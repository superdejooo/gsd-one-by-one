/**
 * Milestone Summary Generator Module
 *
 * Generates markdown-formatted summary comments for milestone creation completion.
 * Used by the milestone workflow orchestrator to post completion summaries.
 */

/**
 * Generate summary comment for milestone creation
 *
 * Creates a comprehensive markdown summary including:
 * - Milestone header with status
 * - Table of created files with purposes
 * - Requirements completion status
 * - Numbered next steps list
 * - Branch reference
 * - Bot signature footer
 *
 * @param {object} data - Milestone creation data
 * @param {number} data.milestoneNumber - Milestone number
 * @param {string} [data.status] - Current workflow status
 * @param {Array<{path: string, purpose: string}>} [data.files] - Created files with purposes
 * @param {object} [data.requirements] - Requirements gathering status
 * @param {boolean} data.requirements.complete - Whether all requirements gathered
 * @param {Array<string>} [data.requirements.answered] - List of answered question IDs
 * @param {Array<string>} [data.requirements.pending] - List of pending question IDs
 * @param {Array<string>} [data.nextSteps] - Array of next step strings
 * @returns {string} Markdown-formatted summary comment
 */
export function generateMilestoneSummary(data) {
  const {
    milestoneNumber,
    status = "Requirements Gathering",
    files = [],
    requirements = {},
    nextSteps = [],
  } = data;

  // Build files table
  const filesTable =
    files.length > 0
      ? files.map((f) => `| \`${f.path}\` | ${f.purpose} |`).join("\n")
      : "| (none) | |";

  // Build requirements status
  const reqStatus = requirements.complete
    ? ":white_check_mark: All requirements gathered"
    : `:hourglass: ${requirements.pending?.length || "Some"} question(s) pending`;

  const answeredList =
    requirements.answered?.length > 0
      ? `Answered: ${requirements.answered.map((q) => `\`${q}\``).join(", ")}`
      : "None yet";

  // Build next steps
  const nextStepsList =
    nextSteps.length > 0
      ? nextSteps.map((step, i) => `${i + 1}. ${step}`).join("\n")
      : "1. Answer remaining requirements questions in comments\n2. I'll continue planning once all questions are answered";

  const branchName = `gsd/${milestoneNumber}`;

  return `## Milestone ${milestoneNumber} Created

**Status:** ${status}

### Files Created

| File | Purpose |
|------|---------|
${filesTable}

### Requirements Status

${reqStatus}
- ${answeredList}

### Next Steps

${nextStepsList}

---

**Branch:** \`${branchName}\`

---
*This milestone was created by GSD Bot. Reply to continue requirements gathering or planning.*`;
}

/**
 * Generate abbreviated summary for partial completion
 * Used when requirements gathering is not yet complete
 *
 * @param {number} milestoneNumber - Milestone number
 * @param {object} requirements - Requirements status
 * @param {Array<string>} pendingQuestions - List of pending question IDs
 * @returns {string} Markdown summary for partial completion
 */
export function generatePartialSummary(
  milestoneNumber,
  requirements,
  pendingQuestions,
) {
  const questionsText =
    pendingQuestions.length > 0
      ? pendingQuestions.map((q) => `- ${q}`).join("\n")
      : "- (all answered, awaiting confirmation)";

  return `## Milestone ${milestoneNumber}: Requirements Gathering

**Status:** In Progress
**Progress:** ${requirements.answered?.length || 0} answered, ${pendingQuestions.length} pending

### Pending Questions

Please answer the following questions to complete requirements gathering:

${questionsText}

### Next Steps

1. Reply with your answers to the pending questions
2. I'll process your answers and continue the workflow
3. Once all required questions are answered, planning documents will be created

---
*Reply with your answers to continue.*`;
}
