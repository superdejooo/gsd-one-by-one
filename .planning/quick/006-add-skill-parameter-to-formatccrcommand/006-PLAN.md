---
phase: quick
plan: 006
type: execute
wave: 1
depends_on: []
files_modified:
  - src/llm/ccr-command.js
  - src/llm/ccr-command.test.js
  - src/milestone/phase-planner.js
  - src/milestone/phase-executor.js
  - src/milestone/milestone-completer.js
autonomous: true

must_haves:
  truths:
    - "formatCcrCommand accepts skill parameter without error"
    - "formatCcrCommandWithOutput accepts skill parameter without error"
    - "All callers pass skill=null (or omit) for backward compatibility"
    - "Generated command strings are unchanged (skill not used yet)"
  artifacts:
    - path: "src/llm/ccr-command.js"
      provides: "CCR command formatting with skill parameter"
      exports: ["formatCcrCommand", "formatCcrCommandWithOutput"]
    - path: "src/llm/ccr-command.test.js"
      provides: "Tests verifying skill parameter acceptance"
  key_links:
    - from: "src/milestone/phase-planner.js"
      to: "formatCcrCommandWithOutput"
      via: "import and function call"
    - from: "src/milestone/phase-executor.js"
      to: "formatCcrCommandWithOutput"
      via: "import and function call"
    - from: "src/milestone/milestone-completer.js"
      to: "formatCcrCommandWithOutput"
      via: "import and function call"
---

<objective>
Add skill parameter to formatCcrCommand and formatCcrCommandWithOutput functions

Purpose: Thread skill parameter through the call chain in preparation for future use. The parameter should be accepted but NOT included in the generated command string yet.

Output: Updated ccr-command.js with skill parameter, updated tests, and all callers passing skill=null
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/llm/ccr-command.js
@src/llm/ccr-command.test.js
@src/milestone/phase-planner.js
@src/milestone/phase-executor.js
@src/milestone/milestone-completer.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add skill parameter to ccr-command.js</name>
  <files>src/llm/ccr-command.js</files>
  <action>
Update both functions to accept skill parameter:

1. formatCcrCommand(gsdCommand, prompt = null, skill = null)
   - Add skill as third parameter with default null
   - Update JSDoc to document skill parameter
   - Note in JSDoc: "skill parameter is accepted but not used yet (placeholder for future)"
   - DO NOT change the command string generation - skill is ignored for now

2. formatCcrCommandWithOutput(gsdCommand, outputPath, prompt = null, skill = null)
   - Add skill as fourth parameter with default null
   - Update JSDoc to document skill parameter
   - Pass skill through to formatCcrCommand (even though it's not used)

Valid skill values (for documentation): github-actions-templates, github-actions-testing, github-project-management, livewire-principles, refactor
</action>
<verify>npm test src/llm/ccr-command.test.js passes (existing tests unchanged)</verify>
<done>Both functions accept skill parameter, existing behavior unchanged</done>
</task>

<task type="auto">
  <name>Task 2: Update tests and callers</name>
  <files>src/llm/ccr-command.test.js, src/milestone/phase-planner.js, src/milestone/phase-executor.js, src/milestone/milestone-completer.js</files>
  <action>
1. In ccr-command.test.js, add tests:
   - 'accepts skill parameter without changing output'
   - 'passes skill through in formatCcrCommandWithOutput'
   - Test with skill='github-actions-testing' to verify parameter is accepted
   - Verify output is UNCHANGED (skill not included in command string)

2. In phase-planner.js (line ~133):
   - Call formatCcrCommandWithOutput(gsdCommand, outputPath, null, null)
   - Explicit null for prompt and skill for clarity

3. In phase-executor.js (line ~316):
   - Call formatCcrCommandWithOutput(gsdCommand, outputPath, null, null)
   - Explicit null for prompt and skill for clarity

4. In milestone-completer.js (line ~89):
   - Call formatCcrCommandWithOutput('/gsd:complete-milestone', outputPath, null, null)
   - Explicit null for prompt and skill for clarity
     </action>
     <verify>npm test passes (all 9+ ccr-command tests pass, workflow tests pass)</verify>
     <done>Tests verify skill parameter acceptance, callers explicitly pass null</done>
     </task>

</tasks>

<verification>
npm test -- --reporter=verbose
All tests pass, coverage maintained at 80%+
</verification>

<success_criteria>

- formatCcrCommand and formatCcrCommandWithOutput accept skill parameter
- Skill parameter is documented in JSDoc
- All callers (phase-planner, phase-executor, milestone-completer) explicitly pass skill=null
- Command string output is UNCHANGED (skill not used yet)
- All existing tests pass
- New tests verify skill parameter acceptance
  </success_criteria>

<output>
After completion, create `.planning/quick/006-add-skill-parameter-to-formatccrcommand/006-SUMMARY.md`
</output>
