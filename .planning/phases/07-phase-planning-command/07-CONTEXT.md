# Phase 7: Phase Planning Command - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire GSD's built-in `plan-phase` command into the GitHub Action with exit detection, output capture, and error handling.

**Flow:**
1. Run: `echo "/gsd:plan-phase 7" | ccr code --print > output.txt`
2. Wait for agent exit (process completion)
3. Read output.txt
4. Validate for errors
5. Post result to GitHub comment

</domain>

<decisions>
## Implementation Decisions

### File Detection (Agent Exit)
- **Detection method:** Wait for process exit, not file polling
- **Timeout:** Per-command configurable in `config.json`
  - Some commands take 1 minute, others 1 hour
  - Default timeouts defined per command type
- **Exit detection:** Check child process exit code

### Argument Format
- **Phase number format:** Just the number
  - `/gsd:plan-phase 7` (not `--phase 7`)
  - Follows pattern from existing `new-milestone` command

### Error Validation
- **Detection method:** Both pattern matching AND exit code
- **Error patterns to detect:**
  - Auth errors: "Permission Denied", "Authorization failed", "not authorized"
  - General errors: "Error:", "Something went wrong", "failed"
  - Command errors: "Unknown command", "invalid arguments", "validation failed"
- **Error comment format:** User-friendly with fix guidance
  - Extract error message
  - Add "How to fix" guidance
  - Not full raw output

### Claude's Discretion
- Exact exit detection implementation (child_process handling)
- Config structure for per-command timeouts
- Error pattern regex details
- User-friendly error message template format

</decisions>

<specifics>
## Specific Ideas

**Command execution pattern:**
```
const { exec } = require('child_process');
exec(`echo "/gsd:plan-phase ${phaseNumber}" | ccr code --print > output.txt`,
  { timeout: config.timeouts?.planPhase || 600000 },
  (error, stdout, stderr) => {
    // Detect errors, read output.txt, post comment
  });
```

**Error detection:**
```javascript
function validateOutput(output, exitCode) {
  const isError = exitCode !== 0 ||
    /Permission Denied|Authorization failed|not authorized/i.test(output) ||
    /Error:|Something went wrong|failed/i.test(output) ||
    /Unknown command|invalid arguments|validation failed/i.test(output);

  if (isError) {
    return formatUserFriendlyError(output);
  }
  return formatSuccessComment(output);
}
```

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-phase-planning-command*
*Context gathered: 2026-01-22*
