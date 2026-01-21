import * as core from "@actions/core";

/**
 * Allowlist of valid commands
 * For v1, only new-milestone is implemented
 */
const ALLOWED_COMMANDS = ["new-milestone"];

/**
 * Validate command against allowlist
 * @param {string} command - Command name
 * @throws {Error} - If command is not in allowlist or has invalid format
 */
export function validateCommand(command) {
  // Allowlist validation (not denylist)
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error(
      `Unknown command: ${command}. Valid commands: ${ALLOWED_COMMANDS.join(", ")}`
    );
  }

  // Format validation (kebab-case only)
  if (!/^[a-z0-9-]+$/.test(command)) {
    throw new Error(`Invalid command format: ${command}. Must be kebab-case`);
  }

  core.info(`Command validated: ${command}`);
}

/**
 * Sanitize arguments to prevent command injection
 * Removes shell metacharacters and validates length
 * @param {object} args - Arguments object
 * @throws {Error} - If validation fails
 * @returns {object} - Sanitized arguments
 */
export function sanitizeArguments(args) {
  const sanitized = {};

  Object.keys(args).forEach((key) => {
    let value = args[key];

    // Check for empty values
    if (!value || value.length === 0) {
      throw new Error(`Argument ${key} cannot be empty`);
    }

    // Check for reasonable length limits (500 chars)
    if (value.length > 500) {
      throw new Error(`Argument ${key} exceeds maximum length (500 chars)`);
    }

    // Remove shell metacharacters to prevent command injection
    // Source: OWASP Input Validation Cheat Sheet
    value = value.replace(/[;&|`$()]/g, "");

    sanitized[key] = value.trim();
  });

  return sanitized;
}
