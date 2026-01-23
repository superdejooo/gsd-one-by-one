# Quick Task 009: Fix CCR Multiline Command String

## Problem

The `formatCcrCommand()` function in `src/llm/ccr-command.js` returns a multi-line string that breaks shell command execution. When `formatCcrCommandWithOutput()` appends `> output.txt 2>&1`, the shell interprets the newlines and the redirect never executes properly.

**Current broken output:**
```bash
ccr code --print "/gsd:complete-milestone but first load this skill .claude/skills/github-actions-testing/SKILL.md"
---- STRICT RULE ----
This is NON INTERACTIVE env,
...
 > output-123.txt 2>&1
```

The `> output-123.txt 2>&1` becomes a separate shell command, not a redirect of ccr.

**Expected output:**
```bash
ccr code --print "/gsd:complete-milestone but first load this skill .claude/skills/github-actions-testing/SKILL.md
---- STRICT RULE ----
This is NON INTERACTIVE env,
..." > output-123.txt 2>&1
```

## Solution

Move the closing quote to the END of the STRICT RULE block, so the entire message is part of the ccr `--print` argument. The redirect then applies to the ccr command.

## Tasks

1. **Fix formatCcrCommand return statement** - Move closing quote after STRICT RULE text
   - File: `src/llm/ccr-command.js`
   - Line ~48-64: Fix template literal structure

2. **Run tests** - Verify existing tests pass
   - `npm test -- src/llm/ccr-command.test.js`

## Acceptance Criteria

- [ ] Command string has proper quote structure
- [ ] Tests pass
- [ ] Output redirect is part of ccr command
