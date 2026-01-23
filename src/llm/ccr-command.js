/**
 * CCR Command Formatting
 *
 * Formats GSD commands for execution via Claude Code Router (CCR).
 * Always prepends the github-actions-testing skill for CI/CD context.
 */

/**
 * Format a GSD command for CCR execution
 *
 * Pattern: /gsd:{command} /github-actions-testing
 *
 * @param {string} gsdCommand - The GSD command (e.g., "/gsd:plan-phase 7")
 * @returns {string} Full CCR command string
 *
 * @example
 * formatCcrCommand("/gsd:plan-phase 7")
 * // Returns: 'ccr code --print "/gsd:plan-phase 7 /github-actions-testing"'
 */
export function formatCcrCommand(gsdCommand) {
  return `ccr code --print "${gsdCommand} /github-actions-testing"`;
}

/**
 * Format a GSD command for CCR execution with output redirect
 *
 * @param {string} gsdCommand - The GSD command (e.g., "/gsd:plan-phase 7")
 * @param {string} outputPath - Path to redirect output to
 * @returns {string} Full CCR command string with output redirect
 */
export function formatCcrCommandWithOutput(gsdCommand, outputPath) {
  return `${formatCcrCommand(gsdCommand)} > ${outputPath} 2>&1`;
}
