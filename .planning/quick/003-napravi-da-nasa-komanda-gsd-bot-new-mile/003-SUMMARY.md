---
phase: quick-003
plan: 01
subsystem: milestone-workflow
tags: [parser, validator, milestone, requirements, workflow]
requires: []
provides:
  - "new-milestone command requires mandatory description parameter"
  - "Description parameter supports up to 50000 characters"
  - "Multi-turn Q&A requirements gathering bypassed when description provided"
affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - src/lib/parser.js
    - src/lib/validator.js
    - src/milestone/index.js
    - src/index.js
decisions:
  - id: desc-001
    decision: "Description parameter mandatory for new-milestone"
    rationale: "90% of users provide complete milestone description upfront, Q&A adds friction"
    alternatives: ["Keep Q&A as default", "Make description optional"]
    chosen: "Make description mandatory"
  - id: desc-002
    decision: "Description character limit set to 50000"
    rationale: "GitHub comment limit is 65535 chars, 50000 provides safety margin for command overhead"
    alternatives: ["Use GitHub's full limit", "Use smaller limit like 10000"]
    chosen: "50000 char limit"
  - id: desc-003
    decision: "Standalone milestone number matched at start of string"
    rationale: "Format '1 Build auth system' is more natural than 'Build auth system 1'"
    alternatives: ["Match number at end", "Require --milestone flag"]
    chosen: "Match at start"
metrics:
  duration: 6 min
  completed: 2026-01-23
---

# Quick Task 003: Make new-milestone command require mandatory description

**One-liner:** new-milestone command now requires a description parameter (up to 50000 chars), bypassing multi-turn Q&A requirements gathering

## Objective

Update `@gsd-bot new-milestone` to require a mandatory description parameter instead of using multi-turn Q&A requirements gathering. This addresses the common use case where users provide a complete milestone description in the command itself.

## What Was Changed

### Task 1: Parser Enhancement

- Added `parseDescriptionArg()` helper function in `src/lib/parser.js`
- Extracts full description text from command args
- Returns null for empty/whitespace-only input
- Supports descriptions up to 50000 characters
- Added 9 comprehensive tests

**Files modified:**

- `src/lib/parser.js` - Added parseDescriptionArg function
- `src/lib/parser.test.js` - Added 9 tests for description parsing

**Commit:** `e2f1489`

### Task 2: Validator Update

- Updated `sanitizeArguments()` in `src/lib/validator.js`
- Special handling for `description` key: allows up to 50000 chars
- Other arguments maintain 500 char limit
- Still removes shell metacharacters from all arguments
- Added 6 comprehensive tests for description handling

**Files modified:**

- `src/lib/validator.js` - Updated length validation logic
- `src/lib/validator.test.js` - Added 6 tests for description validation

**Commit:** `8bfe05e`

### Task 3: Milestone Workflow Update

- Added `parseMilestoneDescription()` function to extract and validate description
- Updated `executeMilestoneWorkflow()` to skip Q&A and use description directly
- Description populates both `scope` and `features` in requirements object
- Updated `parseMilestoneNumber()` to match standalone number at start (not end)
- Updated `src/index.js` to pass raw args string to workflow
- Added 10 tests for parseMilestoneDescription
- Updated existing workflow tests for new behavior

**Files modified:**

- `src/milestone/index.js` - Added parseMilestoneDescription, updated workflow
- `src/milestone/index.test.js` - Added tests and updated existing tests
- `src/index.js` - Updated to pass raw args string
- `src/index.test.js` - Updated test expectations

**Commit:** `124f83d`

## Technical Details

### Command Formats Supported

All these formats work:

```bash
@gsd-bot new-milestone Build authentication system with login and signup
@gsd-bot new-milestone 1 Build authentication system with login and signup
@gsd-bot new-milestone --milestone 1 Build authentication system
@gsd-bot new-milestone -m 1 Build authentication system
```

### Description Processing

1. Parser extracts full args string from comment
2. `parseMilestoneNumber()` extracts milestone number (from flags or standalone)
3. `parseMilestoneDescription()` extracts description by removing milestone flags/number
4. Workflow validates description is not empty after extraction
5. Description populates `requirements.answered.scope` and `requirements.answered.features`
6. Q&A gathering completely bypassed

### Error Handling

Missing description triggers clear error:

```
Error: Milestone description is required. Provide a description of your milestone goals and features.
```

This error occurs when:

- No description provided: `@gsd-bot new-milestone 1`
- Only milestone flag: `@gsd-bot new-milestone --milestone 1`
- Empty/whitespace only text

## Testing

### Test Coverage

- Added 25 new tests across 4 test files
- All 388 tests passing
- Parser: 29 tests (9 new)
- Validator: 33 tests (6 new)
- Milestone workflow: 28 tests (10 new)
- Index dispatch: 12 tests (1 updated)

### Test Scenarios Covered

- Description extraction with various formats
- Long descriptions (5000+, 10000+ chars)
- Description length validation (50000 char limit)
- Shell metacharacter sanitization in descriptions
- Missing description error handling
- Workflow behavior with description
- Milestone number extraction from various formats

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task                  | Commit  | Files Changed | Tests Added |
| --------------------- | ------- | ------------- | ----------- |
| 1. Parser enhancement | e2f1489 | 2 files       | 9 tests     |
| 2. Validator update   | 8bfe05e | 2 files       | 6 tests     |
| 3. Workflow update    | 124f83d | 5 files       | 10 tests    |

## Verification

✅ All tests passing (388 tests)
✅ Build successful (`npm run build`)
✅ Description required for new-milestone command
✅ Descriptions up to 50000 characters accepted
✅ Missing description returns actionable error message
✅ Multi-turn Q&A bypassed when description provided

## Impact

**User Experience:**

- 🚀 Faster workflow - no multi-turn Q&A needed
- ✅ Single command creates milestone with description
- 📝 Clear error messages when description missing

**Implementation:**

- Backward incompatible change - old usage without description now fails
- Existing Q&A code paths remain for potential future use
- Requirements gathering module still exists but bypassed

**Future Considerations:**

- May want to add optional Q&A mode via flag (e.g., `--interactive`)
- Could support both description and additional Q&A refinement
- Consider adding description templates or examples in error message

## Next Phase Readiness

✅ Ready - No blockers identified

All functionality implemented and tested. The new-milestone command now provides a streamlined single-command experience for milestone creation.
