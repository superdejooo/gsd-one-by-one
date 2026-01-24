/**
 * Milestone Completion Workflow Module
 *
 * Executes GSD's built-in complete-milestone command via CCR (Claude Code Router)
 * to archive a completed milestone and prepare for the next version.
 */

import * as core from "@actions/core";
import { exec } from "node:child_process";
import { promisify } from "util";
import fs from "fs/promises";
import { postComment } from "../lib/github.js";
import { formatCcrCommandWithOutput } from "../llm/ccr-command.js";
import { pushBranchAndTags } from "../git/git.js";
import { stripCcrLogs, extractErrorMessage } from "../lib/output-cleaner.js";

const execAsync = promisify(exec);

/**
 * Extract GSD formatted block from output
 * @param {string} output - Raw output (already stripped of CCR logs)
 * @returns {string} GSD block or last 80 lines
 */
function extractGsdBlock(output) {
  const lines = output.split("\n");

  let gsdLineIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes("GSD ►")) {
      gsdLineIndex = i;
      break;
    }
  }

  if (gsdLineIndex !== -1) {
    const startIndex = Math.max(0, gsdLineIndex - 1);
    return lines.slice(startIndex).join("\n");
  }

  const tail = lines.slice(-80);
  return tail.join("\n");
}

/**
 * Execute the complete milestone workflow
 *
 * This orchestrator handles:
 * 1. Execute GSD complete-milestone command via CCR
 * 2. Capture output from command execution
 * 3. Validate output for errors
 * 4. Post formatted result to GitHub issue
 *
 * @param {object} context - GitHub action context
 * @param {string} context.owner - Repository owner
 * @param {string} context.repo - Repository name
 * @param {number} context.issueNumber - Issue number for comments
 * @returns {Promise<object>} Workflow result
 * @throws {Error} If workflow cannot complete
 */
export async function executeMilestoneCompletionWorkflow(
  context,
  skill = null,
) {
  const { owner, repo, issueNumber } = context;

  core.info(
    `Starting milestone completion workflow for ${owner}/${repo}#${issueNumber}`,
  );
  if (skill) core.info(`Using skill: ${skill}`);

  try {
    // Execute GSD complete-milestone via CCR
    // 10 minute timeout - completion is mostly archiving work
    const basePath = `output-${Date.now()}`;
    const { command, stdoutPath, stderrPath } = formatCcrCommandWithOutput(
      "/gsd:complete-milestone",
      basePath,
      null,
      skill,
    );

    core.info(`Executing: ${command}`);
    core.info(`Debug logs: ${stderrPath}`);

    let exitCode = 0;
    try {
      await execAsync(command, { timeout: 600000 }); // 10 min timeout
    } catch (error) {
      exitCode = error.code || 1;
      core.warning(`Command exited with code ${exitCode}`);
    }

    // Read captured output files
    let output = "";
    let stderrOutput = "";
    let ccrLogOutput = "";
    try {
      output = await fs.readFile(stdoutPath, "utf-8");
      core.info(
        `CCR output (${output.length} chars): ${output.substring(0, 500)}`,
      );
    } catch (error) {
      output = "(No output captured)";
      core.warning(`Failed to read output file: ${error.message}`);
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

    // Validate for errors
    const outputWithoutWarnings = output
      .split("\n")
      .filter(
        (line) => !line.includes("⚠️") && !line.includes("Pre-flight check"),
      )
      .join("\n");

    const isError =
      exitCode !== 0 ||
      /Permission Denied|Authorization failed|not authorized/i.test(
        outputWithoutWarnings,
      ) ||
      /^Error:|Something went wrong|command failed/i.test(
        outputWithoutWarnings,
      ) ||
      /Unknown command|invalid arguments|validation failed/i.test(
        outputWithoutWarnings,
      );

    if (isError) {
      const errorMsg = extractErrorMessage(output, stderrOutput, ccrLogOutput);
      throw new Error(`Milestone completion failed: ${errorMsg}`);
    }

    // Format output for comment
    const cleanOutput = stripCcrLogs(output);
    const gsdBlock = extractGsdBlock(cleanOutput);

    // Push commit and tags to remote
    core.info("Pushing milestone commit and tags to remote...");
    await pushBranchAndTags();

    const formattedComment = `## Milestone Completion\n\n\`\`\`\n${gsdBlock}\n\`\`\``;

    await postComment(owner, repo, issueNumber, formattedComment);

    // Keep output file for artifact upload (don't delete)

    core.info(`Milestone completion workflow complete`);

    return {
      complete: true,
      message: "Milestone archived and completion workflow finished",
    };
  } catch (error) {
    core.error(`Milestone completion workflow error: ${error.message}`);
    throw error;
  }
}
