/**
 * CCR Command Formatting
 *
 * Formats GSD commands for execution via Claude Code Router (CCR).
 * Always prepends the github-actions-testing skill for CI/CD context.
 */

/**
 * Format a GSD command for CCR execution
 *
 * Pattern: /gsd:{command} /github-actions-testing {prompt?}
 *
 * @param {string} gsdCommand - The GSD command (e.g., "/gsd:plan-phase 7")
 * @param {string|null} prompt - Optional prompt to append after /github-actions-testing
 * @returns {string} Full CCR command string
 *
 * @example
 * formatCcrCommand("/gsd:plan-phase 7")
 * // Returns: 'ccr code --print "/gsd:plan-phase 7 /github-actions-testing"'
 *
 * @example
 * formatCcrCommand("/gsd:new-milestone", "Build a login system")
 * // Returns: 'ccr code --print "/gsd:new-milestone /github-actions-testing Build a login system"'
 */
export function formatCcrCommand(gsdCommand, prompt = null) {
  const baseCommand = `${gsdCommand} /github-actions-testing`;
  const fullCommand = prompt ? `${baseCommand} ${prompt}` : baseCommand;
  return `ccr code --print "${fullCommand}"`;
}

/**
 * Format a GSD command for CCR execution with output redirect
 *
 * @param {string} gsdCommand - The GSD command (e.g., "/gsd:plan-phase 7")
 * @param {string} outputPath - Path to redirect output to
 * @param {string|null} prompt - Optional prompt to append after /github-actions-testing
 * @returns {string} Full CCR command string with output redirect
 */
export function formatCcrCommandWithOutput(gsdCommand, outputPath, prompt = null) {
  return `${formatCcrCommand(gsdCommand, prompt)} > ${outputPath} 2>&1`;
}
