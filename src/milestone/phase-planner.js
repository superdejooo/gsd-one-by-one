/**
 * Phase Planning Workflow Module
 *
 * Executes GSD's built-in plan-phase command via CCR (Claude Code Router)
 * and captures output for GitHub commenting.
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { postComment } from "../lib/github.js";
import { extractTasksFromPlan, createIssuesForTasks } from "../lib/issues.js";
import { formatCcrCommandWithOutput } from "../llm/ccr-command.js";
import { pushBranchAndTags } from "../git/git.js";
import { stripCcrLogs, extractErrorMessage } from "../lib/output-cleaner.js";

const execAsync = promisify(exec);

/**
 * Parse phase number from command arguments
 * Supports formats:
 * - "7" (just the number)
 * - "--phase 7"
 * - "--phase=7"
 * - "-p 7"
 * - "-p=7"
 *
 * @param {string} commandArgs - Command arguments string
 * @returns {number} Parsed phase number
 * @throws {Error} If phase number cannot be parsed
 */
export function parsePhaseNumber(commandArgs) {
  if (!commandArgs) {
    throw new Error("Phase number is required");
  }

  // Try to extract from --phase flag
  const phaseFlagMatch = commandArgs.match(/--phase[=\s]+(\d+)/);
  if (phaseFlagMatch) {
    return parseInt(phaseFlagMatch[1], 10);
  }

  // Try to extract from -p flag
  const pFlagMatch = commandArgs.match(/-p[=\s]+(\d+)/);
  if (pFlagMatch) {
    return parseInt(pFlagMatch[1], 10);
  }

  // Try to extract standalone number at the end
  const standaloneMatch = commandArgs.match(/(\d+)$/);
  if (standaloneMatch) {
    return parseInt(standaloneMatch[1], 10);
  }

  throw new Error(
    "Could not parse phase number from arguments. Use '--phase N', '-p N', or provide the number directly.",
  );
}

/**
 * Find all PLAN.md files for a phase
 * @param {number} phaseNumber - Phase number
 * @returns {Promise<Array<{path: string, filename: string, phaseDir: string}>>}
 */
async function findPlanFiles(phaseNumber) {
  const paddedPhase = String(phaseNumber).padStart(2, "0");
  const phasesDir = ".planning/phases";

  // Find phase directory (handles 01-name and 1-name patterns)
  const dirs = await fs.readdir(phasesDir);
  const phaseDir = dirs.find(
    (d) => d.startsWith(`${paddedPhase}-`) || d.startsWith(`${phaseNumber}-`),
  );

  if (!phaseDir) {
    core.warning(`Phase directory not found for phase ${phaseNumber}`);
    return [];
  }

  // Find all PLAN.md files
  const files = await fs.readdir(path.join(phasesDir, phaseDir));
  const planFiles = files.filter((f) => f.endsWith("-PLAN.md"));

  return planFiles.map((filename) => ({
    path: path.join(phasesDir, phaseDir, filename),
    filename,
    phaseDir,
  }));
}

/**
 * Extract human-readable phase name from directory
 * @param {string} phaseDir - e.g., "09-issue-tracking-integration"
 * @returns {string} - e.g., "Issue Tracking Integration"
 */
function extractPhaseName(phaseDir) {
  const parts = phaseDir.split("-");
  parts.shift(); // Remove number prefix
  return parts
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Execute the complete phase planning workflow
 *
 * This orchestrator handles:
 * 1. Parse phase number from command arguments
 * 2. Execute GSD plan-phase command via CCR
 * 3. Capture output from command execution
 * 4. Validate output for errors
 * 5. Post result to GitHub issue
 *
 * @param {object} context - GitHub action context
 * @param {string} context.owner - Repository owner
 * @param {string} context.repo - Repository name
 * @param {number} context.issueNumber - Issue number for comments
 * @param {string} commandArgs - Command arguments string
 * @returns {Promise<object>} Workflow result
 * @throws {Error} If workflow cannot complete
 */
export async function executePhaseWorkflow(context, commandArgs, skill = null) {
  const { owner, repo, issueNumber } = context;

  core.info(
    `Starting phase planning workflow for ${owner}/${repo}#${issueNumber}`,
  );
  if (skill) core.info(`Using skill: ${skill}`);

  try {
    // Step 1: Parse phase number from arguments
    const phaseNumber = parsePhaseNumber(commandArgs);
    core.info(`Parsed phase number: ${phaseNumber}`);

    // Step 2: Execute GSD plan-phase command via CCR
    const basePath = `output-${Date.now()}`;
    const { command, stdoutPath, stderrPath } = formatCcrCommandWithOutput(
      `/gsd:plan-phase ${phaseNumber}`,
      basePath,
      null,
      skill,
    );

    core.info(`Executing: ${command}`);
    core.info(`Debug logs: ${stderrPath}`);

    let exitCode = 0;
    try {
      await execAsync(command, { timeout: 600000 }); // 10 minute timeout
    } catch (error) {
      exitCode = error.code || 1;
      core.warning(`Command exited with code ${exitCode}`);
    }

    // Step 3: Read captured output files
    let output = "";
    let stderrOutput = "";
    let ccrLogOutput = "";
    try {
      output = await fs.readFile(stdoutPath, "utf-8");
    } catch (error) {
      output = "(No output captured)";
    }
    try {
      stderrOutput = await fs.readFile(stderrPath, "utf-8");
    } catch (error) {
      // Debug file may not exist, that's ok
    }
    try {
      ccrLogOutput = await fs.readFile("ccr.log", "utf-8");
    } catch (error) {
      // CCR log may not exist, that's ok
    }

    // Step 4: Validate for errors
    const isError =
      exitCode !== 0 ||
      /Permission Denied|Authorization failed|not authorized/i.test(output) ||
      /Error:|Something went wrong|failed/i.test(output) ||
      /Unknown command|invalid arguments|validation failed/i.test(output);

    // Step 5: Check for errors (withErrorHandling will post the comment)
    if (isError) {
      const errorMsg = extractErrorMessage(output, stderrOutput, ccrLogOutput);
      throw new Error(`Phase planning failed: ${errorMsg}`);
    }

    // Post success - pass through GSD output
    await postComment(owner, repo, issueNumber, stripCcrLogs(output));

    // Step 6: Create GitHub issues for tasks
    let createdIssues = [];
    try {
      const planFiles = await findPlanFiles(phaseNumber);

      if (planFiles.length === 0) {
        core.warning("No PLAN.md files found, skipping issue creation");
      } else {
        const phaseName = extractPhaseName(planFiles[0].phaseDir);

        for (const planFile of planFiles) {
          core.info(`Processing ${planFile.filename}`);
          const planContent = await fs.readFile(planFile.path, "utf-8");
          const tasks = extractTasksFromPlan(planContent);

          if (tasks.length > 0) {
            const issues = await createIssuesForTasks(
              owner,
              repo,
              tasks,
              phaseNumber,
              phaseName,
            );
            createdIssues.push(...issues);
          }
        }

        // Post follow-up comment with issue links
        if (createdIssues.length > 0) {
          const issueList = createdIssues
            .map((i) => `- [ ] #${i.number} - ${i.taskName}`)
            .join("\n");

          await postComment(
            owner,
            repo,
            issueNumber,
            `## Issues Created\n\n${issueList}\n\n*Track progress by checking off completed issues.*`,
          );
        }
      }
    } catch (issueError) {
      core.warning(`Issue creation failed: ${issueError.message}`);
      // Don't fail the workflow - planning succeeded, issues are supplementary
    }

    // Push changes to remote
    core.info("Pushing planning changes to remote...");
    try {
      await pushBranchAndTags();
    } catch (pushError) {
      core.warning(`Push failed (changes are committed locally): ${pushError.message}`);
    }

    // Keep output file for artifact upload (don't delete)

    core.info(`Phase ${phaseNumber} planning workflow complete`);

    return {
      complete: true,
      phaseNumber,
      issuesCreated: createdIssues.length,
      message: "Phase planning completed successfully",
    };
  } catch (error) {
    core.error(`Phase planning workflow error: ${error.message}`);
    throw error; // withErrorHandling will post the comment
  }
}
