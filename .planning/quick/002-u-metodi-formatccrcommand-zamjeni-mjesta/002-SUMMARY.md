# Quick Task 002: Swap command order in formatCcrCommand

## Summary

Modified the `formatCcrCommand` function to swap the order of commands.

## Changes Made

### 1. src/llm/ccr-command.js
- Changed pattern from `/github-actions-testing and now trigger command /gsd:{command}` to `/gsd:{command} /github-actions-testing`
- Updated JSDoc comments and example

### 2. src/llm/ccr-command.test.js
- Updated test assertions to match new command format

### 3. dist/index.js
- Rebuilt with `npm run build`

## Verification

- All 363 tests pass
- Build completes successfully
