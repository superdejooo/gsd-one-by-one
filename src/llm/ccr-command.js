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
 * @param {string|null} skill - Optional skill name (placeholder for future use, not included in command yet)
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
 * formatCcrCommand("/gsd:plan-phase 7", null, "github-actions-testing")
 * // Returns: 'ccr code --print "/gsd:plan-phase 7 /github-actions-testing"'
 * // Note: skill parameter is accepted but not used yet (placeholder for future)
 */
export function formatCcrCommand(gsdCommand, prompt = null, skill = null) {
  // Note: skill parameter is accepted but not used yet (placeholder for future)
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
 * @param {string|null} skill - Optional skill name (placeholder for future use, not included in command yet)
 *                               Valid values: github-actions-templates, github-actions-testing,
 *                               github-project-management, livewire-principles, refactor
 * @returns {string} Full CCR command string with output redirect
 */
export function formatCcrCommandWithOutput(gsdCommand, outputPath, prompt = null, skill = null) {
  return `${formatCcrCommand(gsdCommand, prompt, skill)} > ${outputPath} 2>&1`;
}
