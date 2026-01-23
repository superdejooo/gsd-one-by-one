# Phase 03: CCR Integration - Research

**Researched:** 2026-01-21
**Domain:** Anthropic Agent SDK integration for CI/CD
**Confidence:** HIGH

## Summary

The requirements reference "Claude Code Router (CCR)" but this appears to be a misunderstanding. Based on current ecosystem analysis, the correct approach for CI-safe, non-interactive LLM execution in GitHub Actions is to use the **Anthropic Agent SDK** (`@anthropic-ai/claude-agent-sdk`), NOT Claude Code Router.

**Critical clarification:**

- **Claude Code Router** (`@musistudio/claude-code-router`) is a third-party proxy tool that routes Claude Code requests to alternative AI providers (OpenRouter, DeepSeek, Ollama, Gemini). It's designed for users who want to use Claude Code with non-Anthropic models.
- **Anthropic Agent SDK** is the official Anthropic package for programmatic Claude integration in Node.js/TypeScript applications, with built-in support for CI/CD, headless mode, and GitHub Actions.

For this GitHub Action project, which needs to make LLM calls to Claude in a CI environment, the **Anthropic Agent SDK is the correct choice**. It provides:

- Official Anthropic support and stability
- Direct Claude API integration (no proxy needed)
- Built-in non-interactive/headless mode
- TypeScript-native API for Node.js 24.x runtime
- Proper error handling and session management

**Primary recommendation:** Use `@anthropic-ai/claude-agent-sdk` with ANTHROPIC_API_KEY from GitHub Secrets for CI-safe LLM execution. Install as a production dependency, not globally. Configure via environment variables, not config files.

## Standard Stack

The established stack for programmatic Claude integration in Node.js CI/CD environments:

### Core

| Library                        | Version        | Purpose                             | Why Standard                                           |
| ------------------------------ | -------------- | ----------------------------------- | ------------------------------------------------------ |
| @anthropic-ai/claude-agent-sdk | Latest (0.1.x) | Programmatic Claude agent execution | Official Anthropic SDK, designed for CI/CD integration |
| @anthropic-ai/sdk              | Latest         | Low-level Anthropic API client      | Peer dependency of Agent SDK, handles HTTP layer       |

### Supporting

| Library    | Version  | Purpose             | When to Use                            |
| ---------- | -------- | ------------------- | -------------------------------------- |
| Node.js    | >=18.0.0 | Runtime environment | Required for Agent SDK                 |
| TypeScript | >=4.9    | Type safety         | Optional but recommended for SDK usage |

### Alternatives Considered

| Instead of | Could Use                          | Tradeoff                                                                                                  |
| ---------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Agent SDK  | @musistudio/claude-code-router     | Router is for proxying to alternative models (OpenRouter, DeepSeek), not for direct Anthropic usage in CI |
| Agent SDK  | Direct REST API calls              | Loses session management, tool integration, automatic retry logic, and error handling                     |
| Agent SDK  | Claude Code CLI (`claude` command) | CLI designed for interactive use, not programmatic control                                                |

**Installation:**

```bash
npm install @anthropic-ai/claude-agent-sdk
```

**Note:** The Agent SDK should be installed as a **production dependency** in package.json, not globally. GitHub Actions will run `npm install` to get dependencies.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── index.js                 # Main GitHub Action entrypoint
├── commands/                # Command handlers
│   ├── gsd-new-milestone.js
│   └── ...
├── llm/                     # LLM integration layer
│   ├── agent.js            # Agent SDK wrapper
│   ├── prompts.js          # Prompt templates
│   └── config.js           # SDK configuration
└── utils/
    ├── config.js           # Config loading (already exists)
    └── validator.js        # Command validation (already exists)
```

### Pattern 1: Agent SDK Initialization

**What:** Initialize the Agent SDK with API key from environment variable
**When to use:** At module load time or lazy initialization in agent wrapper
**Example:**

```typescript
// src/llm/agent.js
import { query } from "@anthropic-ai/claude-agent-sdk";

export async function executeTask(prompt, options = {}) {
  // ANTHROPIC_API_KEY environment variable is used automatically
  const result = query({
    prompt,
    options: {
      model: "claude-sonnet-4-5-20250929", // Pin specific model
      permissionMode: "acceptEdits", // Auto-approve edits in CI
      allowedTools: options.allowedTools || [
        "Read",
        "Write",
        "Bash",
        "Glob",
        "Grep",
      ],
      maxTurns: options.maxTurns || 50,
      ...options,
    },
  });

  return result;
}
```

**Source:** [Agent SDK TypeScript Reference](https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-typescript)

### Pattern 2: Environment Variable Configuration

**What:** Configure SDK via environment variables, not config files
**When to use:** All CI/CD environments, especially GitHub Actions
**Example:**

```yaml
# .github/workflows/gsd-command-handler.yml
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  # Optional: CLAUDE_CODE_USE_BEDROCK=1 for AWS Bedrock
  # Optional: CLAUDE_CODE_USE_VERTEX=1 for Google Vertex AI
```

**Why:** Environment variables are secure, ephemeral, and standard for CI/CD. Config files at `~/.claude-code-router/config.json` are for CLI usage, not programmatic SDK usage.

### Pattern 3: Stream Processing in CI

**What:** Process Agent SDK message stream asynchronously
**When to use:** All Agent SDK query calls
**Example:**

```typescript
// src/llm/agent.js
export async function executeTaskAndCollectOutput(prompt, options = {}) {
  const messages = [];
  const toolUses = [];

  for await (const message of executeTask(prompt, options)) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if ("text" in block) {
          messages.push(block.text);
        }
        if (block.type === "tool_use") {
          toolUses.push(block);
        }
      }
    }
  }

  return {
    output: messages.join("\n"),
    toolUses,
  };
}
```

**Source:** [Agent SDK TypeScript Examples](https://github.com/anthropics/claude-agent-sdk-typescript)

### Pattern 4: Single-Turn Query (V2 Preview)

**What:** For simple, single-turn prompts without session management
**When to use:** Commands that don't require context or multi-turn conversation
**Example:**

```typescript
import { unstable_v2_prompt } from "@anthropic-ai/claude-agent-sdk";

export async function quickQuery(prompt) {
  const result = await unstable_v2_prompt(prompt, {
    model: "claude-sonnet-4-5-20250929",
  });
  return result.result;
}
```

**Source:** [TypeScript SDK V2 Preview](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview)

### Anti-Patterns to Avoid

- **Installing Agent SDK globally:** SDK should be a package.json dependency, not global install
- **Using `~/.claude-code-router/config.json`:** This is for Claude Code Router (third-party tool), not Agent SDK
- **Running `ccr` command:** CCR is a separate tool; Agent SDK is invoked programmatically via `import`
- **Treating Agent SDK like Claude Code CLI:** SDK is a library API, not a command-line tool
- **Breaking out of async iteration early:** Use flags or let iteration complete naturally to avoid asyncio cleanup issues

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem              | Don't Build                          | Use Instead                         | Why                                                                  |
| -------------------- | ------------------------------------ | ----------------------------------- | -------------------------------------------------------------------- |
| LLM API calls        | Custom fetch() to Claude API         | Agent SDK `query()`                 | SDK handles session management, retries, streaming, tool integration |
| Authentication       | Custom auth token management         | ANTHROPIC_API_KEY env var           | SDK auto-detects and validates                                       |
| Tool execution       | Custom tool invocation logic         | Agent SDK built-in tools            | Tools (Read, Write, Bash, etc.) are integrated and sandboxed         |
| Message parsing      | Custom JSON parsing of API responses | Agent SDK message types             | Type-safe message objects with proper error handling                 |
| Session management   | Custom conversation tracking         | Agent SDK sessions                  | Automatic session IDs, context management, resumption                |
| Error handling       | Try/catch around fetch()             | Agent SDK error handling            | Built-in retry logic, rate limiting, API error translation           |
| Non-interactive mode | Custom headless implementation       | SDK `permissionMode: "acceptEdits"` | Designed for CI/CD, no TTY prompts                                   |

**Key insight:** The Agent SDK encapsulates years of production experience with agentic workflows. Custom implementations miss critical edge cases (rate limiting, token counting, tool sandboxing, session recovery, async cleanup).

## Common Pitfalls

### Pitfall 1: Confusing Claude Code Router with Agent SDK

**What goes wrong:** Developers try to install `@musistudio/claude-code-router` and configure `~/.claude-code-router/config.json` for CI integration
**Why it happens:** Requirements or documentation use "CCR" or "Claude Code Router" ambiguously
**How to avoid:**

- Use Agent SDK (`@anthropic-ai/claude-agent-sdk`) for programmatic Anthropic integration
- Only use Claude Code Router if you need to proxy requests to non-Anthropic models (OpenRouter, DeepSeek)
  **Warning signs:**
- Installing CCR globally (`npm install -g @musistudio/claude-code-router`)
- Creating config files at `~/.claude-code-router/config.json`
- Running `ccr` command in CI

### Pitfall 2: API Key Authentication Confusion

**What goes wrong:** Setting ANTHROPIC_API_KEY when trying to use Claude subscription, or vice versa
**Why it happens:** Agent SDK supports both subscription auth and API key auth
**How to avoid:**

- For CI/CD: Always use ANTHROPIC_API_KEY with a Console API key
- For local dev: Claude Code CLI uses subscription auth (don't set ANTHROPIC_API_KEY)
- Verify with `/status` command in Claude Code CLI
  **Warning signs:**
- Unexpected API charges when using subscription
- Authentication errors in CI despite setting secret
  **Source:** [Managing API Key Environment Variables](https://support.claude.com/en/articles/12304248-managing-api-key-environment-variables-in-claude-code)

### Pitfall 3: Breaking Async Iteration Early

**What goes wrong:** Using `break` to exit `for await` loop causes asyncio cleanup issues
**Why it happens:** Developers want to stop iteration when a condition is met
**How to avoid:**

- Use flags to track completion but let iteration complete naturally
- Or use `return` from function instead of `break`
  **Warning signs:** Uncaught promise rejections, resource leaks
  **Source:** [Session Management Best Practices](https://platform.claude.com/docs/en/agent-sdk/sessions)

### Pitfall 4: Permission Mode Mismatch

**What goes wrong:** Agent SDK prompts for permission in CI, causing workflow to hang
**Why it happens:** Default permission mode is interactive
**How to avoid:**

- Always set `permissionMode: "acceptEdits"` or `permissionMode: "bypassPermissions"` in CI
- Use `allowedTools` to restrict available tools for security
  **Warning signs:**
- Workflow hangs waiting for input
- "Waiting for permission" messages in logs
  **Example:**

```typescript
// CI-safe configuration
options: {
  permissionMode: "acceptEdits", // Auto-approve file edits
  allowedTools: ["Read", "Write", "Glob", "Grep"], // No Bash in this example
}
```

### Pitfall 5: Global Installation in GitHub Actions

**What goes wrong:** Workflow tries to install Agent SDK globally or run CLI commands
**Why it happens:** Confusion with Claude Code CLI (which is global)
**How to avoid:**

- Install Agent SDK as package.json dependency
- Import and use programmatically, don't shell out to commands
  **Warning signs:**
- `npm install -g` in workflow
- `exec()` calls to `claude` or `ccr` commands
- Permission errors accessing global npm directories

### Pitfall 6: Ignoring API Errors

**What goes wrong:** API errors (401, 429, 529) appear as text messages in stream instead of throwing exceptions
**Why it happens:** Current SDK design returns errors as messages
**How to avoid:**

- Check message content for error indicators
- Implement retry logic for rate limits (429) and overloaded (529) responses
- Validate ANTHROPIC_API_KEY at workflow start
  **Warning signs:**
- Workflow completes "successfully" but no real work done
- Error text in output instead of results
  **Source:** [API Error Handling Issue](https://github.com/anthropics/claude-agent-sdk-python/issues/472)

### Pitfall 7: File System Side Effects in Testing

**What goes wrong:** Tests that use `acceptEdits` modify actual files, causing test pollution
**Why it happens:** Agent SDK has real file system access
**How to avoid:**

- Use temporary directories for tests
- Reset/cleanup files after each test run
- Consider mocking Agent SDK in unit tests
  **Warning signs:**
- Test failures after first run
- Git showing unexpected file changes after tests

## Code Examples

Verified patterns from official sources:

### Basic Agent SDK Usage in GitHub Action

```typescript
// src/llm/agent.js
import { query } from "@anthropic-ai/claude-agent-sdk";

/**
 * Execute a task with Claude Agent SDK in CI environment
 * ANTHROPIC_API_KEY must be set in environment
 */
export async function executeLLMTask(prompt, options = {}) {
  const defaults = {
    model: "claude-sonnet-4-5-20250929",
    permissionMode: "acceptEdits", // CI-safe, no prompts
    allowedTools: ["Read", "Write", "Glob", "Grep", "Bash"],
    maxTurns: 50,
  };

  const messages = [];

  try {
    for await (const message of query({
      prompt,
      options: { ...defaults, ...options },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if ("text" in block) {
            messages.push(block.text);
          }
        }
      }
    }

    return {
      success: true,
      output: messages.join("\n"),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
```

**Source:** [Agent SDK TypeScript Reference](https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-typescript)

### GitHub Actions Workflow Integration

```yaml
# .github/workflows/gsd-command-handler.yml
name: GSD Command Handler

on:
  issue_comment:
    types: [created]

jobs:
  handle-command:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"

      - name: Install dependencies
        run: npm install

      - name: Execute GSD command
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: node src/index.js
        # Agent SDK will automatically use ANTHROPIC_API_KEY
```

### Command Handler Pattern

```typescript
// src/commands/gsd-new-milestone.js
import { executeLLMTask } from "../llm/agent.js";

export async function handleNewMilestone(args) {
  const prompt = `
Create a new milestone based on this specification:
${JSON.stringify(args, null, 2)}

Review the codebase, create necessary files, and implement the milestone.
  `.trim();

  const result = await executeLLMTask(prompt, {
    allowedTools: ["Read", "Write", "Glob", "Grep", "Bash"],
    maxTurns: 100, // Complex tasks may need more turns
  });

  return result;
}
```

### Error Handling Pattern

```typescript
// src/llm/agent.js - Enhanced error handling
export async function executeLLMTaskWithRetry(
  prompt,
  options = {},
  maxRetries = 3,
) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeLLMTask(prompt, options);

      // Check if result contains API errors in text
      if (
        result.output.includes("429") ||
        result.output.includes("rate limit")
      ) {
        throw new Error("Rate limited");
      }
      if (
        result.output.includes("529") ||
        result.output.includes("overloaded")
      ) {
        throw new Error("Service overloaded");
      }

      return result;
    } catch (error) {
      lastError = error;

      // Don't retry auth errors
      if (
        error.message.includes("401") ||
        error.message.includes("authentication")
      ) {
        throw error;
      }

      // Exponential backoff for retryable errors
      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000),
        );
      }
    }
  }

  throw lastError;
}
```

## State of the Art

| Old Approach                              | Current Approach                               | When Changed  | Impact                                                                                        |
| ----------------------------------------- | ---------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------- |
| Claude Code CLI (`claude` command)        | Agent SDK programmatic API                     | November 2024 | SDK renamed from "Claude Code SDK" to "Agent SDK", reflecting broader use cases beyond coding |
| Manual API calls with `@anthropic-ai/sdk` | `@anthropic-ai/claude-agent-sdk`               | November 2024 | Higher-level SDK abstracts session management, tool integration, and agentic loop             |
| V1 API (`query()` only)                   | V2 Preview API (`unstable_v2_createSession()`) | January 2026  | Simplified session-based pattern with automatic cleanup                                       |
| Global config files                       | Environment variables only                     | Ongoing       | Better for CI/CD security and ephemeral environments                                          |

**Deprecated/outdated:**

- **Claude Code SDK:** Renamed to "Claude Agent SDK" (November 2024). Update imports from `@anthropic-ai/claude-code-sdk` to `@anthropic-ai/claude-agent-sdk`
- **Classic tokens:** Revoked in 2026. Use granular tokens (90-day max) with 2FA
- **Interactive permission prompts in CI:** Use `permissionMode: "acceptEdits"` or `"bypassPermissions"`

## Open Questions

Things that couldn't be fully resolved:

1. **API Error Handling Reliability**
   - What we know: Current SDK returns API errors as text in message stream instead of exceptions ([Issue #472](https://github.com/anthropics/claude-agent-sdk-python/issues/472))
   - What's unclear: Whether this is fixed in latest TypeScript SDK version
   - Recommendation: Implement defensive error detection by parsing message content for error indicators

2. **Claude Code Router vs Agent SDK Naming**
   - What we know: Requirements mention "Claude Code Router (CCR)" but this is a third-party tool
   - What's unclear: Whether requirements intended Agent SDK or actually want proxy to alternative models
   - Recommendation: Confirm with stakeholders - if using Anthropic models, use Agent SDK; if proxying to OpenRouter/DeepSeek, use Claude Code Router

3. **Token Cost Management**
   - What we know: Agent SDK uses Claude API (pay-per-use)
   - What's unclear: Expected token usage and cost for typical GSD commands
   - Recommendation: Monitor usage in initial deployments, set budget alerts in Anthropic Console

4. **Session Persistence in Stateless CI**
   - What we know: Agent SDK supports session resumption via session IDs
   - What's unclear: Whether sessions should persist across workflow runs or be ephemeral
   - Recommendation: Start with ephemeral sessions (each workflow run is independent), consider persistence if multi-turn conversations across runs are needed

## Sources

### Primary (HIGH confidence)

- [Agent SDK TypeScript Reference](https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-typescript) - Official API documentation
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview) - Architecture and concepts
- [Agent SDK Quickstart](https://platform.claude.com/docs/en/agent-sdk/quickstart) - Installation and setup
- [@anthropic-ai/claude-agent-sdk npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) - Package registry
- [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) - Official Anthropic blog
- [Session Management Documentation](https://platform.claude.com/docs/en/agent-sdk/sessions) - Best practices
- [Managing API Keys](https://support.claude.com/en/articles/12304248-managing-api-key-environment-variables-in-claude-code) - Authentication guidance

### Secondary (MEDIUM confidence)

- [GitHub - anthropics/claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript) - Source repository
- [GitHub - anthropics/claude-agent-sdk-demos](https://github.com/anthropics/claude-agent-sdk-demos) - Example implementations
- [TypeScript SDK V2 Preview](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview) - Next-gen API

### Tertiary (LOW confidence - Claude Code Router, not Agent SDK)

- [GitHub - musistudio/claude-code-router](https://github.com/musistudio/claude-code-router) - Third-party proxy tool
- [@musistudio/claude-code-router npm](https://www.npmjs.com/package/@musistudio/claude-code-router) - Package registry

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Official Anthropic SDK with clear documentation
- Architecture: HIGH - Official examples and TypeScript reference available
- Pitfalls: MEDIUM - Some known issues documented in GitHub issues, production experience needed

**Critical clarification needed:**
The requirements specify "Claude Code Router (CCR)" but this appears to be incorrect terminology. The standard approach for CI-safe Claude integration is the **Anthropic Agent SDK**, not Claude Code Router. Claude Code Router is a third-party tool for proxying to alternative models. This research assumes Agent SDK is the correct approach for direct Anthropic usage in GitHub Actions.

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - relatively stable SDK, but fast-moving AI space)
