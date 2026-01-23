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
