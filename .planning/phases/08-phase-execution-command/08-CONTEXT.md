# Phase 8: Phase Execution Command - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement `gsd:execute-phase` command that executes planned actions with resume capability. The executor invokes GSD via CCR stdin pipe, parses output for actionable items, and posts structured comments to GitHub issues. GSD handles internal state tracking, commits, and parallelization.

</domain>

<decisions>
## Implementation Decisions

### Progress Reporting
- Summary comment at end of each workflow run (not real-time edits)
- Parsed summary format: extract completed actions, next steps, questions from GSD output
- GSD already outputs actionable items in list format with "next step" guidance
- Bot parses GSD output and structures it for GitHub comment

### Resume Behavior
- Auto-resume without confirmation — GSD tracks progress in `.planning/` folder
- Bot just invokes GSD; GSD knows where it left off
- On unrecoverable error: post error details and stop (no retry suggestion)
- GSD handles all commits internally — bot only posts comments

### Parallel Execution
- Parallelization happens inside single workflow run
- GSD handles wave-based parallelization internally
- Bot doesn't orchestrate parallel actions — just invokes GSD
- Timeout configured in config, not user-controlled

### Claude's Discretion
- Exact parsing logic for GSD output sections
- Comment formatting and markdown structure
- Error message formatting

</decisions>

<specifics>
## Specific Ideas

- Execution is conversational: agent may pause to ask questions, user replies, workflow restarts
- Each workflow run is one "step" in a multi-turn conversation
- GSD outputs actionable items in ordered list format
- Work tree creation for milestones will come in future phases

</specifics>

<deferred>
## Deferred Ideas

- Work tree creation at milestone start — future phase
- User-configurable timeouts — not planned (company controls timeout)

</deferred>

---

*Phase: 08-phase-execution-command*
*Context gathered: 2026-01-22*
