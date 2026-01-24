---
phase: quick-010
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/llm/ccr-command.js
  - src/milestone/label-trigger.js
  - src/milestone/phase-planner.js
  - src/milestone/phase-executor.js
autonomous: true

must_haves:
  truths:
    - "CCR stdout (clean agent output) saved to separate file from stderr (debug logs)"
    - "GitHub comments show clean agent output without CCR debug noise"
    - "Error messages show clean truncation, not malformed JSON"
    - "Both output files preserved for artifact upload"
  artifacts:
    - path: "src/llm/ccr-command.js"
      provides: "formatCcrCommandWithOutput with separate stdout/stderr files"
      exports: ["formatCcrCommand", "formatCcrCommandWithOutput"]
    - path: "src/milestone/label-trigger.js"
      provides: "Workflow using separated output files"
    - path: "src/milestone/phase-planner.js"
      provides: "Workflow using separated output files"
    - path: "src/milestone/phase-executor.js"
      provides: "Workflow using separated output files"
  key_links:
    - from: "src/llm/ccr-command.js"
      to: "workflow modules"
      via: "formatCcrCommandWithOutput returns {command, stdoutPath, stderrPath}"
      pattern: "formatCcrCommandWithOutput.*stdoutPath.*stderrPath"
---

<objective>
Split CCR output into clean agent output (stdout) and debug logs (stderr)

Purpose: Fix malformed GitHub error comments caused by CCR debug logs mixed with agent output. Currently, `output.substring(0, 500)` truncates mid-JSON-object because debug noise inflates output size.

Output: Clean separation where GitHub comments show agent-only output, debug logs preserved separately for artifacts.
</objective>

<context>
@src/llm/ccr-command.js (current implementation - uses 2>&1 to merge streams)
@src/milestone/label-trigger.js (affected workflow)
@src/milestone/phase-planner.js (affected workflow)
@src/milestone/phase-executor.js (affected workflow)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update formatCcrCommandWithOutput to separate stdout/stderr</name>
  <files>src/llm/ccr-command.js</files>
  <action>
Modify formatCcrCommandWithOutput to:
1. Accept basePath instead of outputPath (e.g., `output-${timestamp}` without extension)
2. Generate two paths: `{basePath}.txt` (stdout) and `{basePath}-debug.txt` (stderr)
3. Return object `{command, stdoutPath, stderrPath}` instead of string
4. Command format: `ccr code --print "..." > {stdoutPath} 2> {stderrPath}`

Keep formatCcrCommand unchanged (still returns string, used for non-file scenarios).

Example change:
```javascript
export function formatCcrCommandWithOutput(gsdCommand, basePath, prompt = null, skill = null) {
  const stdoutPath = `${basePath}.txt`;
  const stderrPath = `${basePath}-debug.txt`;
  const baseCommand = formatCcrCommand(gsdCommand, prompt, skill);
  return {
    command: `${baseCommand} > ${stdoutPath} 2> ${stderrPath}`,
    stdoutPath,
    stderrPath,
  };
}
```
  </action>
  <verify>npm test -- src/llm/ccr-command.test.js (update tests in same task if needed)</verify>
  <done>formatCcrCommandWithOutput returns object with command, stdoutPath, stderrPath; stderr goes to separate file</done>
</task>

<task type="auto">
  <name>Task 2: Update all workflow modules to use new output format</name>
  <files>src/milestone/label-trigger.js, src/milestone/phase-planner.js, src/milestone/phase-executor.js</files>
  <action>
Update each workflow module:

1. Change call site from:
   ```javascript
   const outputPath = `output-${Date.now()}.txt`;
   const command = formatCcrCommandWithOutput(..., outputPath, ...);
   ```
   To:
   ```javascript
   const basePath = `output-${Date.now()}`;
   const { command, stdoutPath, stderrPath } = formatCcrCommandWithOutput(..., basePath, ...);
   ```

2. Read output from stdoutPath (clean agent output):
   ```javascript
   output = await fs.readFile(stdoutPath, "utf-8");
   ```

3. For error messages, use clean stdout only (no truncation needed for debug logs):
   ```javascript
   throw new Error(`Label trigger failed: ${output.substring(0, 500)}`);
   ```

4. Both files remain for artifact upload (don't delete either)

5. Add core.info logging for debug file location:
   ```javascript
   core.info(`Debug logs: ${stderrPath}`);
   ```

Apply this pattern to:
- src/milestone/label-trigger.js (lines ~51-76)
- src/milestone/phase-planner.js (lines ~138-174)
- src/milestone/phase-executor.js (lines ~340-372)
  </action>
  <verify>npm test (all existing tests pass with updated function signature)</verify>
  <done>All three workflow modules use separated stdout/stderr files; GitHub comments show clean output</done>
</task>

<task type="auto">
  <name>Task 3: Update tests for new return format</name>
  <files>src/llm/ccr-command.test.js, src/milestone/*.test.js</files>
  <action>
Update tests to handle new return format:

1. In ccr-command.test.js:
   - Update formatCcrCommandWithOutput tests to expect object return
   - Verify stdoutPath and stderrPath have correct extensions
   - Verify command string has correct redirect operators

2. In workflow test files (label-trigger.test.js, phase-planner.test.js, phase-executor.test.js):
   - Update mocks for formatCcrCommandWithOutput to return object format
   - Example mock:
     ```javascript
     vi.mocked(formatCcrCommandWithOutput).mockReturnValue({
       command: 'ccr code --print "..." > output.txt 2> output-debug.txt',
       stdoutPath: 'output.txt',
       stderrPath: 'output-debug.txt',
     });
     ```
  </action>
  <verify>npm test (all tests pass)</verify>
  <done>All tests updated and passing; test coverage maintained</done>
</task>

</tasks>

<verification>
1. npm test - all tests pass
2. npm run build - bundle builds successfully
3. Manual check: formatCcrCommandWithOutput returns object with command, stdoutPath, stderrPath
</verification>

<success_criteria>
- CCR command uses `> stdout.txt 2> stderr.txt` (separate files, not `2>&1`)
- All workflow modules read from stdoutPath for agent output
- Error messages truncate clean output only (no debug log pollution)
- Both files preserved for artifact upload
- All existing tests pass with updated mocks
</success_criteria>

<output>
After completion, update .planning/STATE.md quick tasks table with:
| 010 | Split CCR output into clean agent output and debug logs | {date} | {commit} | [010-split-ccr-output-into-clean-agent-output](./quick/010-split-ccr-output-into-clean-agent-output/) |
</output>
