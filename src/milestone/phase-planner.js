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
import { postComment, getWorkflowRunUrl } from "../lib/github.js";
import { formatErrorComment } from "../errors/formatter.js";

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

  throw new Error("Could not parse phase number from arguments. Use '--phase N', '-p N', or provide the number directly.");
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
export async function executePhaseWorkflow(context, commandArgs) {
  const { owner, repo, issueNumber } = context;
  const workflowUrl = getWorkflowRunUrl();

  core.info(`Starting phase planning workflow for ${owner}/${repo}#${issueNumber}`);

  try {
    // Step 1: Parse phase number from arguments
    const phaseNumber = parsePhaseNumber(commandArgs);
    core.info(`Parsed phase number: ${phaseNumber}`);

    // Step 2: Execute GSD plan-phase command via CCR
    const outputPath = `output-${Date.now()}.txt`;
    const command = `echo "/gsd:plan-phase ${phaseNumber}" | npx ccr code --print > ${outputPath}`;

    core.info(`Executing: ${command}`);

    let exitCode = 0;
    try {
      await execAsync(command, { timeout: 600000 }); // 10 minute timeout
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
      throw new Error(`Phase planning failed: ${output.substring(0, 500)}`);
    }

    // Post success - pass through GSD output
    await postComment(owner, repo, issueNumber, output);

    // Cleanup output file
    try {
      await fs.unlink(outputPath);
    } catch (e) {
      core.warning(`Failed to cleanup output file: ${e.message}`);
    }

    core.info(`Phase ${phaseNumber} planning workflow complete`);

    return {
      complete: true,
      phaseNumber,
      message: "Phase planning completed successfully"
    };

  } catch (error) {
    core.error(`Phase planning workflow error: ${error.message}`);

    // Post error comment
    const errorComment = formatErrorComment(error, workflowUrl);
    await postComment(owner, repo, issueNumber, errorComment);

    throw error;
  }
}
