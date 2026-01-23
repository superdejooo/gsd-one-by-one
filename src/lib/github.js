import * as core from "@actions/core";
import * as github from "@actions/github";
import { getOctokit } from "@actions/github";

const token = core.getInput("token") || process.env.GITHUB_TOKEN || github.context.token;

// Use getOctokit from @actions/github (ESM-compatible)
export const octokit = getOctokit(token);

/**
 * Post a comment to an issue or PR
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue or PR number
 * @param {string} body - Markdown comment body
 */
export async function postComment(owner, repo, issueNumber, body) {
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
  core.info(`Comment posted to issue #${issueNumber}`);
}

/**
 * Get current workflow run URL
 * @returns {string} Full URL to workflow run
 */
export function getWorkflowRunUrl() {
  const { server_url, repository, run_id, run_attempt } = github.context;
  return `${server_url}/${repository}/actions/runs/${run_id}/attempts/${run_attempt}`;
}
