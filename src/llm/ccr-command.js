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

  // Add skill if provided (before github-actions-testing)
  if (skill) {
    command = `${command} /${skill}`;
  }

  // Always add github-actions-testing
  command = `${command} /github-actions-testing`;

  // Add prompt at the end if provided
  if (prompt) {
    command = `${command} ${prompt}`;
  }

  return `ccr code --print "${command}"`;
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
