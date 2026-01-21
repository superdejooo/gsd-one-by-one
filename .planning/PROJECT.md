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

## The Problem

GSD's current workflow requires local CLI execution and interactive terminal prompts. Teams want:
1. GitHub-native workflow (issues, comments, PRs) via reusable Action
2. Autonomous agent execution in CI/CD (non-interactive)
3. Visual project board with tickets/phases
4. Jira integration for enterprise teams (future)
5. Comment-based bidirectional communication

**Critical Issue:** Standard GSD cannot run reliably in non-interactive CI environments like GitHub Actions.

## The Solution

A **reusable GitHub Action** that projects reference in their workflow files:

```yaml
# .github/workflows/gsd.yml
on:
  issue_comment:
    types: [created]

jobs:
  gsd:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
      pull-requests: write
    steps:
      - uses: infopuls/gsd-github-action@v1
        with:
          issue-number: ${{ github.event.issue.number }}
          repo-owner: ${{ github.repository_owner }}
          repo-name: ${{ github.event.repository.name }}
          comment-body: ${{ github.event.comment.body }}
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

**Key Components:**
1. **Reusable Action** - Orchestrates GitHub integration and command handling
2. **Claude Code Router (CCR)** - Provides CI-safe, non-interactive LLM execution
3. **GSD Core** - Bundled and version-pinned, handles planning and reasoning
4. **GitHub CLI (gh)** - All GitHub API interactions

User provides only API keys via secrets; all infrastructure is version-pinned and deterministic.

### Key Differences from CLI GSD

| Aspect | CLI GSD | GitHub GSD (Reusable Action) |
|--------|---------|------------|
| Installation | Local CLI install | Reference Action in workflow file |
| Trigger | Manual command | Issue comment (`@gsd-bot`) |
| State | Local files | `.github/planning/` in repo |
| Communication | Terminal/chat | GitHub comments |
| Execution | User's machine (interactive) | GitHub Actions (non-interactive CI/CD) |
| LLM Calls | Direct to Claude Code | Via Claude Code Router (CCR) |
| Artifacts | Local `.planning/` | Committed `.github/planning/` |
| Ticket tracking | None (files only) | GitHub issues (phases, actions) |
| Versioning | User controls GSD version | Action pins CCR + GSD versions |
| User Config | All settings editable | Only API keys (secrets) |

## Milestone Context

This is **v1** of GSD for GitHub. Focus is on getting the core `gsd:new-milestone` command working end-to-end in the GitHub context.

### v1 Scope (This Milestone)

**In Scope:**
- GitHub Actions workflow triggered by `@gsd-bot` comments
- Config file (`.github/gsd-config.json`) with labels and paths
- `gsd:new-milestone` command via GitHub issue
- Interactive requirements gathering via GitHub comments (follow-up allowed)
- Creation of planning docs (PROJECT.md, ROADMAP.md, STATE.md) in `.github/planning/`
- Agent posts summary comment when complete
- Branch creation pattern: `gsd/<milestone-number>/<phase-id>-<slugified-phase-name>`
- GitHub CLI (gh) for posting back to GitHub

**Out of Scope for v1:**
- Action-level GitHub issues (phases only later)
- `gsd:plan-phase` command
- `gsd:execute-phase` command
- `gsd:verify-work` command
- Jira integration (planned for later version)
- Bidirectional status sync (agent reads ticket status)
- Complex label schemes (phase + status labels only)

**Deferred to v2:**
- Full automation of all GSD commands
- Action-level ticket creation
- Jira mirroring
- Advanced concurrency handling
- Workflow retry/resume logic

## Architecture

### Components

1. **Reusable GitHub Action** (`infopuls/gsd-github-action`)
   - Orchestrates GitHub integration and command handling
   - Bundles and pins CCR + GSD Core versions
   - Generates CCR config at runtime with secrets interpolation
   - Manages GitHub API interactions via gh CLI
   - Published with version tags (v1, v2, etc.)

2. **Claude Code Router (CCR)** - Execution Layer
   - Provides CI-safe, non-interactive LLM execution
   - Handles all LLM provider and model invocation
   - Abstracts execution logic from provider-specific details
   - Version-pinned by Action (not user-configurable)
   - Reference: https://github.com/musistudio/claude-code-router

3. **GSD Core** (existing GSD skill)
   - Project management logic, research agents, planning, execution
   - Bundled and version-pinned by Action
   - Never invoked directly by gsd-github
   - Changes require Action version bump

4. **Project Workflow File** (`.github/workflows/gsd.yml`)
   - User adds to their repository
   - References Action with version tag
   - Defines permissions and secrets
   - Passes issue context as inputs

5. **Config File** (`.github/gsd-config.json`)
   - User creates in their repo
   - Label mappings (phase + status)
   - Path definitions
   - GitHub settings

6. **Planning Artifacts** (`.github/planning/`)
   - PROJECT.md - project context
   - ROADMAP.md - phase structure
   - STATE.md - project memory
   - REQUIREMENTS.md - scoped requirements

### Data Flow

```
User comments "@gsd-bot new-milestone" on GitHub Issue
    ↓
Project's GitHub Actions workflow triggers (issue_comment: created)
    ↓
Workflow calls reusable Action: uses: infopuls/gsd-github-action@v1
    ↓
Action receives inputs: issue number, repo owner, repo name, comment body
    ↓
Action reads ANTHROPIC_API_KEY from secrets
    ↓
Action generates CCR config at ~/.claude-code-router/config.json
    ↓
Action reads .github/gsd-config.json (user-provided)
    ↓
Action calls GSD Core via CCR (non-interactive execution)
    ↓
CCR routes LLM calls to configured provider/model
    ↓
GSD Core executes (questions user, updates files)
    ↓
Action commits planning docs to .github/planning/
    ↓
Action posts results via GitHub CLI (gh)
    ↓
Workflow completes
```

### Label Scheme (v1)

```json
{
  "labels": {
    "phases": ["phase-1", "phase-2"],
    "status": ["planning", "active", "done"]
  }
}
```

Labels are user-defined in `.github/gsd-config.json`. Agent uses `gh` to add/remove labels.

### Branch Naming

`gsd/<milestone-number>/<phase-id>-<slugified-phase-name>`

Example: `gsd/1/1-modernize-standup-ui`

Agent creates branches via `gh repo create --branch` or `gh api` calls.

## Requirements

### Validated

(None yet - this is greenfield v1)

### Active

- [GSD-GH-01] System triggers GitHub Actions workflow when user comments `@gsd-bot` on an issue
- [GSD-GH-02] Workflow reads issue context (issue number, repo name, comment body)
- [GSD-GH-03] gsd-github skill wraps existing GSD skill without modifying it
- [GSD-GH-04] Config file (`.github/gsd-config.json`) defines labels and paths
- [GSD-GH-05] gsd-new-milestone command works via GitHub issue comment
- [GSD-GH-06] Agent gathers requirements interactively via GitHub comments
- [GSD-GH-07] Agent can ask follow-up questions in comments (multiple iterations)
- [GSD-GH-08] Agent creates planning docs in `.github/planning/`
- [GSD-GH-09] Agent commits planning docs to the repo
- [GSD-GH-10] Agent posts summary comment when milestone is created
- [GSD-GH-11] Agent creates branch `gsd/<milestone-number>/<phase-id>-<slug>` for each phase
- [GSD-GH-12] Agent uses GitHub CLI (gh) for all GitHub API interactions
- [GSD-GH-13] Workflow exits after posting comment (no polling for responses)

### Out of Scope

- [Action-level GitHub issues] — v1 focuses on milestone-level artifacts only
- [gsd:plan-phase command] — deferred to v2
- [gsd:execute-phase command] — deferred to v2
- [gsd:verify-work command] — deferred to v2
- [Jira integration] — planned for v2 with GitHub-Jira mirroring
- [Bidirectional status sync] — agent does not read ticket status in v1
- [Workflow retry logic] — simple exit-after-post in v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Create wrapper skill, not modify GSD | Keep GSD unchanged, easier maintenance | New gsd-github skill that calls GSD |
| GitHub CLI for API calls | Simplest integration, built into Actions | Agent uses `gh` commands |
| Config in `.github/gsd-config.json` | Separate from GSD project config | User manually creates config |
| Exit workflow after post | Avoid complexity of polling/retrying | New comment triggers new workflow |
| Branch naming with milestone/phase | Organized, easy to identify | `gsd/<m>/<p>-<slug>` pattern |
| Phase + status labels only | Simple scheme for v1, user-defined | User defines in config |
| Requirements in comments (follow-up allowed) | Interactive, allows clarification | Agent posts Q, user answers, repeats |

## Tech Stack

- **Claude CLI** - Runs GSD skills
- **GitHub Actions** - CI/CD execution
- **Node.js** - gsd-github skill implementation
- **GitHub CLI (gh)** - GitHub API interactions
- **Markdown** - Planning artifacts

## Constraints

- Must work with existing GSD skill (no modifications to core)
- Must use GitHub Actions for CI/CD
- Must support both GitHub and future Jira integration
- User manually creates initial config file
- No polling for user responses - exit after post
- Allow multiple workflows (each on new branch)

## Success Criteria

v1 is successful when:
1. User creates GitHub issue with milestone request
2. User comments "@gsd-bot new-milestone"
3. GitHub Actions workflow triggers successfully
4. Agent asks requirements questions in comments
5. User answers in comments (multiple iterations allowed)
6. Agent creates planning docs in `.github/planning/`
7. Agent creates branches for each phase
8. Agent posts summary comment
9. All artifacts are committed to repo

---
*Last updated: 2025-01-21 after initialization*
