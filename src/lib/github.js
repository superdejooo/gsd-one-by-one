import * as core from "@actions/core";
import * as github from "@actions/github";
import { throttling } from "@octokit/plugin-throttling";

// Create throttled octokit instance
const ThrottledOctokit = github.GitHub.plugin(throttling);

const octokit = new ThrottledOctokit({
  auth: core.getInput("token") || process.env.GITHUB_TOKEN,
  throttle: {
    onRateLimit: (retryAfter, options, octokit, retryCount) => {
      octokit.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`
      );
      if (retryCount < 1) {
        octokit.log.info(`Retrying after ${retryAfter} seconds!`);
        return true; // Retry once
      }
    },
    onSecondaryRateLimit: (retryAfter, options, octokit) => {
      octokit.log.warn(
        `SecondaryRateLimit detected for request ${options.method} ${options.url}`
      );
      // Don't automatically retry secondary limits (user intervention needed)
    },
  },
});

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
