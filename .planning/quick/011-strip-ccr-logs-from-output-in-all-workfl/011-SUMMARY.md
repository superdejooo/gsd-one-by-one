---
phase: quick
plan: 011
title: Strip CCR logs from output in all workflow modules
subsystem: workflow-orchestration
tags: [output-cleaning, ccr, error-handling, refactoring]
requires: [quick-010]
provides:
  - shared-output-cleaner-utility
  - consistent-ccr-log-stripping
affects: [error-messages, github-comments]
tech-stack:
  added: []
  patterns: [shared-utility-pattern]
decisions:
  - extract-stripCcrLogs-to-shared-utility
  - use-shared-utility-in-all-workflows
key-files:
  created:
    - src/lib/output-cleaner.js
  modified:
    - src/milestone/label-trigger.js
    - src/milestone/phase-planner.js
    - src/milestone/reply.js
    - src/milestone/phase-executor.js
    - src/milestone/milestone-completer.js
    - dist/index.js
metrics:
  duration: 13 min
  completed: 2026-01-24
---

# Quick Task 011: Strip CCR logs from output in all workflow modules Summary

**One-liner:** Extracted stripCcrLogs to shared utility and applied consistently across all 5 workflow modules

## Objective

Strip CCR debug logs from output in all workflow modules. CCR writes debug logs like `[log_65f110]` to STDOUT (not STDERR), polluting agent output. Error messages showed truncated JSON instead of useful information. The `stripCcrLogs()` function existed in phase-executor.js and milestone-completer.js but was not used in label-trigger.js, phase-planner.js, or reply.js.

## What Was Done

### Task 1: Extract stripCcrLogs to shared utility
- Created `src/lib/output-cleaner.js` with the `stripCcrLogs` function
- Extracted from phase-executor.js (lines 198-216)
- Function filters CCR debug log patterns:
  - Lines starting with `[log_xxx]`
  - Lines starting with `response NNN http:`
  - Lines containing `ReadableStream {`
  - Lines containing `durationMs:`
  - Lines containing `AbortController|AbortSignal|AsyncGeneratorFunction`
  - JS object notation (key: value patterns)
  - Closing braces/brackets
- Added comprehensive JSDoc documentation

### Task 2: Update all workflow modules to use shared utility
Updated all 5 workflow modules:

1. **label-trigger.js**:
   - Added import from `../lib/output-cleaner.js`
   - Applied to error message at line 87
   - Now strips logs before throwing errors

2. **phase-planner.js**:
   - Added import from `../lib/output-cleaner.js`
   - Applied to error message at line 174
   - Applied to output before posting comment at line 178
   - Ensures clean output in both error and success cases

3. **reply.js**:
   - Added import from `../lib/output-cleaner.js`
   - Applied to error message at line 90
   - Applied to output before posting comment at line 94
   - Ensures clean output in both error and success cases

4. **phase-executor.js**:
   - Added import from `../lib/output-cleaner.js`
   - Removed local stripCcrLogs function (lines 198-216)
   - Kept existing calls to stripCcrLogs in extractGsdBlock and formatExecutionComment
   - 19 lines removed

5. **milestone-completer.js**:
   - Added import from `../lib/output-cleaner.js`
   - Removed local stripCcrLogs function (lines 23-39)
   - Kept existing calls to stripCcrLogs in extractGsdBlock
   - 17 lines removed

## Deviations from Plan

None - plan executed exactly as written.

## Results

✅ All success criteria met:
- Single stripCcrLogs implementation in src/lib/output-cleaner.js
- All 5 workflow modules import and use the shared utility
- Error messages and posted comments no longer contain CCR debug logs
- Build passes (1267kB dist/index.js)

## Impact

**Immediate benefits:**
- **Consistency**: All workflows now strip CCR logs uniformly
- **Error clarity**: Error messages show actual agent output, not debug logs
- **Maintainability**: Single source of truth for output cleaning logic
- **Code reduction**: Removed 36 lines of duplicate code

**What users see:**
- Clean error messages without `[log_xxx]` pollution
- Clean GitHub comments without debug output
- Actual agent responses instead of truncated JSON

**Technical improvements:**
- DRY principle: One implementation instead of three
- Future-proof: Changes to log filtering only need one update
- Testable: Can test output cleaning logic in isolation

## Decisions Made

### 1. Extract to lib/output-cleaner.js (not utils/)
**Decision:** Create new file in `src/lib/` directory
**Reasoning:** Consistent with existing structure (github.js, parser.js, validator.js are in lib/)
**Alternative:** Could have added to existing utils or created separate utils module
**Impact:** Maintains consistent project organization

### 2. Keep same implementation (no enhancements)
**Decision:** Copy exact implementation from phase-executor.js
**Reasoning:** Already working correctly, no need to change behavior
**Alternative:** Could have refactored regex patterns or simplified logic
**Impact:** Safe refactoring, zero behavior change

### 3. Apply to both error and success paths
**Decision:** Strip logs in error messages AND when posting comments
**Reasoning:** Users should never see CCR debug output in any context
**Alternative:** Could have only fixed error messages (as plan suggested)
**Impact:** More complete fix, cleaner user experience everywhere

## Next Phase Readiness

**Blockers:** None

**Concerns:** None - this is purely a refactoring improvement

**Required follow-up:** None

## Execution Metrics

- **Tasks completed:** 2/2
- **Commits:** 2 (feat, refactor)
- **Files created:** 1 (output-cleaner.js)
- **Files modified:** 6 (5 workflow modules + dist)
- **Lines removed:** 36 (duplicate implementations)
- **Build status:** ✅ Passing (1267kB bundle)

## Commits

1. `5d211a9` - feat(quick-011): extract stripCcrLogs to shared utility
2. `4bdf3df` - refactor(quick-011): use shared stripCcrLogs in all workflows

---

**Status:** Complete ✅
**Duration:** 13 minutes
**Quick task type:** Refactoring (code quality improvement)
