/**
 * Comment parsing for @gsd-bot commands and /gsd: slash commands
 *
 * Event Filtering:
 * - Created vs Edited: Already handled by workflow trigger (issue_comment: types: [created])
 * - No redundant event type checks needed in this code
 * - Workflow ensures only comment.created events trigger this action
 *
 * Supported formats:
 * - @gsd-bot command-name [args...] (legacy format)
 * - /gsd:command-name [args...] (slash command format)
 *
 * See: .github/workflows/gsd-command-handler.yml
 */

const BOT_MENTION = "@gsd-bot";
const SLASH_PREFIX = "/gsd:";

/**
 * Parse comment body to extract command
 * Supports both @gsd-bot and /gsd: formats
 * @param {string} commentBody - Raw comment text
 * @returns {object|null} - { botMention, command, args } or null if no command found
 */
export function parseComment(commentBody) {
  // Trim whitespace and normalize line breaks
  const normalizedBody = commentBody
    .trim()
    .replace(/\r\n/g, " ")
    .replace(/\n/g, " ");

  const normalizedLower = normalizedBody.toLowerCase();

  // Try slash command format first: /gsd:command-name [args...]
  if (normalizedLower.includes(SLASH_PREFIX.toLowerCase())) {
    const slashPattern = /\/gsd:(\S+)(?:\s+(.*))?/i;
    const match = normalizedBody.match(slashPattern);

    if (match) {
      return {
        botMention: match[0], // Full matched string for compatibility
        command: match[1].toLowerCase(), // Normalize to lowercase
        args: match[2] ? match[2].trim() : "",
      };
    }
  }

  // Fall back to @gsd-bot format: @gsd-bot command-name [args...]
  if (normalizedLower.includes(BOT_MENTION.toLowerCase())) {
    const commandPattern = new RegExp(
      `${BOT_MENTION}\\s+(\\S+)(?:\\s+(.*))?$`,
      "i",
    );
    const match = normalizedBody.match(commandPattern);

    if (match) {
      return {
        botMention: match[0],
        command: match[1].toLowerCase(), // Normalize to lowercase
        args: match[2] ? match[2].trim() : "",
      };
    }
  }

  return null;
}

/**
 * Parse command arguments in --key=value format
 * @param {string} argsString - Raw arguments string
 * @returns {object} - Key-value pairs
 */
export function parseArguments(argsString) {
  const args = {};
  const argPattern = /--(\w+)=("[^"]*"|'[^']*'|\S+)/g;
  let match;

  while ((match = argPattern.exec(argsString)) !== null) {
    const key = match[1];
    let value = match[2];

    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    args[key] = value;
  }

  return args;
}

/**
 * Parse description argument from command args string
 * For new-milestone command, the description is everything after the command
 * @param {string} argsString - Raw arguments string
 * @returns {string|null} - Description text or null if empty
 */
export function parseDescriptionArg(argsString) {
  if (!argsString || argsString.trim().length === 0) {
    return null;
  }

  return argsString.trim();
}

import { SKILL_COMMAND_MAP, SKILL_ALIASES } from "./validator.js";

/**
 * Valid skill aliases (used as --flags)
 */
export const VALID_SKILLS = Object.keys(SKILL_ALIASES);

/**
 * Parse skill from command args string
 * Format: "@gsd-bot plan-phase 7 --manager"
 * @param {string} argsString - Raw arguments string
 * @returns {string|null} - Full skill name or null if not found
 */
export function parseSkillArg(argsString) {
  if (!argsString || argsString.trim().length === 0) {
    return null;
  }

  // Find --alias flags
  const flagMatch = argsString.toLowerCase().match(/--(\w+)/);
  if (flagMatch) {
    const alias = flagMatch[1];
    if (alias in SKILL_ALIASES) {
      return SKILL_ALIASES[alias];
    }
  }

  return null;
}
