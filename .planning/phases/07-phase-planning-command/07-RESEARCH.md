# Phase 7: Phase Planning Command - Research

**Researched:** 2026-01-22
**Domain:** GitHub Action phase planning, command dispatch, markdown document generation
**Confidence:** HIGH

## Summary

Phase 7 implements the `gsd:plan-phase` command that parses phase numbers and creates detailed execution plans. This extends the existing milestone creation workflow pattern to support phase-level planning, enabling users to plan individual phases through GitHub issue comments.

The implementation leverages existing patterns from the milestone workflow (Phase 5) including the orchestrator pattern, planning document generation, and GitHub API integration. Key new work includes:

1. Extending the command allowlist to include `plan-phase`
2. Creating a phase-specific number parser (mirroring `parseMilestoneNumber`)
3. Building a phase planner module that generates PLAN.md files with tasks, dependencies, and wave groupings
4. Integrating phase planning into the command dispatch flow in `src/index.js`

**Primary recommendation:** Follow the established milestone workflow pattern in `src/milestone/index.js`, adapting it for phase-level planning with a dedicated `src/milestone/phase-planner.js` module.

## Standard Stack

The established libraries and patterns for phase planning:

### Core

| Library                      | Version          | Purpose                                      | Why Standard                    |
| ---------------------------- | ---------------- | -------------------------------------------- | ------------------------------- |
| `@actions/github`            | ^7.0.0           | Webhook context, repository info, GitHub API | Official GitHub Actions toolkit |
| `@actions/core`              | ^1.11.1          | Action outputs, logging, inputs              | Official GitHub Actions toolkit |
| `node:fs/promises`           | Node.js built-in | File system operations                       | Native ES module support        |
| `@octokit/plugin-throttling` | ^11.0.3          | Rate-limited API calls                       | Already in project dependencies |

### Command Processing Pipeline

```
parseComment(commentBody) -> validateCommand(command) -> sanitizeArguments(args) -> executePhaseWorkflow()
```

### File Structure Pattern (from existing code)

```
src/
├── index.js                          # Entry point, command dispatch
├── milestone/
│   ├── index.js                      # Milestone workflow orchestrator
│   ├── planning-docs.js              # Document generation
│   ├── state.js                      # State persistence
│   ├── requirements.js               # Requirements gathering
│   ├── summarizer.js                 # Summary comment generation
│   └── phase-planner.js              # NEW: Phase planning logic (Phase 7)
└── .planning/
    └── phases/
        └── {n}/                      # Phase directory
            ├── 07-01-PLAN.md         # Wave 1 plan
            └── 07-02-PLAN.md         # Wave 2 plan (if needed)
```

**Installation:**

```bash
# No new dependencies - uses existing @actions/github, @actions/core, and node:fs
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── milestone/
│   ├── phase-planner.js      # Phase planning orchestrator (NEW)
│   └── ...
└── ...
```

### Pattern 1: Phase Number Parsing

**What:** Extract phase number from command arguments using established pattern
**When to use:** At the start of phase planning workflow
**Example:**

```javascript
// Based on parseMilestoneNumber pattern from src/milestone/index.js

/**
 * Parse phase number from command arguments
 * Supports formats:
 * - "7" (just the number)
 * - "--phase 7"
 * - "--phase=7"
 * - "/gsd:plan-phase 7" (args only)
 *
 * @param {string} commandArgs - Command arguments string
 * @returns {number} Parsed phase number
 * @throws {Error} If phase number cannot be parsed
 */
export function parsePhaseNumber(commandArgs) {
  if (!commandArgs) {
    throw new Error("Phase number is required");
  }

  // Try to extract from --phase flag
  const phaseFlagMatch = commandArgs.match(/--phase[=\s]+(\d+)/);
  if (phaseFlagMatch) {
    return parseInt(phaseFlagMatch[1], 10);
  }

  // Try to extract from -p flag
  const pFlagMatch = commandArgs.match(/-p[=\s]+(\d+)/);
  if (pFlagMatch) {
    return parseInt(pFlagMatch[1], 10);
  }

  // Try to extract standalone number at the end
  const standaloneMatch = commandArgs.match(/(\d+)$/);
  if (standaloneMatch) {
    return parseInt(standaloneMatch[1], 10);
  }

  throw new Error(
    "Could not parse phase number from arguments. Use '--phase N' or provide the number directly.",
  );
}
```

### Pattern 2: Phase Planning Orchestrator

**What:** Orchestrate the complete phase planning workflow
**When to use:** When `gsd:plan-phase` command is dispatched
**Example:**

```javascript
// Based on executeMilestoneWorkflow pattern from src/milestone/index.js

import * as core from "@actions/core";
import * as github from "@actions/github";
import { postComment, getWorkflowRunUrl } from "../lib/github.js";
import { formatErrorComment } from "../errors/formatter.js";
import { createPhaseBranch, branchExists } from "../git/branches.js";
import { runGitCommand, configureGitIdentity } from "../git/git.js";
import {
  loadPhaseState,
  savePhaseState,
  createPhaseState,
  updatePhaseWorkflowRun,
} from "./state.js";
import {
  createPhasePlanDocs,
  generatePhasePlanMarkdown,
} from "./planning-docs.js";
import { generatePhasePlanningSummary } from "./summarizer.js";

/**
 * Execute the complete phase planning workflow
 *
 * Orchestrates:
 * 1. Parse phase number from arguments
 * 2. Load existing phase state or create new state
 * 3. Read milestone context from ROADMAP.md and REQUIREMENTS.md
 * 4. Generate phase plan with tasks, dependencies, waves
 * 5. Create phase branch and commit plan documents
 * 6. Post summary comment to issue
 *
 * @param {object} context - GitHub action context
 * @param {string} context.owner - Repository owner
 * @param {string} context.repo - Repository name
 * @param {number} context.issueNumber - Issue number for comments
 * @param {string} commandArgs - Command arguments string
 * @returns {Promise<object>} Workflow result
 */
export async function executePhaseWorkflow(context, commandArgs) {
  const { owner, repo, issueNumber } = context;
  const workflowUrl = getWorkflowRunUrl();

  core.info(
    `Starting phase planning workflow for ${owner}/${repo}#${issueNumber}`,
  );

  try {
    // Step 1: Parse phase number
    const phaseNumber = parsePhaseNumber(commandArgs);
    core.info(`Parsed phase number: ${phaseNumber}`);

    // Step 2: Load milestone context from planning directory
    const milestoneData = await loadMilestoneContext(owner, repo);

    // Step 3: Generate phase plan data
    const phaseData = {
      phaseNumber,
      milestoneNumber: milestoneData.milestoneNumber,
      owner,
      repo,
      issueNumber,
      goal:
        milestoneData.phases?.[phaseNumber - 1]?.goal || `Phase ${phaseNumber}`,
      dependencies:
        milestoneData.phases?.[phaseNumber - 1]?.dependencies || "None",
      // Wave grouping: tasks organized by dependency level
      waves: [
        {
          wave: 1,
          tasks: [
            {
              id: "7-01",
              description: "Initial setup and foundation",
              verification: "Files created, tests passing",
              dependsOn: [],
            },
          ],
        },
        {
          wave: 2,
          tasks: [
            {
              id: "7-02",
              description: "Core implementation",
              verification: "Integration tests passing",
              dependsOn: ["7-01"],
            },
          ],
        },
      ],
    };

    // Step 4: Create plan documents
    const phaseDir = `.planning/phases/${phaseNumber}/`;
    await fs.mkdir(phaseDir, { recursive: true });

    // Generate wave plans
    const files = [];
    for (const wave of phaseData.waves) {
      const planContent = generatePhasePlanMarkdown(phaseData, wave);
      const planPath = `${phaseDir}${String(phaseNumber).padStart(2, "0")}-${String(wave.wave).padStart(2, "0")}-PLAN.md`;
      await fs.writeFile(planPath, planContent);
      files.push({
        path: planPath,
        purpose: `Wave ${wave.wave} plan`,
        wave: wave.wave,
      });
    }

    // Step 5: Commit to phase branch
    const branchName = `gsd/${milestoneData.milestoneNumber}-${phaseNumber}`;
    await configureGitIdentity(
      "github-actions[bot]",
      "41898282+github-actions[bot]@users.noreply.github.com",
    );

    // Create or switch to phase branch
    const exists = await branchExists(branchName);
    if (!exists) {
      await createPhaseBranch(
        milestoneData.milestoneNumber,
        phaseNumber,
        `phase-${phaseNumber}`,
      );
    } else {
      await runGitCommand(`git switch ${branchName}`);
    }

    // Stage and commit plan files
    for (const file of files) {
      await runGitCommand(`git add "${file.path}"`);
    }
    await runGitCommand(`git commit -m "docs(phase-${phaseNumber}): Create phase planning documents

- ${files.map((f) => f.path.split("/").pop()).join(", ")}

Generated by GSD Bot"`);

    // Step 6: Post summary
    const summary = generatePhasePlanningSummary({
      phaseNumber,
      milestoneNumber: milestoneData.milestoneNumber,
      files,
      waves: phaseData.waves.length,
      branch: branchName,
    });

    await postComment(owner, repo, issueNumber, summary);

    return {
      complete: true,
      phase: "phase-planned",
      phaseNumber,
      files: files.map((f) => f.path),
      branch: branchName,
      message: `Phase ${phaseNumber} planning complete`,
    };
  } catch (error) {
    core.error(`Phase planning error: ${error.message}`);

    const errorComment = formatErrorComment(error, "phase planning");
    await postComment(owner, repo, issueNumber, errorComment);

    throw error;
  }
}
```

### Pattern 3: Phase Plan Document Generation

**What:** Generate structured PLAN.md files with tasks, dependencies, and verification
**When to use:** During phase plan document creation
**Example:**

```javascript
// Based on generateProjectMarkdown pattern

/**
 * Generate PLAN.md content for a specific wave
 * @param {object} phaseData - Phase planning data
 * @param {object} wave - Wave configuration
 * @returns {string} Markdown content
 */
export function generatePhasePlanMarkdown(phaseData, wave) {
  const { phaseNumber, milestoneNumber, goal, dependencies } = phaseData;
  const { wave: waveNum, tasks } = wave;

  const tasksTable = tasks
    .map((task) => {
      const depStr =
        task.dependsOn.length > 0
          ? task.dependsOn.map((d) => `\`${d}\``).join(", ")
          : "None";
      return `| \`${task.id}\` | ${task.description} | ${depStr} | ${task.verification} |`;
    })
    .join("\n");

  return `# Phase ${phaseNumber}: Wave ${waveNum} Plan

**Milestone:** ${milestoneNumber}
**Phase:** ${phaseNumber}
**Wave:** ${waveNum}
**Generated:** ${new Date().toISOString()}

## Goal

${goal}

## Dependencies

${dependencies}

## Tasks

| ID | Description | Depends On | Verification |
|----|-------------|------------|--------------|
${tasksTable}

## Wave Summary

**Total Tasks:** ${tasks.length}
**Parallelizable:** ${tasks.filter((t) => t.dependsOn.length === 0).length}

## Next Steps

1. Review this plan
2. Use \`@gsd-bot execute-phase ${phaseNumber}\` to begin execution
3. Agent will create GitHub issues for each task

---
*Generated by GSD Bot Phase Planner*
`;
}
```

### Pattern 4: Command Dispatch Extension

**What:** Extend existing command dispatch to handle `plan-phase`
**When to use:** In `src/index.js` main entry point
**Example:**

```javascript
// Based on existing new-milestone dispatch pattern

// ALLOWLIST update in src/lib/validator.js
const ALLOWED_COMMANDS = ["new-milestone", "plan-phase"];

// In src/index.js command dispatch:
if (parsed.command === "new-milestone") {
  // Existing milestone workflow
  const result = await executeMilestoneWorkflow(
    {
      owner: repoOwner,
      repo: repoName,
      issueNumber: github.context.issue?.number,
    },
    sanitizedArgs,
  );
  return { commandFound: true, command: parsed.command, ...result };
}

if (parsed.command === "plan-phase") {
  // New phase planning workflow
  core.info("Dispatching to phase planning workflow");
  const result = await executePhaseWorkflow(
    {
      owner: repoOwner,
      repo: repoName,
      issueNumber: github.context.issue?.number,
    },
    sanitizedArgs,
  );
  core.setOutput("phase-planned", result.complete);
  core.setOutput("phase-number", result.phaseNumber);
  return { commandFound: true, command: parsed.command, ...result };
}
```

### Pattern 5: Phase Summary Generation

**What:** Generate summary comment for phase planning completion
**When to use:** After phase plan documents are created
**Example:**

```javascript
// Based on generateMilestoneSummary pattern

/**
 * Generate summary comment for phase planning completion
 * @param {object} data - Phase planning result data
 * @returns {string} Markdown summary
 */
export function generatePhasePlanningSummary(data) {
  const { phaseNumber, milestoneNumber, files, waves, branch } = data;

  const filesTable =
    files.length > 0
      ? files.map((f) => `| \`${f.path}\` | Wave ${f.wave} plan |`).join("\n")
      : "| (none) | |";

  return `## Phase ${phaseNumber} Planning Complete

**Milestone:** ${milestoneNumber}
**Phase:** ${phaseNumber}
**Waves Created:** ${waves}
**Branch:** \`${branch}\`

### Files Created

| File | Purpose |
|------|---------|
${filesTable}

### Next Steps

1. Review the plan files in \`.planning/phases/${phaseNumber}/\`
2. Use \`@gsd-bot execute-phase ${phaseNumber}\` to begin execution
3. The executor will create GitHub issues for each task and track progress

---
*This phase plan was generated by GSD Bot.*`;
}
```

### Anti-Patterns to Avoid

- **Creating plan files without milestone context:** Always read ROADMAP.md/REQUIREMENTS.md first to understand phase goals and dependencies
- **Hard-coding wave structure:** Generate waves dynamically based on task dependencies
- **Skipping phase branch creation:** Plans should be committed to a phase branch for review
- **Not posting summary comment:** Users need to know where to find the plan and what to do next

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                       | Don't Build                  | Use Instead                                 | Why                                                             |
| ----------------------------- | ---------------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| Markdown document generation  | Custom markdown builder      | `generatePhasePlanMarkdown()` pattern       | Consistent with existing `generateProjectMarkdown` pattern      |
| Phase branch naming           | Custom naming logic          | `createPhaseBranch(milestone, phase, name)` | Existing pattern in `src/git/branches.js` handles slugification |
| Git commit with planning docs | Custom git commands          | `commitPlanningDocs()` pattern              | Existing handles identity config and error cases                |
| Summary comment formatting    | Custom markdown from scratch | `generatePhasePlanningSummary()`            | Consistent with `generateMilestoneSummary`                      |
| File path construction        | Manual string concatenation  | Path templates with template literals       | Prevents path traversal issues                                  |

**Key insight:** The existing milestone workflow provides a complete template for phase planning. Adapt patterns rather than building custom solutions.

## Common Pitfalls

### Pitfall 1: Not Loading Milestone Context First

**What goes wrong:** Phase plans lack context about milestone goals, scope, and existing phases

**Why it happens:** Phase planning depends on milestone-level documents that may not exist or be outdated

**How to avoid:** Always load milestone context from `.planning/milestones/{n}/` before generating phase plans

**Warning signs:**

- Generated plans reference "undefined" milestone
- Phase goals don't match milestone ROADMAP.md

### Pitfall 2: Circular Dependencies in Task Planning

**What goes wrong:** Task A depends on B, task B depends on A, causing infinite wave loop

**Why it happens:** Manual task dependency specification without validation

**How to avoid:** Validate no circular dependencies exist before generating plan; throw error if cycle detected

**Warning signs:**

- More waves than tasks
- Phase execution hangs on task ordering

### Pitfall 3: Not Using Phase Branch

**What goes wrong:** Plan files committed to milestone branch instead of phase-specific branch

**Why it happens:** Reusing `commitPlanningDocs` without adapting for phase branches

**How to avoid:** Use `createPhaseBranch()` for phase plans, not `createMilestoneBranch()`

**Warning signs:**

- All phase plans on same branch
- Merge conflicts when planning multiple phases

### Pitfall 4: Missing Verification Criteria

**What goes wrong:** Tasks have descriptions but no verification, making execution status unclear

**Why it happens:** Generating tasks without requiring verification criteria

**How to avoid:** Make verification field required in task definition; reject tasks without it

**Warning signs:**

- Tasks marked "complete" without actual verification
- Users asking "how do I know this is done?"

## Code Examples

### Phase State Management

```javascript
// Based on src/milestone/state.js pattern

const PHASE_STATE_FILE = ".planning/phases/{n}/PHASE-STATE.md";

export function createPhaseState(phaseNumber, milestoneNumber) {
  return {
    phase: phaseNumber,
    milestone: milestoneNumber,
    status: "planning",
    createdAt: new Date().toISOString(),
    lastRunAt: null,
    runCount: 0,
    waves: [],
    tasks: [],
    workflow: {
      startedAt: new Date().toISOString(),
      lastRunAt: null,
      runCount: 0,
    },
  };
}

export async function loadPhaseState(owner, repo, phaseNumber) {
  // Similar to loadState but reads from .planning/phases/{n}/
}
```

### Task Dependency Analysis

```javascript
/**
 * Analyze task dependencies and group into waves
 * Tasks with no dependencies go in wave 1
 * Tasks whose dependencies are in earlier waves go in next wave
 *
 * @param {Array<{id: string, dependsOn: string[]}>} tasks
 * @returns {Array<{wave: number, tasks: object[]}>}
 */
export function groupTasksIntoWaves(tasks) {
  const waves = [];
  const assigned = new Set();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  let waveNum = 1;
  while (assigned.size < tasks.length) {
    const waveTasks = tasks.filter((task) => {
      // Task is ready if all dependencies are assigned
      const deps = task.dependsOn || [];
      const depsAssigned = deps.every((d) => assigned.has(d));
      return !assigned.has(task.id) && depsAssigned;
    });

    if (waveTasks.length === 0 && assigned.size < tasks.length) {
      throw new Error("Circular dependency detected - cannot assign waves");
    }

    waves.push({ wave: waveNum, tasks: waveTasks });
    waveTasks.forEach((t) => assigned.add(t.id));
    waveNum++;
  }

  return waves;
}
```

### Reading Milestone Context

```javascript
/**
 * Load milestone context from planning documents
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<object>} Milestone context
 */
async function loadMilestoneContext(owner, repo) {
  const token = core.getInput("token") || process.env.GITHUB_TOKEN;
  const octokit = github.getOctokit(token);

  // Load ROADMAP.md
  let roadmap = null;
  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: ".planning/milestones/1/ROADMAP.md", // milestone number from STATE.md
    });
    roadmap = Buffer.from(response.data.content, "base64").toString("utf-8");
  } catch (error) {
    if (error.status === 404) {
      throw new Error(
        "Milestone ROADMAP.md not found. Create milestone first with @gsd-bot new-milestone",
      );
    }
    throw error;
  }

  // Parse phase structure from ROADMAP
  const phases = parsePhasesFromMarkdown(roadmap);

  return {
    milestoneNumber: 1, // Would come from STATE.md
    phases,
    roadmap,
  };
}
```

## State of the Art

| Old Approach          | Current Approach               | When Changed | Impact                           |
| --------------------- | ------------------------------ | ------------ | -------------------------------- |
| No phase planning     | Dedicated phase planner module | Phase 7      | Users can plan individual phases |
| Milestone-level only  | Phase-level with wave grouping | Phase 7      | Granular task planning           |
| No task dependencies  | Dependency-aware wave grouping | Phase 7      | Safe parallel execution          |
| Direct commit to main | Phase branch per plan          | Phase 7      | Reviewable, mergeable plans      |

**Key Design Decisions:**

- Phase plans live in `.planning/phases/{n}/` (separate from milestone docs)
- Each wave gets its own PLAN.md file for focused execution
- Tasks include explicit dependencies and verification criteria
- Plans committed to phase-specific branches for PR review

## Open Questions

1. **How to determine milestone number for phase?**
   - What we know: Phase is within a milestone; need to lookup from STATE.md
   - What's unclear: How to specify which milestone (current vs. explicit)
   - Recommendation: Default to milestone from ROADMAP.md, support `--milestone N` override

2. **Should phase planner support custom task definitions?**
   - What we know: Current requirements don't specify user-defined tasks
   - What's unclear: Whether Phase 7 includes interactive task definition
   - Recommendation: Generate default task structure, allow editing via PR on phase branch

3. **How to handle phase numbering across milestones?**
   - What we know: Phases reset per milestone (Phase 7, 8, 9 for v1.1)
   - What's unclear: Whether phase numbers should be global or per-milestone
   - Recommendation: Per-milestone numbering, but track global milestone for branch naming

## Sources

### Primary (HIGH confidence)

- [GitHub Actions JavaScript Action - Setting up](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions) - Action structure and ES modules
- [GitHub REST API - Repos get content](https://docs.github.com/en/rest/repos/repos#get-content) - Reading planning documents
- [GitHub REST API - Repos create or update file contents](https://docs.github.com/en/rest/repos/repos#create-or-update-file-contents) - Committing plan files
- Existing codebase patterns from `src/milestone/index.js`, `src/milestone/planning-docs.js`

### Secondary (MEDIUM confidence)

- [Node.js fs/promises documentation](https://nodejs.org/api/fs.html) - ES module file operations
- [ES Modules in Node.js](https://nodejs.org/api/esm.html) - Import/export syntax

### Tertiary (LOW confidence)

- Community patterns for GitHub Action document generation (inferred from existing code)

## Metadata

**Confidence breakdown:**

- Standard Stack: HIGH - Uses existing project dependencies and established patterns
- Architecture: HIGH - Adapts existing milestone workflow patterns to phase context
- Pitfalls: HIGH - Based on known issues from milestone workflow implementation

**Research date:** 2026-01-22
**Valid until:** 2026-07-22 (6 months - GitHub Actions ES modules are stable)

**Existing codebase integration points:**

- Extends `src/lib/validator.js` ALLOWLIST
- Adds new `src/milestone/phase-planner.js` module
- Uses existing `src/git/branches.js` for phase branch creation
- Uses existing `src/git/git.js` for git operations
- Uses existing `src/lib/github.js` for GitHub API
- Integrates with `src/index.js` command dispatch
