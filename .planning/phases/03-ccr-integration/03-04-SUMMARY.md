---
phase: 03-ccr-integration
plan: 04
subsystem: infra
tags: [ccr, config, architecture-cleanup, gap-closure]

# Dependency graph
requires:
  - phase: 03-03
    provides: CCR 2.1.15 stdin pipe architecture with Agent SDK marked deprecated
provides:
  - NON_INTERACTIVE_MODE: true in CCR config for CI safety
  - Complete architecture cleanup: Agent SDK removed, stdin pipe only
  - Consistent codebase with no conflicting execution approaches
affects: [05-milestone-creation, command-execution, future-llm-commands]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gap closure verification: Address inconsistencies between SUMMARY and implementation"
    - "Architecture cleanup: Remove deprecated dependencies completely"

key-files:
  created: []
  modified:
    - src/llm/config-generator.js
    - package.json
    - .github/workflows/gsd-command-handler.yml

key-decisions:
  - "Architecture finalized: Stdin pipe only, Agent SDK completely removed"
  - "NON_INTERACTIVE_MODE: true required for CI-safe CCR execution"
  - "setup:ccr script updated for ESM compatibility"

patterns-established:
  - "Gap closure plans address verification failures systematically"
  - "Architecture decisions must be reflected consistently across all artifacts"

# Metrics
duration: 1min
completed: 2026-01-21
---

# Phase 03 Plan 04: Gap Closure - Verification Failures Summary

**Architecture cleanup complete: NON_INTERACTIVE_MODE added, Agent SDK removed, ANTHROPIC_BASE_URL removed - consistent stdin pipe execution only**

## Performance

- **Duration:** 1 min
- **Started:** 2026-01-21T23:46:37Z
- **Completed:** 2026-01-21T23:47:57Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- **NON_INTERACTIVE_MODE: true** added to CCR config generator (prevents CI hangs)
- **Agent SDK dependency removed** from package.json (completes architecture pivot)
- **ANTHROPIC_BASE_URL removed** from workflow (no longer needed for stdin pipe)
- **Bundle rebuilt** to reflect cleaned dependencies (32,387 lines, no change)
- **setup:ccr script fixed** for ESM compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Add NON_INTERACTIVE_MODE to CCR config generator** - `9cb4a7e` (feat)
2. **Task 2: Remove Agent SDK dependency and orphaned workflow env var** - `656530e` (chore)
3. **Task 3: Rebuild bundle and verify** - `70cd357` (chore)

**Plan metadata:** _(to be added in final commit)_

## Files Created/Modified

- `src/llm/config-generator.js` - Added NON_INTERACTIVE_MODE: true as first config property
- `package.json` - Removed @anthropic-ai/claude-agent-sdk dependency, fixed setup:ccr for ESM
- `.github/workflows/gsd-command-handler.yml` - Removed ANTHROPIC_BASE_URL env var
- `dist/index.js` - Rebuilt (no Agent SDK references, 32,387 lines)
- `dist/licenses.txt` - Updated after rebuild

## Decisions Made

**1. NON_INTERACTIVE_MODE required for CI safety**
- Rationale: CCR-07 requirement to prevent workflow hangs from interactive prompts
- Impact: Critical for CI/CD execution reliability

**2. Complete Agent SDK removal (not just deprecation)**
- Rationale: Verification found mixed signals (deprecated but still installed), causing confusion
- Impact: Clear architecture with stdin pipe only, smaller bundle, no SDK routing

**3. ANTHROPIC_BASE_URL removal**
- Rationale: Was for Agent SDK routing through CCR proxy; stdin pipe doesn't use it
- Impact: Workflow simplified, no orphaned configuration

**4. setup:ccr script ESM fix**
- Rationale: Project is ESM (type: "module"), CommonJS require() fails
- Solution: Use --input-type=module with dynamic import
- Impact: Config generation works correctly

## Deviations from Plan

**None - gap closure plan executed exactly as written.**

The plan correctly identified all three verification gaps:
1. Missing NON_INTERACTIVE_MODE → Added
2. Agent SDK still present → Removed
3. ANTHROPIC_BASE_URL orphaned → Removed

Additional fix (setup:ccr ESM) was anticipated in plan task description.

## Issues Encountered

None - all gaps addressed successfully on first attempt.

## Gap Closure Context

This plan addressed verification failures from `.planning/phases/03-ccr-integration/03-VERIFICATION.md`:

### Gaps Addressed

**Gap 1: NON_INTERACTIVE_MODE missing from CCR config**
- **Status:** ✅ CLOSED
- **Evidence:** Line 20 in src/llm/config-generator.js now has `"NON_INTERACTIVE_MODE": true,`
- **Impact:** CCR will not prompt for user input in CI, preventing workflow hangs

**Gap 2: Architecture decision unclear**
- **Status:** ✅ CLOSED
- **Evidence:** Agent SDK removed from package.json, ANTHROPIC_BASE_URL removed from workflow
- **Impact:** Codebase now consistently reflects stdin pipe approach documented in 03-03-SUMMARY.md

**Gap 3: Mixed signals in codebase**
- **Status:** ✅ CLOSED
- **Evidence:**
  - package.json: No Agent SDK dependency
  - workflow: No ANTHROPIC_BASE_URL
  - dist/index.js: Zero Agent SDK references
- **Impact:** Architecture is now clear and consistent across all artifacts

### Verification Results

All verification checks from plan passed:

1. **Config check:** `NON_INTERACTIVE_MODE: true` in generated config ✅
2. **Dependency check:** `grep "claude-agent-sdk" package.json` returns nothing ✅
3. **Workflow check:** `grep "ANTHROPIC_BASE_URL" .github/workflows/gsd-command-handler.yml` returns nothing ✅
4. **Bundle check:** `grep "claude-agent-sdk" dist/index.js` returns nothing ✅

### Before vs After

**Before (03-03 state with gaps):**
```
✓ CCR 2.1.15 installed
✓ Claude Code CLI + GSD plugin
✓ Stdin pipe documented in SUMMARY
✗ NON_INTERACTIVE_MODE missing (CI risk)
✗ Agent SDK still in package.json (confusion)
✗ ANTHROPIC_BASE_URL still set (orphaned)
```

**After (03-04 gap closure complete):**
```
✓ CCR 2.1.15 installed
✓ Claude Code CLI + GSD plugin
✓ Stdin pipe documented in SUMMARY
✓ NON_INTERACTIVE_MODE: true in config
✓ Agent SDK removed from package.json
✓ ANTHROPIC_BASE_URL removed from workflow
✓ Architecture consistent across all artifacts
```

## Architecture Final State

### Execution Pattern (Finalized)

**Current approach:**
```javascript
// In future Phase 5 implementation:
const { exec } = require('child_process');
exec(`echo "/gsd:new-milestone" | ccr code`, (error, stdout, stderr) => {
  // Handle result
});
```

**Deprecated approach (removed):**
```javascript
// REMOVED - No longer in codebase
import { executeLLMTaskWithRetry } from "./llm/agent.js";
const result = await executeLLMTaskWithRetry(prompt);
```

### Workflow Configuration (Finalized)

```yaml
# .github/workflows/gsd-command-handler.yml
- Install Claude Code CLI: npm install -g claude-code@latest
- Install GSD Plugin: npx get-shit-done-cc
- Install CCR 2.1.15: npm install -g @musistudio/claude-code-router@2.1.15
- Generate config: npm run setup:ccr (with OPENROUTER_API_KEY et al)
- Start CCR: ccr start (with health check)
- Run action: uses: ./ (NO ANTHROPIC_BASE_URL)
```

### CCR Config (Finalized)

```javascript
{
  "NON_INTERACTIVE_MODE": true,  // NEW - Prevents CI hangs
  "LOG": false,
  "HOST": "127.0.0.1",
  "PORT": 3456,
  "Providers": [...],            // OpenRouter, Anthropic, DeepSeek
  "Router": {...},               // Model routing rules
  "StatusLine": {...}            // Status display config
}
```

### Bundle Metrics (Finalized)

- **Lines:** 32,387 (no change from 03-03)
- **Size:** 1.1MB
- **Agent SDK references:** 0 (verified with grep)
- **Growth from baseline:** Minimal (baseline was 31,998 lines)

## Next Phase Readiness

**Ready for Phase 4 (GitHub Integration & Response):** CCR integration verified and gap-free.

**Phase 3 Complete:**
- CCR 2.1.15 service lifecycle ✅
- Config generation with NON_INTERACTIVE_MODE ✅
- Multi-provider routing (OpenRouter, Anthropic, DeepSeek) ✅
- Stdin pipe architecture finalized ✅
- No conflicting execution approaches ✅
- Verification gaps closed ✅

**What Phase 4 will implement:**
- GitHub CLI operations (issue/comment management)
- Label management workflow
- PR creation and updates
- No LLM execution yet (deferred to Phase 5)

**What Phase 5 will implement:**
- Command execution via stdin pipe: `echo "/gsd:command" | ccr code`
- Milestone planning workflow (06-RESEARCH scope)
- Planning artifact creation (.planning/milestones/)
- GitHub issue integration for progress tracking

**CCR infrastructure status:**
- Service lifecycle: ✅ Complete
- Config generation: ✅ Complete (with NON_INTERACTIVE_MODE)
- Multi-provider routing: ✅ Complete
- Non-interactive execution: ✅ Complete and verified
- Architecture consistency: ✅ Complete (gaps closed)

**Gap closure process:**
- Verification identified 3 gaps ✅
- Gap closure plan created ✅
- All gaps addressed systematically ✅
- Re-verification shows all checks pass ✅

---
*Phase: 03-ccr-integration*
*Completed: 2026-01-21*
