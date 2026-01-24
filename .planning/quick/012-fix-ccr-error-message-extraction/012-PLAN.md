# Quick Task 012: Fix CCR Error Message Extraction

## Problem

When the label-triggered new-milestone workflow failed, the error messages posted to GitHub issues were unreadable:

```
Label trigger failed: [log_0e2385] sending request {
  method: 'post',
  url: 'http://127.0.0.1:3456/v1/messages?beta=true',
  ...
```

Or after quick-011 fix, the error message was completely empty:

```
Label trigger failed:
```

## Root Cause Analysis

1. **CCR writes debug logs to STDOUT** - Even though we redirect stderr separately, CCR's debug output goes to stdout, polluting the agent output file.

2. **When CCR fails mid-request**, the output file contains only debug logs, no useful agent response.

3. **The `stripCcrLogs` function was too aggressive** - It stripped lines matching key: value patterns, which included legitimate error messages like "Error: Something went wrong".

4. **No fallback to other error sources** - When stdout was empty after stripping, there was no attempt to read error details from stderr or ccr.log.

5. **The actual error was in ccr.log** - The real error "Warning: No content in the stream response!" was only in ccr.log, not captured in the error message.

## Solution

### Task 1: Fix stripCcrLogs regex patterns
Update the key: value pattern matching to require at least 2 spaces of indentation, distinguishing CCR debug output (indented JSON) from actual content.

### Task 2: Add extractErrorMessage helper
Create a new function that tries multiple sources for error messages:
1. Cleaned stdout (if any meaningful content remains)
2. CCR log file (for warnings/errors like "No content in stream response")
3. Stderr/debug file

### Task 3: Update all workflow modules
Update label-trigger.js, phase-planner.js, phase-executor.js, reply.js, and milestone-completer.js to:
- Read stderr and ccr.log files when errors occur
- Use extractErrorMessage to get the best available error message

### Task 4: Add comprehensive tests
Add tests for both stripCcrLogs improvements and the new extractErrorMessage function.

## Files Changed

- `src/lib/output-cleaner.js` - Fix regex, add extractErrorMessage
- `src/lib/output-cleaner.test.js` - New test file
- `src/milestone/label-trigger.js` - Use extractErrorMessage
- `src/milestone/phase-planner.js` - Use extractErrorMessage
- `src/milestone/phase-executor.js` - Use extractErrorMessage
- `src/milestone/reply.js` - Use extractErrorMessage
- `src/milestone/milestone-completer.js` - Use extractErrorMessage
- `dist/index.js` - Rebuild

## Verification

- All 479 tests pass
- Error messages now show meaningful content from ccr.log when stdout is empty
- Legitimate error messages like "Error: Something went wrong" are preserved
