# Quick Task 009: Fix CCR Multiline Command String - COMPLETE

## Problem Fixed

The `formatCcrCommand()` function was producing a broken shell command where the STRICT RULE message was outside the quoted string, causing:
1. The output redirect (`> output.txt 2>&1`) to become a separate command
2. CCR returning 0 bytes of output in GitHub Actions

## Changes Made

**File: `src/llm/ccr-command.js`**

Moved the closing quote from line 48 to after the STRICT RULE block (line 64), ensuring the entire message is part of the `--print` argument.

**Before (broken):**
```bash
ccr code --print "/gsd:command ..."
---- STRICT RULE ----
...
 > output.txt 2>&1
```

**After (fixed):**
```bash
ccr code --print "/gsd:command ...
---- STRICT RULE ----
..." > output.txt 2>&1
```

## Verification

- All 469 tests pass
- Bundle rebuilt successfully (1265kB)

## Impact

This fix affects all GSD commands executed via CCR:
- `complete-milestone`
- `plan-phase`
- `execute-phase`
- `new-milestone`
- `reply`
