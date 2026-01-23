/**
 * CCR Command Formatting
 *
 * Formats GSD commands for execution via Claude Code Router (CCR).
 * Always prepends the github-actions-testing skill for CI/CD context.
 */

/**
 * Format a GSD command for CCR execution
 *
 * Pattern: /github-actions-testing and now trigger command /gsd:{command}
 *
 * @param {string} gsdCommand - The GSD command (e.g., "/gsd:plan-phase 7")
 * @returns {string} Full CCR command string
 *
 * @example
 * formatCcrCommand("/gsd:plan-phase 7")
 * // Returns: 'ccr code --print "/github-actions-testing and now trigger command /gsd:plan-phase 7"'
 */
export function formatCcrCommand(gsdCommand) {
  return `ccr code --print "/github-actions-testing and now trigger command ${gsdCommand}"`;
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
