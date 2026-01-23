# Phase 05: Milestone Creation Workflow - Research

**Researched:** 2026-01-22
**Domain:** Multi-turn Workflows, File-based State Management, Requirements Gathering, Git Operations
**Confidence:** HIGH

## Summary

This phase research focuses on implementing the complete `gsd:new-milestone` workflow, which requires orchestrating multiple complex patterns: creating planning documents (PROJECT.md, STATE.md, ROADMAP.md), managing git operations across branches, and implementing multi-turn requirements gathering through GitHub comments. The standard approach uses file-based state persistence in STATE.md for tracking requirements status, octokit paginate for reading comments, and the GitHub Contents API for file creation via base64 encoding.

**Primary recommendation:** Use file-based state in `.github/planning/milestones/{n}/STATE.md` to track requirements gathering progress across workflow runs, with each run posting questions and reading user answers from newly added comments. Store comment IDs to distinguish new user responses from bot-generated comments.

## Standard Stack

### Core

| Library             | Version  | Purpose                                 | Why Standard                                      |
| ------------------- | -------- | --------------------------------------- | ------------------------------------------------- |
| @actions/github     | Latest   | GitHub API client (octokit)             | Official GitHub Actions toolkit                   |
| @actions/core       | Latest   | Input/output, error handling, logging   | Official GitHub Actions toolkit                   |
| octokit.paginate    | Latest   | Automatic pagination for list endpoints | Built-in octokit method for fetching all comments |
| GitHub Contents API | REST v20 | Create/update files in repository       | Standard REST API for file operations             |

### Supporting

| Tool                      | Purpose                    | When to Use                           |
| ------------------------- | -------------------------- | ------------------------------------- |
| Buffer (Node.js built-in) | Base64 encode file content | When creating files via Contents API  |
| util.promisify            | Execute git commands       | All git operations (existing pattern) |

### Utilities Needed

| Module                         | Purpose                                 | Implements                         |
| ------------------------------ | --------------------------------------- | ---------------------------------- |
| src/milestone/planning-docs.js | Create PROJECT.md, STATE.md, ROADMAP.md | MILE-01, MILE-02, MILE-03          |
| src/milestone/requirements.js  | Multi-turn requirements gathering       | REQG-01, REQG-02, REQG-03, REQG-04 |
| src/milestone/state.js         | State file management                   | Multi-run persistence              |

**Installation:**

```bash
# No new packages - using existing @actions/github + Node.js built-ins
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── parser.js           # Existing: Command parsing
│   ├── config.js           # Existing: Config loading
│   ├── validator.js        # Existing: Command validation
│   └── github.js           # Existing: GitHub API operations
├── git/
│   ├── git.js              # Existing: Git command executor
│   └── branches.js         # Existing: Branch management
├── errors/
│   ├── formatter.js        # Existing: Error formatting
│   └── handler.js          # Existing: Error handling
├── milestone/              # NEW: Milestone workflow
│   ├── index.js           # Milestone workflow orchestrator
│   ├── planning-docs.js   # Create PROJECT.md, STATE.md, ROADMAP.md
│   ├── requirements.js    # Requirements gathering logic
│   ├── state.js           # State file management
│   └── summarizer.js      # Summary comment generation
└── index.js               # Main entry point (existing)
```

### Pattern 1: Multi-Run State Persistence

**What:** Store requirements gathering state in a file that persists across workflow runs
**When to use:** Tracking which questions have been answered, milestone progress, requirements status
**Example:**

```javascript
// src/milestone/state.js
import * as github from "@actions/github";
import * as core from "@actions/core";
import fs from "node:fs/promises";

const STATE_FILE = ".github/planning/milestones/{n}/STATE.md";

/**
 * Load state from STATE.md file
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} milestoneNumber - Milestone number
 * @returns {object} State object
 */
export async function loadState(owner, repo, milestoneNumber) {
  const token = core.getInput("token") || process.env.GITHUB_TOKEN;
  const octokit = github.getOctokit(token);
  const path = STATE_FILE.replace("{n}", milestoneNumber);

  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    });

    const content = Buffer.from(response.data.content, "base64").toString(
      "utf-8",
    );
    return parseStateFile(content);
  } catch (error) {
    if (error.status === 404) {
      // State file doesn't exist yet - return initial state
      return createInitialState(milestoneNumber);
    }
    throw error;
  }
}

/**
 * Save state to STATE.md file via GitHub Contents API
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} milestoneNumber - Milestone number
 * @param {object} state - State object to save
 */
export async function saveState(owner, repo, milestoneNumber, state) {
  const token = core.getInput("token") || process.env.GITHUB_TOKEN;
  const octokit = github.getOctokit(token);
  const path = STATE_FILE.replace("{n}", milestoneNumber);
  const content = formatStateFile(state);
  const encodedContent = Buffer.from(content).toString("base64");

  // Get current file SHA for update (or null for create)
  let sha = null;
  try {
    const existing = await octokit.rest.repos.getContent({ owner, repo, path });
    sha = existing.data.sha;
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: `chore: Update milestone ${milestoneNumber} state`,
    content: encodedContent,
    sha: sha, // Omit for create, include for update
  });

  core.info(`State saved to ${path}`);
}

/**
 * Create initial state for new milestone
 */
function createInitialState(milestoneNumber) {
  return {
    milestone: milestoneNumber,
    status: "requirements-gathering",
    createdAt: new Date().toISOString(),
    requirements: {
      questions: [],
      answered: [],
      pending: [],
    },
    workflow: {
      startedAt: new Date().toISOString(),
      lastRunAt: null,
      runCount: 0,
    },
  };
}
```

### Pattern 2: Detect New User Comments

**What:** Distinguish new user answers from previous bot comments by tracking comment IDs
**When to use:** Reading user responses during requirements gathering
**Example:**

```javascript
// src/milestone/requirements.js
import * as github from "@actions/github";

/**
 * Get new comments since last processed comment
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {number} lastProcessedId - ID of last processed comment
 * @returns {Promise<Array>} New comments
 */
export async function getNewComments(
  owner,
  repo,
  issueNumber,
  lastProcessedId = 0,
) {
  const token = core.getInput("token") || process.env.GITHUB_TOKEN;
  const octokit = github.getOctokit(token);

  // Get all comments using pagination
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });

  // Filter to only new comments (higher ID = newer)
  const newComments = comments.filter((c) => c.id > lastProcessedId);

  // Sort by ID ascending (oldest first)
  return newComments.sort((a, b) => a.id - b.id);
}

/**
 * Extract user answers from new comments
 * Parses patterns like:
 * - Q1: answer text
 * - Answer to question 1: text
 * - [x] Question 2 answer
 * @param {Array} comments - New comments
 * @returns {Array} Parsed answers
 */
export function parseUserAnswers(comments) {
  const answers = [];

  for (const comment of comments) {
    // Skip bot comments (comments from github-actions[bot])
    if (
      comment.user.type === "Bot" ||
      comment.user.login === "github-actions[bot]"
    ) {
      continue;
    }

    // Parse answer content
    const body = comment.body;
    const answer = {
      commentId: comment.id,
      user: comment.user.login,
      body: body,
      timestamp: comment.created_at,
    };

    answers.push(answer);
  }

  return answers;
}
```

### Pattern 3: Requirements Questions and Answer Parsing

**What:** Post structured questions and parse user answers
**When to use:** Initial requirements gathering and subsequent answer collection
**Example:**

```javascript
// src/milestone/requirements.js
const DEFAULT_QUESTIONS = [
  {
    id: "scope",
    question: "What is the primary goal of this milestone?",
    format: "freeform",
    required: true,
  },
  {
    id: "features",
    question: "What are the key features or deliverables?",
    format: "list",
    required: true,
  },
  {
    id: "constraints",
    question: "Are there any technical constraints or requirements?",
    format: "freeform",
    required: false,
  },
  {
    id: "timeline",
    question: "What is the expected timeline?",
    format: "freeform",
    required: false,
  },
];

/**
 * Format requirements questions for posting
 * @param {Array} questions - Question objects
 * @param {object} existingAnswers - Previously answered questions
 * @returns {string} Markdown-formatted questions
 */
export function formatRequirementsQuestions(questions, existingAnswers = {}) {
  let markdown = `## Requirements Gathering\n\n`;

  markdown += `Please answer the following questions to help plan this milestone. `;
  markdown += `Reply with your answers and I'll continue gathering until we have everything needed.\n\n`;

  markdown += `---

### Questions

`;

  for (const q of questions) {
    const existing = existingAnswers[q.id];
    const status = existing ? ":white_check_mark:" : ":hourglass:";
    const answeredText = existing ? " *(answered)*" : "";

    markdown += `#### ${status} ${q.question}${answeredText}\n\n`;

    if (existing) {
      markdown += `> ${existing}\n\n`;
    }
  }

  markdown += `---

**Reply with your answers** (answer the questions marked with :hourglass:).\n`;

  return markdown;
}

/**
 * Parse user response into structured answers
 * @param {string} body - User's comment body
 * @param {Array} questions - Question definitions
 * @returns {object} Answers keyed by question ID
 */
export function parseAnswersFromResponse(body, questions) {
  const answers = {};

  // Split body into paragraphs/lines
  const lines = body.split(/\n+/).filter((line) => line.trim());

  // Try to match Q: or Question # patterns
  const questionPatterns = questions.map((q) => ({
    id: q.id,
    patterns: [
      new RegExp(`(?:Q${q.id}|Question\\s*${q.id}|${q.id}[:\\s]*)`, "i"),
      new RegExp(`(?:Q\\s*${q.id}|${q.id}[:\\s]*)`, "i"),
    ],
  }));

  // Simple parsing: assume each paragraph answers the next pending question
  let currentQuestionIndex = 0;
  const pendingQuestions = questions.filter((q) => !answers[q.id]);

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Skip checkboxes and question headers
    if (line.match(/^[-*]\s*\[\s*\]/) || line.match(/^###?\s*Q\d+/i)) {
      continue;
    }

    // Try to detect if this line is an answer (not a question)
    if (currentQuestionIndex < pendingQuestions.length) {
      const q = pendingQuestions[currentQuestionIndex];

      // Check if line starts with this question's ID pattern
      for (const pattern of questionPatterns.find((p) => p.id === q.id)
        ?.patterns || []) {
        const match = line.match(pattern);
        if (match) {
          // Remove the question prefix from the answer
          const answer = line.replace(pattern, "").trim();
          if (answer) {
            answers[q.id] = answer;
          }
          currentQuestionIndex++;
          break;
        }
      }
    }
  }

  // Also try to match checkbox answers: - [x] Answer text
  const checkboxPattern = /^[-*]\s*\[\s*x\s*\]\s*(.+)$/i;
  for (const line of lines) {
    const match = line.match(checkboxPattern);
    if (match) {
      // This is harder to map to questions without more context
      // Could use position in list or additional patterns
    }
  }

  return answers;
}
```

### Pattern 4: Create Planning Documents

**What:** Create PROJECT.md, STATE.md, and ROADMAP.md files
**When to use:** Initial milestone creation workflow
**Example:**

```javascript
// src/milestone/planning-docs.js
import fs from "node:fs/promises";
import * as core from "@actions/core";

/**
 * Create all planning documents for a milestone
 * @param {object} milestoneData - Milestone context
 * @returns {object} Created files map
 */
export async function createPlanningDocs(milestoneData) {
  const { owner, repo, milestoneNumber, requirements, phases } = milestoneData;
  const planningDir = `.github/planning/milestones/${milestoneNumber}`;
  const files = {};

  // Create directory structure
  await fs.mkdir(planningDir, { recursive: true });
  await fs.mkdir(`${planningDir}/phases`, { recursive: true });

  // Create PROJECT.md
  const projectContent = generateProjectMarkdown(milestoneData);
  const projectPath = `${planningDir}/PROJECT.md`;
  await fs.writeFile(projectPath, projectContent);
  files.project = { path: projectPath, purpose: "Milestone context and goals" };
  core.info(`Created ${projectPath}`);

  // Create STATE.md
  const stateContent = generateStateMarkdown(milestoneData);
  const statePath = `${planningDir}/STATE.md`;
  await fs.writeFile(statePath, stateContent);
  files.state = { path: statePath, purpose: "Milestone number and status" };
  core.info(`Created ${statePath}`);

  // Create ROADMAP.md
  const roadmapContent = generateRoadmapMarkdown(milestoneData);
  const roadmapPath = `${planningDir}/ROADMAP.md`;
  await fs.writeFile(roadmapPath, roadmapContent);
  files.roadmap = { path: roadmapPath, purpose: "Phase structure" };
  core.info(`Created ${roadmapPath}`);

  return files;
}

/**
 * Generate PROJECT.md content
 */
function generateProjectMarkdown(data) {
  const { milestoneNumber, title, goal, scope, features } = data;

  return `# Milestone ${milestoneNumber}: ${title}

**Created:** ${new Date().toISOString()}
**Status:** Planning

## Goal

${goal}

## Scope

${scope || "To be defined during requirements gathering."}

## Key Features

${features ? features.map((f) => `- ${f}`).join("\n") : "- To be defined"}

## Requirements Summary

${JSON.stringify(data.requirements || {}, null, 2)}

---
*This file is part of the GSD milestone planning process.*
`;
}

/**
 * Generate STATE.md content
 */
function generateStateMarkdown(data) {
  const { milestoneNumber, status, phases } = data;

  return `# Milestone ${milestoneNumber} State

**Milestone:** ${milestoneNumber}
**Status:** ${status || "planning"}
**Last Updated:** ${new Date().toISOString()}

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
${phases ? phases.map((p, i) => `| ${String(i + 1).padStart(2, "0")} | ${p.name} | ${p.status || "pending"} |`).join("\n") : "|   | (none defined) | pending |"}

## Requirements Gathering

**Status:** ${data.requirements?.complete ? "Complete" : "In Progress"}
**Questions Answered:** ${data.requirements?.answered?.length || 0}
**Questions Pending:** ${data.requirements?.pending?.length || 0}

## Workflow

**Started:** ${data.createdAt || new Date().toISOString()}
**Last Run:** ${data.lastRunAt || "N/A"}
**Run Count:** ${data.runCount || 1}

---
*State file for GSD milestone tracking.*
`;
}

/**
 * Generate ROADMAP.md content
 */
function generateRoadmapMarkdown(data) {
  const { milestoneNumber, phases, totalPhases } = data;

  return `# Milestone ${milestoneNumber} Roadmap

**Total Phases:** ${totalPhases || phases?.length || 0}

## Phase Structure

${
  phases
    ? phases
        .map(
          (p, i) => `### Phase ${i + 1}: ${p.name}

- **Status:** ${p.status || "pending"}
- **Goal:** ${p.goal || "To be defined"}
- **Dependencies:** ${p.dependencies || "None"}
`,
        )
        .join("\n")
    : "Phases will be defined during planning."
}

## Execution Order

1. Phase 1: Foundation Setup
2. Phase 2: Core Implementation
3. Phase 3: Integration
4. Phase 4: Testing & Verification

## Notes

- Each phase is implemented in its own branch
- Planning documents are created before implementation
- Requirements are gathered before detailed planning

---
*This roadmap guides milestone execution.*
`;
}
```

### Pattern 5: Commit All Planning Docs

**What:** Commit all created files to the milestone branch
**When to use:** After creating all planning documents
**Example:**

```javascript
// src/milestone/index.js
import { runGitCommand, configureGitIdentity } from "../git/git.js";
import { createMilestoneBranch } from "../git/branches.js";
import * as core from "@actions/core";

/**
 * Commit all planning documents to milestone branch
 * @param {number} milestoneNumber - Milestone number
 * @param {Array} filePaths - Array of file paths to commit
 * @param {string} commitMessage - Commit message
 */
export async function commitPlanningDocs(
  milestoneNumber,
  filePaths,
  commitMessage,
) {
  // Ensure git identity is configured
  await configureGitIdentity(
    "github-actions[bot]",
    "41898282+github-actions[bot]@users.noreply.github.com",
  );

  // Create milestone branch if it doesn't exist
  await createMilestoneBranch(milestoneNumber);

  // Stage all planning files
  for (const path of filePaths) {
    await runGitCommand(`git add "${path}"`);
    core.info(`Staged ${path}`);
  }

  // Commit
  await runGitCommand(`git commit -m "${commitMessage}"`);

  core.info(
    `Committed ${filePaths.length} planning files to gsd/${milestoneNumber}`,
  );
}
```

### Pattern 6: Summary Comment with Next Steps

**What:** Post summary of created files and next steps
**When to use:** After completing milestone initialization
**Example:**

```javascript
// src/milestone/summarizer.js

/**
 * Generate summary comment for milestone creation
 * @param {object} data - Milestone creation data
 * @returns {string} Markdown-formatted summary
 */
export function generateMilestoneSummary(data) {
  const { milestoneNumber, files, requirements, nextSteps } = data;

  return `## Milestone ${milestoneNumber} Created

**Status:** ${data.status || "Requirements Gathering"}

### Files Created

| File | Purpose |
|------|---------|
${files ? files.map((f) => `| \`${f.path}\` | ${f.purpose} |`).join("\n") : "| (none) | |"}

### Requirements Status

${
  requirements?.complete
    ? ":white_check_mark: All requirements gathered"
    : `:hourglass: ${requirements?.pending?.length || "Some"} questions pending`
}

### Next Steps

${nextSteps ? nextSteps.map((step, i) => `${i + 1}. ${step}`).join("\n") : "1. Answer requirements questions in comments\n2. I'll continue planning once all questions are answered"}

---

**Branch:** \`gsd/${milestoneNumber}\`

*This milestone was created by GSD Bot. Reply to continue requirements gathering.*

`;
}
```

### Anti-Patterns to Avoid

- **Storing state in workflow variables:** Workflow variables don't persist between runs; use file-based state in the repository
- **Using comment timestamps for ordering:** Timestamps can have precision issues; use comment IDs which are monotonically increasing
- **Posting questions one at a time:** Post all pending questions in bulk to minimize workflow runs
- **Not filtering bot comments:** Always skip comments from github-actions[bot] when reading user responses
- **Creating files via REST API only:** Create files locally with `fs`, then commit via git for better branch handling
- **Hardcoding requirements questions:** Make questions extensible via config file

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                        | Don't Build                            | Use Instead                               | Why                                                                 |
| ------------------------------ | -------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| Pagination for comment list    | Custom fetch loop with page params     | `octokit.paginate()`                      | Handles all edge cases, rate limits, and is official recommendation |
| Base64 encoding for API        | Custom implementation                  | `Buffer.from(content).toString('base64')` | Node.js built-in, handles encoding correctly                        |
| File create/update with SHA    | Conditional logic for create vs update | `createOrUpdateFileContents` API          | Handles both cases; just pass sha for update                        |
| Comment ordering               | Timestamp comparison                   | Comment ID comparison                     | IDs are monotonically increasing integers                           |
| State persistence between runs | External database                      | Repository files (STATE.md)               | Matches "All state stored in repository files" decision             |
| Multi-line text in JSON        | Manual escaping                        | JSON.stringify with proper options        | Handles all edge cases                                              |

**Key insight:** GitHub's REST API (octokit) and Node.js built-ins (Buffer, fs) provide robust solutions for all file and API operations. Custom implementations miss edge cases around pagination, encoding, and state management.

## Common Pitfalls

### Pitfall 1: State Not Persisting Between Runs

**What goes wrong:** Requirements gathering progress is lost between workflow runs
**Why it happens:** GitHub Actions doesn't have built-in state persistence; workflow runs are isolated
**How to avoid:** Store all state in repository files (STATE.md) that are committed alongside planning docs
**Warning signs:** Requirements start from scratch on each run, "questions already answered" are shown again

### Pitfall 2: Reading Bot Comments as User Answers

**What goes wrong:** Bot's own comments are parsed as user answers, causing infinite loops
**Why it happens:** Not filtering comments by user type or ID
**How to avoid:** Skip comments from github-actions[bot] or comments with ID <= last processed ID
**Warning signs:** Bot responding to itself, escalating requirements status incorrectly

### Pitfall 3: Comment Order Issues

**What goes wrong:** New comments are processed in wrong order, causing answers to map to wrong questions
**Why it happens:** Relying on timestamps which can have precision issues or be affected by timezones
**How to avoid:** Use comment IDs which are monotonically increasing; store last processed ID in state
**Warning signs:** Answers mapping to wrong questions, duplicate processing of comments

### Pitfall 4: File Encoding Issues

**What goes wrong:** Files created via Contents API have encoding issues or are rejected
**Why it happens:** Not properly encoding content as base64, or encoding multiple times
**How to avoid:** Use `Buffer.from(content).toString('base64')` exactly once
**Warning signs:** API errors about content encoding, files with garbled content

### Pitfall 5: Large Comment Thread Performance

**What goes wrong:** Slow performance when issue has many comments
**Why it happens:** Fetching all comments on each run without filtering
**How to avoid:** Use `since` parameter to filter by date, or track last processed ID to only fetch new comments
**Warning signs:** Long workflow execution times, rate limit warnings

### Pitfall 6: Branch Conflict on Re-run

**What goes wrong:** Workflow fails when re-running because branch already exists
**Why it happens:** `git switch -c` fails if branch exists
**How to avoid:** Check if branch exists first, or use `git switch` (without -c) to switch to existing branch
**Warning signs:** "A branch named 'X' already exists" errors on re-run

## Code Examples

### Complete Milestone Workflow Orchestrator

```javascript
// src/milestone/index.js
import * as core from "@actions/core";
import * as github from "@actions/github";
import { postComment, getWorkflowRunUrl } from "../lib/github.js";
import { formatErrorComment } from "../errors/formatter.js";
import { createMilestoneBranch } from "../git/branches.js";
import { loadState, saveState } from "./state.js";
import { createPlanningDocs } from "./planning-docs.js";
import {
  formatRequirementsQuestions,
  parseUserAnswers,
  parseAnswersFromResponse,
} from "./requirements.js";
import { generateMilestoneSummary } from "./summarizer.js";

/**
 * Execute the complete milestone creation workflow
 * @param {object} context - GitHub action context
 * @param {string} commandArgs - Command arguments
 */
export async function executeMilestoneWorkflow(context, commandArgs) {
  const { owner, repo, issueNumber } = context;
  const workflowUrl = getWorkflowRunUrl();

  // Parse milestone number from arguments
  const milestoneNumber = parseMilestoneNumber(commandArgs);

  // Load existing state or create new
  let state = await loadState(owner, repo, milestoneNumber);

  // Increment run count
  state.workflow.runCount++;
  state.workflow.lastRunAt = new Date().toISOString();

  // Get new user comments since last run
  const lastProcessedId = state.workflow.lastCommentId || 0;
  const newComments = await getNewComments(
    owner,
    repo,
    issueNumber,
    lastProcessedId,
  );

  // Parse user answers from new comments
  const userAnswers = parseUserAnswers(newComments);

  if (userAnswers.length > 0) {
    // Merge new answers into state
    for (const answer of userAnswers) {
      const parsedAnswers = parseAnswersFromResponse(
        answer.body,
        DEFAULT_QUESTIONS,
      );
      Object.assign(state.requirements.answered, parsedAnswers);

      // Update pending/answered lists
      for (const [qId, answerText] of Object.entries(parsedAnswers)) {
        state.requirements.pending = state.requirements.pending.filter(
          (q) => q !== qId,
        );
        if (!state.requirements.answered.includes(qId)) {
          state.requirements.answered.push(qId);
        }
      }

      // Update last processed comment ID
      state.workflow.lastCommentId = answer.commentId;
    }
  }

  // Check if requirements gathering is complete
  const allRequiredAnswered = DEFAULT_QUESTIONS.filter((q) => q.required).every(
    (q) => state.requirements.answered.includes(q.id),
  );

  if (!allRequiredAnswered) {
    // Post pending questions
    const questionsMarkdown = formatRequirementsQuestions(
      DEFAULT_QUESTIONS,
      state.requirements.answered,
    );

    await postComment(owner, repo, issueNumber, questionsMarkdown);

    // Save state
    await saveState(owner, repo, milestoneNumber, state);

    return {
      complete: false,
      phase: "requirements-gathering",
      message: "Waiting for user answers",
    };
  }

  // Requirements complete - create planning documents
  state.status = "planning";
  state.requirements.complete = true;

  const milestoneData = {
    milestoneNumber,
    title: state.requirements.answered.title || `Milestone ${milestoneNumber}`,
    goal: state.requirements.answered.scope,
    features: state.requirements.answered.features?.split("\n"),
    scope: state.requirements.answered.constraints,
    requirements: state,
    phases: generatePhasesFromRequirements(state.requirements.answered),
  };

  // Create planning documents
  const files = await createPlanningDocs(milestoneData);

  // Commit to branch
  await createMilestoneBranch(milestoneNumber);
  const filePaths = Object.values(files).map((f) => f.path);
  await commitPlanningDocs(
    milestoneNumber,
    filePaths,
    `docs(m${milestoneNumber}): Create initial planning documents

- PROJECT.md: Milestone context and goals
- STATE.md: Milestone status tracking
- ROADMAP.md: Phase structure

Generated by GSD Bot`,
  );

  // Save final state
  await saveState(owner, repo, milestoneNumber, state);

  // Post summary comment
  const summary = generateMilestoneSummary({
    milestoneNumber,
    files: Object.values(files),
    requirements: {
      complete: true,
      answered: state.requirements.answered,
      pending: [],
    },
    nextSteps: [
      "Review planning documents",
      "Use `@gsd-bot plan-phase` to plan each phase",
      "Use `@gsd-bot execute-phase` to execute planned work",
    ],
  });

  await postComment(owner, repo, issueNumber, summary);

  return {
    complete: true,
    phase: "milestone-created",
    files: Object.keys(files),
  };
}
```

### State File Format (STATE.md)

```markdown
# Milestone 1 State

**Milestone:** 1
**Status:** planning
**Last Updated:** 2026-01-22T10:30:00.000Z

## Requirements

**Complete:** true
**Questions Answered:** ["scope", "features", "constraints"]

### Answer Details

| Question ID | Answer                                            |
| ----------- | ------------------------------------------------- |
| scope       | Build user authentication system                  |
| features    | Login, logout, session management, password reset |
| constraints | Use existing database schema                      |

## Workflow

**Started:** 2026-01-22T10:00:00.000Z
**Last Run:** 2026-01-22T10:30:00.000Z
**Run Count:** 3
**Last Comment ID:** 123456789

## Phase Status

| Phase | Name       | Status  |
| ----- | ---------- | ------- |
| 01    | Foundation | pending |
| 02    | Core Auth  | pending |
| 03    | Sessions   | pending |
```

## State of the Art

| Old Approach                    | Current Approach            | When Changed    | Impact                                                    |
| ------------------------------- | --------------------------- | --------------- | --------------------------------------------------------- |
| External database for state     | File-based state (STATE.md) | v1 (this phase) | Simpler architecture, no external dependencies            |
| Single-run requirements         | Multi-run with state file   | v1 (this phase) | Better user experience, no pressure to answer all at once |
| Comments API without pagination | octokit.paginate            | v1 (this phase) | Handles large comment threads correctly                   |
| Git checkout for branches       | Git switch                  | Git 2.23 (2019) | Safer branch operations                                   |

**Deprecated/outdated:**

- **Global state storage:** Use repository files only for v1
- **Single-pass comment parsing:** Use ID-based tracking for multi-run workflows
- **Hardcoded requirements:** Make questions configurable via config file

## Open Questions

1. **Requirements Satisfaction Criteria**
   - What we know: Some questions marked as required, others optional
   - What's unclear: What triggers "requirements complete" - all required answered, or user confirmation?
   - Recommendation: Use all required questions answered as threshold, with option for user to say "that's all"

2. **Phase Structure Generation**
   - What we know: Need to generate ROADMAP.md with phase structure
   - What's unclear: Should phases be auto-generated from requirements or user-defined?
   - Recommendation: Generate initial phases from requirements, allow user refinement

3. **Comment Formatting for Answers**
   - What we know: Users can reply with freeform text
   - What's unclear: Best format for structured answers vs freeform
   - Recommendation: Support both; use question ID prefix when detected, fall back to paragraph order

4. **Error Recovery on State Corruption**
   - What we know: State file could become corrupted or invalid
   - What's unclear: How to detect and recover from bad state
   - Recommendation: Validate state on load; if invalid, start fresh with warning comment

## Sources

### Primary (HIGH confidence)

- [Octokit REST API Documentation](https://octokit.github.io/rest.js/v20) - Issues and comments API
- [GitHub REST API: Contents](https://docs.github.com/en/rest/repos/contents) - File creation/update
- [GitHub Actions Events: issue_comment](https://docs.github.com/en/actions/learn-github-actions/events-that-trigger-workflows) - Event triggering
- [GitHub Actions Contexts](https://docs.github.com/en/actions/learn-github-actions/contexts) - github.event structure
- [GitHub Actions Concurrency](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#concurrency) - Concurrency groups

### Secondary (MEDIUM confidence)

- [Node.js Buffer Documentation](https://nodejs.org/api/buffer.html) - Base64 encoding
- [Git Documentation: git-branch](https://git-scm.com/docs/git-branch) - Branch creation

### Tertiary (LOW confidence)

- Community patterns for multi-turn GitHub Actions workflows (no single authoritative source)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All from official GitHub documentation and Node.js built-ins
- Architecture: HIGH - Patterns verified with official API docs
- Pitfalls: HIGH - Common GitHub Actions patterns documented
- State management: MEDIUM - File-based approach is standard but specific format is project decision
- Multi-run patterns: MEDIUM - Standard approach but needs validation in practice

**Research date:** 2026-01-22
**Valid until:** 2026-02-21 (30 days - GitHub REST API and Actions are stable)

**Key decisions made in this research:**

1. Use STATE.md file for multi-run state persistence
2. Track comment IDs to distinguish new user comments from bot comments
3. Post all pending questions in bulk format
4. Use octokit.paginate for fetching all comments
5. Create files locally with fs, commit via git for branch support
