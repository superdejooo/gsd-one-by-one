/**
 * Milestone Workflow Orchestrator
 *
 * Ties together all milestone creation modules:
 * - Planning documents (planning-docs.js)
 * - Requirements gathering (requirements.js)
 * - State management (state.js)
 * - Git operations (git/branches.js, git/git.js)
 * - GitHub posting (lib/github.js)
 * - Summary generation (summarizer.js)
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import { postComment, getWorkflowRunUrl } from "../lib/github.js";
import { formatErrorComment } from "../errors/formatter.js";
import { createMilestoneBranch, branchExists } from "../git/branches.js";
import { runGitCommand, configureGitIdentity } from "../git/git.js";
import {
  loadState,
  saveState,
  createInitialState,
  isRequirementsComplete,
  updateRequirementsAnswer,
  initializePendingQuestions,
  updateWorkflowRun,
  markRequirementsComplete,
} from "./state.js";
import { createPlanningDocs } from "./planning-docs.js";
import {
  getNewComments,
  parseUserAnswers,
  formatRequirementsQuestions,
  parseAnswersFromResponse,
  DEFAULT_QUESTIONS,
} from "./requirements.js";
import { generateMilestoneSummary } from "./summarizer.js";
import { findIteration } from "../lib/projects.js";
import { loadConfig } from "../lib/config.js";

/**
 * Parse milestone number from command arguments
 * Supports formats:
 * - "5" (just the number)
 * - "--milestone 5"
 * - "--milestone=5"
 *
 * @param {string} commandArgs - Command arguments string
 * @returns {number} Parsed milestone number
 * @throws {Error} If milestone number cannot be parsed
 */
export function parseMilestoneNumber(commandArgs) {
  if (!commandArgs) {
    throw new Error("Milestone number is required");
  }

  // Try to extract from --milestone flag
  const milestoneFlagMatch = commandArgs.match(/--milestone[=\s]+(\d+)/);
  if (milestoneFlagMatch) {
    return parseInt(milestoneFlagMatch[1], 10);
  }

  // Try to extract from -m flag
  const mFlagMatch = commandArgs.match(/-m[=\s]+(\d+)/);
  if (mFlagMatch) {
    return parseInt(mFlagMatch[1], 10);
  }

  // Try to extract standalone number at the beginning
  const standaloneMatch = commandArgs.match(/^(\d+)/);
  if (standaloneMatch) {
    return parseInt(standaloneMatch[1], 10);
  }

  throw new Error(
    "Could not parse milestone number from arguments. Use '--milestone N' or provide the number directly.",
  );
}

/**
 * Parse milestone description from command arguments
 * The description is everything that's not a --milestone or -m flag
 *
 * @param {string} commandArgs - Command arguments string
 * @returns {string} Parsed description
 * @throws {Error} If description is missing or empty
 */
export function parseMilestoneDescription(commandArgs) {
  if (!commandArgs || commandArgs.trim().length === 0) {
    throw new Error(
      "Milestone description is required. Provide a description of your milestone goals and features.",
    );
  }

  // Remove --milestone or -m flags from the description
  let description = commandArgs;
  description = description.replace(/--milestone[=\s]+\d+/g, "").trim();
  description = description.replace(/-m[=\s]+\d+/g, "").trim();
  // Remove standalone number at the beginning (must be followed by space or end of string)
  description = description.replace(/^\d+(\s+|$)/, "").trim();

  if (description.length === 0) {
    throw new Error(
      "Milestone description is required. Provide a description of your milestone goals and features.",
    );
  }

  return description;
}

/**
 * Validate project iteration exists for milestone
 *
 * @param {string} owner - Repository owner
 * @param {number} milestoneNumber - Milestone number
 * @param {object} config - Configuration object
 * @returns {Promise<object>} Validation result
 */
async function validateProjectIteration(owner, milestoneNumber, config) {
  // Check if project config exists
  const projectNumber = config?.project?.number;
  if (!projectNumber) {
    core.info("No project configured, skipping iteration validation");
    return { validated: false, reason: "no-project-configured" };
  }

  const isOrg = config?.project?.isOrg ?? true;
  const iterationTitle = `v${milestoneNumber}`; // Convention: v1, v2, etc.

  const iteration = await findIteration(
    owner,
    projectNumber,
    iterationTitle,
    isOrg,
  );

  if (iteration) {
    core.info(`Found project iteration: ${iteration.title}`);
    return { validated: true, iteration };
  } else {
    core.warning(
      `Project iteration "${iterationTitle}" not found. Create it manually in GitHub Projects.`,
    );
    return {
      validated: false,
      reason: "iteration-not-found",
      expected: iterationTitle,
      setupGuide: "See docs/project-setup.md for setup instructions",
    };
  }
}

/**
 * Commit planning documents to the milestone branch
 *
 * @param {number} milestoneNumber - Milestone number
 * @param {Array<{path: string, purpose: string}>} files - Files to commit
 * @returns {Promise<void>}
 */
async function commitPlanningDocs(milestoneNumber, files) {
  // Configure git identity for commits
  await configureGitIdentity(
    "github-actions[bot]",
    "41898282+github-actions[bot]@users.noreply.github.com",
  );

  // Create milestone branch if it doesn't exist
  const branchName = `gsd/${milestoneNumber}`;
  const exists = await branchExists(branchName);

  if (!exists) {
    await createMilestoneBranch(milestoneNumber);
  } else {
    // Switch to existing branch
    await runGitCommand(`git switch ${branchName}`);
    core.info(`Switched to existing branch: ${branchName}`);
  }

  // Stage all planning files
  for (const file of files) {
    await runGitCommand(`git add "${file.path}"`);
    core.info(`Staged ${file.path}`);
  }

  // Create commit with planning docs
  const fileNames = files.map((f) => f.path.split("/").pop()).join(", ");
  await runGitCommand(`git commit -m "docs(m${milestoneNumber}): Create initial planning documents

- ${fileNames}

Generated by GSD Bot"`);

  core.info(`Committed ${files.length} planning files to ${branchName}`);
}

/**
 * Execute the complete milestone creation workflow
 *
 * This orchestrator handles the full lifecycle:
 * 1. Load or create state
 * 2. Fetch and parse new user comments
 * 3. Update requirements with new answers
 * 4. If incomplete: post pending questions, save state, return
 * 5. If complete: create planning docs, commit to branch, post summary
 *
 * @param {object} context - GitHub action context
 * @param {string} context.owner - Repository owner
 * @param {string} context.repo - Repository name
 * @param {number} context.issueNumber - Issue number for comments
 * @param {string} commandArgs - Command arguments string
 * @returns {Promise<object>} Workflow result
 * @throws {Error} If workflow cannot complete
 */
export async function executeMilestoneWorkflow(
  context,
  commandArgs,
  skill = null,
) {
  const { owner, repo, issueNumber } = context;
  const workflowUrl = getWorkflowRunUrl();

  core.info(`Starting milestone workflow for ${owner}/${repo}#${issueNumber}`);
  if (skill) core.info(`Using skill: ${skill} (not used in new-milestone yet)`);

  try {
    // Step 1: Parse milestone number from arguments (optional)
    let milestoneNumber;
    try {
      milestoneNumber = parseMilestoneNumber(commandArgs);
      core.info(`Parsed milestone number: ${milestoneNumber}`);
    } catch (e) {
      // No milestone number provided - GSD will determine from ROADMAP.md
      core.info('No milestone number provided, GSD will determine next milestone');
      milestoneNumber = null;
    }

    // Step 2: Parse milestone description from arguments (REQUIRED)
    // If no milestone number, the entire commandArgs is the description
    const description = milestoneNumber
      ? parseMilestoneDescription(commandArgs)
      : commandArgs.trim();

    if (!description || description.length === 0) {
      throw new Error(
        "Milestone description is required. Provide a description of your milestone goals and features.",
      );
    }

    core.info(
      `Parsed milestone description: ${description.substring(0, 100)}...`,
    );

    // Branch A: GSD-managed flow (no milestone number provided)
    if (milestoneNumber === null) {
      core.info("Label trigger flow: GSD will handle all planning operations");

      // GSD reads ROADMAP.md, determines next milestone, creates planning artifacts
      // We just pass the description as a prompt and let GSD handle everything
      core.info("Executing GSD new-milestone with description as prompt");

      // TODO: Execute CCR command with description/prompt
      // For now, return early indicating GSD will handle this
      return {
        complete: true,
        phase: "gsd-managed",
        message: "GSD will determine milestone number and create planning artifacts",
        description,
      };
    }

    // Branch B: Traditional flow (milestone number provided)
    core.info(`Traditional flow: milestone number ${milestoneNumber} provided`);

    // Step 3: Load existing state or create initial state
    let state = await loadState(owner, repo, milestoneNumber);

    // Step 4: Update workflow metadata (run count, last run time)
    updateWorkflowRun(state);

    // Step 5: Skip Q&A gathering - use description directly
    core.info(
      "Using provided description, skipping requirements gathering Q&A",
    );

    // Populate requirements with description
    state.requirements.answered = {
      scope: description,
      features: description,
    };

    // Mark requirements as complete immediately
    markRequirementsComplete(state);
    state.status = "planning";

    // Step 6: Build milestone data for planning documents
    const milestoneData = {
      owner,
      repo,
      milestoneNumber,
      title: state.requirements.answered.scope
        ? `Milestone ${milestoneNumber}: ${state.requirements.answered.scope.substring(0, 50)}`
        : `Milestone ${milestoneNumber}`,
      goal: state.requirements.answered.scope || "To be defined",
      scope: state.requirements.answered.constraints || "To be defined",
      features: state.requirements.answered.features
        ? state.requirements.answered.features
            .split("\n")
            .filter((f) => f.trim())
        : [],
      requirements: {
        complete: true,
        answered: Object.keys(state.requirements.answered),
        pending: [],
      },
      phases: [],
      totalPhases: 6,
      status: "planning",
      createdAt: state.createdAt,
      lastRunAt: state.workflow?.lastRunAt,
      runCount: state.workflow?.runCount || 1,
    };

    // Step 7: Create planning documents
    const files = await createPlanningDocs(milestoneData);
    const fileList = Object.values(files);

    // Step 8: Commit all files to milestone branch
    await commitPlanningDocs(milestoneNumber, fileList);

    // Step 9: Save final state
    await saveState(owner, repo, milestoneNumber, state, milestoneData.phases);

    // Step 10: Generate and post summary comment
    const nextSteps = [
      "Review the planning documents in `.github/planning/milestones/`",
      "Use `@gsd-bot plan-phase` to plan each phase of the milestone",
      "Use `@gsd-bot execute-phase` to execute planned work",
    ];

    // Step 11: Validate project iteration
    const config = await loadConfig(owner, repo);
    const validationResult = await validateProjectIteration(
      owner,
      milestoneNumber,
      config,
    );

    // Append warning to next steps if iteration not found
    if (
      !validationResult.validated &&
      validationResult.reason === "iteration-not-found"
    ) {
      nextSteps.push(
        `⚠️  Create project iteration "${validationResult.expected}" in GitHub Projects for tracking`,
      );
    }

    const summary = generateMilestoneSummary({
      milestoneNumber,
      status: "Planning Documents Created",
      files: fileList,
      requirements: {
        complete: true,
        answered: Object.keys(state.requirements.answered),
        pending: [],
      },
      nextSteps,
    });

    await postComment(owner, repo, issueNumber, summary);

    core.info(`Milestone ${milestoneNumber} workflow complete`);

    return {
      complete: true,
      phase: "milestone-created",
      milestone: milestoneNumber,
      files: fileList.map((f) => f.path),
      branch: `gsd/${milestoneNumber}`,
      projectIteration: validationResult,
      message: "Milestone created successfully with planning documents",
    };
  } catch (error) {
    core.error(`Milestone workflow error: ${error.message}`);

    // Post error comment
    const errorComment = formatErrorComment(error, "milestone creation");
    await postComment(owner, repo, issueNumber, errorComment);

    throw error;
  }
}

/**
 * Generate phases from requirements answers
 * Helper function to transform requirements into phase structure
 *
 * @param {object} answers - User-provided requirements answers
 * @returns {Array} Phase definitions
 */
function generatePhasesFromRequirements(answers) {
  return [
    {
      name: "Foundation Setup",
      goal: "Initial project structure and dependencies",
      status: "pending",
      dependencies: "None",
    },
    {
      name: "Core Implementation",
      goal: "Main feature implementation",
      status: "pending",
      dependencies: "Phase 1",
    },
    {
      name: "Integration",
      goal: "Connect components and verify functionality",
      status: "pending",
      dependencies: "Phase 2",
    },
    {
      name: "Testing & Verification",
      goal: "Testing, bug fixes, and final verification",
      status: "pending",
      dependencies: "Phase 3",
    },
  ];
}
