---
phase: quick-010
plan: 01
subsystem: llm-integration
tags: [ccr, output-handling, error-messages]
requires: [quick-009]
provides:
  - Clean stdout/stderr separation for CCR commands
  - Improved GitHub comment quality
  - Debug logs preserved separately
affects: [all-future-workflows]
tech-stack:
  added: []
  patterns:
    - "Separate stdout/stderr file redirection (> stdout 2> stderr)"
    - "Object return pattern for file paths"
decisions:
  - id: split-output-files
    context: "Error messages in GitHub comments were malformed due to CCR debug logs inflating output size, causing `substring(0, 500)` to truncate mid-JSON-object"
    decision: "Split CCR output into two files: basePath.txt (clean agent output) and basePath-debug.txt (debug logs)"
    rationale: "Clean separation prevents debug noise from polluting GitHub comments while preserving debug logs for artifact upload"
    alternatives: ["Strip logs in-memory (loses debugging info)", "Increase truncation limit (doesn't solve root cause)"]
key-files:
  created: []
  modified:
    - src/llm/ccr-command.js
    - src/llm/ccr-command.test.js
    - src/milestone/label-trigger.js
    - src/milestone/phase-planner.js
    - src/milestone/phase-executor.js
    - src/milestone/reply.js
    - src/milestone/milestone-completer.js
    - src/milestone/label-trigger.test.js
    - src/milestone/phase-planner.test.js
    - src/milestone/phase-executor.test.js
    - src/milestone/reply.test.js
    - src/milestone/milestone-completer.test.js
metrics:
  duration: 3.5 min
  completed: 2026-01-24
---

# Quick Task 010: Split CCR Output into Clean Agent Output and Debug Logs

**One-liner:** Separate CCR stdout (agent output) from stderr (debug logs) to fix malformed GitHub error comments caused by truncating mid-JSON-object

## Context

**Problem:** GitHub error comments were showing malformed JSON because:
1. CCR debug logs inflated output size
2. `output.substring(0, 500)` truncated in middle of JSON object
3. Users saw broken error messages instead of clean agent output

**Solution:** Split output into two files using shell redirection:
- `basePath.txt` - Clean agent output only (stdout)
- `basePath-debug.txt` - CCR debug logs (stderr)

## What Was Completed

### Task 1: Update formatCcrCommandWithOutput Function ✅
**Commit:** b13f1d8

Changed function signature and return type:
- **Before:** `formatCcrCommandWithOutput(gsdCommand, outputPath, prompt, skill) -> string`
- **After:** `formatCcrCommandWithOutput(gsdCommand, basePath, prompt, skill) -> {command, stdoutPath, stderrPath}`

Implementation:
```javascript
const stdoutPath = `${basePath}.txt`;
const stderrPath = `${basePath}-debug.txt`;
return {
  command: `${baseCommand} > ${stdoutPath} 2> ${stderrPath}`,
  stdoutPath,
  stderrPath,
};
```

Shell redirection changed from `2>&1` (merge streams) to `2>` (separate stderr).

Updated all 13 tests to verify object return format.

### Task 2: Update All Workflow Modules ✅
**Commit:** b5ac09f

Updated 5 workflow modules to use new output format:
- `src/milestone/label-trigger.js`
- `src/milestone/phase-planner.js`
- `src/milestone/phase-executor.js`
- `src/milestone/reply.js`
- `src/milestone/milestone-completer.js`

Pattern applied to each:
```javascript
// Before
const outputPath = `output-${Date.now()}.txt`;
const command = formatCcrCommandWithOutput(..., outputPath, ...);
output = await fs.readFile(outputPath, "utf-8");

// After
const basePath = `output-${Date.now()}`;
const { command, stdoutPath, stderrPath } = formatCcrCommandWithOutput(..., basePath, ...);
core.info(`Debug logs: ${stderrPath}`);
output = await fs.readFile(stdoutPath, "utf-8");
```

Both files remain for artifact upload (neither deleted).

### Task 3: Update Tests for New Return Format ✅
**Commit:** b5ac09f (same commit as Task 2)

Updated all workflow test mocks to return object format:
```javascript
// Before
vi.mock("../llm/ccr-command.js", () => ({
  formatCcrCommandWithOutput: (gsdCmd, outputPath) =>
    `ccr code --print "${gsdCmd}" > ${outputPath} 2>&1`,
}));

// After
vi.mock("../llm/ccr-command.js", () => ({
  formatCcrCommandWithOutput: (gsdCmd, basePath) => ({
    command: `ccr code --print "${gsdCmd}" > ${basePath}.txt 2> ${basePath}-debug.txt`,
    stdoutPath: `${basePath}.txt`,
    stderrPath: `${basePath}-debug.txt`,
  }),
}));
```

Updated expect patterns in tests from `/output-\d+\.txt$/` to `/output-\d+$/` (basePath without extension).

All 464 tests passing.

## Decisions Made

**Decision:** Use shell redirection `> stdout 2> stderr` instead of `2>&1`
- **Context:** Need to separate clean output from debug noise
- **Options:**
  - A: Merge streams and strip logs in-memory (`2>&1` + filter)
  - B: Separate streams via redirection (`> stdout 2> stderr`)
- **Choice:** B - Separate streams via redirection
- **Rationale:** Preserves complete debug logs for troubleshooting while keeping GitHub comments clean

## Deviations from Plan

None - plan executed exactly as written.

## Technical Details

**Before:**
```bash
ccr code --print "..." > output-12345.txt 2>&1
# Both stdout and stderr mixed in output-12345.txt
```

**After:**
```bash
ccr code --print "..." > output-12345.txt 2> output-12345-debug.txt
# stdout in output-12345.txt (clean agent output)
# stderr in output-12345-debug.txt (CCR debug logs)
```

**Impact on GitHub Comments:**
- Error messages now truncate clean output only
- No more mid-JSON truncation
- Debug logs still available via artifact download

## Verification

✅ All tests pass (464/464)
✅ Bundle builds successfully (1267kB dist/index.js)
✅ formatCcrCommandWithOutput returns object with command, stdoutPath, stderrPath
✅ All workflow modules read from stdoutPath
✅ Both output files preserved for artifact upload

## Commits

| Task | Commit  | Message                                                        |
| ---- | ------- | -------------------------------------------------------------- |
| 1    | b13f1d8 | refactor(quick-010): update formatCcrCommandWithOutput         |
| 2+3  | b5ac09f | feat(quick-010): update workflow modules to use separated I/O  |

## Files Modified

**Core Implementation:**
- `src/llm/ccr-command.js` - Function signature and shell redirection
- `src/llm/ccr-command.test.js` - Test object return format

**Workflow Modules:**
- `src/milestone/label-trigger.js`
- `src/milestone/phase-planner.js`
- `src/milestone/phase-executor.js`
- `src/milestone/reply.js`
- `src/milestone/milestone-completer.js`

**Test Files:**
- `src/milestone/label-trigger.test.js`
- `src/milestone/phase-planner.test.js`
- `src/milestone/phase-executor.test.js`
- `src/milestone/reply.test.js`
- `src/milestone/milestone-completer.test.js`

Total: 12 files modified

## Next Phase Readiness

**Ready:** This change is complete and ready for production use.

**Benefits for Future Work:**
- Clean error messages in GitHub comments
- Debug logs preserved for troubleshooting
- Pattern established for all future CCR commands

**No blockers identified.**
