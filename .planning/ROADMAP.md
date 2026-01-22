# Roadmap: GSD for GitHub

## Overview

GSD for GitHub transforms the Get Shit Done project management system into a GitHub-native, autonomous AI workflow. The journey begins by establishing a reusable GitHub Action that responds to `@gsd-bot` comment commands, progresses through integrating the Claude Code Router for CI-safe LLM execution, and culminates in a fully functional `gsd:new-milestone` command that creates planning artifacts, manages branches, and gathers requirements via GitHub issue comments.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: GitHub Action Foundation** - Create reusable Action with workflow triggers and permissions
- [ ] **Phase 2: Command Parsing & Config** - Parse @gsd-bot commands and load user configuration
- [ ] **Phase 3: CCR Integration** - Bundle and configure Claude Code Router for CI-safe execution
- [ ] **Phase 4: GitHub Integration & Response** - GitHub CLI operations, comments, branches, and commits
- [ ] **Phase 5: Milestone Creation Workflow** - Planning docs, requirements gathering, and summary posts
- [ ] **Phase 6: Security & Authorization** - Permission validation and final error handling

## Phase Details

### Phase 1: GitHub Action Foundation
**Goal**: Establish the reusable GitHub Action infrastructure with proper triggers, permissions, and concurrency control
**Depends on**: Nothing (first phase)
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04, WORK-05, AUTH-01, AUTH-02, CONC-01, CONC-02, CONC-03
**Success Criteria** (what must be TRUE):
  1. User can add workflow file that references `superdejooo/gsd-github-action@v1` and workflow triggers on issue_comment events
  2. Workflow has explicit scoped permissions (contents: write, issues: write, pull-requests: write)
  3. Concurrent workflow runs are prevented on same branch but allowed on different branches
  4. Action uses Node.js 24.x runtime and exits cleanly after execution
**Plans**: 3 plans

Plans:
- [x] 01-01: Create reusable GitHub Action with workflow triggers and basic inputs
- [x] 01-02: Configure scoped permissions and Node.js 24.x runtime
- [x] 01-03: Implement concurrency control and clean exit handling

### Phase 2: Command Parsing & Config
**Goal**: Parse @gsd-bot commands from issue comments, validate user input, and load user configuration
**Depends on**: Phase 1
**Requirements**: PARS-01, PARS-02, PARS-03, PARS-04, CONF-01, CONF-02, CONF-03, CONF-04, ERR-04
**Success Criteria** (what must be TRUE):
  1. Agent extracts `@gsd-bot new-milestone` from issue comment and identifies the command
  2. Agent only responds to comment created events (not edited or deleted)
  3. Agent reads `.github/gsd-config.json` for labels and paths, or uses sensible defaults
  4. User input is validated and sanitized to prevent command injection
**Plans**: 3 plans

Plans:
- [x] 02-01: Create parser module with parseComment and parseArguments
- [x] 02-02: Integrate parser into main action entry point
- [x] 02-03: Load config file from repository with defaults and add command validation with input sanitization

### Phase 3: CCR Integration
**Goal**: Bundle and configure Claude Code Router for CI-safe, non-interactive LLM execution via stdin pipe
**Depends on**: Phase 2
**Requirements**: CCR-01, CCR-02, CCR-03, CCR-04, CCR-05, CCR-06, CCR-07
**Success Criteria** (what must be TRUE):
  1. Action installs CCR with pinned version via package manager
  2. Action configures CCR via environment variables and config file
  3. API keys from GitHub Actions secrets are interpolated into CCR config
  4. CCR runs in non-interactive mode (NON_INTERACTIVE_MODE: true) and wraps Claude Code CLI
**Plans**: 4 plans

Plans:
- [x] 03-01: Install Agent SDK with pinned version and bundle into distributable
- [x] 03-02: Create LLM integration layer with SDK wrapper and prompt templates
- [x] 03-03: Configure API key passing and verify non-interactive execution
- [x] 03-04: Gap closure - Add NON_INTERACTIVE_MODE and clean up architecture artifacts

### Phase 4: GitHub Integration & Response
**Goal**: Enable GitHub API operations for posting comments, creating branches, and committing artifacts
**Depends on**: Phase 3
**Requirements**: GITH-01, GITH-02, GITH-03, GITH-04, GITH-05, ERR-01, ERR-02, ERR-03, ERR-05
**Success Criteria** (what must be TRUE):
  1. Agent posts formatted markdown comments to issue/PR via GitHub REST API (octokit)
  2. Agent creates milestone branch `gsd/<milestone-number>` and phase branches with proper naming
  3. Agent configures git (user.name, user.email) before committing planning docs
  4. Agent posts structured error messages with workflow run URLs and handles rate limits
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — GitHub API operations with throttled octokit client and error/success message formatting
- [ ] 04-02-PLAN.md — Git operations module with branch creation and naming conventions (milestone and phase branches)
- [ ] 04-03-PLAN.md — Git identity configuration and centralized error handling with GitHub comment posting

### Phase 5: Milestone Creation Workflow
**Goal**: Implement the complete gsd:new-milestone workflow including planning docs and requirements gathering
**Depends on**: Phase 4
**Requirements**: MILE-01, MILE-02, MILE-03, MILE-04, MILE-05, REQG-01, REQG-02, REQG-03, REQG-04
**Success Criteria** (what must be TRUE):
  1. Agent creates PROJECT.md, ROADMAP.md, and STATE.md in `.github/planning/` directory
  2. Agent posts requirements questions in comments and reads user answers from subsequent comments
  3. Agent continues requirements gathering across multiple workflow runs until satisfied
  4. Agent commits all planning docs and posts summary comment with next steps
**Plans**: 4 plans

Plans:
- [x] 05-01-PLAN.md — Create planning documents (PROJECT.md, STATE.md, ROADMAP.md) in correct location
- [x] 05-02-PLAN.md — Implement requirements gathering with multi-turn comment interaction
- [x] 05-03-PLAN.md — Add context persistence across workflow runs for requirements gathering
- [x] 05-04-PLAN.md — Commit planning docs and post completion summary comment

### Phase 6: Security & Authorization
**Goal**: Implement permission validation and finalize error handling for production readiness
**Depends on**: Phase 5
**Requirements**: AUTH-03
**Success Criteria** (what must be TRUE):
  1. Agent validates that trigger user has write access to repository before executing
  2. Unauthorized users receive clear error message explaining permission requirements
**Plans**: 2 plans

Plans:
- [ ] 06-01: Implement write access validation via GitHub API
- [ ] 06-02: Add authorization error handling and user feedback

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. GitHub Action Foundation | 3/3 | Complete | 2026-01-21 |
| 2. Command Parsing & Config | 3/3 | Complete | 2026-01-21 |
| 3. CCR Integration | 4/4 | Complete | 2026-01-22 |
| 4. GitHub Integration & Response | 0/3 | Planned | - |
| 5. Milestone Creation Workflow | 4/4 | Complete | 2026-01-22 |
| 6. Security & Authorization | 0/2 | Not started | - |
