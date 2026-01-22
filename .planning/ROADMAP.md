# Roadmap: GSD for GitHub

## Milestones

- ✅ **v1.0 MVP** — GitHub-native GSD via Reusable Action (shipped 2026-01-22)
- 📋 **v1.1** — `gsd:plan-phase` and `gsd:execute-phase` commands (in progress)

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

**Success Criteria:**
1. Command parses `@gsd-bot plan-phase N` or `/gsd:plan-phase N`
2. Bot responds with planning status comment
3. Phase planner reads requirements from ROADMAP.md and REQUIREMENTS.md
4. Planner creates plan files in `.planning/phases/{n}/`
5. Plans include tasks with dependencies, verification, and wave grouping
6. Bot posts summary comment with plan location when complete

**Files Created:**
- `src/milestone/phase-planner.js` — Phase planning logic
- `.planning/phases/{n}/07-01-PLAN.md` — Wave 1 plan
- `.planning/phases/{n}/07-02-PLAN.md` — Wave 2 plan (if needed)

---

### Phase 8: Phase Execution Command

**Goal:** Implement `gsd:execute-phase` command that executes planned actions with resume capability.

**Requirements:**
- EXEC-01: `gsd:execute-phase` command executes planned actions with wave-based parallelization
- EXEC-02: Agent can read GitHub issue status to determine resume point
- EXEC-03: Agent updates issue status as tasks complete (pending → in-progress → complete)
- RETRY-01: Workflow can resume from last incomplete action on retry

**Success Criteria:**
1. Command parses `@gsd-bot execute-phase N` or `/gsd:execute-phase N`
2. Bot responds with execution status comment
3. Executor reads plan files from `.planning/phases/{n}/`
4. Actions execute in waves (parallel where independent, sequential where dependent)
5. Executor checks issue status to resume from last incomplete action
6. Executor updates issue status as tasks progress
7. Bot posts summary when phase execution completes

**Files Created:**
- `src/milestone/phase-executor.js` — Phase execution logic
- Updated `.planning/phases/{n}/*.md` with execution notes

---

### Phase 9: Issue Tracking Integration

**Goal:** Create GitHub issues for each action and enable bidirectional status sync.

**Requirements:**
- ISSUE-01: Each action in a plan creates a corresponding GitHub issue
- ISSUE-02: Issue body contains action details, verification criteria, and phase context

**Success Criteria:**
1. Phase planner creates GitHub issues when generating plan
2. Issue body includes action description, verification criteria, phase context
3. Issues are labeled with phase number and status (pending/in-progress)
4. Phase executor can read issue status via GitHub API
5. Issues are updated to "complete" when verification passes

**Files Modified:**
- `src/milestone/phase-planner.js` — Add issue creation
- `src/milestone/phase-executor.js` — Add issue status reading/updating

---

## Phase Summary

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 7 | Phase Planning Command | Implement `gsd:plan-phase` command | PLAN-01, PLAN-02, PLAN-03 | 6 criteria |
| 8 | Phase Execution Command | Implement `gsd:execute-phase` command | EXEC-01, EXEC-02, EXEC-03, RETRY-01 | 7 criteria |
| 9 | Issue Tracking Integration | Create GitHub issues for actions | ISSUE-01, ISSUE-02 | 5 criteria |

---

## Dependencies

- Phase 7 → Phase 8: Phase planner creates plans that executor reads
- Phase 8 → Phase 9: Issue tracking integrates with execution
- All phases → v1.0 foundation: Built on existing Action infrastructure, command parsing, and CCR integration

---

*Roadmap created: 2026-01-22 for v1.1 milestone*
*Phases continue from v1.0 (which ended at phase 6)*
