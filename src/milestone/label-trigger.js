/**
 * Label Trigger Workflow Module
 *
 * Executes GSD's new-milestone command when "good first issue" label is added.
 * Joins issue title and body as prompt for milestone creation.
 */

import * as core from "@actions/core";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import { formatCcrCommandWithOutput } from "../llm/ccr-command.js";

const execAsync = promisify(exec);

/**
 * Execute the label trigger workflow
 *
 * This orchestrator handles:
 * 1. Join issue title and body with --- separator
 * 2. Execute GSD new-milestone command via CCR with issue content as prompt
 * 3. Capture output from command execution
 * 4. Validate output for errors
 * 5. Return result (note: posting comment will happen in future plans)
 *
 * @param {object} context - GitHub action context
 * @param {string} context.owner - Repository owner
 * @param {string} context.repo - Repository name
 * @param {number} context.issueNumber - Issue number for reference
 * @param {string} context.issueTitle - Issue title
 * @param {string} context.issueBody - Issue body
 * @returns {Promise<object>} Workflow result
 * @throws {Error} If workflow cannot complete
 */
export async function executeLabelTriggerWorkflow(context) {
  const { owner, repo, issueNumber, issueTitle, issueBody } = context;

  core.info(
    `Starting label trigger workflow for ${owner}/${repo}#${issueNumber}`,
  );
  core.info(`Issue title: ${issueTitle}`);

  try {
    // Step 1: Join title and body with --- separator
    const prompt = `${issueTitle}\n---\n${issueBody || ""}`;
    core.info(`Formatted prompt (${prompt.length} chars)`);

    // Step 2: Execute GSD new-milestone via CCR with prompt
    const outputPath = `output-${Date.now()}.txt`;
    const command = formatCcrCommandWithOutput(
      "/gsd:new-milestone",
      outputPath,
      prompt, // Pass issue content as prompt
      null, // No skill override
    );

    core.info(`Executing: ${command}`);

    // Step 3: Execute command with 10 minute timeout (same as phase planner)
    let exitCode = 0;
    try {
      await execAsync(command, { timeout: 600000 });
    } catch (error) {
      exitCode = error.code || 1;
      core.warning(`Command exited with code ${exitCode}`);
    }

    // Step 4: Read captured output
    let output = "";
    try {
      output = await fs.readFile(outputPath, "utf-8");
    } catch (error) {
      output = "(No output captured)";
    }

    // Step 5: Validate for errors
    const isError =
      exitCode !== 0 ||
      /Permission Denied|Authorization failed|not authorized/i.test(output) ||
      /Error:|Something went wrong|failed/i.test(output) ||
      /Unknown command|invalid arguments|validation failed/i.test(output);

    if (isError) {
      throw new Error(`Label trigger failed: ${output.substring(0, 500)}`);
    }

    // Cleanup output file
    try {
      await fs.unlink(outputPath);
    } catch (e) {
      core.warning(`Failed to cleanup output file: ${e.message}`);
    }

    core.info(`Label trigger workflow complete`);

    return {
      complete: true,
      output,
      message: "Label trigger completed successfully",
    };
  } catch (error) {
    core.error(`Label trigger workflow error: ${error.message}`);
    throw error;
  }
}
