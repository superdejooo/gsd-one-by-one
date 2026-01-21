/**
 * Prompt template helpers for GSD commands
 *
 * Separates prompt engineering from execution logic.
 * Makes prompts testable and reusable across command handlers.
 */

/**
 * Create prompt for milestone creation command
 *
 * @param {object} args - Milestone specification from user
 * @param {string} args.name - Milestone name
 * @param {string} [args.description] - Milestone description
 * @param {string} [args.phases] - Number of phases or phase list
 * @returns {string} Formatted prompt for Claude
 */
export function createMilestonePrompt(args) {
  return `
Create a new GSD milestone based on this specification:
${JSON.stringify(args, null, 2)}

Instructions:
1. Review the existing codebase structure
2. Create planning documents in .github/planning/:
   - PROJECT.md with milestone context and goals
   - ROADMAP.md with phase breakdown and dependencies
   - STATE.md with milestone status tracking
3. Follow GSD planning standards for document structure
4. Consider project type and existing patterns

Respond with the created file contents and any clarifying questions needed for requirements gathering.
  `.trim();
}

// Additional prompt templates will be added in later phases (Phase 5+)
// as more GSD commands are implemented:
// - createExecutePhasePrompt(phaseId)
// - createPlanPhasePrompt(phaseId, context)
// - createDiscussPhasePrompt(topic)
// - createVerifyWorkPrompt(targetId)
