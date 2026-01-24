---
phase: quick
plan: 011
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/output-cleaner.js
  - src/milestone/label-trigger.js
  - src/milestone/phase-planner.js
  - src/milestone/reply.js
  - src/milestone/phase-executor.js
  - src/milestone/milestone-completer.js
autonomous: true
---

<objective>
Strip CCR debug logs from output in all workflow modules.

Purpose: CCR writes debug logs like `[log_65f110]` to STDOUT (not STDERR), polluting agent output. Error messages show truncated JSON instead of useful information. The `stripCcrLogs()` function exists in phase-executor.js and milestone-completer.js but is not used in label-trigger.js, phase-planner.js, or reply.js.

Output: Shared `stripCcrLogs()` utility used consistently across all workflow modules.
</objective>

<context>
@src/milestone/phase-executor.js (lines 198-216 have stripCcrLogs)
@src/milestone/milestone-completer.js (lines 23-39 have duplicate)
@src/milestone/label-trigger.js (no stripping, line 87 throws with raw output)
@src/milestone/phase-planner.js (no stripping, line 178 posts raw output)
@src/milestone/reply.js (no stripping, line 94 posts raw output)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract stripCcrLogs to shared utility</name>
  <files>src/lib/output-cleaner.js</files>
  <action>
Create new file src/lib/output-cleaner.js with the stripCcrLogs function extracted from phase-executor.js (lines 198-216). Export it as a named export.

The function filters these CCR debug log patterns:
- Lines starting with `[log_xxx]`
- Lines starting with `response NNN http:`
- Lines containing `ReadableStream {`
- Lines containing `durationMs:`
- Lines containing `AbortController|AbortSignal|AsyncGeneratorFunction`
- JS object notation (key: value patterns)
- Closing braces/brackets

Keep the same implementation - it's already working correctly.
  </action>
  <verify>File exists at src/lib/output-cleaner.js with exported stripCcrLogs function</verify>
  <done>Shared utility created with stripCcrLogs function</done>
</task>

<task type="auto">
  <name>Task 2: Update all workflow modules to use shared utility</name>
  <files>
    src/milestone/label-trigger.js
    src/milestone/phase-planner.js
    src/milestone/reply.js
    src/milestone/phase-executor.js
    src/milestone/milestone-completer.js
  </files>
  <action>
1. **label-trigger.js**:
   - Import `stripCcrLogs` from `../lib/output-cleaner.js`
   - At line 87, change `throw new Error(\`Label trigger failed: ${output.substring(0, 500)}\`)` to strip logs first: `throw new Error(\`Label trigger failed: ${stripCcrLogs(output).substring(0, 500)}\`)`

2. **phase-planner.js**:
   - Import `stripCcrLogs` from `../lib/output-cleaner.js`
   - At line 174, change error message to use stripped output
   - At line 178, strip output before posting: `await postComment(owner, repo, issueNumber, stripCcrLogs(output))`

3. **reply.js**:
   - Import `stripCcrLogs` from `../lib/output-cleaner.js`
   - At line 90, change error message to use stripped output
   - At line 94, strip output before posting: `await postComment(owner, repo, issueNumber, stripCcrLogs(output))`

4. **phase-executor.js**:
   - Import `stripCcrLogs` from `../lib/output-cleaner.js`
   - Remove local stripCcrLogs function (lines 198-216)
   - Keep extractGsdBlock and formatExecutionComment as-is (they call stripCcrLogs)

5. **milestone-completer.js**:
   - Import `stripCcrLogs` from `../lib/output-cleaner.js`
   - Remove local stripCcrLogs function (lines 23-39)
   - Keep extractGsdBlock as-is (it uses the cleaned output)
  </action>
  <verify>
    npm run build
    grep -r "stripCcrLogs" src/milestone/ | grep "import" | wc -l  # Should show 5 imports
    grep -r "function stripCcrLogs" src/milestone/ | wc -l  # Should show 0 (no local copies)
  </verify>
  <done>All 5 workflow modules import and use shared stripCcrLogs utility; no duplicate implementations remain</done>
</task>

</tasks>

<verification>
1. `npm run build` succeeds
2. No duplicate stripCcrLogs implementations in src/milestone/
3. All workflow modules import from src/lib/output-cleaner.js
</verification>

<success_criteria>
- Single stripCcrLogs implementation in src/lib/output-cleaner.js
- All 5 workflow modules (label-trigger, phase-planner, reply, phase-executor, milestone-completer) use the shared utility
- Error messages and posted comments no longer contain CCR debug logs
- Build passes
</success_criteria>
