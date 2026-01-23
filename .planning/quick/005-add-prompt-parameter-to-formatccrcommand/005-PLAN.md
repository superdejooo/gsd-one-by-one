---
phase: quick
plan: 005
type: execute
wave: 1
depends_on: []
files_modified:
  - src/llm/ccr-command.js
  - src/llm/ccr-command.test.js
autonomous: true

must_haves:
  truths:
    - "formatCcrCommand appends prompt to end of command string when provided"
    - "formatCcrCommand behaves same as before when prompt is not provided"
    - "formatCcrCommandWithOutput passes prompt through to formatCcrCommand"
  artifacts:
    - path: "src/llm/ccr-command.js"
      provides: "CCR command formatting with optional prompt parameter"
      exports: ["formatCcrCommand", "formatCcrCommandWithOutput"]
    - path: "src/llm/ccr-command.test.js"
      provides: "Tests for prompt parameter behavior"
      contains: "with prompt parameter"
  key_links:
    - from: "formatCcrCommandWithOutput"
      to: "formatCcrCommand"
      via: "prompt parameter passthrough"
      pattern: "formatCcrCommand\\(gsdCommand,\\s*prompt\\)"
---

<objective>
Add optional prompt parameter to formatCcrCommand and formatCcrCommandWithOutput functions.

Purpose: Enable commands like "@gsd-bot new-milestone {prompt}" and "@gsd-bot verify-work {prompt}" to pass user-provided prompts to the GSD commands.

Output: Updated ccr-command.js with prompt support and comprehensive tests.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/llm/ccr-command.js
@src/llm/ccr-command.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add prompt parameter to CCR command functions</name>
  <files>src/llm/ccr-command.js</files>
  <action>
Update formatCcrCommand to accept optional second parameter `prompt`:
- Function signature: `formatCcrCommand(gsdCommand, prompt = null)`
- If prompt is provided (truthy), append it after /github-actions-testing with a space
- Pattern with prompt: `ccr code --print "{gsdCommand} /github-actions-testing {prompt}"`
- Pattern without prompt: `ccr code --print "{gsdCommand} /github-actions-testing"` (unchanged)

Update formatCcrCommandWithOutput to accept optional third parameter `prompt`:

- Function signature: `formatCcrCommandWithOutput(gsdCommand, outputPath, prompt = null)`
- Pass prompt through to formatCcrCommand call
- Pattern: `formatCcrCommand(gsdCommand, prompt)`

Update JSDoc comments for both functions to document the new parameter.
</action>
<verify>File saved, syntax valid: `node --check src/llm/ccr-command.js`</verify>
<done>Both functions accept optional prompt parameter, appending it to command string when provided</done>
</task>

<task type="auto">
  <name>Task 2: Add tests for prompt parameter</name>
  <files>src/llm/ccr-command.test.js</files>
  <action>
Add tests to formatCcrCommand describe block:
1. Test 'appends prompt when provided' - verify prompt appears at end after /github-actions-testing
2. Test 'handles prompt with null value' - verify null prompt behaves same as no prompt (backward compatibility)

Add tests to formatCcrCommandWithOutput describe block:

1. Test 'passes prompt to formatCcrCommand' - verify prompt appears in final command string
2. Test 'works without prompt parameter' - verify existing behavior unchanged (backward compatibility)

Example expected outputs:

- With prompt: `ccr code --print "/gsd:new-milestone Create a login system" /github-actions-testing"`
  Wait, re-reading requirements... Pattern is `/gsd:{command} /github-actions-testing {prompt}`
- With prompt: `ccr code --print "/gsd:new-milestone /github-actions-testing Create a login system" > output.txt 2>&1`
- Without prompt: `ccr code --print "/gsd:plan-phase 7 /github-actions-testing" > output.txt 2>&1` (unchanged)
  </action>
  <verify>Run tests: `npm test -- src/llm/ccr-command.test.js` - all tests pass</verify>
  <done>New tests for prompt parameter pass, existing tests still pass (no regressions)</done>
  </task>

</tasks>

<verification>
```bash
# Syntax check
node --check src/llm/ccr-command.js

# Run specific tests

npm test -- src/llm/ccr-command.test.js

# Run full test suite to ensure no regressions

npm test

```
</verification>

<success_criteria>
- formatCcrCommand("/gsd:new-milestone", "Build a login system") returns `ccr code --print "/gsd:new-milestone /github-actions-testing Build a login system"`
- formatCcrCommand("/gsd:plan-phase 7") returns `ccr code --print "/gsd:plan-phase 7 /github-actions-testing"` (unchanged)
- formatCcrCommandWithOutput("/gsd:verify-work", "output.txt", "Check the API") returns command with prompt appended
- formatCcrCommandWithOutput("/gsd:execute-phase 3", "output.txt") returns command without prompt (unchanged)
- All tests pass including new prompt tests
</success_criteria>

<output>
After completion, create `.planning/quick/005-add-prompt-parameter-to-formatccrcommand/005-SUMMARY.md`
</output>
```
