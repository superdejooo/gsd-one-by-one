import * as core from "@actions/core";
import { formatErrorComment } from "./formatter.js";
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

    // Post formatted error to issue/PR
    if (context.issueNumber) {
      const errorComment = formatErrorComment(error, workflowUrl);
      await postComment(context.owner, context.repo, context.issueNumber, errorComment);
    }

    return { success: false, error: error.message };
  }
}
