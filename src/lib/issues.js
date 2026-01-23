import * as core from "@actions/core";
import { octokit } from "./github.js";
import { ensureLabelsExist, STATUS_LABELS } from "./labels.js";

/**
 * Extract tasks from PLAN.md content
 * @param {string} planContent - Raw PLAN.md file content
 * @returns {Array<{type: string, name: string, files: string, action: string, verify: string, done: string}>}
 */
export function extractTasksFromPlan(planContent) {
  const tasks = [];

  // Match XML-style task blocks with type, name, files, action, verify, done
  const taskPattern = /<task\s+type="(auto|checkpoint:[^"]+)">\s*<name>([\s\S]*?)<\/name>\s*<files>([\s\S]*?)<\/files>\s*<action>([\s\S]*?)<\/action>\s*<verify>([\s\S]*?)<\/verify>\s*<done>([\s\S]*?)<\/done>\s*<\/task>/g;

  let match;
  while ((match = taskPattern.exec(planContent)) !== null) {
    const taskName = match[2].trim();

    // Remove "Task N:" prefix if present
    const cleanedName = taskName.replace(/^Task\s+\d+:\s*/i, '');

    tasks.push({
      type: match[1].trim(),
      name: cleanedName,
      files: match[3].trim(),
      action: match[4].trim(),
      verify: match[5].trim(),
      done: match[6].trim()
    });
  }

  return tasks;
}

/**
 * Format issue body with task details
 * @param {Object} task - Task object from extractTasksFromPlan
 * @param {number} phaseNumber - Phase number
 * @param {string} phaseName - Phase name
 * @returns {string} Markdown-formatted issue body
 */
export function formatIssueBody(task, phaseNumber, phaseName) {
  let body = `## Task Details

**Phase:** ${phaseNumber} - ${phaseName}
**Files:** ${task.files}
**Type:** ${task.type}

## Action

${task.action}

## Verification

\`\`\`bash
${task.verify}
\`\`\`

## Done Criteria

${task.done}

---
*Created by GSD Phase Planner*`;

  // Truncate if exceeds GitHub's 65536 char limit (use 65000 for safety)
  if (body.length > 65000) {
    body = body.substring(0, 64997) + '...';
  }

  return body;
}

/**
 * Truncate title to max length with ellipsis
 * @param {string} title - Title to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated title
 */
function truncateTitle(title, maxLength) {
  if (title.length <= maxLength) {
    return title;
  }
  return title.substring(0, maxLength - 3) + '...';
}

/**
 * Create GitHub issues for tasks
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Array<Object>} tasks - Tasks from extractTasksFromPlan
 * @param {number} phaseNumber - Phase number
 * @param {string} phaseName - Phase name
 * @returns {Promise<Array<{number: number, url: string, taskName: string}>>}
 */
export async function createIssuesForTasks(owner, repo, tasks, phaseNumber, phaseName) {
  // Ensure phase label exists
  const phaseLabel = {
    name: `phase-${phaseNumber}`,
    color: '1d76db',  // Blue
    description: `Phase ${phaseNumber} tasks`
  };

  // Ensure all labels exist (phase label + status labels)
  await ensureLabelsExist(owner, repo, [phaseLabel, ...STATUS_LABELS]);

  const createdIssues = [];

  // Create issues sequentially (throttling plugin handles rate limiting)
  for (const task of tasks) {
    try {
      const cleanTaskName = task.name.replace(/^Task\s+\d+:\s*/i, '');
      const issueTitle = truncateTitle(`${String(phaseNumber).padStart(2, '0')}: ${cleanTaskName}`, 240);

      const issue = await octokit.rest.issues.create({
        owner,
        repo,
        title: issueTitle,
        body: formatIssueBody(task, phaseNumber, phaseName),
        labels: ['status:pending', `phase-${phaseNumber}`]
      });

      core.info(`Created issue #${issue.data.number}: ${cleanTaskName}`);
      createdIssues.push({
        number: issue.data.number,
        url: issue.data.html_url,
        taskName: cleanTaskName
      });
    } catch (error) {
      core.warning(`Failed to create issue for "${task.name}": ${error.message}`);
      // Continue creating other issues
    }
  }

  return createdIssues;
}

/**
 * Get all issues for a phase
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} phaseNumber - Phase number
 * @returns {Promise<Array<{number: number, title: string, status: string, url: string}>>}
 */
export async function getPhaseIssues(owner, repo, phaseNumber) {
  const { data: issues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    labels: `phase-${phaseNumber}`,
    state: 'all',
    per_page: 100
  });

  return issues.map(issue => {
    // Extract status from status: label
    const statusLabel = issue.labels.find(l => l.name.startsWith('status:'));
    const status = statusLabel ? statusLabel.name : 'unknown';

    return {
      number: issue.number,
      title: issue.title,
      status,
      url: issue.html_url
    };
  });
}
