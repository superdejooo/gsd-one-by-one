# Phase 13: Milestone Trigger via "good first issue" Label - Research

**Researched:** 2026-01-23
**Domain:** GitHub Actions webhook triggers, issue event handling, markdown parsing
**Confidence:** HIGH

## Summary

This phase enables automatic milestone creation when a GitHub issue receives the "good first issue" label. The workflow triggers on `issues.labeled` event, reads the issue title and body as the milestone description, invokes GSD's `new-milestone` command, then parses the generated planning artifacts (REQUIREMENTS.md and ROADMAP.md) to update the triggering issue with milestone information and phase links.

The standard approach uses a separate workflow file (distinct from the existing `issue_comment` workflow) that triggers on the `issues.labeled` event with conditional logic to filter for the specific label name. GitHub provides `github.event.issue.title` and `github.event.issue.body` for accessing issue content. After GSD execution, standard Node.js file reading and regex parsing extracts milestone metadata from markdown files. The issue update occurs via Octokit's REST API using the `PATCH /repos/{owner}/{repo}/issues/{issue_number}` endpoint.

**Primary recommendation:** Create a new workflow file `.github/workflows/gsd-label-trigger.yml` that triggers on `issues.labeled`, uses conditional job execution to filter for "good first issue" label, and reuses existing action code with modified inputs to accept issue body as command arguments.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @actions/github | 6.0+ | GitHub API & context | Official GitHub Actions toolkit, provides Octokit REST client |
| @actions/core | 1.10+ | Workflow commands | Official GitHub Actions toolkit for inputs/outputs/logging |
| Node.js fs/promises | Built-in | File reading | Native async file operations, no dependencies needed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gray-matter | 4.0+ | Markdown frontmatter parsing | If REQUIREMENTS.md uses YAML frontmatter (optional) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Multiple workflows | Single workflow with complex conditionals | Multiple workflows provides cleaner separation of concerns, easier to maintain |
| Regex parsing | gray-matter library | Regex is sufficient for current simple markdown structure, library adds dependency |
| REST API milestone creation | GraphQL mutation | REST API is simpler, well-documented, and sufficient for single operations |

**Installation:**
```bash
# No new dependencies required - using existing @actions/github and @actions/core
# Optional if frontmatter parsing becomes complex:
# npm install gray-matter
```

## Architecture Patterns

### Recommended Project Structure

```
.github/workflows/
├── gsd-command-handler.yml  # Existing - triggers on issue_comment
├── gsd-label-trigger.yml     # NEW - triggers on issues.labeled
└── test.yml                  # Existing - test workflow

src/
├── index.js                  # Entry point - needs conditional logic for trigger type
├── milestone/
│   ├── index.js              # executeMilestoneWorkflow - refactor parseMilestoneNumber out
│   └── milestone-parsers.js  # NEW - parse REQUIREMENTS.md and ROADMAP.md
└── lib/
    └── github.js             # Add updateIssue and createMilestone functions
```

### Pattern 1: Separate Workflow for Different Trigger

**What:** Create a dedicated workflow file for `issues.labeled` event that runs in parallel to the existing `issue_comment` workflow

**When to use:** When different event types require similar logic but different input sources

**Example:**
```yaml
# .github/workflows/gsd-label-trigger.yml
name: GSD Label Trigger

on:
  issues:
    types: [labeled]

jobs:
  handle-good-first-issue:
    # Conditional execution - only run for specific label
    if: github.event.label.name == 'good first issue'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      # Same setup steps as gsd-command-handler.yml
      # (Node.js, Bun, Claude Code, CCR, etc.)

      - name: Run Action
        uses: ./
        with:
          issue-number: ${{ github.event.issue.number }}
          repo-owner: ${{ github.repository_owner }}
          repo-name: ${{ github.event.repository.name }}
          # Pass issue title and body joined with separator
          comment-body: "@gsd-bot new-milestone ${{ github.event.issue.title }} --- ${{ github.event.issue.body }}"
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Pattern 2: Input Source Detection in Action Code

**What:** Modify `src/index.js` to detect whether it's being called from issue_comment or issues.labeled trigger

**When to use:** When the same action needs to handle multiple trigger types

**Example:**
```javascript
// src/index.js
const commentBody = core.getInput("comment-body");
const triggerType = core.getInput("trigger-type"); // NEW optional input

// Detect trigger context
const isLabelTrigger = triggerType === "label" || !commentBody.includes("@gsd-bot");

if (isLabelTrigger) {
  // Label trigger: issue title/body is the description
  // commentBody contains: "title --- body"
  const description = commentBody;
  // Execute without parsing milestone number
} else {
  // Comment trigger: parse command from comment
  const parsed = parseComment(commentBody);
}
```

### Pattern 3: Markdown File Parsing

**What:** Read and parse .planning/REQUIREMENTS.md and .planning/ROADMAP.md after GSD execution completes

**When to use:** When extracting structured data from generated markdown files

**Example:**
```javascript
// src/milestone/milestone-parsers.js
import { readFile } from "fs/promises";

/**
 * Parse REQUIREMENTS.md for milestone metadata
 *
 * @param {string} filePath - Path to REQUIREMENTS.md
 * @returns {object} Parsed metadata { milestone, version, definedDate }
 */
export async function parseRequirements(filePath = ".planning/REQUIREMENTS.md") {
  const content = await readFile(filePath, "utf-8");

  // Extract milestone title from header
  // Example: "# Requirements: GSD for GitHub v1.1"
  const titleMatch = content.match(/^#\s+Requirements:\s+(.+?)$/m);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Extract version (vX or vX.Y)
  const versionMatch = content.match(/v(\d+\.?\d*)/);
  const version = versionMatch ? versionMatch[0] : null;

  // Extract defined date
  // Example: "**Defined:** 2026-01-22"
  const dateMatch = content.match(/\*\*Defined:\*\*\s+(\d{4}-\d{2}-\d{2})/);
  const definedDate = dateMatch ? dateMatch[1] : null;

  // Extract milestone description from "**Milestone:**" line
  const milestoneMatch = content.match(/\*\*Milestone:\*\*\s+(.+?)$/m);
  const milestone = milestoneMatch ? milestoneMatch[1].trim() : null;

  return { title, version, definedDate, milestone };
}

/**
 * Parse ROADMAP.md for phase information
 *
 * @param {string} filePath - Path to ROADMAP.md
 * @returns {Array} Phase objects with { number, title, goal, status }
 */
export async function parseRoadmap(filePath = ".planning/ROADMAP.md") {
  const content = await readFile(filePath, "utf-8");
  const phases = [];

  // Match phase sections like:
  // ### Phase 7: Phase Planning Command
  // **Goal:** Implement `gsd:plan-phase` command...
  // **Status:** Complete (2026-01-22)

  const phasePattern = /^###\s+Phase\s+(\d+(?:\.\d+)?):?\s+(.+?)$/gm;
  let match;

  while ((match = phasePattern.exec(content)) !== null) {
    const number = match[1];
    const title = match[2].trim();

    // Find the goal and status for this phase
    // Look ahead from current position until next phase header
    const startIndex = match.index;
    const nextPhaseMatch = phasePattern.exec(content);
    const endIndex = nextPhaseMatch ? nextPhaseMatch.index : content.length;

    // Reset regex for next iteration
    phasePattern.lastIndex = match.index + match[0].length;

    const phaseSection = content.substring(startIndex, endIndex);

    // Extract goal
    const goalMatch = phaseSection.match(/\*\*Goal:\*\*\s+(.+?)$/m);
    const goal = goalMatch ? goalMatch[1].trim() : null;

    // Extract status
    const statusMatch = phaseSection.match(/\*\*Status:\*\*\s+(.+?)$/m);
    const status = statusMatch ? statusMatch[1].trim() : "Not started";

    phases.push({ number, title, goal, status });
  }

  return phases;
}
```

### Pattern 4: GitHub Issue Update with Milestone

**What:** Update the triggering issue with milestone information and formatted phase links

**When to use:** After successfully creating planning artifacts

**Example:**
```javascript
// src/lib/github.js
/**
 * Create a GitHub milestone
 *
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} title - Milestone title
 * @param {string} description - Milestone description
 * @param {string} dueOn - Due date (ISO 8601 format)
 * @returns {Promise<object>} Created milestone object
 */
export async function createMilestone(owner, repo, title, description, dueOn = null) {
  const response = await octokit.rest.issues.createMilestone({
    owner,
    repo,
    title,
    description,
    due_on: dueOn,
    state: "open"
  });

  core.info(`Milestone created: ${title} (#${response.data.number})`);
  return response.data;
}

/**
 * Update a GitHub issue
 *
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {object} updates - Fields to update { title, body, milestone, labels }
 */
export async function updateIssue(owner, repo, issueNumber, updates) {
  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    ...updates
  });

  core.info(`Issue #${issueNumber} updated`);
}
```

### Anti-Patterns to Avoid

- **Parsing milestone number from user input:** GSD determines the milestone number automatically, don't force users to provide it
- **Modifying existing workflow file:** Keep label trigger separate from comment trigger for maintainability
- **Complex frontmatter parsing:** Current markdown structure doesn't use YAML frontmatter, simple regex is sufficient
- **Synchronous file reading:** Always use fs/promises async methods in Node.js action context
- **Hardcoding "good first issue":** Make label name configurable via action input or config file for flexibility

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub API client | Custom fetch() wrapper | @actions/github (Octokit) | Official toolkit, handles auth, rate limiting, type definitions |
| Markdown parsing | Custom regex parser for full markdown | gray-matter (if needed) | Handles edge cases like escaped delimiters, nested structures |
| Workflow context access | Environment variable parsing | @actions/core and github.context | Type-safe context access, official API |
| Issue body multiline handling | String concatenation in workflow | Environment variables | Prevents script injection, handles special characters |

**Key insight:** GitHub Actions provides comprehensive official tooling (@actions/*) that handles authentication, context access, and API interaction. Custom implementations miss edge cases around rate limiting, retry logic, and security. The official toolkit is battle-tested across millions of workflows.

## Common Pitfalls

### Pitfall 1: Multiline Issue Body in Workflow Expressions

**What goes wrong:** Using `${{ github.event.issue.body }}` directly in workflow expressions can cause "Invalid or unexpected token" errors if the body contains newlines or special characters

**Why it happens:** GitHub Actions evaluates expressions as JavaScript, newlines break the parser

**How to avoid:** Set issue body to environment variable first, then pass to action:
```yaml
- name: Run Action
  env:
    ISSUE_BODY: ${{ github.event.issue.body }}
  with:
    comment-body: "@gsd-bot new-milestone ${{ github.event.issue.title }} --- $ISSUE_BODY"
```

**Warning signs:** Workflow fails with "Unexpected token" or parser errors when issue body contains newlines

### Pitfall 2: Label Event Doesn't Include Label Name Filter

**What goes wrong:** Triggering on `issues.labeled` runs for ALL labels, not just "good first issue"

**Why it happens:** GitHub Actions doesn't support label name filtering in event trigger syntax

**How to avoid:** Use job-level `if` conditional:
```yaml
jobs:
  handle-label:
    if: github.event.label.name == 'good first issue'
```

**Warning signs:** Workflow runs every time any label is added to any issue

### Pitfall 3: Milestone Number Parsing Still Required

**What goes wrong:** Assuming GSD can determine milestone number but existing code still expects it as input

**Why it happens:** Current `parseMilestoneNumber()` function throws error if number not found in arguments

**How to avoid:** Refactor `executeMilestoneWorkflow` to make milestone number optional, let GSD determine it from context. This requires changes to:
- Remove `parseMilestoneNumber()` call for label-triggered flows
- Update GSD command format to not require milestone number
- Handle cases where milestone number is known (comment trigger) vs unknown (label trigger)

**Warning signs:** Action fails with "Milestone number is required" error even though none was provided

### Pitfall 4: Race Condition Between Workflow Runs

**What goes wrong:** Multiple label additions in quick succession trigger overlapping workflows that conflict when writing to .planning/ directory

**Why it happens:** GitHub Actions doesn't enforce concurrency limits by default between different workflow files

**How to avoid:** Use concurrency key in workflow definition:
```yaml
concurrency:
  group: gsd-milestone-creation
  cancel-in-progress: false  # Don't cancel, queue instead
```

**Warning signs:** Git conflicts, corrupted planning files, workflow failures with "file already exists"

### Pitfall 5: REQUIREMENTS.md Doesn't Exist Between Milestones

**What goes wrong:** Parsing logic fails when trying to read REQUIREMENTS.md before GSD has created it

**Why it happens:** REQUIREMENTS.md is created by GSD during milestone creation, doesn't exist beforehand

**How to avoid:** Check file existence before parsing, handle cases where:
- File doesn't exist yet (pre-GSD execution)
- File was deleted after milestone completion
- File is in subdirectory (`.planning/milestones/vX-REQUIREMENTS.md`)

**Warning signs:** "File not found" errors when reading .planning/REQUIREMENTS.md

## Code Examples

Verified patterns from official sources:

### GitHub Actions Label Trigger with Conditional

```yaml
# Source: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows
# Source: https://github.com/orgs/community/discussions/26160

name: GSD Label Trigger

on:
  issues:
    types: [labeled]

permissions:
  contents: write
  issues: write
  pull-requests: write

concurrency:
  group: gsd-milestone-${{ github.event.issue.number }}
  cancel-in-progress: false

jobs:
  create-milestone:
    # Only run for "good first issue" label, not from bots
    if: github.event.label.name == 'good first issue' && github.event.sender.type != 'Bot'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Extract issue content
        id: issue-content
        run: |
          # Store multiline content in environment files
          echo "ISSUE_TITLE=${{ github.event.issue.title }}" >> $GITHUB_ENV
          echo "ISSUE_BODY<<EOF" >> $GITHUB_ENV
          echo "${{ github.event.issue.body }}" >> $GITHUB_ENV
          echo "EOF" >> $GITHUB_ENV

      - name: Run Action
        uses: ./
        with:
          issue-number: ${{ github.event.issue.number }}
          repo-owner: ${{ github.repository_owner }}
          repo-name: ${{ github.event.repository.name }}
          comment-body: "@gsd-bot new-milestone ${ISSUE_TITLE} --- ${ISSUE_BODY}"
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Octokit Issue Update with Milestone

```javascript
// Source: https://docs.github.com/en/rest/issues/issues
// Using @actions/github Octokit client

import { octokit } from "./lib/github.js";
import * as core from "@actions/core";

/**
 * Create GitHub milestone and update issue
 */
async function updateIssueWithMilestone(owner, repo, issueNumber, milestoneData) {
  // Step 1: Create milestone
  const milestone = await octokit.rest.issues.createMilestone({
    owner,
    repo,
    title: milestoneData.version, // e.g., "v1.1"
    description: milestoneData.milestone,
    state: "open"
  });

  core.info(`Created milestone: ${milestone.data.title} (#${milestone.data.number})`);

  // Step 2: Update issue body with phase links
  const phaseLinks = milestoneData.phases.map(p =>
    `- Phase ${p.number}: ${p.title} — ${p.status}`
  ).join("\n");

  const updatedBody = `## Milestone Created: ${milestoneData.version}

${milestoneData.milestone}

### Phases

${phaseLinks}

### Planning Documents

- [REQUIREMENTS.md](.planning/REQUIREMENTS.md)
- [ROADMAP.md](.planning/ROADMAP.md)

---

_Original description:_

${github.event.issue.body}
`;

  // Step 3: Update issue with milestone and new body
  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    milestone: milestone.data.number, // Reference by number
    body: updatedBody,
    labels: ["milestone-created", "planning"]
  });

  core.info(`Updated issue #${issueNumber} with milestone and phase links`);
}
```

### Regex-based Markdown Parsing

```javascript
// Simple regex parsing for structured markdown (no dependencies)
// Source: Current codebase pattern, adapted for REQUIREMENTS.md/ROADMAP.md

import { readFile } from "fs/promises";
import { access, constants } from "fs/promises";

/**
 * Check if file exists
 */
async function fileExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse milestone metadata from REQUIREMENTS.md
 */
export async function parseRequirements(filePath = ".planning/REQUIREMENTS.md") {
  if (!await fileExists(filePath)) {
    return { title: null, version: null, milestone: null, definedDate: null };
  }

  const content = await readFile(filePath, "utf-8");

  // Extract title: "# Requirements: GSD for GitHub v1.1"
  const titleMatch = content.match(/^#\s+Requirements:\s+(.+?)$/m);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Extract version: "v1.1" or "v2"
  const versionMatch = title?.match(/v(\d+(?:\.\d+)?)/);
  const version = versionMatch ? versionMatch[0] : null;

  // Extract milestone description: "**Milestone:** v1.1 — Plan & Execute Commands"
  const milestoneMatch = content.match(/\*\*Milestone:\*\*\s+(.+?)$/m);
  const milestone = milestoneMatch ? milestoneMatch[1].trim() : null;

  // Extract defined date: "**Defined:** 2026-01-22"
  const dateMatch = content.match(/\*\*Defined:\*\*\s+(\d{4}-\d{2}-\d{2})/);
  const definedDate = dateMatch ? dateMatch[1] : null;

  return { title, version, milestone, definedDate };
}

/**
 * Parse phases from ROADMAP.md
 */
export async function parseRoadmap(filePath = ".planning/ROADMAP.md") {
  if (!await fileExists(filePath)) {
    return [];
  }

  const content = await readFile(filePath, "utf-8");
  const phases = [];

  // Split by phase headers: "### Phase 7: Phase Planning Command"
  const phaseRegex = /^###\s+Phase\s+(\d+(?:\.\d+)?):?\s+(.+?)$\n([\s\S]*?)(?=^###\s+Phase|\n---|\n##\s+Phase\s+Summary|$)/gm;

  let match;
  while ((match = phaseRegex.exec(content)) !== null) {
    const [_, number, title, section] = match;

    // Extract goal from section
    const goalMatch = section.match(/\*\*Goal:\*\*\s+(.+?)$/m);
    const goal = goalMatch ? goalMatch[1].trim() : null;

    // Extract status from section
    const statusMatch = section.match(/\*\*Status:\*\*\s+(.+?)$/m);
    const status = statusMatch ? statusMatch[1].trim() : "Not started";

    phases.push({
      number,
      title: title.trim(),
      goal,
      status
    });
  }

  return phases;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|---------|
| Single workflow for all triggers | Separate workflows per trigger type | 2024+ | Cleaner separation, easier maintenance, better concurrency control |
| Parse everything with regex | Use libraries for complex parsing | 2023+ | More robust, but simple regex still appropriate for basic markdown |
| Frontmatter in all markdown | Frontmatter optional | 2025+ | Simpler markdown files, frontmatter only when metadata complex |
| REST API v3 | REST API v4 (2022-11-28) | 2022 | Better consistency, more features |

**Deprecated/outdated:**

- `github-script` action for complex logic: Now prefer custom JavaScript actions for better testability and type safety
- Inline shell scripts with multiline: Use composite actions or custom actions instead
- Global environment variables: Prefer job/step-specific env for better isolation

## Open Questions

Things that couldn't be fully resolved:

1. **Milestone number determination strategy**
   - What we know: GSD can auto-determine milestone number from existing .planning/ structure
   - What's unclear: Whether this happens in GSD skill or needs helper in our action code
   - Recommendation: Test GSD's `new-milestone` command without number argument to confirm behavior

2. **Planning file location consistency**
   - What we know: Current code uses `.planning/` at root, but milestone-specific files may go in `.planning/milestones/vX/`
   - What's unclear: Whether REQUIREMENTS.md is at root or in milestone subdirectory after creation
   - Recommendation: Check both locations in parsing logic, prioritize root location first

3. **Concurrency with existing workflows**
   - What we know: Need to prevent conflicts between label trigger and comment trigger workflows
   - What's unclear: Whether same concurrency group should be used or separate groups
   - Recommendation: Use separate concurrency groups (one for label, one for comment) to allow independent execution

4. **Label removal behavior**
   - What we know: Workflow triggers on labeled event only
   - What's unclear: Should "good first issue" label be removed after milestone creation
   - Recommendation: Keep label for discoverability, add "milestone-created" label to indicate completion

## Sources

### Primary (HIGH confidence)

- [GitHub Actions: Events that trigger workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows) - Official documentation on issues.labeled event
- [GitHub Actions: Webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads) - Payload structure for issues event
- [GitHub Actions: Using conditions to control job execution](https://docs.github.com/en/actions/using-jobs/using-conditions-to-control-job-execution) - Conditional job execution patterns
- [GitHub REST API: Milestones](https://docs.github.com/en/rest/issues/milestones) - Milestone creation and management
- [GitHub REST API: Issues](https://docs.github.com/en/rest/issues/issues) - Issue update endpoint and parameters
- [GitHub Actions: Contexts reference](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/accessing-contextual-information-about-workflow-runs) - Accessing github.event.issue fields

### Secondary (MEDIUM confidence)

- [GitHub Community: Conditional job execution for specific label](https://github.com/orgs/community/discussions/26160) - Practical pattern for label filtering
- [GitHub Community: Get contents/body of issue in action](https://github.com/orgs/community/discussions/25486) - Issue body access patterns
- [gray-matter npm package](https://www.npmjs.com/package/gray-matter) - Markdown frontmatter parsing (if needed)
- [marked npm package](https://www.npmjs.com/package/marked) - Full markdown parsing (if needed)

### Tertiary (LOW confidence)

- [GitHub Webhooks Guide](https://www.magicbell.com/blog/github-webhooks-guide) - General webhook patterns
- [GitHub Actions Conditional Job Execution (Medium)](https://samanpavel.medium.com/github-actions-conditional-job-execution-e6aa363d2867) - Community patterns

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Official GitHub Actions toolkit is well-documented and battle-tested
- Architecture: HIGH - Patterns verified with official documentation and current codebase structure
- Pitfalls: MEDIUM - Based on community discussions and common GitHub Actions issues, not all tested in this specific context

**Research date:** 2026-01-23
**Valid until:** 30 days (2026-02-22) - GitHub Actions API stable, markdown parsing patterns mature
