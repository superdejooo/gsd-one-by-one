# GSD for GitHub

## What This Is

A GitHub-integrated version of the Get Shit Done (GSD) project management plugin for Claude. Enables fully autonomous agentic development workflows through GitHub Issues, GitHub Actions, and interactive comment-based collaboration.

This is NOT a new project from scratch - it's a wrapper/extension that leverages the existing GSD skill, command patterns, research agents, and execution framework. The goal is to port GSD's proven workflows to a project management board (GitHub Issues) with mirroring capability to Jira Enterprise.

## Core Value

Enable autonomous AI-driven development that runs in CI/CD, responds to GitHub issue comments, creates and updates planning artifacts in the repo, and tracks progress via GitHub issues - all without requiring local CLI usage.

## The Problem

GSD's current workflow requires local CLI execution and file-based state management. Teams want:
1. GitHub-native workflow (issues, comments, PRs)
2. Autonomous agent execution in CI/CD
3. Visual project board with tickets/phases
4. Jira integration for enterprise teams
5. Bidirectional communication - agent asks questions, user responds, agent continues

## The Solution

A GitHub Actions workflow that triggers on issue comments containing `@gsd-bot`. The workflow runs Claude CLI with a new `gsd-github` skill that wraps existing GSD functionality. Agent communicates via GitHub comments, stores planning artifacts in `.github/planning/`, and can create GitHub issues for tracking.

### Key Differences from CLI GSD

| Aspect | CLI GSD | GitHub GSD |
|--------|---------|------------|
| Trigger | Manual command | Issue comment (`@gsd-bot`) |
| State | Local files | `.github/planning/` in repo |
| Communication | Terminal/chat | GitHub comments |
| Execution | User's machine | GitHub Actions (CI/CD) |
| Artifacts | Local `.planning/` | Committed `.github/planning/` |
| Ticket tracking | None (files only) | GitHub issues (phases, actions) |

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

1. **GitHub Workflow** (`.github/workflows/gsd.yml`)
   - Triggers on issue comments
   - Validates `@gsd-bot` trigger
   - Reads GSD config
   - Invokes Claude CLI with gsd-github skill

2. **gsd-github Skill** (new skill)
   - Wraps existing GSD skill
   - Parses issue context (issue number, repo, comment)
   - Maps labels to GSD commands
   - Handles bidirectional communication

3. **GSD Skill** (existing, unchanged)
   - Core project management logic
   - Research agents, planning, execution
   - Called by gsd-github skill

4. **Config File** (`.github/gsd-config.json`)
   - Label mappings (phase + status)
   - Path definitions
   - GitHub settings

5. **Planning Artifacts** (`.github/planning/`)
   - PROJECT.md - project context
   - ROADMAP.md - phase structure
   - STATE.md - project memory
   - REQUIREMENTS.md - scoped requirements

### Data Flow

```
User comments "@gsd-bot new-milestone" on GitHub Issue
    ↓
GitHub Actions workflow triggers
    ↓
Workflow reads issue context (number, repo, comment body)
    ↓
Workflow calls Claude CLI with gsd-github skill
    ↓
gsd-github reads .github/gsd-config.json
    ↓
gsd-github calls GSD skill with appropriate command
    ↓
GSD skill executes (questions user, updates files)
    ↓
gsd-github posts results via GitHub CLI
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

Labels are user-defined in config. Agent uses `gh` to add/remove labels.

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
