# Phase 8: Phase Execution Command - Research

**Researched:** 2026-01-22
**Domain:** GitHub Action command integration with GSD execute-plan workflow
**Confidence:** HIGH

## Summary

Phase 8 implements the `execute-phase` command that triggers GSD's built-in `/gsd:execute-plan` workflow via CCR stdin pipe. The implementation follows the established pattern from Phase 7 (phase-planner.js), adapting it for longer-running execution with enhanced output parsing and progress reporting.

**Key findings:**

- GSD handles all execution logic internally (wave-based parallelization, state tracking, commits)
- Bot responsibility: command dispatch, CCR invocation, output capture, structured comment posting
- Resume capability built into GSD via `.planning/` folder state tracking
- Execution is conversational: agent may pause with questions, requiring workflow restart

**Primary recommendation:** Create `src/milestone/phase-executor.js` following the phase-planner.js pattern with extended timeout (default: 30 minutes vs 10 minutes for planning) and enhanced output parsing to extract completed actions, next steps, and questions from GSD's structured output.

## Standard Stack

The established libraries/tools for GitHub Action + CCR integration:

### Core (Already Integrated)

| Library                 | Version  | Purpose                        | Why Standard                                      |
| ----------------------- | -------- | ------------------------------ | ------------------------------------------------- |
| @actions/core           | Latest   | GitHub Actions logging/outputs | Official GitHub Actions toolkit                   |
| @actions/github         | Latest   | GitHub API access via Octokit  | Official GitHub Actions toolkit                   |
| child_process (Node.js) | Built-in | Execute CCR via stdin pipe     | Node.js standard library for subprocess execution |
| fs/promises             | Built-in | File I/O for output capture    | Node.js standard async file operations            |

### Supporting

| Library        | Version  | Purpose                     | When to Use                         |
| -------------- | -------- | --------------------------- | ----------------------------------- |
| util.promisify | Built-in | Promisify exec callback API | Convert exec to async/await pattern |

### Alternatives Considered

| Instead of   | Could Use      | Tradeoff                                                                                                        |
| ------------ | -------------- | --------------------------------------------------------------------------------------------------------------- |
| exec         | spawn          | spawn provides streaming, but exec with --print flag captures complete output; exec is simpler for our use case |
| File polling | Process.stdout | CCR's --print flag writes to stdout, redirecting to file provides reliable capture after exit                   |

**Installation:**
No new packages required. All dependencies already integrated in Phase 7.

## Architecture Patterns

### Recommended Project Structure

```
src/milestone/
├── phase-planner.js     # Phase 7: Planning workflow
├── phase-executor.js    # Phase 8: Execution workflow (NEW)
└── index.js             # Milestone orchestrator
```

### Pattern 1: CCR Stdin Pipe Execution

**What:** Execute GSD commands via CCR using stdin pipe pattern with output redirection
**When to use:** All GSD command invocations from GitHub Action

**Example:**

```javascript
// Source: Phase 7 implementation (phase-planner.js)
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";

const execAsync = promisify(exec);

const outputPath = `output-${Date.now()}.txt`;
const command = `echo "/gsd:execute-plan ${phaseNumber}" | ccr code --print > ${outputPath}`;

let exitCode = 0;
try {
  await execAsync(command, { timeout: 1800000 }); // 30 min timeout for execution
} catch (error) {
  exitCode = error.code || 1;
  core.warning(`Command exited with code ${exitCode}`);
}

// Read captured output
const output = await fs.readFile(outputPath, "utf-8");
```

### Pattern 2: Phase Number Parsing

**What:** Extract phase number from command arguments supporting multiple formats
**When to use:** Command argument parsing for phase-specific commands

**Example:**

```javascript
// Source: Phase 7 implementation (phase-planner.js:31-55)
export function parsePhaseNumber(commandArgs) {
  if (!commandArgs) {
    throw new Error("Phase number is required");
  }

  // Try --phase flag
  const phaseFlagMatch = commandArgs.match(/--phase[=\s]+(\d+)/);
  if (phaseFlagMatch) return parseInt(phaseFlagMatch[1], 10);

  // Try -p flag
  const pFlagMatch = commandArgs.match(/-p[=\s]+(\d+)/);
  if (pFlagMatch) return parseInt(pFlagMatch[1], 10);

  // Try standalone number
  const standaloneMatch = commandArgs.match(/(\d+)$/);
  if (standaloneMatch) return parseInt(standaloneMatch[1], 10);

  throw new Error("Could not parse phase number from arguments.");
}
```

### Pattern 3: Output Validation for Errors

**What:** Pattern matching on output text and exit codes to detect execution failures
**When to use:** After GSD command completion, before posting to GitHub

**Example:**

```javascript
// Source: Phase 7 implementation (phase-planner.js:109-113)
const isError =
  exitCode !== 0 ||
  /Permission Denied|Authorization failed|not authorized/i.test(output) ||
  /Error:|Something went wrong|failed/i.test(output) ||
  /Unknown command|invalid arguments|validation failed/i.test(output);

if (isError) {
  const errorMsg = formatErrorComment(new Error(output.trim()), workflowUrl);
  await postComment(owner, repo, issueNumber, errorMsg);
  throw new Error(`Phase execution failed: ${output.substring(0, 500)}`);
}
```

### Pattern 4: Structured Output Parsing

**What:** Extract structured sections from GSD's markdown output for enhanced GitHub comments
**When to use:** Phase 8 execution output (more complex than Phase 7's pass-through approach)

**Example:**

```javascript
// NEW for Phase 8 - parse GSD output sections
function parseExecutionOutput(output) {
  const sections = {
    completedActions: [],
    nextSteps: [],
    questions: [],
    errors: [],
  };

  // Extract completed actions (tasks marked complete)
  const completedPattern = /(?:✓|✅|completed?:?)\s*(.+)/gi;
  let match;
  while ((match = completedPattern.exec(output)) !== null) {
    sections.completedActions.push(match[1].trim());
  }

  // Extract next steps section
  const nextStepsMatch = output.match(
    /(?:##?\s*)?next steps?:?\s*\n((?:[-*]\s*.+\n?)+)/i,
  );
  if (nextStepsMatch) {
    sections.nextSteps = nextStepsMatch[1]
      .split("\n")
      .filter(
        (line) => line.trim().startsWith("-") || line.trim().startsWith("*"),
      )
      .map((line) => line.replace(/^[-*]\s*/, "").trim());
  }

  // Extract questions (agent asking for input)
  const questionsPattern = /(?:##?\s*)?questions?:?\s*\n((?:[-*]\s*.+\n?)+)/i;
  const questionsMatch = output.match(questionsPattern);
  if (questionsMatch) {
    sections.questions = questionsMatch[1]
      .split("\n")
      .filter(
        (line) => line.trim().startsWith("-") || line.trim().startsWith("*"),
      )
      .map((line) => line.replace(/^[-*]\s*/, "").trim());
  }

  return sections;
}

function formatExecutionComment(parsedOutput, rawOutput) {
  let comment = `## Phase Execution Update\n\n`;

  if (parsedOutput.completedActions.length > 0) {
    comment += `### Completed\n\n`;
    parsedOutput.completedActions.forEach((action) => {
      comment += `- ✅ ${action}\n`;
    });
    comment += `\n`;
  }

  if (parsedOutput.nextSteps.length > 0) {
    comment += `### Next Steps\n\n`;
    parsedOutput.nextSteps.forEach((step) => {
      comment += `- ${step}\n`;
    });
    comment += `\n`;
  }

  if (parsedOutput.questions.length > 0) {
    comment += `### Questions\n\n`;
    parsedOutput.questions.forEach((question) => {
      comment += `- ❓ ${question}\n`;
    });
    comment += `\n**Please answer these questions by commenting on this issue. The workflow will resume when you reply.**\n\n`;
  }

  // Include raw output in collapsible section
  comment += `<details>\n<summary>Full Output</summary>\n\n${rawOutput}\n\n</details>`;

  return comment;
}
```

### Pattern 5: Command Dispatch Integration

**What:** Add command to validator allowlist and dispatch logic in src/index.js
**When to use:** Adding any new GSD command to GitHub Action

**Example:**

```javascript
// Source: Phase 7 implementation

// 1. Add to allowlist (src/lib/validator.js:7)
const ALLOWED_COMMANDS = ["new-milestone", "plan-phase", "execute-phase"];

// 2. Add dispatch block (src/index.js after line 110)
if (parsed.command === "execute-phase") {
  core.info("Dispatching to phase execution workflow");
  const result = await executePhaseExecutionWorkflow(
    {
      owner: repoOwner,
      repo: repoName,
      issueNumber: github.context.issue?.number,
    },
    sanitizedArgs,
  );
  core.setOutput("phase-executed", result.complete);
  core.setOutput("phase-number", result.phaseNumber);
  return { commandFound: true, command: parsed.command, ...result };
}
```

### Anti-Patterns to Avoid

- **Real-time progress editing:** Don't edit GitHub comments during execution; post summary at end (GitHub API rate limits, comment history pollution)
- **Manual parallelization:** Don't orchestrate parallel task execution in the bot; GSD handles wave-based parallelization internally
- **Custom retry logic:** Don't implement retry loops; GSD's resume capability handles this via state tracking in `.planning/`
- **Process polling:** Don't poll for process completion; use process exit event with timeout

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem            | Don't Build                                        | Use Instead                         | Why                                                                                                                                    |
| ------------------ | -------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Markdown parsing   | Custom regex parser for all markdown elements      | Simple regex for specific sections  | GSD output format is consistent and limited to sections we need; full markdown parser (marked.js) is overkill and adds 32KB+ to bundle |
| Stream processing  | Real-time log streaming with Transform streams     | File capture with `> output.txt`    | CCR's `--print` flag outputs complete result; streaming adds complexity without benefit for our batch workflow                         |
| Retry mechanism    | Custom retry loops with exponential backoff        | GSD's internal resume capability    | GSD tracks progress in `.planning/` folder; just re-invoke the same command and it resumes automatically                               |
| Task orchestration | Custom DAG executor for wave-based parallelization | GSD's internal executor             | GSD already implements wave-based parallelization reading PLAN.md dependencies; don't duplicate this logic                             |
| State persistence  | Custom JSON/YAML state tracking                    | GSD's `.planning/` folder structure | GSD maintains state in markdown files (PLAN.md, SUMMARY.md); read these for resume point detection                                     |

**Key insight:** The bot is a thin wrapper around GSD. GSD is the execution engine; the bot just invokes it and posts results. Resist the temptation to pull orchestration logic into the bot.

## Common Pitfalls

### Pitfall 1: Insufficient Timeout for Execution

**What goes wrong:** Phase execution can take 30+ minutes for complex phases with many tasks. Default 10-minute timeout (used for planning) will kill the process mid-execution.
**Why it happens:** Copying timeout from phase-planner.js without adjusting for execution duration
**How to avoid:** Set execution timeout to 30 minutes (1800000ms) minimum; consider 60 minutes for complex phases
**Warning signs:**

- `ETIMEDOUT` errors in workflow logs
- Process killed before completion
- Incomplete task execution with no error message

### Pitfall 2: Treating Output as Plain Text

**What goes wrong:** GSD outputs structured markdown with sections. Posting raw output to GitHub loses structure and is hard to parse for status.
**Why it happens:** Following phase-planner.js pattern which passes through raw output (acceptable for planning, insufficient for execution)
**How to avoid:** Parse output to extract completed actions, next steps, questions; format structured comment
**Warning signs:**

- Users complain about hard-to-read comments
- Can't determine what was completed without reading full output
- Questions from agent are buried in long output

### Pitfall 3: Not Handling Conversational Pauses

**What goes wrong:** Agent pauses execution to ask questions; bot treats this as completion and doesn't indicate user action needed.
**Why it happens:** Assuming execution is always autonomous; not detecting question markers in output
**How to avoid:** Parse output for question patterns (`## Questions`, `❓`, `Please answer`); add prominent "action required" message to comment
**Warning signs:**

- Workflow appears complete but phase isn't finished
- Agent waiting for input but user doesn't know
- Execution resumes without context when user comments unrelated message

### Pitfall 4: Exit Code Zero with Error Content

**What goes wrong:** Some errors (permission issues, validation failures) may exit with code 0 but include error messages in output. Relying only on exit code misses these failures.
**Why it happens:** Assuming process exit code always indicates success/failure
**How to avoid:** Check both exit code AND error patterns in output text (Pattern 3)
**Warning signs:**

- "Successful" executions that actually failed
- Users report errors that weren't caught
- Error messages in output but posted as success

### Pitfall 5: No Resume Point Detection

**What goes wrong:** User retries failed execution; bot re-runs from beginning instead of resuming.
**Why it happens:** Not understanding that GSD handles resume internally via state files
**How to avoid:** Just invoke the same command again; GSD reads `.planning/` folder and resumes from last incomplete task. No special resume logic needed in the bot.
**Warning signs:**

- Tasks re-executed on retry
- "Already completed" messages from GSD
- Duplicate commits for same task

## Code Examples

Verified patterns from established codebase:

### Command Argument Sanitization

```javascript
// Source: src/lib/validator.js:37-61
export function sanitizeArguments(args) {
  const sanitized = {};

  Object.keys(args).forEach((key) => {
    let value = args[key];

    // Check for empty values
    if (!value || value.length === 0) {
      throw new Error(`Argument ${key} cannot be empty`);
    }

    // Check for reasonable length limits (500 chars)
    if (value.length > 500) {
      throw new Error(`Argument ${key} exceeds maximum length (500 chars)`);
    }

    // Remove shell metacharacters to prevent command injection
    // Source: OWASP Input Validation Cheat Sheet
    value = value.replace(/[;&|`$()]/g, "");

    sanitized[key] = value.trim();
  });

  return sanitized;
}
```

### Error Comment Formatting

```javascript
// Source: src/errors/formatter.js:9-37
export function formatErrorComment(error, workflowUrl) {
  const errorSummary = error.message || "Unknown error";
  const stackTrace = error.stack || "No stack trace available";

  return `
## Error: ${errorSummary}

Something went wrong during command execution.

**Workflow Run:** [View Logs](${workflowUrl})

### Next Steps

1. Check the workflow run logs for detailed error information
2. Review the command syntax and arguments
3. Ensure all required permissions are configured
4. Verify GitHub token has appropriate scopes
5. If the issue persists, please report the error with the workflow run ID

<details>
<summary><strong>Stack Trace</strong></summary>

\`\`\`
${stackTrace}
\`\`\`

</details>
`;
}
```

### File Cleanup After Capture

```javascript
// Source: src/milestone/phase-planner.js:125-129
// Cleanup output file
try {
  await fs.unlink(outputPath);
} catch (e) {
  core.warning(`Failed to cleanup output file: ${e.message}`);
}
```

## State of the Art

| Old Approach                          | Current Approach                              | When Changed                  | Impact                                                                  |
| ------------------------------------- | --------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------- |
| Real-time comment editing             | Summary comment at end                        | Phase 8 decision (2026-01-22) | Simpler implementation, avoids API rate limits, cleaner comment history |
| User-triggered resume                 | Auto-resume on retry                          | Phase 8 decision (2026-01-22) | Seamless retry experience; GSD handles state tracking                   |
| Parallel workflow jobs                | Single workflow with internal parallelization | Phase 8 decision (2026-01-22) | GSD handles wave-based parallelization; bot just invokes GSD once       |
| Work tree creation at milestone start | Deferred to future phase                      | Phase 8 deferral              | Keeps Phase 8 scope focused on execution command wiring                 |

**Deprecated/outdated:**

- N/A - This is the initial implementation of execute-phase command

## Open Questions

Things that couldn't be fully resolved:

1. **Exact GSD Output Format for execute-plan**
   - What we know: GSD outputs markdown with sections (completed actions, next steps, questions)
   - What's unclear: Precise format and markers used by GSD's execute-plan output
   - Recommendation: Test with actual GSD execute-plan command to capture output format; adjust parsing regex based on real output. Start with conservative patterns (Pattern 4) and iterate.

2. **Optimal Timeout Values**
   - What we know: Planning takes ~10 minutes; execution is longer; Phase 7 uses 600000ms (10 min)
   - What's unclear: What's a reasonable default for execution? How much variation between phases?
   - Recommendation: Start with 1800000ms (30 min) default; monitor actual execution times in production; consider making timeout configurable in CONTEXT.md per phase

3. **Handling Multiple Conversational Turns**
   - What we know: Execution is conversational; agent may pause multiple times
   - What's unclear: How to track conversation history across workflow runs
   - Recommendation: Keep conversation in GitHub issue comments; each workflow run reads full comment thread (already available in webhook payload); GSD maintains internal state

4. **Issue Status Update Mechanism (EXEC-03)**
   - What we know: Requirement states agent updates issue status as tasks complete
   - What's unclear: Where is this status stored? GitHub issue labels? Custom fields? Project boards?
   - Recommendation: Defer to Phase 9 (Issue Tracking Integration) which handles ISSUE-01 and ISSUE-02. For Phase 8, focus on posting progress comments; formal status tracking comes later.

## Sources

### Primary (HIGH confidence)

- Phase 7 implementation: src/milestone/phase-planner.js - Established CCR execution pattern
- Phase 7 context: .planning/phases/07-phase-planning-command/07-CONTEXT.md - Exit detection, error validation patterns
- Phase 7 research: .planning/phases/07-phase-planning-command/07-RESEARCH-GSD.md - GSD lifecycle steps, output markers
- Phase 8 context: .planning/phases/08-phase-execution-command/08-CONTEXT.md - User decisions on progress reporting, resume, parallelization
- Existing codebase patterns: src/index.js, src/lib/validator.js, src/errors/formatter.js - Established architecture patterns

### Secondary (MEDIUM confidence)

- [GSD Claude Code Plugin](https://github.com/onewithdev/gsd) - Meta-prompting system for Claude Code
- [GSD Execute-Plan Command](https://medium.com/@joe.njenga/i-tested-gsd-claude-code-meta-prompting-that-ships-faster-no-agile-bs-ca62aff18c04) - GSD workflow sequence: create-roadmap → plan-phase → execute-plan
- [Claude Code Plugin Hub](https://www.claudepluginhub.com/commands/glittercowboy-get-shit-done/commands/gsd/help) - GSD command documentation
- [Node.js child_process Documentation](https://nodejs.org/api/child_process.html) - Official Node.js child_process API including timeout handling
- [Node.js Streams Best Practices 2026](https://betterstack.com/community/guides/scaling-nodejs/nodejs-streams/) - Stream processing patterns (decided against for this use case)

### Tertiary (LOW confidence - not used in recommendations)

- [GitHub Actions Retry Patterns](https://github.com/marketplace/actions/retry-action) - Third-party retry actions (not needed; GSD handles resume)
- [Markdown Parsing Libraries](https://marked.js.org/) - Full markdown parsers (overkill for our limited parsing needs)
- [Real-time Log Streaming](https://dev.to/manojspace/real-time-log-streaming-with-nodejs-and-react-using-server-sent-events-sse-48pk) - Streaming approaches (not applicable to our batch workflow)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All dependencies already integrated in Phase 7; no new packages needed
- Architecture: HIGH - Following established phase-planner.js pattern; patterns verified in production codebase
- Pitfalls: MEDIUM - Based on common child_process and timeout issues; GSD-specific pitfalls are theoretical until tested
- Output parsing: LOW - GSD execute-plan output format not directly verified; Pattern 4 parsing based on GSD documentation and markdown conventions

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (30 days - stable domain, established patterns, minimal external dependencies)

---

**Research complete. Ready for planning Phase 8 implementation.**
