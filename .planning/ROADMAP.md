# Roadmap: GSD for GitHub

## Milestones

- **v1.0 MVP** --- GitHub-native GSD via Reusable Action (shipped 2026-01-22)
- **v1.1** --- `gsd:plan-phase` and `gsd:execute-phase` commands (in progress)

---

## v1.1 Milestone: Plan & Execute Commands

**Goal:** Enable users to plan and execute individual phases through GitHub issue comments, with full workflow tracking via GitHub issues.

**Phases:** 8 phases | **Requirements:** 9 mapped

---

### Phase 7: Phase Planning Command

**Goal:** Implement `gsd:plan-phase` command that parses phase numbers and creates detailed execution plans.

**Requirements:**

- PLAN-01: `gsd:plan-phase` command parses phase number and triggers phase planning workflow
- PLAN-02: Phase planner creates detailed execution plans with tasks, dependencies, and verification
- PLAN-03: Plans are committed to `.planning/phases/{n}/` directory

**Status:** Complete (2026-01-22)

**Plans:** 1 plan | **Waves:** 1

- [x] 07-01-PLAN.md --- Foundation (command allowlist, phase-planner.js module, command dispatch)

**Files Created:**

- `src/milestone/phase-planner.js` --- Phase planning logic (8 exports)
- `src/lib/validator.js` --- ALLOWLIST includes "plan-phase"
- `src/index.js` --- Command dispatch for plan-phase workflow

---

### Phase 8: Phase Execution Command

**Goal:** Implement `gsd:execute-phase` command that executes planned actions with resume capability.

**Requirements:**

- EXEC-01: `gsd:execute-phase` command executes planned actions with wave-based parallelization
- EXEC-02: Agent can read state from `.planning/` folder to determine resume point (GSD internal)
- RETRY-01: Workflow can resume from last incomplete action on retry (GSD internal)

**Note:** EXEC-03 (Agent updates issue status as tasks complete) moved to Phase 9 — requires ISSUE-01 first.

**Status:** Complete (2026-01-22)

**Plans:** 1 plan | **Waves:** 1

- [x] 08-01-PLAN.md --- Execute-phase command (allowlist, phase-executor.js module, command dispatch)

**Files Created:**

- `src/milestone/phase-executor.js` --- Phase execution logic with enhanced output parsing (242 lines)
- `src/lib/validator.js` --- ALLOWLIST includes "execute-phase"
- `src/index.js` --- Command dispatch for execute-phase workflow

**Implementation Notes:**

- 30-minute timeout (vs 10 min for planning)
- Parses GSD output for completed actions, next steps, questions
- Posts structured comment instead of raw output pass-through
- Returns hasQuestions flag for conversational continuation
- GSD handles all internal state tracking, commits, parallelization

---

### Phase 8.1: GitHub Projects & Issue Tracking and Organization (INSERTED)

**Goal:** Infrastructure for organizing milestone work — labels as source of truth, GitHub Projects for visual grouping, minimal API work.

**Depends on:** Phase 8

**Status:** Complete (2026-01-22)

**Plans:** 3 plans | **Waves:** 1

- [x] 08.1-01-PLAN.md — Label helpers (labels.js module with STATUS_LABELS, ensureLabelsExist, applyLabels, updateIssueStatus)
- [x] 08.1-02-PLAN.md — Project GraphQL queries (projects.js module, milestone iteration validation)
- [x] 08.1-03-PLAN.md — User documentation (project-setup.md guide for manual iteration setup)

**Files Created:**

- `src/lib/labels.js` — Label CRUD operations for status tracking (4 exports)
- `src/lib/projects.js` — GitHub Projects v2 GraphQL queries (3 exports, read-only)
- `docs/project-setup.md` — Step-by-step setup guide for GitHub Projects (313 lines)

**Files Modified:**

- `src/milestone/index.js` — Added validateProjectIteration integration
- `README.md` — Added link to project setup documentation

**Implementation Notes:**

- Labels as source of truth: `status:pending`, `status:in-progress`, `status:complete`, `status:blocked`
- Projects v2 queries are read-only (no iteration creation via API - causes data loss)
- new-milestone validates iteration exists, warns if not found
- Manual iteration setup documented (user creates via GitHub UI)

**Context:** See `.planning/phases/08.1-github-projects-issue-tracking-and-organization/08.1-CONTEXT.md`

---

### Phase 9: Issue Tracking Integration

**Goal:** Create GitHub issues for each action and enable bidirectional status sync.

**Depends on:** Phase 8.1

**Requirements:**

- ISSUE-01: Each action in a plan creates a corresponding GitHub issue
- ISSUE-02: Issue body contains action details, verification criteria, and phase context
- EXEC-03: Agent updates issue status as tasks complete (pending -> in-progress -> complete) — moved from Phase 8

**Status:** Complete (2026-01-23)

**Plans:** 3 plans | **Waves:** 2

- [x] 09-01-PLAN.md — Issues module (src/lib/issues.js with task parsing and issue CRUD)
- [x] 09-02-PLAN.md — Phase planner integration (create issues after planning)
- [x] 09-03-PLAN.md — Phase executor integration (update status during execution)

**Files Created:**

- `src/lib/issues.js` — Issue creation and task parsing (4 exports)

**Files Modified:**

- `src/milestone/phase-planner.js` — Add issue creation after planning
- `src/milestone/phase-executor.js` — Add status updates during execution

**Success Criteria:**

1. Phase planner creates GitHub issues when generating plan
2. Issue body includes action description, verification criteria, phase context
3. Issues are labeled with phase number and status (pending/in-progress)
4. Phase executor can read issue status via GitHub API
5. Issues are updated to "complete" when verification passes

---

### Phase 10: Test for Each Service, Method, Feature and Flow

**Goal:** Comprehensive test coverage for all 23 source modules using Vitest, with mocked GitHub API, child_process, and @actions packages.

**Depends on:** Phase 9

**Status:** Complete (2026-01-23)

**Plans:** 7 plans | **Waves:** 4

Plans:

- [x] 10-01-PLAN.md — Test infrastructure (vitest.config.js, test/setup.js, fetch mocking)
- [x] 10-02-PLAN.md — Pure logic unit tests (parser, validator, formatter, slugify, prompts, auth/errors)
- [x] 10-03-PLAN.md — GitHub API tests (auth/validator, labels, projects, github)
- [x] 10-04-PLAN.md — Child process tests (git, branches, phase-planner, phase-executor)
- [x] 10-05-PLAN.md — Orchestrator tests (milestone/index, requirements, planning-docs, handler, config)
- [x] 10-06-PLAN.md — Entry point tests (index.js command dispatch integration)
- [x] 10-07-PLAN.md — CI integration (finalize suite, add test workflow)

**Wave Structure:**

- Wave 1: 10-01 (infrastructure setup - must complete first)
- Wave 2: 10-02, 10-03, 10-04 (parallel - no dependencies between test categories)
- Wave 3: 10-05, 10-06 (depend on Wave 2 summaries)
- Wave 4: 10-07 (finalization after all tests exist)

**Coverage Targets:**

- 80% overall minimum
- 90%+ for critical modules (auth, parser, validator)
- Tests colocated with source (module.test.js)

**Files Created:**

- `vitest.config.js` — Vitest configuration with coverage thresholds
- `test/setup.js` — Global test setup with fetch mocking
- `.github/workflows/test.yml` — CI workflow for automated testing
- 18+ test files colocated with source modules

---

### Phase 11: Output Parsing Improvements

**Goal:** Fix output formatting issues in GitHub comments — duplicate errors, CCR log pollution, false positive task matching.

**Depends on:** Phase 10

**Status:** Complete (2026-01-23)

**Plans:** 1 plan | **Waves:** 1

- [x] 11-01-PLAN.md — Output parsing fixes (duplicate errors, CCR stripping, GSD block extraction)

**Files Modified:**

- `src/milestone/phase-planner.js` — Removed duplicate error posting
- `src/milestone/phase-executor.js` — Added stripCcrLogs, extractGsdBlock, fixed task parsing
- `src/milestone/phase-planner.test.js` — Updated error handling tests
- `src/milestone/phase-executor.test.js` — Added CCR/GSD extraction tests

**Implementation Notes:**

- Error posting delegated to withErrorHandling wrapper (single source)
- CCR logs stripped via regex patterns (log_xxx, response 200, JS object notation)
- GSD block extracted from LAST "GSD ►" marker (handles multiple markers)
- Fallback to last 80 lines if no GSD marker found
- Only explicit [x] checkbox markers matched (not "Complete" text)

---

### Phase 12: CCR Command Formatting

**Goal:** Extract CCR command formatting into centralized helper for consistent command structure across all workflow modules.

**Depends on:** Phase 11

**Status:** Complete (2026-01-23)

**Plans:** 1 plan | **Waves:** 1

- [x] 12-01-PLAN.md — CCR command helper (formatCcrCommand, formatCcrCommandWithOutput)

**Files Created:**

- `src/llm/ccr-command.js` — Helper functions for CCR command formatting (2 exports)
- `src/llm/ccr-command.test.js` — Tests for helper functions (5 tests)

**Files Modified:**

- `src/milestone/phase-planner.js` — Use helper instead of inline command
- `src/milestone/phase-executor.js` — Use helper instead of inline command
- `src/milestone/milestone-completer.js` — Use helper instead of inline command
- `src/milestone/*.test.js` — Mock helper for test isolation

**Implementation Notes:**

- Pattern: `/github-actions-testing and now trigger command /gsd:{command}`
- Single source of truth for command format
- Easy to change pattern in one place
- Tests mock helper for isolation

---

## Phase Summary

| #   | Phase                                           | Goal                                       | Requirements                | Plans              |
| --- | ----------------------------------------------- | ------------------------------------------ | --------------------------- | ------------------ |
| 7   | Phase Planning Command                          | Implement `gsd:plan-phase` command         | PLAN-01, PLAN-02, PLAN-03   | 1 plan (complete)  |
| 8   | Phase Execution Command                         | Implement `gsd:execute-phase` command      | EXEC-01, EXEC-02, RETRY-01  | 1 plan (complete)  |
| 8.1 | GitHub Projects & Issue Tracking                | Labels + Project iterations infrastructure | N/A                         | 3 plans (complete) |
| 9   | Issue Tracking Integration                      | Create GitHub issues for actions           | ISSUE-01, ISSUE-02, EXEC-03 | 3 plans (complete) |
| 10  | Test for Each Service, Method, Feature and Flow | Comprehensive testing coverage             | TEST-01: 80%+ coverage      | 7 plans (complete) |
| 11  | Output Parsing Improvements                     | Fix comment formatting issues              | N/A                         | 1 plan (complete)  |
| 12  | CCR Command Formatting                          | Centralized command helper                 | N/A                         | 1 plan (complete)  |

---

## Dependencies

- Phase 7 -> Phase 8: Phase planner creates plans that executor reads
- Phase 8 -> Phase 8.1: Project infrastructure builds on execute-phase foundation
- Phase 8.1 -> Phase 9: Issue tracking uses labels infrastructure
- Phase 9 -> Phase 10: Testing covers all modules including Phase 9 additions
- Phase 10 -> Phase 11: Output improvements discovered during testing/live usage
- Phase 11 -> Phase 12: CCR command refactoring builds on output parsing
- All phases -> v1.0 foundation: Built on existing Action infrastructure, command parsing, and CCR integration

---

_Roadmap created: 2026-01-22 for v1.1 milestone_
_Phases continue from v1.0 (which ended at phase 6)_
