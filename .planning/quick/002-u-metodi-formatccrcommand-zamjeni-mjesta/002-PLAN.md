# Quick Task 002: Swap command order in formatCcrCommand

## Description
U metodi formatCcrCommand zamjeni mjesta github testing i gsd komandi; now load skill and start as planned /github-action-testing

## Tasks

### 1. Modify formatCcrCommand function
**File:** `src/llm/ccr-command.js`

Change the command pattern from:
```
/github-actions-testing and now trigger command /gsd:{command}
```

To:
```
/gsd:{command} /github-actions-testing
```

This loads the github-actions-testing skill and then runs the GSD command.

### 2. Update JSDoc comments
**File:** `src/llm/ccr-command.js`

Update the example in JSDoc to reflect the new command format.

### 3. Rebuild the project
**Command:** `npm run build`

Bundles the updated code to `dist/index.js`.

### 4. Verify no test failures
**Command:** `npm test`

Ensures tests still pass with the new command format.
