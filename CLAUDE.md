# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GSD for GitHub — a reusable GitHub Action that brings the GSD (Get Shit Done) project management skill to GitHub, enabling autonomous AI-driven development workflows triggered through GitHub Issue comments.

**Built On:**

- **Claude Code CLI** — Anthropic's AI coding assistant
- **GSD Skill** (`get-shit-done-cc`) — Project management plugin for Claude Code
- **Claude Code Router (CCR)** — CI-safe proxy for non-interactive LLM execution

## Build & Development Commands

```bash
npm run build         # Bundle src/index.js → dist/index.js using @vercel/ncc
npm run setup:ccr     # Generate Claude Code Router configuration
```

The bundled output at `/dist/index.js` is what GitHub Actions executes. Always rebuild after code changes.

## Architecture

### Command Flow

```
GitHub Issue Comment (@gsd-bot <command>)
    → GitHub Actions Workflow (.github/workflows/gsd-command-handler.yml)
    → Node.js Action (src/index.js)
    → Command Dispatch → Workflow Module
    → Claude Code Router (CCR) for LLM execution
    → GitHub Comment with results
```

### Module Structure

| Module           | Purpose                                                |
| ---------------- | ------------------------------------------------------ |
| `src/index.js`   | Entry point, command dispatch                          |
| `src/auth/`      | Authorization validation (write/admin access required) |
| `src/errors/`    | Error handling, GitHub comment formatting              |
| `src/git/`       | Git operations (branches, commits, identity)           |
| `src/lib/`       | Utilities (config, parser, validator, GitHub API)      |
| `src/llm/`       | Claude Code Router integration, prompts                |
| `src/milestone/` | Workflow orchestrators for each command                |

### Supported Commands

1. **`@gsd-bot new-milestone`** — Creates planning docs, gathers requirements via multi-turn conversation
2. **`@gsd-bot plan-phase`** — Executes GSD planning for a phase
3. **`@gsd-bot execute-phase`** — Executes GSD implementation (30-min timeout)

Command allowlist is in `src/lib/validator.js`.

### State & Planning

All planning artifacts are stored in `.planning/` at project root (not `.github/planning/`):

- `PROJECT.md` — Project description, requirements, tech stack
- `STATE.md` — Current position, velocity, context
- `ROADMAP.md` — Phase breakdown and requirements
- `milestones/{n}/` — Per-milestone docs
- `phases/{n}/` — Per-phase plans

## Key Patterns

**Authorization**: All commands check user permissions via `src/auth/validator.js` before executing. Only users with write/admin/maintain access can trigger commands.

**Error Handling**: Use `withErrorHandling()` wrapper from `src/errors/handler.js` for consistent GitHub comment formatting.

**Input Sanitization**: Shell metacharacters `[;&|`$()]` are stripped from arguments (OWASP compliance).

**Branch Naming**: `gsd/{milestoneNumber}` for milestones, pattern defined in `src/git/branches.js`.

## Runtime Environment

- Node.js 24 (specified in `action.yml`)
- ESM modules (`"type": "module"` in package.json)
- GitHub Actions runtime with Claude Code Router on port 3456

## Environment Variables

| Variable             | Purpose                 |
| -------------------- | ----------------------- |
| `GITHUB_TOKEN`       | GitHub API access       |
| `OPENROUTER_API_KEY` | LLM provider (primary)  |
| `ANTHROPIC_API_KEY`  | LLM provider (fallback) |
| `DEEPSEEK_API_KEY`   | LLM provider (fallback) |
