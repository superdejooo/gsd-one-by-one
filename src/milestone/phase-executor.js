/**
 * Phase Execution Workflow Module
 *
 * Executes GSD's built-in execute-plan command via CCR (Claude Code Router)
 * with enhanced output parsing for structured GitHub comments.
 *
 * Key differences from phase-planner.js:
 * - 30-minute timeout (execution takes longer than planning)
 * - Parses output to extract completed actions, next steps, questions
 * - Posts structured comment instead of raw pass-through
 * - Returns hasQuestions flag for conversational continuation
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import { exec } from "node:child_process";
import { promisify } from "util";
import fs from "fs/promises";
import { postComment, getWorkflowRunUrl } from "../lib/github.js";
import { formatErrorComment } from "../errors/formatter.js";
import { getPhaseIssues } from "../lib/issues.js";
import { updateIssueStatus } from "../lib/labels.js";

const execAsync = promisify(exec);

/**
 * Find issue that matches a task name
 * @param {string} taskName - Task name from execution output
 * @param {Array<{number: number, title: string}>} issues - Phase issues
 * @returns {object|null} Matching issue or null
 */
function matchTaskToIssue(taskName, issues) {
  // Normalize for comparison: lowercase, remove "Task N:" prefix
  const normalizedTask = taskName
    .toLowerCase()
    .replace(/^task\s*\d+:\s*/i, '')
    .trim();

  return issues.find(issue => {
    // Issue title format: "09: Task Name"
    const issueTaskName = issue.title
      .replace(/^\d+:\s*/, '')  // Remove "09: " prefix
      .toLowerCase()
      .replace(/^task\s*\d+:\s*/i, '')  // Remove any "Task N:" in title
      .trim();

    // Check for substring match (task name contained in issue title or vice versa)
    return issueTaskName.includes(normalizedTask) ||
           normalizedTask.includes(issueTaskName);
  });
}

/**
 * Update issues to complete status for completed tasks
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string[]} completedActions - List of completed task names
 * @param {Array<{number: number, title: string, status: string}>} issues - Phase issues
 * @returns {Promise<number>} Number of issues updated
 */
async function updateIssuesForCompletedTasks(owner, repo, completedActions, issues) {
  let updatedCount = 0;

  for (const taskName of completedActions) {
    const matchingIssue = matchTaskToIssue(taskName, issues);

    if (matchingIssue && matchingIssue.status !== 'status:complete') {
      try {
        await updateIssueStatus(owner, repo, matchingIssue.number, 'complete');
        updatedCount++;
        core.info(`Marked issue #${matchingIssue.number} as complete`);
      } catch (error) {
        core.warning(`Failed to update issue #${matchingIssue.number}: ${error.message}`);
      }
    }
  }

  return updatedCount;
}

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

  throw new Error("Could not parse phase number from arguments. Use '--phase N', '-p N', or provide the number directly.");
}

/**
 * Parse GSD execution output to extract structured sections
 * @param {string} output - Raw GSD output
 * @returns {object} Parsed sections
 */
function parseExecutionOutput(output) {
  const sections = {
    completedActions: [],
    nextSteps: [],
    questions: [],
    hasQuestions: false
  };

  // Extract completed actions (checkmarks, "completed", task markers)
  const completedPattern = /(?:[*-]\s*)?(?:\[x\]|completed?:?|done:?)\s*(.+)/gi;
  let match;
  while ((match = completedPattern.exec(output)) !== null) {
    sections.completedActions.push(match[1].trim());
  }

  // Extract next steps section
  const nextStepsMatch = output.match(/(?:##?\s*)?next steps?:?\s*\n((?:[-*]\s*.+\n?)+)/i);
  if (nextStepsMatch) {
    sections.nextSteps = nextStepsMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  // Extract questions (agent asking for input)
  const questionsMatch = output.match(/(?:##?\s*)?questions?:?\s*\n((?:[-*]\s*.+\n?)+)/i);
  if (questionsMatch) {
    sections.questions = questionsMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 0);
    sections.hasQuestions = sections.questions.length > 0;
  }

  return sections;
}

/**
 * Format parsed output into structured GitHub comment
 * @param {object} parsed - Parsed sections from parseExecutionOutput
 * @param {string} rawOutput - Original raw output for details section
 * @returns {string} Formatted markdown comment
 */
function formatExecutionComment(parsed, rawOutput) {
  let comment = `## Phase Execution Update\n\n`;

  if (parsed.completedActions.length > 0) {
    comment += `### Completed\n\n`;
    parsed.completedActions.forEach(action => {
      comment += `- [x] ${action}\n`;
    });
    comment += `\n`;
  }

  if (parsed.nextSteps.length > 0) {
    comment += `### Next Steps\n\n`;
    parsed.nextSteps.forEach(step => {
      comment += `- ${step}\n`;
    });
    comment += `\n`;
  }

  if (parsed.questions.length > 0) {
    comment += `### Questions\n\n`;
    parsed.questions.forEach(question => {
      comment += `- ${question}\n`;
    });
    comment += `\n**Reply to this comment to answer these questions. The workflow will resume when you reply.**\n\n`;
  }

  // Include raw output in collapsible section
  comment += `<details>\n<summary>Full Output</summary>\n\n\`\`\`\n${rawOutput}\n\`\`\`\n\n</details>`;

  return comment;
}

/**
 * Execute the complete phase execution workflow
 *
 * This orchestrator handles:
 * 1. Parse phase number from command arguments
 * 2. Execute GSD execute-plan command via CCR
 * 3. Capture output from command execution
 * 4. Validate output for errors
 * 5. Parse output for structured sections
 * 6. Post formatted result to GitHub issue
 *
 * @param {object} context - GitHub action context
 * @param {string} context.owner - Repository owner
 * @param {string} context.repo - Repository name
 * @param {number} context.issueNumber - Issue number for comments
 * @param {string} commandArgs - Command arguments string
 * @returns {Promise<object>} Workflow result
 * @throws {Error} If workflow cannot complete
 */
export async function executePhaseExecutionWorkflow(context, commandArgs) {
  const { owner, repo, issueNumber } = context;
  const workflowUrl = getWorkflowRunUrl();

  core.info(`Starting phase execution workflow for ${owner}/${repo}#${issueNumber}`);

  try {
    // Step 1: Parse phase number
    const phaseNumber = parsePhaseNumber(commandArgs);
    core.info(`Parsed phase number: ${phaseNumber}`);

    // Step 2: Execute GSD execute-plan via CCR
    // 30 minute timeout - execution takes longer than planning
    const outputPath = `output-${Date.now()}.txt`;
    const command = `echo "/gsd:execute-plan ${phaseNumber}" | ccr code --print > ${outputPath}`;

    core.info(`Executing: ${command}`);

    let exitCode = 0;
    try {
      await execAsync(command, { timeout: 1800000 }); // 30 min timeout
    } catch (error) {
      exitCode = error.code || 1;
      core.warning(`Command exited with code ${exitCode}`);
    }

    // Step 3: Read captured output
    let output = "";
    try {
      output = await fs.readFile(outputPath, "utf-8");
    } catch (error) {
      output = "(No output captured)";
    }

    // Step 4: Validate for errors
    const isError = exitCode !== 0 ||
      /Permission Denied|Authorization failed|not authorized/i.test(output) ||
      /Error:|Something went wrong|failed/i.test(output) ||
      /Unknown command|invalid arguments|validation failed/i.test(output);

    // Step 5: Post result to GitHub
    if (isError) {
      const errorMsg = formatErrorComment(new Error(output.trim()), workflowUrl);
      await postComment(owner, repo, issueNumber, errorMsg);
      throw new Error(`Phase execution failed: ${output.substring(0, 500)}`);
    }

    // Step 6: Parse and format structured output
    const parsed = parseExecutionOutput(output);
    const formattedComment = formatExecutionComment(parsed, output);

    // Step 7: Update issue status for completed tasks
    let issuesUpdated = 0;
    try {
      const phaseIssues = await getPhaseIssues(owner, repo, phaseNumber);

      if (phaseIssues.length > 0 && parsed.completedActions.length > 0) {
        // Mark all phase issues as in-progress at start (if still pending)
        for (const issue of phaseIssues) {
          if (issue.status === 'status:pending') {
            try {
              await updateIssueStatus(owner, repo, issue.number, 'in-progress');
              core.info(`Marked issue #${issue.number} as in-progress`);
            } catch (error) {
              core.warning(`Failed to update issue #${issue.number}: ${error.message}`);
            }
          }
        }

        // Mark completed tasks
        issuesUpdated = await updateIssuesForCompletedTasks(
          owner, repo, parsed.completedActions, phaseIssues
        );
      }
    } catch (issueError) {
      core.warning(`Issue status update failed: ${issueError.message}`);
      // Don't fail the workflow - execution succeeded, status updates are supplementary
    }

    await postComment(owner, repo, issueNumber, formattedComment);

    // Cleanup output file
    try {
      await fs.unlink(outputPath);
    } catch (e) {
      core.warning(`Failed to cleanup output file: ${e.message}`);
    }

    core.info(`Phase ${phaseNumber} execution workflow complete`);

    return {
      complete: !parsed.hasQuestions,
      phaseNumber,
      hasQuestions: parsed.hasQuestions,
      completedCount: parsed.completedActions.length,
      issuesUpdated,
      message: parsed.hasQuestions
        ? "Phase execution paused - questions require user input"
        : "Phase execution completed successfully"
    };

  } catch (error) {
    core.error(`Phase execution workflow error: ${error.message}`);
    const errorComment = formatErrorComment(error, workflowUrl);
    await postComment(owner, repo, issueNumber, errorComment);
    throw error;
  }
}
