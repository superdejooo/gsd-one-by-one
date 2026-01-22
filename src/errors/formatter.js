import { getWorkflowRunUrl } from "../lib/github.js";

/**
 * Format error for GitHub comment
 * @param {Error} error - Error object
 * @param {string} workflowUrl - Link to workflow run
 * @returns {string} Formatted markdown error message
 */
export function formatErrorComment(error, workflowUrl) {
  const errorSummary = error.message || "Unknown error";
  const stackTrace = error.stack || "No stack trace available";

  return `
## Error: ${errorSummary}

Something went wrong during command execution.

**Workflow Run:** [View Logs](${workflowUrl})

### Next Steps

1. Check the workflow run logs for detailed error information
2. Review the command syntax and arguments
3. Ensure all required permissions are configured
4. Verify GitHub token has appropriate scopes
5. If the issue persists, please report the error with the workflow run ID

<details>
<summary><strong>Stack Trace</strong></summary>

\`\`\`
${stackTrace}
\`\`\`

</details>
`;
}

/**
 * Format success comment with execution summary
 * @param {object} result - Execution result
 * @param {string} workflowUrl - Link to workflow run
 * @returns {string} Formatted markdown success message
 */
export function formatSuccessComment(result, workflowUrl) {
  const summary = result.summary || "Command executed without errors.";
  let comment = `## Command Completed Successfully

**Workflow Run:** [View Details](${workflowUrl})

### Summary

${summary}`;

  if (result.filesCreated && result.filesCreated.length > 0) {
    comment += `

### Files Created

| File | Purpose |
|------|---------`;
    for (const file of result.filesCreated) {
      comment += `\n| ${file.name} | ${file.purpose} |`;
    }
  }

  if (result.decisions && result.decisions.length > 0) {
    comment += `

### Decisions Made

`;
    for (const decision of result.decisions) {
      comment += `- ${decision}\n`;
    }
  }

  return comment;
}
