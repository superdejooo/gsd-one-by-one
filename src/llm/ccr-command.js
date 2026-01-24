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

  return `ccr code --print "${command} ---- STRICT RULE: NON INTERACTIVE env, output ONLY ONCE. If blocked, handover to .planning with plan and questions. ----"`;
}

/**
 * Format a GSD command for CCR execution with output redirect
 *
 * @param {string} gsdCommand - The GSD command (e.g., "/gsd:plan-phase 7")
 * @param {string} basePath - Base path for output files (without extension)
 * @param {string|null} prompt - Optional prompt to append at end of command
 * @param {string|null} skill - Optional skill name to load before github-actions-testing
 *                               Valid values: github-actions-templates, github-actions-testing,
 *                               github-project-management, livewire-principles, refactor
 * @returns {object} Object with command, stdoutPath, and stderrPath
 */
export function formatCcrCommandWithOutput(
  gsdCommand,
  basePath,
  prompt = null,
  skill = null,
) {
  const stdoutPath = `${basePath}.txt`;
  const stderrPath = `${basePath}-debug.txt`;
  const baseCommand = formatCcrCommand(gsdCommand, prompt, skill);
  return {
    command: `${baseCommand} > ${stdoutPath} 2> ${stderrPath}`,
    stdoutPath,
    stderrPath,
  };
}
