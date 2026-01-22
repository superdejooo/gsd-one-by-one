# Requirements: GSD for GitHub v1.1

**Defined:** 2026-01-22
**Milestone:** v1.1 — Plan & Execute Commands
**Core Value:** Enable autonomous AI-driven development that runs in CI/CD, responds to GitHub issue comments, creates and updates planning artifacts in the repo, and tracks progress via GitHub issues.

## v1.1 Requirements

Requirements for the Plan & Execute Commands milestone.

### Phase Planning

- [x] **PLAN-01**: `gsd:plan-phase` command parses phase number and triggers phase planning workflow
- [x] **PLAN-02**: Phase planner creates detailed execution plans with tasks, dependencies, and verification
- [x] **PLAN-03**: Plans are committed to `.planning/phases/{n}/` directory

### Phase Execution

- [ ] **EXEC-01**: `gsd:execute-phase` command executes planned actions with wave-based parallelization
- [ ] **EXEC-02**: Agent can read GitHub issue status to determine resume point
- [ ] **EXEC-03**: Agent updates issue status as tasks complete (pending → in-progress → complete)

### Issue Tracking

- [ ] **ISSUE-01**: Each action in a plan creates a corresponding GitHub issue
- [ ] **ISSUE-02**: Issue body contains action details, verification criteria, and phase context

### Workflow Resilience

- [ ] **RETRY-01**: Workflow can resume from last incomplete action on retry

## v2 Requirements (Deferred)

### Multi-Repo Support

- **MREPO-01**: Support for cross-repository workflow orchestration
- **MREPO-02**: Issue linking across repositories
- **MREPO-03**: Shared planning context for multi-repo projects

### Integration

- **JIRA-01**: Bidirectional sync between GitHub issues and Jira tickets
- **JIRA-02**: Import existing Jira issues as GSD actions
- **JIRA-03**: Export GSD plans to Jira epics

### Analytics

- **ANALYT-01**: Track velocity metrics across milestones
- **ANALYT-02**: Burndown chart generation
- **ANALYT-03**: Performance dashboards

## Out of Scope

| Feature | Reason |
|---------|--------|
| Jira integration | Defer to v2 with GitHub-Jira mirroring |
| Multi-repo workflows | Single repo focus for v1.x |
| Real-time progress dashboard | Issue comments sufficient for v1.x |
| Complex branching strategies | Main branch workflow for v1.x |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAN-01 | Phase 7 | Complete |
| PLAN-02 | Phase 7 | Complete |
| PLAN-03 | Phase 7 | Complete |
| EXEC-01 | Phase 8 | Pending |
| EXEC-02 | Phase 8 | Pending |
| EXEC-03 | Phase 8 | Pending |
| ISSUE-01 | Phase 9 | Pending |
| ISSUE-02 | Phase 9 | Pending |
| RETRY-01 | Phase 8 | Pending |

**Coverage:**
- v1.1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-22 for v1.1 milestone*
