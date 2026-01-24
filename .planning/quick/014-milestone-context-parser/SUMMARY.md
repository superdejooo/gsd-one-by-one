# Quick Task 014: MILESTONE-CONTEXT.md Parser

## Problem

GSD's `/gsd:new-milestone` command enters a QUESTIONING phase when gathering requirements interactively. During this phase, it creates `.planning/MILESTONE-CONTEXT.md` instead of the standard `REQUIREMENTS.md` and `ROADMAP.md` files. The existing `parseMilestoneMetadata()` function couldn't find milestone data because it only looked for REQUIREMENTS.md.

From pipeline logs (run 21323386746):
- Agent created `.planning/MILESTONE-CONTEXT.md` (70 lines)
- Agent entered QUESTIONING state asking for confirmation
- Parser logged "Could not parse milestone metadata" because REQUIREMENTS.md didn't exist

## Solution

Added `parseMilestoneContext()` parser that handles the MILESTONE-CONTEXT.md format:

```markdown
# v1.2 Planning Context

## Milestone Goal
{goal description}

## Proposed v1.2 Core Focus
- **LINK-01**: Store phase and plan metadata
- **CLOSE-01**: Close issues when verified

**Status:** Ready for requirements definition
```

Updated `parseMilestoneMetadata()` to fall back to MILESTONE-CONTEXT.md when REQUIREMENTS.md is not found.

## Changes

### src/lib/planning-parser.js
- Added `parseMilestoneContext()` function (lines 467-523)
  - Extracts version from `# v{version} Planning Context`
  - Extracts goal from `## Milestone Goal` section
  - Extracts status from `**Status:**` line
  - Extracts requirements from `- **REQ-01**: description` patterns
- Updated `parseMilestoneMetadata()` to include context in fallback chain:
  - title: requirements → context → roadmap → default
  - version: requirements → context → roadmap → default
  - coreValue: requirements → context.goal → null
  - status: requirements → context → roadmap → null

### src/lib/planning-parser.test.js
- Added 4 tests for `parseMilestoneContext`:
  - Parse MILESTONE-CONTEXT.md format
  - Return null if file not found
  - Return null if version/goal can't be parsed
  - Handle missing requirements section
- Updated 5 tests for `parseMilestoneMetadata` fallback behavior

## Verification

```bash
$ npm test -- src/lib/planning-parser.test.js
 ✓ src/lib/planning-parser.test.js (32 tests)
```

Tested against real `.planning/MILESTONE-CONTEXT.md`:
```json
{
  "title": "v1.2 Planning Context",
  "version": "v1.2",
  "goal": "Enhance Issue Tracking Integration capabilities...",
  "status": "Ready for requirements definition",
  "requirements": [
    {"id": "LINK-01", "description": "Store phase and plan metadata in issue bodies"},
    {"id": "LINK-02", "description": "Parse issue metadata to discover phase ownership"},
    {"id": "CLOSE-01", "description": "Close issues when phase requirements are verified"},
    {"id": "CLOSE-02", "description": "Add closure comments with summary"},
    {"id": "SYNC-01", "description": "Update issue status during execution"}
  ]
}
```

## GSD Flow Understanding

The GSD new-milestone flow when triggered in CI:
1. GSD creates `MILESTONE-CONTEXT.md` with initial interpretation
2. GSD enters **QUESTIONING** state to confirm understanding
3. Agent outputs question asking for confirmation
4. CI has no mechanism to respond → workflow ends

The MILESTONE-CONTEXT.md serves as a handover document for the next interaction cycle.
