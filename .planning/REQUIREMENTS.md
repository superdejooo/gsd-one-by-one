# Requirements

**Project:** GSD for GitHub (Reusable Action)
**Milestone:** v1 - gsd:new-milestone command
**Last Updated:** 2025-01-21
**Architecture:** Reusable GitHub Action - projects reference Action package via workflow file

## v1 Requirements

### Authentication & Permissions

- [ ] **AUTH-01**: System uses GITHUB_TOKEN with scoped permissions (`contents: write`, `issues: write`, `pull-requests: write`)
- [ ] **AUTH-02**: Workflow explicitly declares permissions in YAML to avoid silent failures
- [ ] **AUTH-03**: Agent validates that trigger user has write access to repository before executing

### Command Parsing

- [ ] **PARS-01**: Agent extracts `@gsd-bot` mention from issue/PR comment body
- [ ] **PARS-02**: Agent detects specific command after mention (e.g., `new-milestone`)
- [ ] **PARS-03**: Agent parses command arguments and flags from comment
- [ ] **PARS-04**: Agent only responds to comment `created` events (not edited or deleted)

### GitHub Integration

- [ ] **GITH-01**: Agent posts comments to issue/PR via GitHub CLI (gh)
- [ ] **GITH-02**: Agent creates milestone branch `gsd/<milestone-number>` when milestone is initiated
- [ ] **GITH-03**: Agent creates phase branches `gsd/<milestone-number>/<phase-id>-<slugified-phase-name>` for each phase
- [ ] **GITH-04**: Agent commits planning docs to `.github/planning/` directory in the repo
- [ ] **GITH-05**: Agent configures git (user.name, user.email) before making commits

### Workflow Execution (Reusable Action)

- [ ] **WORK-01**: Reusable Action accepts inputs: issue number, repo owner, repo name, comment body
- [ ] **WORK-02**: Action publishes as package with version tags (v1, v2, etc.)
- [ ] **WORK-03**: Action uses Node.js 24.x runtime
- [ ] **WORK-04**: Action exits after posting response
- [ ] **WORK-05**: Project adds workflow file referencing Action: `uses: gsd-org/gsd-github-action@v1`

### Claude Code Router (CCR) - Execution Layer

- [ ] **CCR-01**: Action bundles Claude Code Router (CCR) for CI-safe LLM execution
- [ ] **CCR-02**: Action pins CCR version (not user-configurable)
- [ ] **CCR-03**: Action generates CCR config at `~/.claude-code-router/config.json` at runtime
- [ ] **CCR-04**: Action interpolates API keys from GitHub Actions secrets into CCR config
- [ ] **CCR-05**: CCR handles all LLM invocations (GSD never calls Claude Code directly)
- [ ] **CCR-06**: Action installs CCR via package manager with pinned version
- [ ] **CCR-07**: CCR runs in non-interactive mode (no TTY, no prompts)

### Concurrency

- [ ] **CONC-01**: Workflow uses concurrency group based on branch name to prevent duplicate runs on same branch
- [ ] **CONC-02**: Workflow allows concurrent runs on different branches (one per milestone)
- [ ] **CONC-03**: `cancel-in-progress: true` to cancel previous run when new comment triggers workflow on same branch

### Error Handling

- [ ] **ERR-01**: Agent posts clear, structured error messages to issue comments
- [ ] **ERR-02**: Agent includes workflow run URL in error comments for debugging
- [ ] **ERR-03**: Agent handles GitHub API rate limits gracefully with retry logic
- [ ] **ERR-04**: Agent validates and sanitizes all user input to prevent command injection
- [ ] **ERR-05**: Agent catches and reports unexpected errors without crashing workflow

### Milestone Creation (gsd:new-milestone)

- [ ] **MILE-01**: Agent creates `PROJECT.md` in `.github/planning/` with milestone context
- [ ] **MILE-02**: Agent creates `STATE.md` in `.github/planning/` with milestone number and status
- [ ] **MILE-03**: Agent creates `ROADMAP.md` in `.github/planning/` with phase structure
- [ ] **MILE-04**: Agent commits all planning docs to the milestone branch
- [ ] **MILE-05**: Agent posts summary comment listing created files and next steps

### Requirements Gathering

- [ ] **REQG-01**: Agent posts requirements questions in comments (bulk format)
- [ ] **REQG-02**: User answers via new comment, which triggers new workflow run
- [ ] **REQG-03**: Agent reads user answers from new comments
- [ ] **REQG-04**: Agent continues requirements gathering across multiple workflow runs until satisfied

### Config File

- [ ] **CONF-01**: Agent reads `.github/gsd-config.json` from repository
- [ ] **CONF-02**: Config file contains label mappings (phases, status)
- [ ] **CONF-03**: Config file contains path definitions (planning directory)
- [ ] **CONF-04**: Agent uses default values if config file is missing

---

## v2 Requirements (Deferred)

### Additional Commands

- [ ] **V2-01**: `gsd:plan-phase` command to plan execution for a phase
- [ ] **V2-02**: `gsd:execute-phase` command to execute planned actions
- [ ] **V2-03**: `gsd:verify-work` command to verify built features

### Advanced Features

- [ ] **V2-04**: Create GitHub issues for each action (not just phases)
- [ ] **V2-05**: Jira integration with GitHub-Jira mirroring
- [ ] **V2-06**: Bidirectional status sync (agent reads ticket status)
- [ ] **V2-07**: Workflow retry/resume logic
- [ ] **V2-08**: Incremental documentation updates (merge with existing content)
- [ ] **V2-09**: Structured research synthesis (multi-domain parallel research)

---

## Out of Scope

- [Action code in project repos] — Reusable Action architecture, projects reference package via workflow file
- [User-configurable CCR] — CCR version and config are pinned by Action, not user-configurable
- [User-configurable GSD core] — GSD core version is pinned by Action
- [Direct Claude Code/CLI calls] — All LLM execution goes through CCR
- [Persistent servers] — Serverless GitHub Actions approach, no separate bot server
- [External databases] — All state stored in repository files
- [GitHub App for v1] — Using GITHUB_TOKEN, GitHub App deferred to v2
- [Self-hosted runners] — Using github.com hosted runners (ubuntu-latest)
- [Fork execution] — Not supporting workflow execution from forks in v1
- [Direct REST API calls] — Using GitHub CLI (gh) for all GitHub interactions
- [PAT authentication] — Using GITHUB_TOKEN, not personal access tokens
- [Commit-pinned actions] — Using version tags (@v1, @v2, etc.) not specific commits

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| AUTH-01 | TBD | Pending |
| AUTH-02 | TBD | Pending |
| AUTH-03 | TBD | Pending |
| PARS-01 | TBD | Pending |
| PARS-02 | TBD | Pending |
| PARS-03 | TBD | Pending |
| PARS-04 | TBD | Pending |
| GITH-01 | TBD | Pending |
| GITH-02 | TBD | Pending |
| GITH-03 | TBD | Pending |
| GITH-04 | TBD | Pending |
| GITH-05 | TBD | Pending |
| WORK-01 | TBD | Pending |
| WORK-02 | TBD | Pending |
| WORK-03 | TBD | Pending |
| WORK-04 | TBD | Pending |
| WORK-05 | TBD | Pending |
| CCR-01 | TBD | Pending |
| CCR-02 | TBD | Pending |
| CCR-03 | TBD | Pending |
| CCR-04 | TBD | Pending |
| CCR-05 | TBD | Pending |
| CCR-06 | TBD | Pending |
| CCR-07 | TBD | Pending |
| CONC-01 | TBD | Pending |
| CONC-02 | TBD | Pending |
| CONC-03 | TBD | Pending |
| ERR-01 | TBD | Pending |
| ERR-02 | TBD | Pending |
| ERR-03 | TBD | Pending |
| ERR-04 | TBD | Pending |
| ERR-05 | TBD | Pending |
| MILE-01 | TBD | Pending |
| MILE-02 | TBD | Pending |
| MILE-03 | TBD | Pending |
| MILE-04 | TBD | Pending |
| MILE-05 | TBD | Pending |
| REQG-01 | TBD | Pending |
| REQG-02 | TBD | Pending |
| REQG-03 | TBD | Pending |
| REQG-04 | TBD | Pending |
| CONF-01 | TBD | Pending |
| CONF-02 | TBD | Pending |
| CONF-03 | TBD | Pending |
| CONF-04 | TBD | Pending |

---
*Last updated: 2025-01-21*
