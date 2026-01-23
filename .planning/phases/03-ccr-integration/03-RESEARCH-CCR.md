# Phase 03: CCR Integration - Claude Code Router Research

**Researched:** 2026-01-21
**Domain:** Claude Code Router (@musistudio/claude-code-router) for multi-provider LLM routing in GitHub Actions
**Confidence:** MEDIUM to HIGH (official docs verified, some GitHub Actions patterns inferred)

## Summary

Claude Code Router (CCR) is a **proxy server** tool that intercepts Claude Code requests and routes them to alternative AI providers (OpenRouter, DeepSeek, Ollama, Gemini, etc.). It allows using Claude Code's infrastructure while directing API calls to non-Anthropic models for cost optimization or multi-provider flexibility.

**Critical architectural insight:** CCR is NOT a Node.js library with a programmatic API. It's a CLI tool that runs as a background service/proxy server. Integration requires:

1. Installing CCR globally (`npm install -g @musistudio/claude-code-router`)
2. Starting the CCR service (`ccr start`)
3. Configuring providers in `~/.claude-code-router/config.json`
4. Setting `ANTHROPIC_BASE_URL` environment variable to point to the local CCR server (default: `http://127.0.0.1:3456`)
5. Using the official Anthropic `claude-code-action` (not CCR-specific action) with the base URL override

**Primary recommendation:** For GitHub Actions integration, CCR acts as middleware. Install and start CCR service in workflow, configure it with `NON_INTERACTIVE_MODE: true`, then use standard Anthropic tooling (Claude Code CLI or Agent SDK) pointed at the CCR proxy endpoint.

**Alternative consideration:** If the project only needs Anthropic models (not multi-provider routing), the Anthropic Agent SDK (`@anthropic-ai/claude-agent-sdk`) is simpler and doesn't require proxy architecture. CCR adds value when routing to OpenRouter, DeepSeek, or other providers.

## Package Information

| Attribute                   | Details                                         |
| --------------------------- | ----------------------------------------------- |
| **npm Package**             | `@musistudio/claude-code-router`                |
| **Current Version**         | 2.0.0 (as of 2026-01-14)                        |
| **Latest Update**           | 14 days ago (actively maintained)               |
| **Installation**            | `npm install -g @musistudio/claude-code-router` |
| **Node.js Requirement**     | >= 18.0.0                                       |
| **Package Manager Options** | npm, pnpm (>= 8.0.0), yarn                      |
| **License**                 | MIT                                             |
| **Maintenance Status**      | ACTIVE (27 releases in ~1 month)                |

**Confidence:** HIGH - Verified from npm package registry and official documentation

**Sources:**

- [npm package page](https://www.npmjs.com/package/@musistudio/claude-code-router)
- [GitHub repository](https://github.com/musistudio/claude-code-router)
- [Package.json](https://github.com/musistudio/claude-code-router/blob/main/package.json)

## API Patterns

### CCR is a CLI Tool, Not a Programmatic Library

**Critical Finding:** CCR does **not** expose a Node.js API for `import` or `require`. It's a command-line tool that operates as a proxy service.

**Architecture:**

```
GitHub Actions Workflow
  ↓
1. Install CCR globally (npm install -g)
  ↓
2. Start CCR service (ccr start - runs background proxy server)
  ↓
3. Set ANTHROPIC_BASE_URL=http://127.0.0.1:3456
  ↓
4. Use Claude Code CLI or Agent SDK (routes through CCR proxy)
  ↓
5. CCR intercepts requests, routes to configured provider
```

### CLI Commands Available

| Command                     | Purpose                              | Usage Context                |
| --------------------------- | ------------------------------------ | ---------------------------- |
| `ccr code`                  | Start Claude Code using router       | Interactive CLI development  |
| `ccr start`                 | Start CCR proxy service              | Background service (CI/CD)   |
| `ccr restart`               | Restart service after config changes | After modifying config.json  |
| `ccr model`                 | Interactive model selector           | Manual model switching       |
| `ccr ui`                    | Web-based configuration interface    | Visual config management     |
| `ccr activate`              | Output shell environment variables   | Shell integration            |
| `ccr statusline`            | Read JSON from stdin for status      | Shell statusline integration |
| `ccr preset export [name]`  | Export current config as preset      | Configuration sharing        |
| `ccr preset install [path]` | Install preset configuration         | Quick setup                  |
| `ccr --version`             | Show version                         | Verification                 |

**Confidence:** HIGH - Verified from official documentation

### GitHub Actions Integration Pattern

**Workflow pattern for CCR in CI:**

```yaml
- name: Install Claude Code Router
  run: npm install -g @musistudio/claude-code-router

- name: Configure CCR
  run: |
    mkdir -p $HOME/.claude-code-router
    cat << 'EOF' > $HOME/.claude-code-router/config.json
    {
      "NON_INTERACTIVE_MODE": true,
      "LOG": true,
      "API_TIMEOUT_MS": 600000,
      "Providers": [
        {
          "name": "openrouter",
          "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
          "api_key": "${{ secrets.OPENROUTER_API_KEY }}",
          "models": ["anthropic/claude-sonnet-4"],
          "transformer": {
            "use": ["openrouter"]
          }
        }
      ],
      "Router": {
        "default": "openrouter,anthropic/claude-sonnet-4"
      }
    }
    EOF

- name: Start CCR Service
  run: nohup ccr start &
  # Runs as background service on port 3456 by default

- name: Use Claude Code (via CCR proxy)
  env:
    ANTHROPIC_BASE_URL: http://127.0.0.1:3456
  run: |
    # Option 1: Use Claude Code CLI
    claude --prompt "Your task here"

    # Option 2: Use Agent SDK with base URL override
    # SDK will automatically use ANTHROPIC_BASE_URL
```

**Confidence:** MEDIUM - Pattern inferred from GitHub Actions example and official documentation

**Sources:**

- [GitHub Actions Integration Example](https://github.com/musistudio/claude-code-router)
- [Official Installation Guide](https://musistudio.github.io/claude-code-router/docs/cli/installation/)

## Configuration Schema

### File Location

**Primary:** `~/.claude-code-router/config.json`

The configuration file uses **JSON5 format** (allows comments and flexible syntax).

**Auto-discovery:** CCR automatically reads this file on startup. No explicit path parameter required.

**Backups:** CCR maintains last 3 versions of config.json automatically.

**Confidence:** HIGH - Verified from official documentation

### Complete Schema

```json5
{
  // === Service Configuration ===

  HOST: "127.0.0.1",
  // Optional: Server host address
  // If APIKEY is not set, forced to 127.0.0.1 for security
  // Default: 127.0.0.1

  PORT: 3456,
  // Optional: Server port (not explicitly documented, inferred from examples)
  // Default: 3456

  APIKEY: "your-secret-key",
  // Optional: Authentication secret for CCR API
  // Clients must provide in Authorization: Bearer <key> or x-api-key: <key>
  // If unset, no authentication required (local-only access)

  PROXY_URL: "http://127.0.0.1:7890",
  // Optional: HTTP proxy for outbound API requests
  // Format: http://host:port

  // === Non-Interactive Mode (CI/CD) ===

  NON_INTERACTIVE_MODE: true,
  // CRITICAL for GitHub Actions: Prevents prompts, sets CI env vars
  // When true, CCR sets: CI=true, FORCE_COLOR=0, and configures stdin
  // Default: false
  // Confidence: HIGH

  // === Logging Configuration ===

  LOG: true,
  // Enable/disable logging
  // When false, no log files created
  // Default: true

  LOG_LEVEL: "debug",
  // Options: "fatal", "error", "warn", "info", "debug", "trace"
  // Server logs: ~/.claude-code-router/logs/ccr-*.log
  // Application logs: ~/.claude-code-router/claude-code-router.log
  // Default: "debug"

  // === Request Configuration ===

  API_TIMEOUT_MS: 600000,
  // Timeout for API requests in milliseconds
  // Default: 600000 (10 minutes)

  // === Environment Variable Interpolation ===

  // Use $VAR_NAME or ${VAR_NAME} anywhere in config
  // Example: "api_key": "$OPENROUTER_API_KEY"
  // Recursively replaced before processing

  // === Providers Array ===

  Providers: [
    {
      name: "openrouter",
      // Unique identifier for this provider
      // Required: must be unique across all providers

      api_base_url: "https://openrouter.ai/api/v1/chat/completions",
      // Full endpoint URL for chat completions
      // Required: must be a complete URL

      api_key: "$OPENROUTER_API_KEY",
      // Provider authentication token
      // Required: can use env var interpolation

      models: [
        "google/gemini-2.5-pro-preview",
        "anthropic/claude-sonnet-4",
        "anthropic/claude-3.5-sonnet",
        "anthropic/claude-3.7-sonnet:thinking",
      ],
      // Array of model identifiers available from this provider
      // Required: must list at least one model

      transformer: {
        use: ["openrouter"],
        // Optional: Request/response adapters
        // Available transformers: anthropic, deepseek, gemini, openrouter,
        //   groq, maxtoken, tooluse, reasoning, enhancetool
      },
    },
    {
      name: "deepseek",
      api_base_url: "https://api.deepseek.com/chat/completions",
      api_key: "$DEEPSEEK_API_KEY",
      models: ["deepseek-chat", "deepseek-reasoner"],
      transformer: {
        use: ["deepseek"],
        // Model-specific transformer configuration
        "deepseek-chat": {
          use: ["tooluse"],
        },
      },
    },
    {
      name: "ollama",
      api_base_url: "http://localhost:11434/v1/chat/completions",
      api_key: "ollama",
      models: ["qwen2.5-coder:latest"],
      // No transformer needed for Ollama
    },
    {
      name: "gemini",
      api_base_url: "https://generativelanguage.googleapis.com/v1beta/models/",
      api_key: "$GEMINI_API_KEY",
      models: ["gemini-2.5-flash", "gemini-2.5-pro"],
      transformer: {
        use: ["gemini"],
      },
    },
  ],

  // === Router Configuration ===

  Router: {
    default: "deepseek,deepseek-chat",
    // Format: "provider_name,model_name"
    // Used for all requests unless scenario-specific route exists
    // Required: must specify at least default

    background: "ollama,qwen2.5-coder:latest",
    // Optional: For simple, low-cost background tasks

    think: "deepseek,deepseek-reasoner",
    // Optional: For complex reasoning, planning, architectural tasks

    longContext: "openrouter,google/gemini-2.5-pro-preview",
    // Optional: For tasks exceeding longContextThreshold

    longContextThreshold: 60000,
    // Token count threshold for triggering longContext model
    // Default: 60000
    // Token calculation uses tiktoken (cl100k_base)

    webSearch: "gemini,gemini-2.5-flash",
    // Optional: For web search tasks (requires model support)

    image: "openrouter,anthropic/claude-sonnet-4",
    // Optional (beta): For image-related tasks
    // If model doesn't support tool calling, set config.forceUseImageAgent: true
  },

  // === Transformers Array (Advanced) ===

  transformers: [
    // Load custom external transformers
    // Array of paths to custom transformer modules
  ],

  // === Custom Router (Advanced) ===

  CUSTOM_ROUTER_PATH: "/path/to/custom-router.js",
  // Optional: Load custom routing logic from external JavaScript file
  // For advanced routing scenarios beyond built-in Router object
}
```

**Confidence:** HIGH for documented fields, MEDIUM for inferred fields (PORT)

### Required vs Optional Fields

| Field                         | Required? | Default      | Notes                           |
| ----------------------------- | --------- | ------------ | ------------------------------- |
| `Providers`                   | Yes       | N/A          | Must have at least one provider |
| `Providers[].name`            | Yes       | N/A          | Unique identifier               |
| `Providers[].api_base_url`    | Yes       | N/A          | Full endpoint URL               |
| `Providers[].api_key`         | Yes       | N/A          | Can use env var interpolation   |
| `Providers[].models`          | Yes       | N/A          | At least one model              |
| `Router.default`              | Yes       | N/A          | Primary model selection         |
| `NON_INTERACTIVE_MODE`        | No        | false        | **Set to true for CI/CD**       |
| `LOG`                         | No        | true         | Enable logging                  |
| `LOG_LEVEL`                   | No        | "debug"      | Verbosity level                 |
| `API_TIMEOUT_MS`              | No        | 600000       | Request timeout                 |
| `HOST`                        | No        | "127.0.0.1"  | Server host                     |
| `APIKEY`                      | No        | N/A          | Service authentication          |
| `PROXY_URL`                   | No        | N/A          | Outbound proxy                  |
| `Router.background`           | No        | Uses default | Background tasks model          |
| `Router.think`                | No        | Uses default | Reasoning tasks model           |
| `Router.longContext`          | No        | Uses default | Long context model              |
| `Router.longContextThreshold` | No        | 60000        | Token threshold                 |

**Confidence:** HIGH

**Sources:**

- [GitHub CLAUDE.md Documentation](https://github.com/musistudio/claude-code-router/blob/main/CLAUDE.md)
- [Configuration Examples](https://github.com/musistudio/claude-code-router)

## Multi-Provider Setup

### Supported Providers

| Provider             | Base URL                                                   | Transformer  | Notes                                               |
| -------------------- | ---------------------------------------------------------- | ------------ | --------------------------------------------------- |
| **OpenRouter**       | `https://openrouter.ai/api/v1/chat/completions`            | `openrouter` | Access to 400+ models including Claude, GPT, Gemini |
| **DeepSeek**         | `https://api.deepseek.com/chat/completions`                | `deepseek`   | Cost-effective reasoning models                     |
| **Ollama**           | `http://localhost:11434/v1/chat/completions`               | None         | Local models, no API key needed                     |
| **Gemini**           | `https://generativelanguage.googleapis.com/v1beta/models/` | `gemini`     | Google's models                                     |
| **Anthropic Direct** | (Via OpenRouter or direct)                                 | `anthropic`  | Direct Anthropic API (less useful with CCR)         |
| **Groq**             | `https://api.groq.com/openai/v1`                           | `groq`       | Fast inference                                      |
| **Volcengine**       | (Provider-specific)                                        | Custom       | Chinese cloud provider                              |
| **SiliconFlow**      | (Provider-specific)                                        | Custom       | Chinese cloud provider                              |
| **ModelScope**       | (Provider-specific)                                        | Custom       | Alibaba model hub                                   |
| **DashScope**        | (Provider-specific)                                        | Custom       | Alibaba cloud                                       |
| **AIHubMix**         | (Provider-specific)                                        | Custom       | Model aggregator                                    |

**Confidence:** HIGH for documented providers, MEDIUM for Chinese providers (mentioned but not detailed)

### Configuration Pattern

**1. Define Multiple Providers:**

```json
{
  "Providers": [
    {
      "name": "openrouter",
      "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
      "api_key": "$OPENROUTER_API_KEY",
      "models": ["anthropic/claude-sonnet-4", "google/gemini-2.5-pro-preview"],
      "transformer": { "use": ["openrouter"] }
    },
    {
      "name": "deepseek",
      "api_base_url": "https://api.deepseek.com/chat/completions",
      "api_key": "$DEEPSEEK_API_KEY",
      "models": ["deepseek-chat", "deepseek-reasoner"],
      "transformer": { "use": ["deepseek"] }
    }
  ]
}
```

**2. Configure Routing Rules:**

```json
{
  "Router": {
    "default": "deepseek,deepseek-chat",
    "think": "deepseek,deepseek-reasoner",
    "longContext": "openrouter,google/gemini-2.5-pro-preview"
  }
}
```

**3. Environment Variable Management:**

Use environment variables for API keys:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export DEEPSEEK_API_KEY="sk-..."
```

Then reference in config.json:

```json
{
  "Providers": [
    {
      "api_key": "$OPENROUTER_API_KEY"
    }
  ]
}
```

**Confidence:** HIGH

### Provider Priority/Fallback Mechanism

**Routing Strategy:**

CCR uses **scenario-based routing**, NOT automatic fallback:

1. **Scenario Detection:** CCR analyzes the request context (token count, task type)
2. **Scenario Matching:** Matches to Router scenario (default, background, think, longContext, webSearch, image)
3. **Provider Selection:** Uses the provider,model pair configured for that scenario
4. **No Auto-Fallback:** If the selected provider fails, CCR does NOT automatically try another provider

**Scenario Mapping:**

| Scenario      | Trigger Condition                               | Example Use Case                 |
| ------------- | ----------------------------------------------- | -------------------------------- |
| `default`     | No other scenario matches                       | General coding tasks             |
| `background`  | Simple, low-token tasks                         | Quick file operations            |
| `think`       | Complex reasoning needed                        | Architecture decisions, planning |
| `longContext` | Tokens > `longContextThreshold` (default 60000) | Large codebase analysis          |
| `webSearch`   | Web search capability needed                    | Current info retrieval           |
| `image`       | Image processing tasks                          | Visual content analysis          |

**Manual Model Switching:**

Users can override routing with in-chat commands:

```
/model openrouter,anthropic/claude-sonnet-4
```

Or use the interactive model selector:

```bash
ccr model
```

**Confidence:** MEDIUM - Inferred from documentation, no explicit fallback mechanism documented

**Sources:**

- [Router Configuration](https://github.com/musistudio/claude-code-router)
- [ClaudeLog Documentation](https://claudelog.com/claude-code-mcps/claude-code-router/)

## Non-Interactive Execution

### CI/CD Configuration

**Key Field:** `"NON_INTERACTIVE_MODE": true`

**What it does:**

1. Sets `CI=true` environment variable
2. Sets `FORCE_COLOR=0` (disables color output)
3. Configures stdin handling to prevent process hangs
4. Disables interactive prompts

**Critical for GitHub Actions:** Without this setting, CCR will hang waiting for user input in automated environments.

**Confidence:** HIGH

### Complete GitHub Actions Pattern

```yaml
name: GSD Command with CCR

on:
  issue_comment:
    types: [created]

jobs:
  gsd-handler:
    if: contains(github.event.comment.body, '/gsd')
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "24"

      - name: Install Claude Code Router
        run: npm install -g @musistudio/claude-code-router

      - name: Configure CCR for CI
        run: |
          mkdir -p $HOME/.claude-code-router
          cat << 'EOF' > $HOME/.claude-code-router/config.json
          {
            "NON_INTERACTIVE_MODE": true,
            "LOG": true,
            "LOG_LEVEL": "info",
            "API_TIMEOUT_MS": 600000,
            "Providers": [
              {
                "name": "openrouter",
                "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
                "api_key": "${{ secrets.OPENROUTER_API_KEY }}",
                "models": ["anthropic/claude-sonnet-4"],
                "transformer": {"use": ["openrouter"]}
              }
            ],
            "Router": {
              "default": "openrouter,anthropic/claude-sonnet-4"
            }
          }
          EOF

      - name: Start CCR Service
        run: |
          nohup ccr start > ccr.log 2>&1 &
          sleep 5  # Give service time to start

          # Verify service is running
          curl -f http://127.0.0.1:3456/health || (cat ccr.log && exit 1)

      - name: Install dependencies
        run: npm install

      - name: Execute GSD command
        env:
          ANTHROPIC_BASE_URL: http://127.0.0.1:3456
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Your GSD handler code here
          # Agent SDK or Claude Code CLI will automatically use CCR via ANTHROPIC_BASE_URL
          node src/index.js

      - name: Upload CCR logs (on failure)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: ccr-logs
          path: |
            ccr.log
            ~/.claude-code-router/logs/
            ~/.claude-code-router/claude-code-router.log
```

**Confidence:** MEDIUM - Pattern constructed from examples and documentation, not officially tested

### Error Handling in CI

**Common Issues:**

1. **Service Not Starting:**
   - Symptom: Workflow hangs or fails to connect to CCR
   - Solution: Add health check after `ccr start`, review logs

2. **Authentication Errors:**
   - Symptom: 401/403 responses from providers
   - Solution: Verify secrets are correctly set and interpolated

3. **Timeout Issues:**
   - Symptom: Workflow times out during long operations
   - Solution: Increase `API_TIMEOUT_MS` or GitHub Actions timeout

**Confidence:** MEDIUM - Inferred from common CI patterns

**Sources:**

- [GitHub Actions Integration Example](https://github.com/musistudio/claude-code-router)
- [NON_INTERACTIVE_MODE Documentation](https://github.com/musistudio/claude-code-router/blob/main/CLAUDE.md)

## Config Discovery

### Automatic Configuration Loading

**Default Path:** `~/.claude-code-router/config.json`

**Discovery Mechanism:**

1. CCR automatically reads from `~/.claude-code-router/config.json` on startup
2. No command-line flag or explicit path parameter required
3. Config file MUST exist before running `ccr start`

**Confidence:** HIGH

### Environment Variables

**CCR-Specific Variables:**

| Variable               | Purpose                                   | Usage                                              |
| ---------------------- | ----------------------------------------- | -------------------------------------------------- |
| `ANTHROPIC_BASE_URL`   | Point Claude tools to CCR proxy           | Set to `http://127.0.0.1:3456`                     |
| `ANTHROPIC_AUTH_TOKEN` | API key for Anthropic (overridden by CCR) | Set by `ccr activate`                              |
| `ANTHROPIC_API_KEY`    | Alternative API key variable              | Should be empty when using CCR                     |
| `CUSTOM_ROUTER_PATH`   | Load custom routing logic                 | Path to custom router JS file                      |
| `LOG_LEVEL`            | Override config logging level             | `fatal`, `error`, `warn`, `info`, `debug`, `trace` |

**Config Interpolation Variables:**

ANY environment variable can be referenced in config.json using `$VAR_NAME` or `${VAR_NAME}` syntax:

```json
{
  "Providers": [
    {
      "api_key": "$OPENROUTER_API_KEY",
      "api_base_url": "${CUSTOM_API_BASE}"
    }
  ]
}
```

Variables are recursively replaced before config processing.

**Confidence:** HIGH

### Shell Integration (ccr activate)

**What `ccr activate` does:**

Outputs shell commands to set environment variables for direct Claude Code CLI usage:

```bash
export ANTHROPIC_AUTH_TOKEN="<api-key-from-config>"
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export NO_PROXY="127.0.0.1"
```

**Usage:**

```bash
# One-time activation (current shell only)
eval "$(ccr activate)"

# Persistent activation (add to shell profile)
echo 'eval "$(ccr activate)"' >> ~/.zshrc
```

After activation, `claude` command automatically routes through CCR without needing `ccr code`.

**Confidence:** HIGH

### Configuration Changes and Reload

**Hot Reload:** NOT supported

After modifying `~/.claude-code-router/config.json`, you MUST restart the service:

```bash
ccr restart
```

This is important for GitHub Actions - if config changes between workflow runs, ensure service is restarted.

**Confidence:** HIGH

**Sources:**

- [CLAUDE.md Documentation](https://github.com/musistudio/claude-code-router/blob/main/CLAUDE.md)
- [Configuration Guide](https://github.com/musistudio/claude-code-router)

## Installation

### Package Details

**npm Package:** `@musistudio/claude-code-router`

**Current Version:** 2.0.0 (as of 2026-01-14)

**Installation Command:**

```bash
npm install -g @musistudio/claude-code-router
```

**Prerequisites:**

- Node.js >= 18.0.0
- API key from chosen LLM provider(s)

**Verification:**

```bash
ccr --version
```

**Confidence:** HIGH

### Version Stability

**Release Cadence:**

- 27 releases in ~1 month (very active development)
- Latest release: 14 days ago (2.0.0)
- Previous version: 1.0.26

**Stability Assessment:**

- **MEDIUM stability** - Rapid release cycle suggests active development and potential breaking changes
- Recommend pinning to specific version in GitHub Actions: `@musistudio/claude-code-router@2.0.0`
- Monitor releases: https://github.com/musistudio/claude-code-router/releases

**Confidence:** MEDIUM - Based on release history analysis

### Alternative Installation Methods

**pnpm:**

```bash
pnpm add -g @musistudio/claude-code-router
```

**Yarn:**

```bash
yarn global add @musistudio/claude-code-router
```

**Confidence:** HIGH

### Related Packages

**Alternative forks:**

- `@tellerlin/claude-code-router` (v1.1.2, 6 months old - potentially outdated)
- `@rikaaa0928/claude-code-router` (variant)
- `@datartech/claude-code-router` (v1.0.32, 5 months old)

**Recommendation:** Use the official `@musistudio/claude-code-router` for most recent updates and community support.

**Confidence:** HIGH

**Sources:**

- [npm Package Registry](https://www.npmjs.com/package/@musistudio/claude-code-router)
- [Installation Guide](https://musistudio.github.io/claude-code-router/docs/cli/installation/)
- [GitHub Repository](https://github.com/musistudio/claude-code-router)

## Confidence Assessment

| Area                          | Confidence Level | Reason                                                               |
| ----------------------------- | ---------------- | -------------------------------------------------------------------- |
| **Package Information**       | HIGH             | Verified from npm registry, GitHub repo, and official docs           |
| **API Patterns**              | MEDIUM-HIGH      | CLI commands verified; GitHub Actions pattern inferred from examples |
| **Configuration Schema**      | HIGH             | Comprehensive documentation in CLAUDE.md, verified examples          |
| **Multi-Provider Setup**      | HIGH             | Multiple examples and official transformer list available            |
| **Non-Interactive Execution** | HIGH             | `NON_INTERACTIVE_MODE` explicitly documented for CI/CD               |
| **Config Discovery**          | HIGH             | Default path and env var interpolation clearly documented            |
| **Installation**              | HIGH             | npm package verified, official installation guide available          |

### Open Questions

1. **Health Check Endpoint:**
   - What we know: Example workflow uses `http://127.0.0.1:3456/health`
   - What's unclear: Whether this endpoint is officially documented or inferred
   - Recommendation: Test in actual workflow, may need to verify service via different method

2. **Error Handling and Retry Logic:**
   - What we know: CCR routes to configured provider/model pairs
   - What's unclear: How CCR handles provider API errors, rate limits, or unavailability
   - Recommendation: Implement error handling in workflow layer, don't rely on CCR retry

3. **Session Persistence:**
   - What we know: CCR runs as a stateful service
   - What's unclear: Whether conversation sessions persist across multiple API calls
   - Recommendation: Assume ephemeral sessions in GitHub Actions (new conversation per workflow run)

4. **Performance Impact:**
   - What we know: CCR adds proxy layer between client and provider
   - What's unclear: Latency overhead, especially in CI environment
   - Recommendation: Monitor workflow execution time, consider direct provider access if CCR adds significant overhead

5. **Preset System for CI:**
   - What we know: `ccr preset export/install` exists for sharing configs
   - What's unclear: Whether presets work well in CI or if manual config.json is better
   - Recommendation: Use manual config.json generation in workflows (more explicit and debuggable)

## Architecture Decision Comparison

### Option A: Use Claude Code Router (Multi-Provider)

**Pros:**

- Multi-provider flexibility (OpenRouter, DeepSeek, etc.)
- Cost optimization via provider selection
- Scenario-based routing (cheap models for background, powerful for thinking)
- Provider competition/redundancy

**Cons:**

- Additional complexity (proxy service architecture)
- Rapid development cycle (potential breaking changes)
- Stateful service in stateless CI (requires careful setup)
- Extra point of failure (CCR service must be running)

**Best For:** Projects requiring multiple AI providers or cost optimization through provider mixing

### Option B: Use Anthropic Agent SDK (Direct)

**Pros:**

- Simpler architecture (no proxy)
- Official Anthropic support
- Stateless design (better for CI)
- Fewer moving parts

**Cons:**

- Single provider (Anthropic only)
- No cost optimization via provider switching
- Higher API costs (Anthropic direct pricing)

**Best For:** Projects committed to Anthropic models, prioritizing simplicity over multi-provider flexibility

### Recommendation for This Project

**User confirmed using CCR** (from context), so proceed with CCR integration BUT:

1. **Start simple:** Use one provider (OpenRouter with Anthropic models) initially
2. **Plan for complexity:** Document CCR service lifecycle in workflows
3. **Monitor stability:** Pin CCR version, watch for breaking changes
4. **Have fallback:** Design architecture so CCR could be replaced with direct SDK if needed
5. **Test thoroughly:** CCR's proxy architecture introduces points of failure not present in direct SDK

## Code Examples

### Minimal GitHub Actions Workflow with CCR

```yaml
name: Minimal CCR Test

on: workflow_dispatch

jobs:
  test-ccr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"

      - name: Setup CCR
        run: |
          npm install -g @musistudio/claude-code-router@2.0.0
          mkdir -p ~/.claude-code-router

          cat > ~/.claude-code-router/config.json << 'EOF'
          {
            "NON_INTERACTIVE_MODE": true,
            "LOG": true,
            "Providers": [{
              "name": "openrouter",
              "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
              "api_key": "${{ secrets.OPENROUTER_API_KEY }}",
              "models": ["anthropic/claude-sonnet-4"],
              "transformer": {"use": ["openrouter"]}
            }],
            "Router": {
              "default": "openrouter,anthropic/claude-sonnet-4"
            }
          }
          EOF

          nohup ccr start &
          sleep 3

      - name: Test with Agent SDK
        env:
          ANTHROPIC_BASE_URL: http://127.0.0.1:3456
          ANTHROPIC_API_KEY: "dummy-key-required-by-sdk"
        run: |
          npm install @anthropic-ai/claude-agent-sdk

          node << 'SCRIPT'
          const { query } = require('@anthropic-ai/claude-agent-sdk');

          async function test() {
            for await (const msg of query({
              prompt: "Echo: Hello from CCR!",
              options: { model: "claude-sonnet-4-5-20250929" }
            })) {
              if (msg.type === "assistant") {
                console.log(msg.message.content);
              }
            }
          }

          test();
          SCRIPT
```

### Config with Multiple Providers and Routing

```json
{
  "NON_INTERACTIVE_MODE": true,
  "LOG": true,
  "LOG_LEVEL": "info",
  "API_TIMEOUT_MS": 600000,

  "Providers": [
    {
      "name": "openrouter",
      "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
      "api_key": "$OPENROUTER_API_KEY",
      "models": ["anthropic/claude-sonnet-4", "google/gemini-2.5-pro-preview"],
      "transformer": { "use": ["openrouter"] }
    },
    {
      "name": "deepseek",
      "api_base_url": "https://api.deepseek.com/chat/completions",
      "api_key": "$DEEPSEEK_API_KEY",
      "models": ["deepseek-chat", "deepseek-reasoner"],
      "transformer": {
        "use": ["deepseek"],
        "deepseek-chat": { "use": ["tooluse"] }
      }
    }
  ],

  "Router": {
    "default": "deepseek,deepseek-chat",
    "background": "deepseek,deepseek-chat",
    "think": "deepseek,deepseek-reasoner",
    "longContext": "openrouter,google/gemini-2.5-pro-preview",
    "longContextThreshold": 60000
  }
}
```

### OpenRouter-Specific Configuration (Without CCR)

**Alternative pattern:** Direct OpenRouter configuration without CCR proxy

```bash
# Set in shell or .claude/settings.local.json
export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_AUTH_TOKEN="$OPENROUTER_API_KEY"
export ANTHROPIC_API_KEY=""  # Must be empty!
```

This bypasses CCR entirely but loses routing features.

**Confidence:** HIGH - Verified from OpenRouter official docs

**Source:** [OpenRouter Claude Code Integration](https://openrouter.ai/docs/guides/guides/claude-code-integration)

## Sources

### Primary (HIGH confidence)

- [GitHub: musistudio/claude-code-router](https://github.com/musistudio/claude-code-router) - Main repository
- [GitHub: CLAUDE.md](https://github.com/musistudio/claude-code-router/blob/main/CLAUDE.md) - Technical documentation
- [npm: @musistudio/claude-code-router](https://www.npmjs.com/package/@musistudio/claude-code-router) - Package registry
- [Official Documentation](https://musistudio.github.io/claude-code-router/) - Project website
- [Installation Guide](https://musistudio.github.io/claude-code-router/docs/cli/installation/) - Setup instructions
- [OpenRouter Claude Code Integration](https://openrouter.ai/docs/guides/guides/claude-code-integration) - Provider-specific guide

### Secondary (MEDIUM confidence)

- [GitHub: musistudio/claude-code-router-action](https://github.com/musistudio/claude-code-router-action) - GitHub Actions integration
- [ClaudeLog: Claude Code Router](https://claudelog.com/claude-code-mcps/claude-code-router/) - Community documentation
- [GitHub Actions Integration Examples](https://zread.ai/musistudio/claude-code-router/30-github-actions-integration) - Workflow patterns

### Tertiary (LOW confidence - verification needed)

- Community blog posts and guides (various sources in WebSearch results)
- Inferred patterns from example workflows

## Metadata

**Research date:** 2026-01-21
**Valid until:** 2026-02-04 (14 days - fast-moving project with active development)

**Researcher notes:**

This research revealed that CCR is architecturally different from the Anthropic Agent SDK covered in the prior RESEARCH.md file. Key differences:

1. **CCR = Proxy Service** (runs as background process)
2. **Agent SDK = Library** (imported into Node.js code)

For the GitHub Actions project, the architecture will be:

```
Workflow → Install CCR → Start CCR Service → Configure ANTHROPIC_BASE_URL → Use Agent SDK → Routes through CCR → Provider APIs
```

This is more complex than direct SDK usage but provides the multi-provider flexibility the user requested.

**Critical implementation consideration:** The stateful CCR service must be carefully managed in GitHub Actions' ephemeral environment (install, configure, start, and ensure running before SDK usage).
