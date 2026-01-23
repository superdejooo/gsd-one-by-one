---
phase: quick-008
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/validator.js
  - src/milestone/reply.js
  - src/milestone/reply.test.js
  - src/index.js
autonomous: true

must_haves:
  truths:
    - "User can invoke reply command via @gsd-bot reply <text>"
    - "Reply command executes GSD via CCR with text parameter as prompt"
    - "Reply command supports skill parameter like other commands"
  artifacts:
    - path: "src/milestone/reply.js"
      provides: "Reply workflow orchestrator"
      exports: ["executeReplyWorkflow"]
    - path: "src/lib/validator.js"
      provides: "Command allowlist with reply"
      contains: "reply"
  key_links:
    - from: "src/index.js"
      to: "src/milestone/reply.js"
      via: "command dispatch"
      pattern: 'parsed.command === "reply"'
---

<objective>
Add a new `/gsd:reply` command that passes user-provided text directly to GSD as a prompt.

Purpose: Enable users to send free-form text to GSD for conversational interactions, questions, or follow-up requests that don't fit predefined commands.

Output: Working `@gsd-bot reply <text>` command that executes via CCR and posts output to GitHub.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/index.js
@src/lib/validator.js
@src/milestone/phase-planner.js (reference pattern)
@src/llm/ccr-command.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add reply to command allowlist</name>
  <files>src/lib/validator.js</files>
  <action>
Add "reply" to the ALLOWED_COMMANDS array (after "complete-milestone").

Also add "reply" to the SKILL_COMMAND_MAP for skills that make sense:
- github-actions-testing: null (already allows all commands)
- github-project-management: add "reply" to its array
- github-actions-templates: add "reply" to its array
- livewire-principles: add "reply" to its array
- refactor: add "reply" to its array

This follows the existing pattern where most skills are available for commands that involve interacting with GSD.
  </action>
  <verify>
Run: `grep -n "reply" src/lib/validator.js`
Confirm "reply" appears in ALLOWED_COMMANDS and SKILL_COMMAND_MAP entries.
  </verify>
  <done>
"reply" is a valid command that passes validateCommand() and supports skill parameters.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create reply workflow orchestrator with tests</name>
  <files>src/milestone/reply.js, src/milestone/reply.test.js</files>
  <action>
Create src/milestone/reply.js following the phase-planner.js pattern:

1. Export `executeReplyWorkflow(context, commandArgs, skill = null)`:
   - context: { owner, repo, issueNumber }
   - commandArgs: the text after "reply" (the user's message)
   - skill: optional skill parameter

2. Implementation:
   - Validate commandArgs is not empty (text is required)
   - Format CCR command: `/gsd:reply` doesn't exist in GSD, so use a generic prompt pattern
   - Actually, simpler approach: just pass the text as a prompt to CCR directly
   - Use formatCcrCommandWithOutput with just the prompt (no /gsd:* command)
   - Pattern: `ccr code --print "/{skill} /github-actions-testing {text}"`
   - Execute via execAsync with 10 minute timeout (same as plan-phase)
   - Read output file
   - Check for errors
   - Post output to GitHub issue
   - Cleanup output file
   - Return { complete: true, message: "Reply sent successfully" }

3. Create src/milestone/reply.test.js with tests:
   - Test executeReplyWorkflow calls CCR with text as prompt
   - Test empty text throws error "Reply text is required"
   - Test skill parameter is passed through
   - Test error handling on CCR failure
   - Mock: child_process.exec, fs.readFile, fs.unlink, postComment

Note: The CCR command should be `/github-actions-testing {text}` - we're not invoking a GSD command, just sending text to Claude with the testing skill loaded.
  </action>
  <verify>
Run: `npm test -- src/milestone/reply.test.js`
All tests pass.
  </verify>
  <done>
reply.js executes text via CCR and posts response to GitHub issue.
Tests verify happy path, empty text error, skill support, and error handling.
  </done>
</task>

<task type="auto">
  <name>Task 3: Integrate reply command into entry point</name>
  <files>src/index.js</files>
  <action>
1. Add import at top with other milestone imports:
   `import { executeReplyWorkflow } from "./milestone/reply.js";`

2. Add bundling trigger (for @vercel/ncc):
   `const _replyModule = { executeReplyWorkflow };`
   And add `!!_replyModule` to the console.log statement.

3. Add command dispatch block after the "complete-milestone" block:
```javascript
// Command dispatch for reply workflow
if (parsed.command === "reply") {
  core.info("Dispatching to reply workflow");
  const result = await executeReplyWorkflow(
    {
      owner: repoOwner,
      repo: repoName,
      issueNumber: github.context.issue?.number,
    },
    parsed.args || "",
    skill,
  );
  core.setOutput("reply-sent", result.complete);
  return { commandFound: true, command: parsed.command, ...result };
}
```
  </action>
  <verify>
Run: `npm run build` (should complete without errors)
Run: `npm test` (all tests pass, including any index.test.js updates needed)
  </verify>
  <done>
@gsd-bot reply <text> is routed to executeReplyWorkflow.
Build succeeds with new module bundled.
  </done>
</task>

</tasks>

<verification>
1. `npm test` - All tests pass
2. `npm run build` - Build succeeds
3. `grep -n "reply" src/lib/validator.js` - Shows in ALLOWED_COMMANDS
4. `grep -n "executeReplyWorkflow" src/index.js` - Shows import and dispatch
</verification>

<success_criteria>
- "reply" command is in ALLOWED_COMMANDS
- reply.js exports executeReplyWorkflow
- reply.test.js has 4+ tests all passing
- src/index.js dispatches to reply workflow
- npm run build succeeds
- npm test passes with no regressions
</success_criteria>

<output>
After completion, create `.planning/quick/008-add-new-gsd-reply-command-with-text-para/008-SUMMARY.md`
</output>
