# Roadmap: GSD for GitHub

## Milestones

- **v1.0 MVP** --- GitHub-native GSD via Reusable Action (shipped 2026-01-22)
- **v1.1** --- `gsd:plan-phase` and `gsd:execute-phase` commands (in progress)

---

## v1.1 Milestone: Plan & Execute Commands

**Goal:** Enable users to plan and execute individual phases through GitHub issue comments, with full workflow tracking via GitHub issues.

**Phases:** 3 phases | **Requirements:** 9 mapped

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

### Phase 9: Issue Tracking Integration

**Goal:** Create GitHub issues for each action and enable bidirectional status sync.

**Requirements:**
- ISSUE-01: Each action in a plan creates a corresponding GitHub issue
- ISSUE-02: Issue body contains action details, verification criteria, and phase context
- EXEC-03: Agent updates issue status as tasks complete (pending → in-progress → complete) — moved from Phase 8

**Success Criteria:**
1. Phase planner creates GitHub issues when generating plan
2. Issue body includes action description, verification criteria, phase context
3. Issues are labeled with phase number and status (pending/in-progress)
4. Phase executor can read issue status via GitHub API
5. Issues are updated to "complete" when verification passes

**Files Modified:**
- `src/milestone/phase-planner.js` --- Add issue creation
- `src/milestone/phase-executor.js` --- Add issue status reading/updating

---

## Phase Summary

| # | Phase | Goal | Requirements | Plans |
|---|-------|------|--------------|-------|
| 7 | Phase Planning Command | Implement `gsd:plan-phase` command | PLAN-01, PLAN-02, PLAN-03 | 1 plan (complete) |
| 8 | Phase Execution Command | Implement `gsd:execute-phase` command | EXEC-01, EXEC-02, RETRY-01 | 1 plan (complete) |
| 9 | Issue Tracking Integration | Create GitHub issues for actions | ISSUE-01, ISSUE-02, EXEC-03 | TBD |

---

## Dependencies

- Phase 7 -> Phase 8: Phase planner creates plans that executor reads
- Phase 8 -> Phase 9: Issue tracking integrates with execution
- All phases -> v1.0 foundation: Built on existing Action infrastructure, command parsing, and CCR integration

---

*Roadmap created: 2026-01-22 for v1.1 milestone*
*Phases continue from v1.0 (which ended at phase 6)*
