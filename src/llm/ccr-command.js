/**
 * CCR Command Formatting
 *
 * Formats GSD commands for execution via Claude Code Router (CCR).
 * Always prepends the github-actions-testing skill for CI/CD context.
 */

/**
 * Format a GSD command for CCR execution
 *
 * Pattern: /gsd:{command} /{skill} /github-actions-testing {prompt?}
 *
 * @param {string} gsdCommand - The GSD command (e.g., "/gsd:plan-phase 7")
 * @param {string|null} prompt - Optional prompt to append at end of command
 * @param {string|null} skill - Optional skill name to load before github-actions-testing
 *                               Valid values: github-actions-templates, github-actions-testing,
 *                               github-project-management, livewire-principles, refactor
 * @returns {string} Full CCR command string
 *
 * @example
 * formatCcrCommand("/gsd:plan-phase 7")
 * // Returns: 'ccr code --print "/gsd:plan-phase 7 /github-actions-testing"'
 *
 * @example
 * formatCcrCommand("/gsd:new-milestone", "Build a login system")
 * // Returns: 'ccr code --print "/gsd:new-milestone /github-actions-testing Build a login system"'
 *
 * @example
 * formatCcrCommand("/gsd:plan-phase 7", null, "github-project-management")
 * // Returns: 'ccr code --print "/gsd:plan-phase 7 /github-project-management /github-actions-testing"'
 */
export function formatCcrCommand(gsdCommand, prompt = null, skill = null) {
  let command = gsdCommand;

  // DECISION 18:10 23.1.2026.
  // DO NOT CHANGE!
  // Add optional skill before appending custom prompt
  if (!skill) {
      skill = 'github-actions-testing';
  }
    command = `${command} but first load this skill .claude/skills/${skill}/SKILL.md`;

  // Add prompt at the end if provided
  if (prompt) {
    command = `${command} and then: ' ${prompt}'`;
  }

  return `ccr code --print "${command}" 
---- STRICT RULE ---- 
This is NON INTERACTIVE env, 
you can output ONLY ONCE!!!
If you cannot figure out how 
to proceed, even with all 
available agents and tools, 
you MUST perform an handover 
to the .planning directory.
Handover MUST include a detailed 
plan and justification and all 
your questions.

User after reviewing, will assign 
another agent.
----------------------
`;
}

/**
 * Format a GSD command for CCR execution with output redirect
 *
 * @param {string} gsdCommand - The GSD command (e.g., "/gsd:plan-phase 7")
 * @param {string} outputPath - Path to redirect output to
 * @param {string|null} prompt - Optional prompt to append at end of command
 * @param {string|null} skill - Optional skill name to load before github-actions-testing
 *                               Valid values: github-actions-templates, github-actions-testing,
 *                               github-project-management, livewire-principles, refactor
 * @returns {string} Full CCR command string with output redirect
 */
export function formatCcrCommandWithOutput(
  gsdCommand,
  outputPath,
  prompt = null,
  skill = null,
) {
  return `${formatCcrCommand(gsdCommand, prompt, skill)} > ${outputPath} 2>&1`;
}
