# GSD for GitHub

## What This Is

A **reusable GitHub Action** that integrates the Get Shit Done (GSD) project management system with GitHub. Enables fully autonomous agentic development workflows through GitHub Issues and GitHub Actions.

**Architecture:**
- Distributed as a reusable GitHub Action package
- Projects install by adding a workflow file that references the Action
- No code is copied into project repositories; all logic runs from the Action package
- Uses **Claude Code Router (CCR)** for CI-safe LLM execution

This is NOT a new project from scratch - it wraps the existing GSD skill, command patterns, research agents, and execution framework. The goal is to port GSD's proven workflows to GitHub Issues with future Jira mirroring capability.

## Core Value

Enable autonomous AI-driven development that runs in CI/CD, responds to GitHub issue comments, creates and updates planning artifacts in the repo, and tracks progress via GitHub issues - all without requiring local CLI usage.

## Current State (v1.0 MVP Shipped)

**Shipped:** 2026-01-22
**LOC:** ~2,400 JavaScript
**Phases:** 6 phases, 19 plans

The v1.0 MVP delivers:
- Reusable GitHub Action with Node.js 24 runtime
- `@gsd-bot new-milestone` command via GitHub issue comments
- Requirements gathering via multi-turn comment interaction
- Planning document creation (PROJECT.md, STATE.md, ROADMAP.md) in `.github/planning/`
- Branch creation with `gsd/{n}` naming convention
- Permission validation before execution
- CCR integration for CI-safe LLM execution

## Next Milestone Goals (v1.1)

- `gsd:plan-phase` command — plan execution for a phase
- `gsd:execute-phase` command — execute planned actions
- GitHub issues for each action (not just phases)
- Workflow retry/resume logic

---

## Requirements

### Validated (v1.0)

These requirements were shipped and validated in v1.0:

- ✓ GitHub Actions workflow triggered by `@gsd-bot` comments — v1.0
- ✓ Workflow reads issue context (issue number, repo name, comment body) — v1.0
- ✓ gsd-new-milestone command works via GitHub issue comment — v1.0
- ✓ Agent gathers requirements interactively via GitHub comments — v1.0
- ✓ Agent can ask follow-up questions in comments (multiple iterations) — v1.0
- ✓ Agent creates planning docs in `.github/planning/` — v1.0
- ✓ Agent commits planning docs to the repo — v1.0
- ✓ Agent posts summary comment when milestone is created — v1.0
- ✓ Agent uses GitHub CLI (gh) or Octokit for API interactions — v1.0
- ✓ Workflow exits after posting comment (no polling for responses) — v1.0

### Active (v1.1)

- [ ] `gsd:plan-phase` command to plan execution for a phase
- [ ] `gsd:execute-phase` command to execute planned actions
- [ ] Create GitHub issues for each action (not just phases)
- [ ] Bidirectional status sync (agent reads ticket status)

### Out of Scope

- [Jira integration] — planned for v2 with GitHub-Jira mirroring
- [Workflow retry logic] — v1.1 adds basic retry capability

---

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Create wrapper skill, not modify GSD | Keep GSD unchanged, easier maintenance | ✓ Working |
| GitHub CLI for API calls | Simplest integration, built into Actions | ✓ Working |
| Config in `.github/gsd-config.json` | Separate from GSD project config | ✓ Working |
| Exit workflow after post | Avoid complexity of polling/retrying | ✓ Working |
| Branch naming with milestone/phase | Organized, easy to identify | ✓ Working |
| Phase + status labels only | Simple scheme for v1, user-defined | ✓ Working |
| Requirements in comments (follow-up allowed) | Interactive, allows clarification | ✓ Working |

---

## Tech Stack

- **Node.js 24** - Action runtime
- **@actions/core** - GitHub Actions toolkit
- **@actions/github** - GitHub API client
- **@octokit/plugin-throttling** - Rate limit handling
- **Claude Code Router (CCR)** - CI-safe LLM execution
- **JavaScript (ESM)** - Action implementation

---

*Last updated: 2026-01-22 after v1.0 milestone*
