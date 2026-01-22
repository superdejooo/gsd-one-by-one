/**
 * State Management Module
 * Persists requirements gathering progress across workflow runs using STATE.md files
 */

import * as github from "@actions/github";
import * as core from "@actions/core";

/**
 * STATE_FILE path pattern
 * @constant
 */
const STATE_FILE = ".github/planning/milestones/{n}/STATE.md";

/**
 * Parse state content from STATE.md file
 * Extracts key information from markdown format
 * @param {string} content - Raw STATE.md content
 * @returns {object} Parsed state object
 */
export function parseStateMarkdown(content) {
  const state = {
    milestone: null,
    status: "planning",
    createdAt: null,
    lastRunAt: null,
    runCount: 0,
    lastCommentId: 0,
    requirements: {
      complete: false,
      answered: {},
      pending: []
    },
    phases: []
  };

  const lines = content.split('\n');
  let currentSection = '';

  for (const line of lines) {
    // Detect section headers
    if (line.startsWith('## ')) {
      currentSection = line.replace('## ', '').trim();
      continue;
    }

    // Parse key-value pairs from the header section
    const keyValueMatch = line.match(/\*\*([^*]+):\*\* (.+)/);
    if (keyValueMatch) {
      const key = keyValueMatch[1].trim();
      const value = keyValueMatch[2].trim();

      switch (key) {
        case 'Milestone':
          state.milestone = parseInt(value, 10);
          break;
        case 'Status':
          state.status = value;
          break;
        case 'Started':
          state.createdAt = value;
          break;
        case 'Last Run':
          state.lastRunAt = value;
          break;
        case 'Run Count':
          state.runCount = parseInt(value, 10) || 0;
          break;
        case 'Last Comment ID':
          state.lastCommentId = parseInt(value, 10) || 0;
          break;
      }
    }

    // Parse requirements status in Requirements Gathering section
    if (currentSection === 'Requirements Gathering') {
      if (line.startsWith('**Status:**')) {
        const statusText = line.replace('**Status:**', '').trim();
        state.requirements.complete = statusText === 'Complete';
      }
      if (line.startsWith('**Questions Answered:**')) {
        // Parse answered count - we'll need to update answered array from elsewhere
      }
    }
  }

  return state;
}

/**
 * Generate STATE.md content from state object
 * Compatible with generateStateMarkdown in planning-docs.js
 * @param {object} state - State object
 * @param {Array} phases - Phase definitions
 * @returns {string} Markdown content
 */
export function generateStateMarkdown(state, phases = []) {
  const {
    milestone,
    status,
    createdAt,
    lastRunAt,
    runCount,
    requirements
  } = state;

  const phaseRows = phases.length > 0
    ? phases.map((p, i) => {
        const phaseNum = String(i + 1).padStart(2, '0');
        const phaseName = p.name || "Unnamed Phase";
        const phaseStatus = p.status || "pending";
        return `| ${phaseNum} | ${phaseName} | ${phaseStatus} |`;
      }).join('\n')
    : "|   | (none defined) | pending |";

  const reqStatus = requirements?.complete ? "Complete" : "In Progress";
  const answeredCount = Object.keys(requirements?.answered || {}).length;
  const pendingCount = requirements?.pending?.length || 0;

  return `# Milestone ${milestone} State

**Milestone:** ${milestone}
**Status:** ${status || "planning"}
**Last Updated:** ${new Date().toISOString()}

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
${phaseRows}

## Requirements Gathering

**Status:** ${reqStatus}
**Questions Answered:** ${answeredCount}
**Questions Pending:** ${pendingCount}

## Workflow

**Started:** ${createdAt || "N/A"}
**Last Run:** ${lastRunAt || "N/A"}
**Run Count:** ${runCount || 1}

---
*State file for GSD milestone tracking.*
`;
}

/**
 * Create initial state for a new milestone
 * @param {number} milestoneNumber - Milestone number
 * @returns {object} Initial state object
 */
export function createInitialState(milestoneNumber) {
  const now = new Date().toISOString();

  return {
    milestone: milestoneNumber,
    status: "requirements-gathering",
    createdAt: now,
    lastRunAt: null,
    runCount: 0,
    lastCommentId: 0,
    requirements: {
      complete: false,
      answered: {},
      pending: []
    },
    workflow: {
      startedAt: now,
      lastRunAt: null,
      runCount: 0,
      lastCommentId: 0
    },
    phases: []
  };
}

/**
 * Load state from STATE.md file via GitHub Contents API
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} milestoneNumber - Milestone number
 * @returns {Promise<object>} State object
 */
export async function loadState(owner, repo, milestoneNumber) {
  const token = core.getInput("token") || process.env.GITHUB_TOKEN;
  const octokit = github.getOctokit(token);
  const path = STATE_FILE.replace("{n}", milestoneNumber);

  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path
    });

    const content = Buffer.from(response.data.content, "base64").toString("utf-8");
    const state = parseStateMarkdown(content);

    core.info(`Loaded state for milestone ${milestoneNumber} from ${path}`);
    return state;
  } catch (error) {
    if (error.status === 404) {
      core.info(`State file not found for milestone ${milestoneNumber}, creating initial state`);
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
 * @param {Array} phases - Phase definitions (optional)
 * @returns {Promise<void>}
 */
export async function saveState(owner, repo, milestoneNumber, state, phases = []) {
  const token = core.getInput("token") || process.env.GITHUB_TOKEN;
  const octokit = github.getOctokit(token);
  const path = STATE_FILE.replace("{n}", milestoneNumber);
  const content = generateStateMarkdown(state, phases);
  const encodedContent = Buffer.from(content).toString("base64");

  // Get current file SHA for update (or null for create)
  let sha = null;
  try {
    const existing = await octokit.rest.repos.getContent({
      owner,
      repo,
      path
    });
    sha = existing.data.sha;
  } catch (error) {
    if (error.status !== 404) throw error;
    // File doesn't exist, sha remains null for create
  }

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: `chore: Update milestone ${milestoneNumber} state`,
    content: encodedContent,
    sha: sha // Omit for create, include for update
  });

  core.info(`State saved to ${path}`);
}

/**
 * Check if all required questions have been answered
 * @param {object} state - State object
 * @param {Array<{id: string, required: boolean}>} questions - Question definitions
 * @returns {boolean} True if all required questions are answered
 */
export function isRequirementsComplete(state, questions) {
  const { answered, complete } = state.requirements;

  // If explicitly marked complete, trust that
  if (complete) {
    return true;
  }

  // Check if all required questions have answers
  const requiredQuestions = questions.filter(q => q.required);
  const allRequiredAnswered = requiredQuestions.every(q => answered[q.id]);

  return allRequiredAnswered;
}

/**
 * Update state with a new answer
 * @param {object} state - State object to update
 * @param {string} questionId - Question identifier
 * @param {string} answer - Answer text
 * @param {number} commentId - GitHub comment ID
 * @returns {object} Updated state
 */
export function updateRequirementsAnswer(state, questionId, answer, commentId) {
  // Add to answered
  state.requirements.answered[questionId] = answer;

  // Remove from pending if present
  state.requirements.pending = state.requirements.pending.filter(q => q !== questionId);

  // Update last comment ID
  state.workflow.lastCommentId = commentId;

  return state;
}

/**
 * Initialize pending questions list from question definitions
 * @param {object} state - State object
 * @param {Array<{id: string}>} questions - Question definitions
 * @returns {object} Updated state
 */
export function initializePendingQuestions(state, questions) {
  state.requirements.pending = questions.map(q => q.id);
  return state;
}

/**
 * Update workflow metadata (run count, last run time)
 * @param {object} state - State object
 * @returns {object} Updated state
 */
export function updateWorkflowRun(state) {
  state.workflow = state.workflow || {
    startedAt: state.createdAt,
    runCount: 0,
    lastRunAt: null,
    lastCommentId: state.lastCommentId || 0
  };

  state.workflow.runCount++;
  state.workflow.lastRunAt = new Date().toISOString();

  return state;
}

/**
 * Mark requirements as complete
 * @param {object} state - State object
 * @returns {object} Updated state
 */
export function markRequirementsComplete(state) {
  state.requirements.complete = true;
  state.status = "planning";
  return state;
}
