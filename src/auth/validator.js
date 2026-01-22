import * as github from "@actions/github";

/**
 * Check if user has write access to repository
 * @param {object} octokit - Authenticated Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} username - GitHub username to check
 * @returns {Promise<boolean>} True if user has write access
 */
export async function hasWriteAccess(octokit, owner, repo, username) {
  try {
    const response = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username,
    });

    const permission = response.data.permission;
    // write, maintain, and admin all have write access
    return ["admin", "write", "maintain"].includes(permission);
  } catch (error) {
    if (error.status === 404) {
      // User is not a collaborator at all
      return false;
    }
    throw error; // Rethrow unexpected errors
  }
}

/**
 * Get authorization context from webhook payload
 * @returns {object} Authorization context with user and repo info
 */
export function getAuthContext() {
  const payload = github.context.payload;
  const sender = payload.sender;

  return {
    username: sender?.login,
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issueNumber: payload.issue?.number || payload.pull_request?.number,
    isComment: payload.comment?.id !== undefined,
  };
}

/**
 * Check authorization for the triggering user
 * @param {object} octokit - Authenticated Octokit instance
 * @returns {Promise<object>} Authorization result with authorized, username, permission, and reason
 */
export async function checkAuthorization(octokit) {
  const payload = github.context.payload;

  // Get triggering user from webhook sender
  const username = payload.sender?.login;
  if (!username) {
    return {
      authorized: false,
      username: null,
      permission: null,
      reason: "Could not identify triggering user from webhook payload",
    };
  }

  const { owner, repo } = github.context.repo;

  try {
    // Check collaborator permission level
    const response = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username,
    });

    const permission = response.data.permission;
    const hasWriteAccess = ["admin", "write", "maintain"].includes(permission);

    return {
      authorized: hasWriteAccess,
      username,
      permission,
      roleName: response.data.role_name,
    };
  } catch (error) {
    if (error.status === 404) {
      // User is not a collaborator
      return {
        authorized: false,
        username,
        permission: null,
        reason: "User is not a collaborator on this repository",
      };
    }
    // Rethrow unexpected errors
    throw error;
  }
}
