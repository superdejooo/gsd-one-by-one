import * as core from "@actions/core";

/**
 * Allowlist of valid commands
 * For v1, only new-milestone is implemented
 */
const ALLOWED_COMMANDS = [
  "new-milestone",
  "plan-phase",
  "execute-phase",
  "complete-milestone",
];

/**
 * Map of skills to commands they can be used with
 * Skills are loaded from .claude/skills/ folder
 * null means skill can be used with any command
 */
export const SKILL_COMMAND_MAP = {
  "github-actions-templates": ["plan-phase", "execute-phase"],
  "github-actions-testing": null, // All commands (default, always loaded)
  "github-project-management": [
    "new-milestone",
    "plan-phase",
    "execute-phase",
    "complete-milestone",
  ],
  "livewire-principles": ["plan-phase", "execute-phase"],
  "refactor": ["plan-phase", "execute-phase"],
};

/**
 * Short aliases for skill names
 * Users can use these instead of full skill names
 */
export const SKILL_ALIASES = {
  manager: "github-project-management",
  testing: "github-actions-testing",
  templates: "github-actions-templates",
  livewire: "livewire-principles",
  refactor: "refactor",
};

/**
 * Get valid skills for a command
 * @param {string} command - Command name
 * @returns {string[]} List of valid skill names for this command
 */
export function getValidSkillsForCommand(command) {
  return Object.entries(SKILL_COMMAND_MAP)
    .filter(([, commands]) => commands === null || commands.includes(command))
    .map(([skill]) => skill);
}

/**
 * Validate skill for a command
 * @param {string} skill - Skill name
 * @param {string} command - Command name
 * @returns {boolean} True if skill is valid for command
 */
export function isValidSkillForCommand(skill, command) {
  if (!skill) return true; // No skill is always valid
  if (!(skill in SKILL_COMMAND_MAP)) return false; // Unknown skill
  const allowedCommands = SKILL_COMMAND_MAP[skill];
  if (allowedCommands === null) return true; // Skill valid for all commands
  return allowedCommands.includes(command);
}

/**
 * Validate command against allowlist
 * @param {string} command - Command name
 * @throws {Error} - If command is not in allowlist or has invalid format
 */
export function validateCommand(command) {
  // Allowlist validation (not denylist)
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error(
      `Unknown command: ${command}. Valid commands: ${ALLOWED_COMMANDS.join(", ")}`,
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

    // Special handling for description argument (allows larger text)
    const maxLength = key === "description" ? 50000 : 500;

    // Check for reasonable length limits
    if (value.length > maxLength) {
      throw new Error(
        `Argument ${key} exceeds maximum length (${maxLength} chars)`,
      );
    }

    // Remove shell metacharacters to prevent command injection
    // Source: OWASP Input Validation Cheat Sheet
    value = value.replace(/[;&|`$()]/g, "");

    sanitized[key] = value.trim();
  });

  return sanitized;
}
