# Phase 2: Command Parsing & Config - Research

**Researched:** 2026-01-21
**Domain:** GitHub Actions comment parsing, configuration management, input validation
**Confidence:** MEDIUM

## Summary

This phase focuses on parsing GitHub issue comments to extract GSD bot commands, loading configuration files from the repository, and validating user input. The primary technologies are the existing `@actions/github` library (for Octokit REST API access) and built-in JavaScript string manipulation (no additional command parsing libraries needed).

**Key findings:**

- Command parsing can be handled with simple regex patterns without external libraries
- GitHub API file fetching uses `octokit.rest.repos.getContent()` which returns base64-encoded content
- Event filtering (PARS-04) is already handled at the workflow level via `issue_comment: types: [created]`
- Input validation should follow OWASP allowlist principles for security

**Primary recommendation:** Use built-in JavaScript regex for command parsing, `@actions/github` for config file fetching, and simple allowlist validation for command injection prevention. No additional libraries required.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library                        | Version                    | Purpose                                  | Why Standard                                                             |
| ------------------------------ | -------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| `@actions/github`              | ^7.0.0 (already installed) | GitHub REST API client                   | Pre-installed, authenticated Octokit client, standard for GitHub Actions |
| `@actions/core`                | ^2.0.2 (already installed) | Inputs, outputs, logging, error handling | Already installed, provides input validation utilities                   |
| Built-in JavaScript ES modules | N/A                        | String manipulation, regex parsing       | No external dependencies needed for this scope                           |

### Supporting

| Library | Version | Purpose                   | When to Use                                               |
| ------- | ------- | ------------------------- | --------------------------------------------------------- |
| None    | N/A     | Command parsing libraries | Not needed - simple regex is sufficient for this use case |

### Alternatives Considered

| Instead of           | Could Use                        | Tradeoff                                                                                                                  |
| -------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Simple regex parsing | `yargs`, `commander`, `argparse` | Overkill - these libraries are designed for CLI parsing, not comment parsing. Adds unnecessary complexity and bundle size |

**Installation:**
No additional packages needed. Using existing dependencies:

```bash
# Already installed from Phase 1
npm install @actions/core @actions/github
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── parser.js      # Comment parsing logic
│   ├── config.js      # Config file loading
│   └── validator.js   # Input validation & sanitization
└── index.js           # Main entry point (already exists)
```

### Pattern 1: Command Mention Parsing

**What:** Extract `@gsd-bot` mention and command from comment body using regex
**When to use:** Processing issue comments in Phase 2
**Example:**

```javascript
// Source: Built-in JavaScript regex (no external library)
const BOT_MENTION = "@gsd-bot";

function parseComment(commentBody) {
  // Trim whitespace and normalize line endings
  const normalizedBody = commentBody.trim();

  // Check if bot is mentioned
  if (!normalizedBody.includes(BOT_MENTION)) {
    return null;
  }

  // Extract command - pattern: @gsd-bot command-name [args...]
  const commandPattern = new RegExp(
    `${BOT_MENTION}\\s+(\\S+)(?:\\s+(.*))?$`,
    "i",
  );
  const match = normalizedBody.match(commandPattern);

  if (!match) {
    return null;
  }

  return {
    botMention: match[0],
    command: match[1].toLowerCase(), // Normalize to lowercase
    args: match[2] ? match[2].trim() : "",
  };
}

// Example usage:
// Input: "@gsd-bot new-milestone --title=\"Feature X\""
// Output: { botMention: "@gsd-bot", command: "new-milestone", args: "--title=\"Feature X\"" }
```

### Pattern 2: Argument Parsing (Optional)

**What:** Parse command arguments and flags (simple key-value parsing)
**When to use:** Commands accept flags like `--title` or `--description`
**Example:**

```javascript
// Source: Custom implementation (no external library)
function parseArguments(argsString) {
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

// Example usage:
// Input: "--title=\"Feature X\" --priority=high"
// Output: { title: "Feature X", priority: "high" }
```

### Pattern 3: GitHub API File Fetching

**What:** Fetch and decode repository config files using Octokit
**When to use:** Loading `.github/gsd-config.json` from repository
**Example:**

```javascript
// Source: @actions/github README (HIGH confidence)
import * as github from "@actions/github";
import * as core from "@actions/core";

async function loadConfig(owner, repo) {
  const token =
    core.getInput("token", { required: false }) || process.env.GITHUB_TOKEN;
  const octokit = github.getOctokit(token);

  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: ".github/gsd-config.json",
    });

    // Decode base64 content (GitHub API returns base64 for files)
    const content = Buffer.from(response.data.content, "base64").toString(
      "utf-8",
    );
    return JSON.parse(content);
  } catch (error) {
    if (error.status === 404) {
      core.info("Config file not found, using defaults");
      return getDefaultConfig();
    }
    throw error;
  }
}

// Source: OWASP Input Validation Cheat Sheet (HIGH confidence)
function getDefaultConfig() {
  return {
    labels: {
      phases: {
        "01-github-action-foundation": "Phase 1: Foundation",
        "02-command-parsing-config": "Phase 2: Command Parsing & Config",
        "03-claude-code-router": "Phase 3: CCR Integration",
        "04-communication-layer": "Phase 4: Communication",
        "05-milestone-creation": "Phase 5: Milestone Creation",
        "06-authorization-check": "Phase 6: Authorization",
      },
      status: {
        todo: "To Do",
        "in-progress": "In Progress",
        done: "Done",
        blocked: "Blocked",
      },
    },
    paths: {
      planning: ".github/planning/",
      milestones: ".github/planning/milestones/",
      phases: ".github/planning/phases/",
    },
  };
}
```

### Pattern 4: Input Validation & Sanitization

**What:** Validate commands and arguments to prevent command injection
**When to use:** All user input from comment body
**Example:**

```javascript
// Source: OWASP Input Validation Cheat Sheet (HIGH confidence)
// Use allowlist validation, not denylist

const ALLOWED_COMMANDS = [
  "new-milestone",
  "plan-phase",
  "execute-phase",
  "verify-work",
];

function validateCommand(command) {
  // Allowlist validation: check against known commands
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  // Additional format validation (kebab-case)
  if (!/^[a-z0-9-]+$/.test(command)) {
    throw new Error(`Invalid command format: ${command}`);
  }

  return true;
}

function sanitizeArgument(value) {
  // Remove shell metacharacters to prevent command injection
  // Source: OWASP Input Validation Cheat Sheet (HIGH confidence)
  const sanitized = value.replace(/[;&|`$()]/g, "");

  // Trim whitespace
  return sanitized.trim();
}

function validateArguments(args) {
  // Validate each argument value
  Object.keys(args).forEach((key) => {
    const value = args[key];

    // Check for empty values
    if (!value || value.length === 0) {
      throw new Error(`Argument ${key} cannot be empty`);
    }

    // Check for reasonable length limits
    if (value.length > 500) {
      throw new Error(`Argument ${key} exceeds maximum length (500 chars)`);
    }

    // Sanitize to prevent injection
    args[key] = sanitizeArgument(value);
  });

  return true;
}
```

### Anti-Patterns to Avoid

- **Using denylist filtering:** Attackers can bypass blacklists easily. Use allowlist validation instead.
- **External command parsing libraries:** `yargs`, `commander` are overkill for comment parsing and add bundle size.
- **Direct string concatenation for commands:** Always use parameterized APIs or proper escaping.
- **Trusting user input without validation:** All comment input must be validated and sanitized.
- **Ignoring missing config files:** Always use defaults with clear logging when config is missing.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                   | Don't Build                    | Use Instead                               | Why                                                          |
| ------------------------- | ------------------------------ | ----------------------------------------- | ------------------------------------------------------------ |
| GitHub API authentication | Manual token handling          | `@actions/github.getOctokit()`            | Handles proxy settings, GHES URLs, retry logic automatically |
| Base64 decoding           | Manual Buffer operations       | Built-in `Buffer.from(content, 'base64')` | GitHub API standard, well-tested                             |
| Input validation regex    | Custom patterns                | Simple allowlist arrays                   | More maintainable, less error-prone                          |
| Error handling            | Manual try-catch for each call | Centralized error handling                | Consistent error messages, easier debugging                  |

**Key insight:** While this phase seems like it needs complex parsing libraries, the requirements are simple enough for built-in JavaScript. External libraries add complexity without adding value for this use case. The only "don't hand-roll" items are related to GitHub API interactions, where `@actions/github` is essential.

## Common Pitfalls

### Pitfall 1: Not Handling GitHub API Base64 Encoding

**What goes wrong:** GitHub API returns file content as base64-encoded strings. Trying to parse it directly as JSON fails.
**Why it happens:** `repos.getContent()` always returns `content` field as base64 for file-type responses.
**How to avoid:** Always decode base64 before parsing JSON:

```javascript
const content = Buffer.from(response.data.content, "base64").toString("utf-8");
const config = JSON.parse(content);
```

**Warning signs:** `SyntaxError: Unexpected token a in JSON at position 0` when parsing config.

### Pitfall 2: Assuming Config File Always Exists

**What goes wrong:** Action crashes with 404 error when repo doesn't have `.github/gsd-config.json`.
**Why it happens:** CONF-04 requires using defaults when config is missing, but code may not handle the 404 case.
**How to avoid:** Catch 404 errors and fall back to defaults with clear logging:

```javascript
try {
  const response = await octokit.rest.repos.getContent({ ... });
} catch (error) {
  if (error.status === 404) {
    core.info('Config not found, using defaults');
    return getDefaultConfig();
  }
  throw error;
}
```

**Warning signs:** "Resource not found" errors in logs, failing workflow on new repositories.

### Pitfall 3: Case Sensitivity in Command Matching

**What goes wrong:** User types `@Gsd-Bot NEW-MILESTONE` but code doesn't recognize it.
**Why it happens:** JavaScript string matching is case-sensitive by default.
**How to avoid:** Normalize both the bot mention and command to lowercase before matching:

```javascript
const normalizedBody = commentBody.toLowerCase();
const commandPattern = /@gsd-bot\s+(\S+)/;
```

**Warning signs:** Users report "command not recognized" when they type it correctly.

### Pitfall 4: ReDoS (Regular Expression Denial of Service)

**What goes wrong:** Complex regex patterns can cause exponential backtracking, freezing the action.
**Why it happens:** Using `.*` or `.+` with nested quantifiers in regex patterns.
**How to avoid:** Keep regex patterns simple and avoid nested quantifiers:

```javascript
// BAD: Complex pattern with nested quantifiers
const badPattern = /@gsd-bot\s+(?:.*\s+){3,}.*/;

// GOOD: Simple, linear pattern
const goodPattern = /@gsd-bot\s+(\S+)(?:\s+(.*))?$/;
```

**Warning signs:** Action hangs indefinitely on certain comment inputs.

### Pitfall 5: Ignoring Multi-Line Comments

**What goes wrong:** Comment has line breaks, regex only matches first line.
**Why it happens:** Not accounting for `\n` characters in comment body.
**How to avoid:** Normalize line breaks before parsing:

```javascript
const normalizedBody = commentBody.replace(/\r\n/g, " ").replace(/\n/g, " ");
```

**Warning signs:** Commands not detected when users add line breaks for readability.

### Pitfall 6: Confusing Workflow-Level Event Filtering with Code-Level

**What goes wrong:** Adding redundant event type checks in code when workflow already filters `issue_comment: created`.
**Why it happens:** Misunderstanding that PARS-04 is already satisfied by the workflow trigger.
**How to avoid:** Trust the workflow trigger - don't add `if (action !== 'created')` checks in code. The workflow only triggers on created events.

**Warning signs:** Adding unnecessary GitHub API calls to check comment action.

## Code Examples

Verified patterns from official sources:

### Basic Command Parsing

```javascript
// Source: Built-in JavaScript regex (HIGH confidence)
function parseComment(commentBody) {
  const BOT_MENTION = "@gsd-bot";
  const normalized = commentBody.trim().toLowerCase();

  if (!normalized.includes(BOT_MENTION)) {
    return null;
  }

  const match = normalized.match(
    new RegExp(`${BOT_MENTION}\\s+(\\S+)(?:\\s+(.*))?$`),
  );

  if (!match) {
    return null;
  }

  return {
    command: match[1],
    args: match[2] || "",
  };
}
```

### Load Config with Defaults

```javascript
// Source: @actions/github README (HIGH confidence)
// Source: OWASP Input Validation Cheat Sheet (HIGH confidence)
import * as github from "@actions/github";
import * as core from "@actions/core";

async function loadConfig(owner, repo) {
  const octokit = github.getOctokit(process.env.GITHUB_TOKEN);

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: ".github/gsd-config.json",
    });

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    return JSON.parse(content);
  } catch (error) {
    if (error.status === 404) {
      core.info("Using default config (gsd-config.json not found)");
      return getDefaultConfig();
    }
    throw new Error(`Failed to load config: ${error.message}`);
  }
}

function getDefaultConfig() {
  return {
    labels: {
      phases: {
        "01-github-action-foundation": "Phase 1: Foundation",
        "02-command-parsing-config": "Phase 2: Command Parsing & Config",
        // ... other phases
      },
      status: {
        todo: "To Do",
        "in-progress": "In Progress",
        done: "Done",
        blocked: "Blocked",
      },
    },
    paths: {
      planning: ".github/planning/",
      milestones: ".github/planning/milestones/",
      phases: ".github/planning/phases/",
    },
  };
}
```

### Input Validation

```javascript
// Source: OWASP Input Validation Cheat Sheet (HIGH confidence)
const ALLOWED_COMMANDS = [
  "new-milestone",
  "plan-phase",
  "execute-phase",
  "verify-work",
];

function validateCommand(command) {
  // Allowlist validation (not denylist)
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error(
      `Unknown command: ${command}. Valid commands: ${ALLOWED_COMMANDS.join(", ")}`,
    );
  }

  // Format validation (kebab-case only)
  if (!/^[a-z0-9-]+$/.test(command)) {
    throw new Error(`Invalid command format: ${command}`);
  }

  return command;
}

function sanitizeArguments(args) {
  const sanitized = {};

  Object.keys(args).forEach((key) => {
    let value = args[key];

    // Remove shell metacharacters
    value = value.replace(/[;&|`$()]/g, "");

    // Validate length
    if (value.length > 500) {
      throw new Error(`Argument ${key} exceeds maximum length (500 chars)`);
    }

    sanitized[key] = value.trim();
  });

  return sanitized;
}
```

### Argument Parsing

```javascript
// Source: Custom implementation (HIGH confidence)
function parseArguments(argsString) {
  const args = {};
  const argPattern = /--(\w+)=("[^"]*"|'[^']*'|\S+)/g;
  let match;

  while ((match = argPattern.exec(argsString)) !== null) {
    const key = match[1];
    let value = match[2];

    // Remove quotes
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
```

## State of the Art

| Old Approach                   | Current Approach             | When Changed                  | Impact                                                  |
| ------------------------------ | ---------------------------- | ----------------------------- | ------------------------------------------------------- |
| Direct REST API with curl      | `@actions/github` (Octokit)  | GitHub Actions v2+            | Type-safe, auto-authenticated, handles proxies and GHES |
| Denylist validation            | Allowlist validation         | OWASP updated recommendations | More secure, less bypassable                            |
| Manual GitHub token management | GITHUB_TOKEN via environment | GitHub Actions native         | Auto-rotating, no secret management overhead            |

**Deprecated/outdated:**

- Manual GitHub API requests: Use `@actions/github` instead for automatic authentication
- Denylist filtering: Use allowlist validation per OWASP guidelines
- `@actions/github` v6.x: Upgrade to v7.x for latest Octokit features

## Open Questions

Things that couldn't be fully resolved:

1. **Command Argument Schema**
   - What we know: Commands should support `--key=value` format
   - What's unclear: Whether commands need complex nested arguments or just flat key-value pairs
   - Recommendation: Start with flat key-value parsing, extend if requirements emerge

2. **Config File Schema Validation**
   - What we know: Config should contain label mappings and path definitions
   - What's unclear: Whether to use JSON Schema validation or trust user-provided config
   - Recommendation: Validate required fields exist, but don't enforce full schema (allow extensibility)

3. **Command Aliases**
   - What we know: Only `new-milestone` is required for v1
   - What's unclear: Whether to support shortened aliases (e.g., `nm` for `new-milestone`)
   - Recommendation: Don't implement aliases in Phase 2; evaluate need during Phase 5 (milestone creation)

## Sources

### Primary (HIGH confidence)

- [@actions/github README](https://github.com/actions/toolkit/tree/main/packages/github) - Octokit usage, authenticated client setup, `repos.getContent()` method
- [@actions/core README](https://github.com/actions/toolkit/tree/main/packages/core) - Input/output handling, error handling, logging
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) - Allowlist validation, input sanitization, length constraints
- [Octokit REST API Documentation](https://octokit.github.io/rest.js/v20/#rest-repos-get-content) - `repos.getContent()` method, base64 encoding

### Secondary (MEDIUM confidence)

- [Node.js regex MDN documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions) - Regex patterns, string manipulation
- [Buffer.from documentation](https://nodejs.org/api/buffer.html#static-method-bufferfromstring-encoding) - Base64 decoding

### Tertiary (LOW confidence)

- WebSearch results for command parsing patterns - No specific library needed, simple regex sufficient

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - @actions/github and @actions/core are installed and well-documented
- Architecture: HIGH - File structure based on common patterns, examples verified with official docs
- Pitfalls: HIGH - All pitfalls backed by official documentation or well-known issues

**Research date:** 2026-01-21
**Valid until:** 30 days (GitHub Actions and @actions/core have stable APIs)
