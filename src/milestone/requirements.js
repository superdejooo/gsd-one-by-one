/**
 * Requirements gathering module for milestone creation workflow
 *
 * Provides functionality to:
 * - Fetch new comments from GitHub issues
 * - Parse user answers from comments
 * - Format requirements questions for posting
 * - Parse answers from user responses
 */

import * as github from "@actions/github";
import * as core from "@actions/core";

/**
 * Default requirements questions for milestone creation
 * @constant
 * @type {Array<{id: string, question: string, required: boolean}>}
 */
export const DEFAULT_QUESTIONS = [
  {
    id: "scope",
    question: "What is the primary goal of this milestone?",
    required: true
  },
  {
    id: "features",
    question: "What are the key features or deliverables?",
    required: true
  },
  {
    id: "constraints",
    question: "Are there any technical constraints or requirements?",
    required: false
  },
  {
    id: "timeline",
    question: "What is the expected timeline?",
    required: false
  }
];

/**
 * Check if a comment is from a bot
 * @param {object} comment - GitHub comment object
 * @returns {boolean} True if comment is from a bot
 */
function isBotComment(comment) {
  const user = comment.user;

  // Check for github-actions[bot]
  if (user.login === "github-actions[bot]") {
    return true;
  }

  // Check for generic bot type
  if (user.type === "Bot") {
    return true;
  }

  return false;
}

/**
 * Get new comments since the last processed comment ID
 *
 * Fetches all comments for an issue, filters to only new comments
 * (those with ID greater than lastProcessedId), and excludes bot comments.
 *
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {number} lastProcessedId - ID of the last processed comment (default: 0)
 * @returns {Promise<Array<object>>} New human comments, sorted by ID ascending
 */
export async function getNewComments(owner, repo, issueNumber, lastProcessedId = 0) {
  const token = core.getInput("token") || process.env.GITHUB_TOKEN;
  const octokit = github.getOctokit(token);

  // Fetch all comments using pagination
  const comments = await octokit.paginate(
    octokit.rest.issues.listComments,
    {
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100
    }
  );

  // Filter to only new comments (higher ID = newer)
  const newComments = comments.filter(c => c.id > lastProcessedId);

  // Filter out bot comments
  const humanComments = newComments.filter(c => !isBotComment(c));

  // Sort by ID ascending (oldest first)
  return humanComments.sort((a, b) => a.id - b.id);
}

/**
 * Parse user answers from comment objects
 *
 * Extracts human responses from a list of comments, filtering out
 * any bot comments and returning structured answer objects.
 *
 * @param {Array<object>} comments - Array of GitHub comment objects
 * @returns {Array<{commentId: number, user: string, body: string, timestamp: string}>}
 *   Array of parsed user answers
 */
export function parseUserAnswers(comments) {
  const answers = [];

  for (const comment of comments) {
    // Skip bot comments
    if (isBotComment(comment)) {
      continue;
    }

    // Parse answer content
    const answer = {
      commentId: comment.id,
      user: comment.user.login,
      body: comment.body,
      timestamp: comment.created_at
    };

    answers.push(answer);
  }

  return answers;
}

/**
 * Format requirements questions as markdown for posting
 *
 * Creates a formatted markdown block showing all questions with status icons:
 * - :white_check_mark: for answered questions
 * - :hourglass: for pending questions
 *
 * Existing answers are shown in blockquotes.
 *
 * @param {Array<{id: string, question: string, required: boolean}>} questions - Question definitions
 * @param {object} existingAnswers - Map of question ID to answer text
 * @returns {string} Markdown-formatted questions
 */
export function formatRequirementsQuestions(questions, existingAnswers = {}) {
  let markdown = `## Requirements Gathering\n\n`;

  markdown += `Please answer the following questions to help plan this milestone. `;
  markdown += `Reply with your answers and I'll continue gathering until we have everything needed.\n\n`;

  markdown += `---\n\n### Questions\n\n`;

  for (const q of questions) {
    const existing = existingAnswers[q.id];
    const status = existing ? ":white_check_mark:" : ":hourglass:";
    const answeredText = existing ? " *(answered)*" : "";

    markdown += `#### ${status} ${q.question}${answeredText}\n\n`;

    if (existing) {
      markdown += `> ${existing}\n\n`;
    }
  }

  markdown += `---\n\n**Reply with your answers** (answer the questions marked with :hourglass:).\n`;

  return markdown;
}

/**
 * Parse user response into structured answers
 *
 * Supports two parsing strategies:
 * 1. Q: prefix patterns (e.g., "Q: scope: Build auth")
 * 2. Paragraph order fallback (each paragraph maps to next pending question)
 *
 * @param {string} body - User's comment body
 * @param {Array<{id: string, question: string}>} questions - Question definitions
 * @param {object} existingAnswers - Previously collected answers (optional)
 * @returns {object} Answers keyed by question ID
 */
export function parseAnswersFromResponse(body, questions, existingAnswers = {}) {
  const answers = {};

  // Split body into paragraphs/lines
  const lines = body.split(/\n+/).filter(line => line.trim());

  // Build patterns for each question
  const questionPatterns = questions.map(q => ({
    id: q.id,
    patterns: [
      new RegExp(`(?:Q${q.id}|Question\\s*${q.id}|${q.id}[:\\s]*)`, 'i'),
      new RegExp(`(?:Q\\s*${q.id}|${q.id}[:\\s]*)`, 'i')
    ]
  }));

  // Track which questions have been answered
  const answeredIds = new Set(Object.keys(existingAnswers || {}));
  const pendingQuestions = questions.filter(q => !answeredIds.has(q.id));

  // Current position in pending questions
  let currentQuestionIndex = 0;

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Skip checkboxes and question headers
    if (line.match(/^[-*]\s*\[\s*\]/) || line.match(/^###?\s*Q\d+/i)) {
      continue;
    }

    // Try to match a question prefix
    let matched = false;

    for (const qPattern of questionPatterns) {
      for (const pattern of qPattern.patterns) {
        const match = line.match(pattern);
        if (match) {
          // Remove the question prefix from the answer
          const answer = line.replace(pattern, '').trim();
          if (answer) {
            answers[qPattern.id] = answer;
          }
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    // If no prefix matched and we have pending questions, use order-based parsing
    if (!matched && currentQuestionIndex < pendingQuestions.length) {
      const q = pendingQuestions[currentQuestionIndex];

      // Skip if this line looks like a header or list item
      if (line.match(/^[-*]\s+/) || line.match(/^\d+\.\s+/)) {
        continue;
      }

      answers[q.id] = line.trim();
      currentQuestionIndex++;
    }
  }

  return answers;
}
