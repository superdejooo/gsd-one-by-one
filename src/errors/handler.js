import * as core from "@actions/core";
import { formatErrorComment } from "./formatter.js";
import { AuthorizationError } from "../auth/errors.js";
import { postComment, getWorkflowRunUrl } from "../lib/github.js";

/**
 * Execute operation with error handling and GitHub comment posting
 * @param {Function} operation - Async operation to execute
 * @param {object} context - Context for error reporting
 * @returns {Promise<object>} Operation result
 */
export async function withErrorHandling(operation, context) {
  const workflowUrl = getWorkflowRunUrl();

  try {
    const result = await operation();
    return { success: true, ...result };
  } catch (error) {
    core.setFailed(error.message);

    // Authorization errors use user-friendly messages (already formatted)
    if (error.isAuthorizationError === true) {
      core.info("Authorization error detected - posting user-friendly message");
      if (context.issueNumber) {
        await postComment(context.owner, context.repo, context.issueNumber, error.userMessage);
      }
      return { success: false, error: error.message, isAuthorizationError: true };
    }

    // Post formatted error to issue/PR for technical errors
    if (context.issueNumber) {
      const errorComment = formatErrorComment(error, workflowUrl);
      await postComment(context.owner, context.repo, context.issueNumber, errorComment);
    }

    return { success: false, error: error.message };
  }
}
