---
phase: quick-003
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/parser.js
  - src/lib/parser.test.js
  - src/lib/validator.js
  - src/lib/validator.test.js
  - src/milestone/index.js
  - src/milestone/index.test.js
  - src/index.js
autonomous: true

must_haves:
  truths:
    - "new-milestone command requires mandatory description parameter"
    - "Description can be very large text (up to 50000 chars)"
    - "Missing description returns clear error message"
  artifacts:
    - path: "src/lib/parser.js"
      provides: "Updated parsing to capture full description text"
    - path: "src/lib/validator.js"
      provides: "Updated sanitization with higher char limit for description"
    - path: "src/milestone/index.js"
      provides: "Updated workflow to use description parameter"
  key_links:
    - from: "src/index.js"
      to: "src/milestone/index.js"
      via: "passes raw args (description) to executeMilestoneWorkflow"
---

<objective>
Make `@gsd-bot new-milestone` require a mandatory description parameter.

Purpose: The new-milestone command should accept a large text block describing the entire milestone instead of using the multi-turn Q&A requirements gathering approach. 90% of the time users will provide a complete milestone description in the command itself.

Output: Updated parser, validator, and milestone workflow that require and use the description parameter.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/lib/parser.js
@src/lib/validator.js
@src/milestone/index.js
@src/index.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update parser to capture full description text</name>
  <files>
    src/lib/parser.js
    src/lib/parser.test.js
  </files>
  <action>
Update `parseComment()` in parser.js to capture everything after the command as the description:

1. The current regex captures args as `(?:\\s+(.*))?$` - this already captures everything after the command
2. The description will be the entire `args` string returned by parseComment
3. No changes needed to parseComment - it already returns the full text after the command

Add a new function `parseDescriptionArg(argsString)`:
- Takes the raw args string from parseComment
- Returns the description text (the entire string after command)
- If empty/whitespace only, returns null

Add tests for:
- `@gsd-bot new-milestone This is my milestone description` -> description = "This is my milestone description"
- `@gsd-bot new-milestone` with multiline text -> captures all lines
- Very long descriptions (5000+ chars) -> captures complete text
- Empty description -> returns null
  </action>
  <verify>Run `npm test -- src/lib/parser.test.js` - all tests pass</verify>
  <done>parseComment returns full description text in args field, new helper validates non-empty description</done>
</task>

<task type="auto">
  <name>Task 2: Update validator to allow large descriptions</name>
  <files>
    src/lib/validator.js
    src/lib/validator.test.js
  </files>
  <action>
Update `sanitizeArguments()` in validator.js:

1. Add a special case for `description` argument key:
   - Allow up to 50000 characters (GitHub comment max is ~65535)
   - Still sanitize shell metacharacters [;&|`$()]

2. Keep existing 500 char limit for other arguments

3. Update tests:
   - Test description with 500 chars passes (existing limit doesn't apply)
   - Test description with 10000 chars passes
   - Test description with 50001 chars throws error
   - Test description still has shell metacharacters removed
  </action>
  <verify>Run `npm test -- src/lib/validator.test.js` - all tests pass</verify>
  <done>sanitizeArguments allows up to 50000 chars for description key while maintaining 500 char limit for other args</done>
</task>

<task type="auto">
  <name>Task 3: Update milestone workflow to require description</name>
  <files>
    src/milestone/index.js
    src/milestone/index.test.js
    src/index.js
  </files>
  <action>
Update `executeMilestoneWorkflow()` in milestone/index.js:

1. Add new function `parseMilestoneDescription(commandArgs)`:
   - Extract description from args (everything that's not --milestone flag)
   - If description is empty/missing, throw Error("Milestone description is required. Provide a description of your milestone goals and features.")
   - Return the cleaned description string

2. Update executeMilestoneWorkflow to:
   - Call parseMilestoneDescription to get required description
   - Skip the requirements gathering Q&A loop entirely
   - Use the description directly to populate requirements:
     - state.requirements.answered.scope = description
     - state.requirements.answered.features = description
   - Mark requirements as complete immediately
   - Proceed directly to planning docs creation

3. Update src/index.js:
   - In the new-milestone dispatch, pass sanitizedArgs.description || parsed.args to executeMilestoneWorkflow
   - The raw args string contains the description

4. Update tests:
   - Test description extraction: "@gsd-bot new-milestone Build auth system with login and signup"
   - Test error when no description: "@gsd-bot new-milestone" -> throws
   - Test that workflow skips Q&A and goes straight to planning docs
   - Test that description populates requirements.answered.scope
  </action>
  <verify>Run `npm test -- src/milestone/index.test.js src/index.test.js` - all tests pass, then run full `npm test`</verify>
  <done>new-milestone command requires description, skips Q&A, uses description for planning docs</done>
</task>

</tasks>

<verification>
- `npm test` passes all tests
- `npm run build` produces updated bundle
- Manual verification: The command `@gsd-bot new-milestone This is a full description of my milestone...` should work
- The command `@gsd-bot new-milestone` without description should return clear error
</verification>

<success_criteria>
- new-milestone command requires mandatory description parameter
- Descriptions up to 50000 characters are accepted
- Missing description returns actionable error message
- Multi-turn Q&A requirements gathering is bypassed when description provided
- All existing tests pass, new tests added for description handling
</success_criteria>

<output>
After completion, create `.planning/quick/003-napravi-da-nasa-komanda-gsd-bot-new-mile/003-SUMMARY.md`
</output>
