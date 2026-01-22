import * as core from "@actions/core";
import { octokit } from "./github.js";

/**
 * Status labels for issue tracking
 * These labels drive GitHub Project board automations
 */
export const STATUS_LABELS = [
  { name: 'status:pending', color: 'd4c5f9', description: 'Task is queued, not yet started' },
  { name: 'status:in-progress', color: 'fbca04', description: 'Task is actively being worked on' },
  { name: 'status:complete', color: '0e8a16', description: 'Task is finished' },
  { name: 'status:blocked', color: 'd93f0b', description: 'Task cannot proceed' }
];

/**
 * Ensure labels exist in repository, creating them if missing
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Array<{name: string, color: string, description: string}>} labels - Labels to create
 */
export async function ensureLabelsExist(owner, repo, labels) {
  // Fetch existing labels
  const existingLabels = await octokit.rest.issues.listLabelsForRepo({
    owner,
    repo,
    per_page: 100
  });

  const existingNames = new Set(existingLabels.data.map(l => l.name));

  // Create missing labels
  for (const label of labels) {
    if (!existingNames.has(label.name)) {
      try {
        await octokit.rest.issues.createLabel({
          owner,
          repo,
          name: label.name,
          color: label.color,
          description: label.description
        });
        core.info(`Created label: ${label.name}`);
      } catch (error) {
        // Handle 422 error gracefully (label already exists due to race condition)
        if (error.status === 422) {
          core.info(`Label already exists: ${label.name}`);
        } else {
          throw error;
        }
      }
    } else {
      core.info(`Label already exists: ${label.name}`);
    }
  }
}

/**
 * Apply labels to an issue
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {string[]} labels - Label names to add
 */
export async function applyLabels(owner, repo, issueNumber, labels) {
  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels
  });
  core.info(`Applied labels to issue #${issueNumber}: ${labels.join(', ')}`);
}

/**
 * Update issue status by atomically replacing status label
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {string} newStatus - New status (pending, in-progress, complete, blocked)
 * @throws {Error} If newStatus is invalid
 */
export async function updateIssueStatus(owner, repo, issueNumber, newStatus) {
  // Validate status
  const validStatuses = ['pending', 'in-progress', 'complete', 'blocked'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Fetch current labels
  const currentLabels = await octokit.rest.issues.listLabelsOnIssue({
    owner,
    repo,
    issue_number: issueNumber
  });

  // Filter out existing status labels, keep all others
  const nonStatusLabels = currentLabels.data
    .filter(l => !l.name.startsWith('status:'))
    .map(l => l.name);

  // Replace labels: all non-status labels + new status label
  await octokit.rest.issues.setLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels: [...nonStatusLabels, `status:${newStatus}`]
  });

  core.info(`Updated issue #${issueNumber} status to: status:${newStatus}`);
}
