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
import { parseMilestoneMetadata } from "../lib/planning-parser.js";
import { updateIssueBody, postComment } from "../lib/github.js";
import { stripCcrLogs, extractErrorMessage } from "../lib/output-cleaner.js";
import { pushBranchAndTags } from "../git/git.js";

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
    const basePath = `output-${Date.now()}`;
    const { command, stdoutPath, stderrPath } = formatCcrCommandWithOutput(
      "/gsd:new-milestone",
      basePath,
      prompt, // Pass issue content as prompt
      null, // No skill override
    );

    core.info(`Executing: ${command}`);
    core.info(`Debug logs: ${stderrPath}`);

    // Step 3: Execute command with 10 minute timeout (same as phase planner)
    let exitCode = 0;
    try {
      await execAsync(command, { timeout: 600000 });
    } catch (error) {
      exitCode = error.code || 1;
      core.warning(`Command exited with code ${exitCode}`);
    }

    // Step 4: Read captured output files
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

    // Step 5: Validate for errors
    const isError =
      exitCode !== 0 ||
      /Permission Denied|Authorization failed|not authorized/i.test(output) ||
      /Error:|Something went wrong|failed/i.test(output) ||
      /Unknown command|invalid arguments|validation failed/i.test(output);

    if (isError) {
      const errorMsg = extractErrorMessage(output, stderrOutput, ccrLogOutput);
      throw new Error(`Label trigger failed: ${errorMsg}`);
    }

    // Keep output file for artifact upload (don't delete)

    // Step 6: Commit and push changes to remote (agent creates files but may not commit)
    core.info("Committing and pushing milestone changes...");
    try {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execPromise = promisify(exec);

      // Check for changes
      const { stdout: status } = await execPromise("git status --porcelain");
      if (status.trim()) {
        core.info(`Found changes to commit:\n${status}`);
        await execPromise("git add -A");
        await execPromise('git commit -m "chore: milestone created by GSD bot"');
        core.info("Changes committed");
      } else {
        core.info("No changes to commit");
      }

      await pushBranchAndTags();
      core.info("Changes pushed successfully");
    } catch (pushError) {
      core.warning(`Commit/push failed: ${pushError.message}`);
    }

    // Step 7: Post agent output as comment
    const cleanOutput = stripCcrLogs(output);
    try {
      await postComment(owner, repo, issueNumber, cleanOutput);
      core.info("Agent output posted as comment");
    } catch (commentError) {
      core.warning(`Failed to post agent output: ${commentError.message}`);
    }

    core.info(`Label trigger workflow complete`);

    // Step 8: Parse milestone metadata from generated files (optional enhancement)
    let metadata;
    try {
      metadata = await parseMilestoneMetadata();
    } catch (parseError) {
      core.warning(
        `Failed to parse milestone metadata: ${parseError.message}`,
      );
      return { complete: true, phase: "gsd-complete-no-metadata" };
    }

    if (!metadata || !metadata.title) {
      core.warning(
        "Could not parse milestone metadata, skipping issue update",
      );
      return { complete: true, phase: "gsd-complete-no-metadata" };
    }

    // Step 9: Format milestone info section (enhancement - update issue body)
    const phaseList =
      metadata.phases.length > 0
        ? metadata.phases
            .map((p) => `- [ ] Phase ${p.number}: ${p.name} (${p.status})`)
            .join("\n")
        : "- No phases defined yet";

    const milestoneSection = `

---

## Milestone Created: ${metadata.title} ${metadata.version}

${metadata.coreValue ? `**Core Value:** ${metadata.coreValue}` : ""}

### Phases

${phaseList}

---
*Created by GSD Bot via "good first issue" label*
`;

    // Step 10: Update issue body (append milestone info to original)
    const originalBody = issueBody || "";
    const updatedBody = originalBody + milestoneSection;

    try {
      await updateIssueBody(owner, repo, issueNumber, updatedBody);
      core.info(`Updated issue #${issueNumber} with milestone info`);
    } catch (updateError) {
      core.error(`Failed to update issue body: ${updateError.message}`);
      // Don't fail workflow - core work (GSD) is done
    }

    // Step 11: Post follow-up comment with next steps
    try {
      await postComment(
        owner,
        repo,
        issueNumber,
        `## Next Steps

**${metadata.title}** (${metadata.version}) - ${metadata.phases.length} phase(s) defined.

- Use \`@gsd-bot plan-phase N\` to plan each phase
- Use \`@gsd-bot execute-phase N\` to implement`,
      );
      core.info("Next steps comment posted");
    } catch (commentError) {
      core.error(`Failed to post next steps comment: ${commentError.message}`);
      // Don't fail workflow - core work is done
    }

    return {
      complete: true,
      phase: "milestone-created",
      title: metadata.title,
      version: metadata.version,
      phaseCount: metadata.phases.length,
    };
  } catch (error) {
    core.error(`Label trigger workflow error: ${error.message}`);
    throw error;
  }
}
