# Phase 5 Plan 2: Requirements Gathering Summary

**Plan:** 05-02
**Phase:** 05-milestone-creation-workflow
**Completed:** 2026-01-22
**Duration:** ~3 min
**Commit:** 2782184

## Objective

Create the requirements gathering module that posts questions, reads user answers from comments, and supports multi-turn interaction across workflow runs.

## Deliverables

| File                            | Purpose                      |
| ------------------------------- | ---------------------------- |
| `src/milestone/requirements.js` | Requirements gathering logic |

## Exports

| Export                                                       | Purpose                                     |
| ------------------------------------------------------------ | ------------------------------------------- |
| `getNewComments(owner, repo, issueNumber, lastProcessedId)`  | Fetch new comments since last processed ID  |
| `parseUserAnswers(comments)`                                 | Extract human answers from comments         |
| `formatRequirementsQuestions(questions, existingAnswers)`    | Format questions as markdown                |
| `parseAnswersFromResponse(body, questions, existingAnswers)` | Parse user response into structured answers |
| `DEFAULT_QUESTIONS`                                          | Array of 4 requirement questions            |

## Key Features

**DEFAULT_QUESTIONS:**

1. `scope` - What is the primary goal of this milestone? (required)
2. `features` - What are the key features or deliverables? (required)
3. `constraints` - Are there any technical constraints or requirements? (optional)
4. `timeline` - What is the expected timeline? (optional)

**Bot Comment Filtering:**

- Filters `github-actions[bot]` by login name
- Filters any user with `type === "Bot"` (includes dependabot, Renovate, etc.)

**Question Status Icons:**

- `:white_check_mark:` - Answered questions
- `:hourglass:` - Pending questions

**Answer Parsing:**

- Supports Q: prefix patterns (e.g., "Q: scope: Build auth")
- Fallback to paragraph-order mapping for plain text responses

## Decisions Made

None - implementation followed research patterns exactly.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

| Test                                       | Status |
| ------------------------------------------ | ------ |
| All 5 exports available                    | PASS   |
| DEFAULT_QUESTIONS has 4 questions          | PASS   |
| formatRequirementsQuestions produces icons | PASS   |
| parseAnswersFromResponse extracts answers  | PASS   |
| parseUserAnswers filters bot comments      | PASS   |
| Correct comment IDs captured               | PASS   |

## Dependencies

- `src/lib/github.js` - Uses octokit pagination pattern
- `@actions/github` - GitHub API client
- `@actions/core` - Input/output handling

## Next Steps

This module will be used by `src/milestone/index.js` (Plan 05-03) to:

1. Post requirements questions to the milestone issue
2. Fetch user answers from new comments
3. Parse and store answers in state
4. Continue gathering until all required questions are answered
