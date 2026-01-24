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
import { stripCcrLogs } from "../lib/output-cleaner.js";

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

    // Step 4: Read captured output (clean agent output only)
    let output = "";
    try {
      output = await fs.readFile(stdoutPath, "utf-8");
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
      throw new Error(`Label trigger failed: ${stripCcrLogs(output).substring(0, 500)}`);
    }

    // Keep output file for artifact upload (don't delete)

    core.info(`Label trigger workflow complete`);

    // Step 4: Parse milestone metadata from generated files
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

    // Step 5: Format milestone info section
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

    // Step 6: Update issue body (append milestone info to original)
    const originalBody = issueBody || "";
    const updatedBody = originalBody + milestoneSection;

    try {
      await updateIssueBody(owner, repo, issueNumber, updatedBody);
      core.info(`Updated issue #${issueNumber} with milestone info`);
    } catch (updateError) {
      core.error(`Failed to update issue body: ${updateError.message}`);
      // Don't fail workflow - core work (GSD) is done
    }

    // Step 7: Post success comment
    try {
      await postComment(
        owner,
        repo,
        issueNumber,
        `## Milestone Created

**${metadata.title}** (${metadata.version}) has been created from this issue.

${metadata.phases.length} phase(s) defined. See the updated issue body for details.

Next steps:
- Review planning docs in \`.planning/\`
- Use \`@gsd-bot plan-phase N\` to plan each phase
- Use \`@gsd-bot execute-phase N\` to implement`,
      );
      core.info("Success comment posted");
    } catch (commentError) {
      core.error(`Failed to post success comment: ${commentError.message}`);
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
