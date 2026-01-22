/**
 * Authorization-specific error class
 * Provides clear error identification and user-friendly messages
 */
export class AuthorizationError extends Error {
  /**
   * @param {string} message - Technical error message for logging
   * @param {string} userMessage - User-friendly message for display
   */
  constructor(message, userMessage) {
    super(message);
    this.name = "AuthorizationError";
    this.userMessage = userMessage;
    this.isAuthorizationError = true;
  }
}

/**
 * Format authorization error for GitHub comment
 * @param {string} username - Triggering username
 * @param {string} repo - Repository name (owner/repo format)
 * @param {string} workflowUrl - Link to workflow run
 * @returns {string} Formatted markdown error message
 */
export function formatAuthorizationError(username, repo, workflowUrl) {
  return `## Permission Denied

@${username} does not have write access to this repository.

### Required Permissions

To trigger the GSD milestone workflow, you need:
- **Write** access to \`${repo}\`, or
- **Maintain** role, or
- **Admin** role

### How to Request Access

1. Contact a repository maintainer or admin
2. Ask them to add you as a collaborator with write permissions
3. Once added, you'll be able to use the @gsd-bot commands

**Workflow Run:** [View Logs](${workflowUrl})`;
}
