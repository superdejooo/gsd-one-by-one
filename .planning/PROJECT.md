# GSD for GitHub

## What This Is

A **reusable GitHub Action** that brings the [GSD (Get Shit Done)](https://github.com/anthropics/claude-code) project management skill to GitHub. This Action wraps the existing GSD CLI skill and exposes it through GitHub Issue comments, enabling autonomous AI-driven development without local CLI usage.

**Built On:**

- **[Claude Code](https://claude.ai/code)** — Anthropic's AI coding assistant CLI
- **[GSD Skill](https://www.npmjs.com/package/get-shit-done-cc)** — Project management plugin for Claude Code
- **[Claude Code Router (CCR)](https://www.npmjs.com/package/@musistudio/claude-code-router)** — CI-safe proxy for non-interactive LLM execution

**Architecture:**

- Distributed as a reusable GitHub Action package
- Projects install by adding a workflow file that references the Action
- No code is copied into project repositories; all logic runs from the Action package
- Commands execute via CCR → Claude Code → GSD Skill pipeline

This is NOT a new project from scratch — it wraps the existing GSD skill, command patterns, research agents, and execution framework. Planning documents follow GSD standard structure in `.planning/` folder.

## Core Value

Enable autonomous AI-driven development that runs in CI/CD, responds to GitHub issue comments, creates and updates planning artifacts in the repo, and tracks progress via GitHub issues — all without requiring local CLI usage.

## Command Flow (GSD Workflow)

The GSD workflow follows a structured sequence. This Action exposes these commands via `@gsd-bot` mentions:

```
@gsd-bot new-project          → Initialize project, deep context gathering
         ↓
@gsd-bot new-milestone N      → Create milestone, gather requirements (multi-turn)
         ↓
@gsd-bot plan-phase N         → Research + plan phase implementation
         ↓
@gsd-bot execute-phase N      → Execute plan with atomic commits
         ↓
@gsd-bot verify-work          → Validate features through UAT
```

**Current Implementation:**

- ✅ `new-milestone` — Shipped in v1.0
- ✅ `plan-phase` — Implemented in v1.1
- ✅ `execute-phase` — Implemented in v1.1
- ⏳ `new-project` — Planned for future (projects start with milestone for now)
- ⏳ `verify-work` — Planned for future

**Artifacts Generated:** All planning documents stored in `.planning/` folder (GSD standard):

- `PROJECT.md`, `STATE.md`, `ROADMAP.md` — Project-level docs
- `phases/{N}/RESEARCH.md`, `PLAN.md`, `SUMMARY.md` — Per-phase docs
- `milestones/{N}/` — Milestone-specific docs

## Current State (v1.0 MVP Shipped)

**Shipped:** 2026-01-22
**LOC:** ~2,400 JavaScript
**Phases:** 6 phases, 19 plans

The v1.0 MVP delivers:

- Reusable GitHub Action with Node.js 24 runtime
- `@gsd-bot new-milestone` command via GitHub issue comments
- Requirements gathering via multi-turn comment interaction
- Planning document creation (PROJECT.md, STATE.md, ROADMAP.md) in `.planning/`
- Branch creation with `gsd/{n}` naming convention
- Permission validation before execution
- CCR integration for CI-safe LLM execution

## Current Milestone: v1.1 — Plan & Execute Commands

**Goal:** Enable users to plan and execute individual phases through GitHub issue comments, with full workflow tracking via GitHub issues.

**Target features:**

- `gsd:plan-phase` command — Plan execution for a phase
- `gsd:execute-phase` command — Execute planned actions
- GitHub issues for each action (not just phases)
- Bidirectional status sync (agent reads ticket status)

---

## Requirements

### Validated (v1.0)

These requirements were shipped and validated in v1.0:

- ✓ GitHub Actions workflow triggered by `@gsd-bot` comments — v1.0
- ✓ Workflow reads issue context (issue number, repo name, comment body) — v1.0
- ✓ gsd-new-milestone command works via GitHub issue comment — v1.0
- ✓ Agent gathers requirements interactively via GitHub comments — v1.0
- ✓ Agent can ask follow-up questions in comments (multiple iterations) — v1.0
- ✓ Agent creates planning docs in `.planning/` — v1.0
- ✓ Agent commits planning docs to the repo — v1.0
- ✓ Agent posts summary comment when milestone is created — v1.0
- ✓ Agent uses GitHub CLI (gh) or Octokit for API interactions — v1.0
- ✓ Workflow exits after posting comment (no polling for responses) — v1.0

### Active (v1.1)

- [ ] **PLAN-01**: `gsd:plan-phase` command parses phase number and triggers phase planning workflow
- [ ] **PLAN-02**: Phase planner creates detailed execution plans with tasks, dependencies, and verification
- [ ] **PLAN-03**: Plans are committed to `.planning/phases/{n}/` directory
- [ ] **EXEC-01**: `gsd:execute-phase` command executes planned actions with wave-based parallelization
- [ ] **EXEC-02**: Agent can read GitHub issue status to determine resume point
- [ ] **EXEC-03**: Agent updates issue status as tasks complete (pending → in-progress → complete)
- [ ] **ISSUE-01**: Each action in a plan creates a corresponding GitHub issue
- [ ] **ISSUE-02**: Issue body contains action details, verification criteria, and phase context
- [ ] **RETRY-01**: Workflow can resume from last incomplete action on retry

### Out of Scope

- [Jira integration] — planned for v2 with GitHub-Jira mirroring
- [Complex multi-repo workflows] — single repo focus for v1.x
- [Real-time progress dashboard] — issue comments sufficient for v1.x

---

## Key Decisions

| Decision                                                | Rationale                                                               | Status     |
| ------------------------------------------------------- | ----------------------------------------------------------------------- | ---------- |
| Create wrapper skill, not modify GSD                    | Keep GSD unchanged, easier maintenance                                  | ✓ Working  |
| GitHub CLI for API calls                                | Simplest integration, built into Actions                                | ✓ Working  |
| Config in `.github/gsd-config.json`                     | Separate from GSD project config                                        | ✓ Working  |
| Exit workflow after post                                | Avoid complexity of polling/retrying                                    | ✓ Working  |
| Branch naming with milestone/phase                      | Organized, easy to identify                                             | ✓ Working  |
| Phase + status labels only                              | Simple scheme for v1, user-defined                                      | ✓ Working  |
| Requirements in comments (follow-up allowed)            | Interactive, allows clarification                                       | ✓ Working  |
| Planning docs in `.planning/` (not `.github/planning/`) | GSD CLI standard, visible in repo root, consistent with local CLI usage | ✓ Standard |

---

## Tech Stack

**AI/LLM Pipeline:**

- **Claude Code CLI** (`claude-code@latest`) — Anthropic's AI coding assistant
- **GSD Skill** (`get-shit-done-cc`) — Project management plugin for Claude Code
- **Claude Code Router** (`@musistudio/claude-code-router@2.1.15`) — CI-safe proxy for non-interactive execution

**GitHub Action Runtime:**

- **Node.js 24** — Action runtime
- **@actions/core** — GitHub Actions toolkit (logging, outputs)
- **@actions/github** — GitHub API client (Octokit)
- **@octokit/plugin-throttling** — Rate limit handling
- **@vercel/ncc** — Bundle to single distributable file

**Language:** JavaScript (ESM modules)

---

_Last updated: 2026-01-22 after v1.0 milestone, v1.1 started_
