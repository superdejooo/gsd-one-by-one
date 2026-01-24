import { promisify } from "node:util";
import { exec } from "node:child_process";
import * as core from "@actions/core";

const execAsync = promisify(exec);

/**
 * Execute git command with error handling
 * @param {string} command - Git command to execute
 * @returns {Promise<string>} Command output
 */
export async function runGitCommand(command) {
  core.debug(`Executing: ${command}`);
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      // Git uses stderr for progress/info messages (not just errors)
      // Only log as warning if it looks like an actual warning/error
      const isRealWarning = /warning:|error:|fatal:|failed/i.test(stderr);
      if (isRealWarning) {
        core.warning(`Git: ${stderr.trim()}`);
      } else {
        core.info(`Git: ${stderr.trim()}`);
      }
    }
    return stdout.trim();
  } catch (error) {
    core.error(`Git command failed: ${command}`);
    core.error(`Exit code: ${error.code}`);
    core.error(`Error: ${error.message}`);
    throw error;
  }
}

/**
 * Configure git identity for commits
 * @param {string} name - Git user name
 * @param {string} email - Git user email
 */
export async function configureGitIdentity(name, email) {
  await runGitCommand(`git config set user.name "${name}"`);
  await runGitCommand(`git config set user.email "${email}"`);
  core.info(`Git identity configured: ${name} <${email}>`);
}

/**
 * Create and switch to new branch
 * @param {string} branchName - Name of branch to create
 * @param {string} [startPoint] - Optional start point (commit, branch, tag)
 */
export async function createAndSwitchBranch(branchName, startPoint = null) {
  const command = startPoint
    ? `git switch -c ${branchName} ${startPoint}`
    : `git switch -c ${branchName}`;

  await runGitCommand(command);
  core.info(`Created and switched to branch: ${branchName}`);
}

/**
 * Switch to existing branch
 * @param {string} branchName - Name of branch to switch to
 */
export async function switchBranch(branchName) {
  await runGitCommand(`git switch ${branchName}`);
  core.info(`Switched to branch: ${branchName}`);
}

/**
 * Push current branch and all tags to remote
 * @param {string} [remote='origin'] - Remote name
 */
export async function pushBranchAndTags(remote = "origin") {
  const branch = await runGitCommand("git branch --show-current");
  await runGitCommand(`git push ${remote} ${branch}`);
  core.info(`Pushed branch ${branch} to ${remote}`);
  await runGitCommand(`git push ${remote} --tags`);
  core.info(`Pushed tags to ${remote}`);
}
