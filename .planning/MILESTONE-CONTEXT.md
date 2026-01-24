# Milestone Planning: Non-Interactive Execution Engine

**Date:** 2026-01-24
**Status:** QUESTIONING — Critical questions pending

---

## User's Proposal

One-shot, non-interactive execution engine that replaces manual GSD flow:
- Milestone = commitment, runs until ends
- Planning = single input, no back-and-forth
- Research = silent, no approvals
- Implementation = sequential, no hand-offs
- Verification = self-checking, not review
- Engine re-runs with no parameters
- State on cards only: files are signals, cards are truth

**Rule:** Files may exist, but meaning must be reflected as state on card. If not on card, doesn't exist.

---

## Critical Unresolved Questions

### 1. Scope Boundary

**Question:** What is this milestone actually building?

**Options:**
- A. New engine architecture to replace current GSD for GitHub entirely
- B. Alternative execution mode alongside existing conversation-based system
- C. Internal refactor of how phases execute (still conversation-based)

**Why it matters:** A changes everything. B requires dual-mode architecture. C is limited in scope.

---

### 2. Engine Entry Point

**Question:** How does the engine "run again" to decide next action?

**Options:**
- A. Cron job polling for uncompleted cards
- B. Command `/gsd:continue` (user-triggered)
- C. GitHub event trigger (label added, comment posted)
- D. Workflow_dispatch (manual trigger in Actions UI)

**Why it matters:** Determines automation level, requires different GitHub Actions configuration.

---

### 3. State Representation on Cards

**Question:** When you say "state on the card," what exactly is the representation?

**Context:** You mention examples like "Research completed, assumptions locked" — but where?

**Options:**
- A. Issue body structured sections
- B. Most recent comment
- C. Label combination (e.g., `status:researching` + `phase:01`)
- D. Issue title prefix/state badge

**Why it matters:** Determines engine parsing logic, GitHub API read patterns.

---

### 4. Finite State Model

**Question:** What are the concrete states a card can be in?

**User mentions:**
- planned → researching → implementing → verifying → complete

**Missing:**
- What does "blocked" look like?
- What does "failed" look like?
- What does "awaiting dependency" look like?
- Are states hierarchical? (phase → task → subtask?)

**Why it matters:** Engine needs finite state machine to decide transitions. Ambiguous states break automation.

---

### 5. Planning Input Format

**Question:** If "one shot planning," what's the expected input format?

**Options:**
- A. Free-form prose (like your description above)
- B. Structured YAML/JSON specification
- C. Markdown with defined sections
- D. Combination: prose + structured directives

**Why it matters:** Engine must parse this. Free-form is fragile. Structured is rigid but reliable.

**Related:** How does engine know when to stop planning and start executing?

---

### 6. File Monitoring

**Question:** How does engine know when a file "appears"?

**Context:** "When such a file appears or changes, system reads it"

**Options:**
- A. Workflow triggered on push (checks all files)
- B. Workflow triggered on specific file paths (.planning/**)
- C. Engine explicitly lists files to watch
- D. No monitoring — files are only read during explicit phases

**Why it matters:** Determines GitHub Actions trigger configuration, file watching logic.

---

### 7. "Meaning Extraction" Logic

**Question:** How does engine derive "meaning" from arbitrary files?

**Context:** "Understands what changed: progress, decision, result, blocker, completion"

**Questions:**
- Is there a schema each file must follow?
- Or is LLM used to interpret?
- What if interpretation is ambiguous?
- Is interpretation deterministic or probabilistic?

**Why it matters:** If LLM-based, needs prompt engineering, error handling. If schema-based, requires strict formatting rules.

---

### 8. Transition Path

**Question:** Does this milestone maintain backward compatibility?

**Options:**
- A. Complete break — v2.0 requires migration
- B. Coexist — v1.1 commands still work, engine is new mode
- C. Gradual migration — can switch projects individually

**Why it matters:** Affects migration docs, whether existing users are disrupted.

---

### 9. GitHub Card Structure

**Question:** What's the hierarchical relationship between cards?

**Options:**
- A. Milestone issue → Phase issues → Task issues (3-level hierarchy)
- B. Single card per phase, tasks as checklist items
- C. Project board with columns, cards as tasks
- D. Milestone as label, tasks as issues

**Why it matters:** Determines GitHub Projects integration, how engine traverses work.

---

### 10. Verification Logic

**Question:** "Does this match what was planned?" — where is "what was planned" stored?

**Options:**
- A. On the card itself (original requirements section)
- B. In .planning/PLAN.md (current pattern)
- C. In issue body template
- D. Engine derives from planning input

**Why it matters:** If on card only, state principle holds. If in files, breaks "files are signals" rule.

---

## Decision Dependencies

**Cannot proceed until these are resolved:**

1. Scope (Q1) → determines all other decisions
2. Entry point (Q2) → architecture foundation
3. State representation (Q3) → parsing logic
4. State model (Q4) → state machine design

**Secondary dependencies (depend on primary):**
- Q5-Q10 all hinge on first 4 answers

---

## Current System Context

**From PROJECT.md:**
- v1.1 shipped: plan-phase, execute-phase commands
- Uses GitHub issues for tracking
- Planning docs in .planning/ folder
- CCR for LLM execution
- 94.15% test coverage, 469 tests

**Tension with proposal:**
- Current: Planning files are source of truth
- Proposed: Cards are only truth

This is a fundamental architectural inversion.

---

## Proposed Next Step

User answers questions → I create design doc → We review → Proceed to requirements

**Or:** If questions are unclear, provide examples/clarify intent → I refine questions → Repeat until answers are actionable

---

_Updated: 2026-01-24 — Initial questioning phase_
