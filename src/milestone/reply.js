/**
 * Reply Workflow Module
 *
 * Executes free-form text prompts via CCR (Claude Code Router)
 * and captures output for GitHub commenting.
 */

import * as core from "@actions/core";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import { postComment } from "../lib/github.js";
import { formatCcrCommandWithOutput } from "../llm/ccr-command.js";

const execAsync = promisify(exec);

/**
 * Execute the reply workflow
 *
 * This orchestrator handles:
 * 1. Validate text parameter is provided
 * 2. Execute text as prompt via CCR
 * 3. Capture output from command execution
 * 4. Validate output for errors
 * 5. Post result to GitHub issue
 *
 * @param {object} context - GitHub action context
 * @param {string} context.owner - Repository owner
 * @param {string} context.repo - Repository name
 * @param {number} context.issueNumber - Issue number for comments
 * @param {string} commandArgs - The text to send to GSD as prompt
 * @param {string|null} skill - Optional skill parameter
 * @returns {Promise<object>} Workflow result
 * @throws {Error} If workflow cannot complete
 */
export async function executeReplyWorkflow(context, commandArgs, skill = null) {
  const { owner, repo, issueNumber } = context;

  core.info(
    `Starting reply workflow for ${owner}/${repo}#${issueNumber}`,
  );
  if (skill) core.info(`Using skill: ${skill}`);

  try {
    // Step 1: Validate text is provided
    if (!commandArgs || commandArgs.trim().length === 0) {
      throw new Error("Reply text is required");
    }

    core.info(`Reply text: ${commandArgs.substring(0, 100)}...`);

    // Step 2: Execute text as prompt via CCR
    // We don't use /gsd:reply - just send the text directly as a prompt
    const outputPath = `output-${Date.now()}.txt`;
    const command = formatCcrCommandWithOutput(
      "",
      outputPath,
      commandArgs,
      skill,
    );

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
    const isError =
      exitCode !== 0 ||
      /Permission Denied|Authorization failed|not authorized/i.test(output) ||
      /Error:|Something went wrong|failed/i.test(output) ||
      /Unknown command|invalid arguments|validation failed/i.test(output);

    // Step 5: Check for errors (withErrorHandling will post the comment)
    if (isError) {
      throw new Error(`Reply failed: ${output.substring(0, 500)}`);
    }

    // Post success - pass through GSD output
    await postComment(owner, repo, issueNumber, output);

    // Keep output file for artifact upload (don't delete)

    core.info(`Reply workflow complete`);

    return {
      complete: true,
      message: "Reply sent successfully",
    };
  } catch (error) {
    core.error(`Reply workflow error: ${error.message}`);
    throw error; // withErrorHandling will post the comment
  }
}
