# Phase 9: Issue Tracking Integration - Research

**Researched:** 2026-01-22
**Domain:** GitHub Issues REST API, Octokit.js, issue tracking automation
**Confidence:** HIGH

## Summary

Phase 9 integrates GitHub Issues with the GSD planning system by creating issues for each action in PLAN.md files and enabling bidirectional status sync. The standard approach uses Octokit's REST API (`octokit.rest.issues.create`) with markdown-formatted bodies containing task lists. Issue status is managed through labels (status:pending, status:in-progress, status:complete) that drive GitHub Project automations.

The integration point is the phase-planner.js workflow, which should parse PLAN.md files after GSD generates them, extract task blocks, create corresponding issues, and return issue metadata for tracking. The phase-executor.js workflow should update issue status as execution progresses.

**Primary recommendation:** Use sequential issue creation (not batch) with existing labels.js infrastructure, parse PLAN.md XML-style task blocks with regex, and implement issue creation in phase-planner.js as a post-planning step.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library                    | Version          | Purpose                            | Why Standard                                                   |
| -------------------------- | ---------------- | ---------------------------------- | -------------------------------------------------------------- |
| @actions/github            | ^6.0.0           | Octokit wrapper for GitHub Actions | Pre-configured authentication, official GitHub Actions SDK     |
| @octokit/plugin-throttling | ^9.3.0           | Rate limit handling                | Already integrated, automatic retry logic, prevents API errors |
| fs/promises                | Node.js built-in | File system operations             | Read PLAN.md files from .planning/ directory                   |

### Supporting

| Library           | Version | Purpose                 | When to Use                                                       |
| ----------------- | ------- | ----------------------- | ----------------------------------------------------------------- |
| src/lib/labels.js | Current | Label management        | Already exists with STATUS_LABELS, applyLabels, updateIssueStatus |
| src/lib/github.js | Current | Shared octokit instance | Use for all API calls to ensure throttling                        |

### Alternatives Considered

| Instead of          | Could Use             | Tradeoff                                                                                           |
| ------------------- | --------------------- | -------------------------------------------------------------------------------------------------- |
| Sequential creation | Bulk batch operations | Batch: higher throughput but complex error recovery, sequential: simpler, safer within rate limits |
| Regex parsing       | Full XML parser       | XML parser: robust but heavy dependency, regex: sufficient for GSD's consistent format             |
| Labels for status   | GitHub issue states   | States: only open/closed, labels: support pending/in-progress/complete/blocked                     |

**Installation:**
No new dependencies needed - all infrastructure exists.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── issues.js           # New: Issue creation and parsing
│   ├── labels.js           # Existing: Label operations
│   └── github.js           # Existing: Shared octokit
├── milestone/
│   ├── phase-planner.js    # Modify: Add issue creation after planning
│   └── phase-executor.js   # Modify: Add status updates during execution
```

### Pattern 1: Parse PLAN.md for Tasks

**What:** Extract task blocks from GSD-generated PLAN.md files
**When to use:** After GSD plan-phase completes, before posting result comment
**Example:**

```javascript
// Source: GSD PLAN.md structure (observed in 05-01-PLAN.md, 07-01-PLAN.md)
function extractTasksFromPlan(planContent) {
  const tasks = [];
  // Match <task type="auto"> blocks with name, files, action, verify, done
  const taskPattern =
    /<task type="(auto|manual)">\s*<name>(.*?)<\/name>\s*<files>(.*?)<\/files>\s*<action>(.*?)<\/action>\s*<verify>(.*?)<\/verify>\s*<done>(.*?)<\/done>\s*<\/task>/gs;

  let match;
  while ((match = taskPattern.exec(planContent)) !== null) {
    tasks.push({
      type: match[1], // auto or manual
      name: match[2].trim(), // Task title
      files: match[3].trim(), // Files modified
      action: match[4].trim(), // Action description
      verify: match[5].trim(), // Verification command
      done: match[6].trim(), // Completion criteria
    });
  }

  return tasks;
}
```

### Pattern 2: Issue Body Formatting

**What:** Create markdown body with task details and verification criteria
**When to use:** When creating issues from extracted tasks
**Example:**

```javascript
// Source: GitHub markdown best practices
function formatIssueBody(task, phaseNumber, phaseName) {
  return `## Task Details

**Phase:** ${phaseNumber} - ${phaseName}
**Files:** ${task.files}
**Type:** ${task.type}

## Action

${task.action}

## Verification

\`\`\`bash
${task.verify}
\`\`\`

## Done Criteria

${task.done}

---
*Created by GSD Phase Planner*`;
}
```

### Pattern 3: Sequential Issue Creation

**What:** Create issues one-by-one with error handling per issue
**When to use:** When creating multiple issues from a plan
**Example:**

```javascript
// Source: Octokit best practices
async function createIssuesForTasks(
  owner,
  repo,
  tasks,
  phaseNumber,
  phaseName,
) {
  const createdIssues = [];

  for (const task of tasks) {
    try {
      const issue = await octokit.rest.issues.create({
        owner,
        repo,
        title: `${String(phaseNumber).padStart(2, "0")}: ${task.name}`,
        body: formatIssueBody(task, phaseNumber, phaseName),
        labels: ["status:pending", `phase-${phaseNumber}`],
      });

      core.info(`Created issue #${issue.data.number}: ${task.name}`);
      createdIssues.push({
        number: issue.data.number,
        url: issue.data.html_url,
        taskName: task.name,
      });
    } catch (error) {
      core.warning(
        `Failed to create issue for "${task.name}": ${error.message}`,
      );
      // Continue creating other issues
    }
  }

  return createdIssues;
}
```

### Pattern 4: Issue Status Updates During Execution

**What:** Update issue labels as executor completes tasks
**When to use:** During phase-executor.js execution, after each task completion
**Example:**

```javascript
// Source: Existing labels.js module
import { updateIssueStatus } from "../lib/labels.js";

async function updateTaskProgress(owner, repo, issueNumber, status) {
  // status: 'pending' | 'in-progress' | 'complete' | 'blocked'
  await updateIssueStatus(owner, repo, issueNumber, status);
  core.info(`Updated issue #${issueNumber} to ${status}`);
}
```

### Pattern 5: Find Issues by Phase

**What:** Query issues by phase label to get tracking metadata
**When to use:** When executor needs to find issues for current phase
**Example:**

```javascript
// Source: Octokit REST API
async function getPhaseIssues(owner, repo, phaseNumber) {
  const { data: issues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    labels: `phase-${phaseNumber}`,
    state: "all",
    per_page: 100,
  });

  return issues.map((issue) => ({
    number: issue.number,
    title: issue.title,
    status:
      issue.labels.find((l) => l.name.startsWith("status:"))?.name || "unknown",
    url: issue.html_url,
  }));
}
```

### Anti-Patterns to Avoid

- **Creating issues before planning completes:** Planning may fail, leaving orphan issues
- **Using issue state (open/closed) for status:** Need 4 states (pending/in-progress/complete/blocked), not 2
- **Batch API calls without error recovery:** One failure shouldn't block all issues
- **Parsing PLAN.md without validation:** Malformed plans should fail gracefully

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                | Don't Build           | Use Instead                                                           | Why                                                                      |
| ---------------------- | --------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Label management       | Custom label CRUD     | src/lib/labels.js (ensureLabelsExist, applyLabels, updateIssueStatus) | Already handles race conditions, atomic replacement, validation          |
| Rate limiting          | Manual retry logic    | @octokit/plugin-throttling (already configured)                       | Built-in exponential backoff, respects GitHub headers                    |
| Markdown parsing       | Full XML/HTML parser  | Regex for GSD's consistent format                                     | GSD always uses same XML-style tags, regex is sufficient and lightweight |
| Authentication         | Custom token handling | src/lib/github.js shared octokit                                      | Pre-configured with Actions token, throttling enabled                    |
| Issue title formatting | String concatenation  | Template literals with padStart                                       | Consistent "01: Task Name" format matching folder names                  |

**Key insight:** The project already has robust GitHub API infrastructure (labels.js, github.js) and GSD's PLAN.md format is consistent enough for regex parsing. Don't over-engineer.

## Common Pitfalls

### Pitfall 1: Rate Limit Exhaustion

**What goes wrong:** Creating 20+ issues rapidly hits GitHub's content creation limit (80 requests/min)
**Why it happens:** Sequential API calls without throttling awareness
**How to avoid:**

- Use existing @octokit/plugin-throttling (already configured)
- Sequential creation is fine - throttling plugin handles waits
- Don't batch unless >50 issues (unlikely for GSD phases)
  **Warning signs:** 403 responses with retry-after headers, "rate limit exceeded" errors

### Pitfall 2: Issue Body Size Limit

**What goes wrong:** Task action descriptions >65,536 characters cause creation failure
**Why it happens:** Copying large code blocks into action field
**How to avoid:**

- Validate body length before API call: `body.length < 65000`
- Truncate action descriptions with "...see PLAN.md" fallback
- Store full details in PLAN.md, issue has summary
  **Warning signs:** "body is too long (maximum is 65536 characters)" API error

### Pitfall 3: Issue Title Length Limit

**What goes wrong:** Long task names cause "title too long" errors (256 char max)
**Why it happens:** Copying full task name without truncation
**How to avoid:**

- Truncate at 240 chars: `title.substring(0, 240) + '...'`
- Format: "01: Task Name..." to preserve phase prefix
  **Warning signs:** Issue creation fails with title validation error

### Pitfall 4: Parsing PLAN.md Before File Exists

**What goes wrong:** Reading PLAN.md file fails because GSD hasn't written it yet
**Why it happens:** Trying to create issues in same exec call as GSD planning
**How to avoid:**

- Wait for GSD command to complete (await execAsync)
- Verify PLAN.md file exists: `await fs.access(planPath)`
- Parse only after successful exit code
  **Warning signs:** File not found errors, empty task arrays

### Pitfall 5: Label Race Conditions

**What goes wrong:** Multiple workflows try to create status labels simultaneously
**Why it happens:** Parallel plan-phase commands
**How to avoid:**

- Use labels.js ensureLabelsExist (already handles 422 errors)
- Call once per workflow run, not per issue
- Don't create custom labels per issue
  **Warning signs:** 422 "Label already exists" errors, inconsistent label colors

### Pitfall 6: Issue Mapping Loss

**What goes wrong:** Executor can't find which issue corresponds to which task
**Why it happens:** No persistent mapping between task names and issue numbers
**How to avoid:**

- Include task name in issue title for text matching
- Add phase label for filtering: `phase-${phaseNumber}`
- Store mapping in comment or STATE.md if needed
  **Warning signs:** Executor updates wrong issues, duplicate status updates

## Code Examples

Verified patterns from official sources:

### Creating an Issue with Octokit

```javascript
// Source: https://docs.github.com/en/rest/issues
import { octokit } from "./github.js";

const issue = await octokit.rest.issues.create({
  owner: "owner",
  repo: "repo",
  title: "01: New Milestone Workflow",
  body: "Task description with markdown...",
  labels: ["status:pending", "phase-1"],
});

console.log(`Created issue #${issue.data.number}`);
console.log(`URL: ${issue.data.html_url}`);
```

### Reading PLAN.md File

```javascript
// Source: Node.js fs/promises
import fs from "fs/promises";
import path from "path";

async function readPlanFile(phaseNumber) {
  const paddedPhase = String(phaseNumber).padStart(2, "0");

  // Find phase directory (handles both 01-name and 1-name patterns)
  const phasesDir = ".planning/phases";
  const dirs = await fs.readdir(phasesDir);
  const phaseDir = dirs.find(
    (d) => d.startsWith(`${paddedPhase}-`) || d.startsWith(`${phaseNumber}-`),
  );

  if (!phaseDir) {
    throw new Error(`Phase directory not found for phase ${phaseNumber}`);
  }

  // Find PLAN.md file (may be 01-01-PLAN.md, 01-02-PLAN.md, etc.)
  const planFiles = await fs.readdir(path.join(phasesDir, phaseDir));
  const planFile = planFiles.find((f) => f.endsWith("-PLAN.md"));

  if (!planFile) {
    throw new Error(`No PLAN.md found in ${phaseDir}`);
  }

  const planPath = path.join(phasesDir, phaseDir, planFile);
  const content = await fs.readFile(planPath, "utf-8");

  return { content, path: planPath, filename: planFile };
}
```

### Extracting Phase Name from Directory

```javascript
// Source: Project structure observation
function extractPhaseName(phaseDir) {
  // "01-foundation" -> "Foundation"
  // "05-milestone-creation-workflow" -> "Milestone Creation Workflow"
  const parts = phaseDir.split("-");
  parts.shift(); // Remove number prefix
  return parts
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
```

### Task List Markdown in Issue Body

```javascript
// Source: https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/about-tasklists
function formatIssueBodyWithChecklist(task, subtasks) {
  let body = `## Task: ${task.name}\n\n`;
  body += `**Files:** ${task.files}\n\n`;
  body += `## Action\n\n${task.action}\n\n`;
  body += `## Checklist\n\n`;

  // GitHub will make these interactive checkboxes
  subtasks.forEach((subtask) => {
    body += `- [ ] ${subtask}\n`;
  });

  body += `\n## Verification\n\n\`\`\`bash\n${task.verify}\n\`\`\`\n`;

  return body;
}
```

## State of the Art

| Old Approach             | Current Approach         | When Changed        | Impact                                                 |
| ------------------------ | ------------------------ | ------------------- | ------------------------------------------------------ |
| Manual issue creation    | Automated from PLAN.md   | Phase 9 (2026-01)   | Issues auto-created with complete context              |
| Issue state for tracking | Labels with 4 states     | Phase 8.1 (2025-12) | Granular status (pending/in-progress/complete/blocked) |
| Additive label updates   | Atomic label replacement | Phase 8.1 (2025-12) | No duplicate status labels                             |
| Global labels only       | Phase-specific labels    | Phase 9 (2026-01)   | Filter issues by phase-N label                         |

**Deprecated/outdated:**

- **Issue states for progress tracking:** Only open/closed available, need 4 states for workflow
- **Additive label operations (addLabels):** Use setLabels for atomic replacement (Phase 8.1 decision)
- **Manual label creation:** Use ensureLabelsExist from labels.js

## Open Questions

Things that couldn't be fully resolved:

1. **Issue-to-task mapping persistence**
   - What we know: Issue titles contain task names, phase labels enable filtering
   - What's unclear: Should mapping be stored in STATE.md or retrieved via API query?
   - Recommendation: Query by phase label + title matching is sufficient, no persistent storage needed

2. **Multiple PLAN.md files per phase**
   - What we know: Some phases have multiple plans (05-01-PLAN.md, 05-02-PLAN.md)
   - What's unclear: Should each plan create separate issues or combine all plans?
   - Recommendation: Create issues for ALL PLAN.md files in phase directory, label each with plan number

3. **Executor integration timing**
   - What we know: Executor should update status, but GSD execute-plan output is free-form
   - What's unclear: How to detect when a specific task completes in executor output?
   - Recommendation: Parse executor output for task names, update matching issues (LOW confidence)

## Sources

### Primary (HIGH confidence)

- GitHub REST API - Issues: https://docs.github.com/en/rest/issues
- Octokit.js REST API documentation: https://octokit.github.io/rest.js/
- GitHub rate limits: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- GitHub issue limits: https://github.com/dead-claudia/github-limits (verified 256 char title, 65536 char body)
- GitHub task lists: https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/about-tasklists
- Existing codebase: src/lib/labels.js, src/lib/github.js, src/milestone/phase-planner.js

### Secondary (MEDIUM confidence)

- GitHub automation workflows: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations
- Octokit scripting guide: https://docs.github.com/en/rest/guides/scripting-with-the-rest-api-and-javascript
- GSD PLAN.md structure: Observed in .planning/phases/\*/\*-PLAN.md files

### Tertiary (LOW confidence)

- Bulk issue creation tools: https://github.com/benbalter/bulk-issue-creator (community tool, not needed for this use case)
- Markdown parsing libraries: https://github.com/lennartpollvogt/markdown-to-data (overkill for GSD's consistent format)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Existing infrastructure verified in codebase, Octokit methods confirmed in official docs
- Architecture: HIGH - PLAN.md structure observed in multiple examples, pattern matches existing phase-planner.js
- Pitfalls: HIGH - Rate limits and size limits verified in official GitHub docs and github-limits repo
- Open questions: MEDIUM - Executor integration unclear due to free-form output format

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (30 days - stable APIs)
