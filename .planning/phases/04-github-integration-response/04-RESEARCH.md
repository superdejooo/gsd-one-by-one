# Phase 04: GitHub Integration & Response - Research

**Researched:** 2026-01-22
**Domain:** GitHub API Integration, Git Operations, Error Handling
**Confidence:** HIGH

## Summary

This phase research focuses on enabling GitHub CLI operations for posting comments to issues/PRs, creating milestone and phase branches, configuring git for automated commits, and handling errors with rate limiting. The standard approach uses GitHub REST API via `@actions/github` octokit client for comments, native git commands via `child_process.exec` with promises for branch operations, and `@octokit/plugin-throttling` for automatic rate limit handling with retry logic.

**Primary recommendation:** Use `@actions/github` octokit REST API for all GitHub API operations (comments, issues), native git commands via `child_process.exec` with `util.promisify` for branch operations, `@octokit/plugin-throttling` for rate limit handling, and GitHub Actions core toolkit (`@actions/core`) for error handling and logging. Configure git with local `user.name` and `user.email` before making commits.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @actions/github | Latest | GitHub API client (octokit) | Official GitHub Actions toolkit, provides authenticated octokit instance |
| @actions/core | Latest | Input/output, error handling, logging | Official GitHub Actions toolkit for workflow commands |
| @octokit/plugin-throttling | Latest | Rate limit handling and retry | Official octokit plugin for throttling with recommended best practices |
| child_process (Node.js built-in) | - | Execute git commands | Native Node.js module for shell commands |
| util.promisify (Node.js built-in) | - | Convert callbacks to promises | Built-in utility for async/await pattern |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| git switch | Create and switch branches | Modern approach (Git 2.23+) for branch operations |
| git config set | Configure git user identity | Before making commits in automation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| octokit REST API | GitHub CLI (`gh` commands) | Octokit is more reliable in CI, no need for CLI installation; gh adds dependency |
| child_process.exec | simple-git npm package | simple-git is higher-level but adds dependency; child_process is native and sufficient |
| @octokit/plugin-throttling | Custom retry logic | Plugin implements official GitHub recommendations, handles headers automatically |

**Installation:**
```bash
npm install @octokit/plugin-throttling
# @actions/github and @actions/core already installed from Phase 1
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── index.js                 # Main entry point (exists)
├── lib/                    # Existing utilities
│   ├── parser.js            # Command parsing (exists)
│   ├── config.js            # Config loading (exists)
│   ├── validator.js         # Command validation (exists)
│   └── github.js           # NEW: GitHub API operations
├── git/                    # NEW: Git operations
│   ├── git.js              # Git command wrapper with exec
│   └── branches.js         # Branch creation and management
└── errors/                 # NEW: Error handling
    ├── formatter.js         # Format errors for GitHub comments
    └── handler.js          # Centralized error handling with retry
```

### Pattern 1: GitHub API Client with Throttling
**What:** Initialize octokit with throttling plugin for automatic rate limit handling
**When to use:** All GitHub API operations in the action
**Example:**
```javascript
// Source: https://github.com/octokit/plugin-throttling.js
// Source: @actions/github README
import * as github from "@actions/github";
import { throttling } from "@octokit/plugin-throttling";

// Create octokit instance with throttling
const ThrottledOctokit = github.GitHub.plugin(throttling);
const octokit = new ThrottledOctokit({
  auth: core.getInput("token") || process.env.GITHUB_TOKEN,
  throttle: {
    onRateLimit: (retryAfter, options, octokit, retryCount) => {
      octokit.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`
      );
      if (retryCount < 1) {
        octokit.log.info(`Retrying after ${retryAfter} seconds!`);
        return true; // Retry once
      }
    },
    onSecondaryRateLimit: (retryAfter, options, octokit) => {
      octokit.log.warn(
        `SecondaryRateLimit detected for request ${options.method} ${options.url}`
      );
      // Don't automatically retry secondary limits (user intervention needed)
    },
  },
});
```

### Pattern 2: Post Comment to Issue/PR
**What:** Create markdown-formatted comments via octokit REST API
**When to use:** Responding to user commands, posting success/error messages
**Example:**
```javascript
// Source: https://octokit.github.io/rest.js/v20
async function postIssueComment(owner, repo, issueNumber, body) {
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body
  });
}

// Usage with markdown
await postIssueComment("owner", "repo", 123, `
## Command Completed

Successfully executed the requested command.

**Files modified:**
- src/index.js
- lib/github.js

[View workflow run](https://github.com/owner/repo/actions/runs/123)
`);
```

### Pattern 3: Git Commands with Promises
**What:** Execute git commands asynchronously using `util.promisify`
**When to use:** All git operations (branch creation, commits, config)
**Example:**
```javascript
// Source: https://nodejs.org/api/util.html#utilpromisifyoriginal
import { promisify } from "node:util";
import { exec } from "node:child_process";
import * as core from "@actions/core";

const execAsync = promisify(exec);

async function runGitCommand(command) {
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      core.warning(`Git command warning: ${stderr}`);
    }
    return stdout.trim();
  } catch (error) {
    core.error(`Git command failed: ${command}`);
    core.error(`Exit code: ${error.code}`);
    core.error(`Error: ${error.message}`);
    throw error;
  }
}

// Usage examples
await runGitCommand('git config set user.name "GSD Bot"');
await runGitCommand('git config set user.email "gsd-bot@noreply.github.com"');
```

### Pattern 4: Create and Switch Branch
**What:** Create and switch to new branches using modern `git switch` command
**When to use:** Creating milestone and phase branches
**Example:**
```javascript
// Source: https://git-scm.com/docs/git-switch
async function createAndSwitchBranch(branchName, startPoint = null) {
  // git switch -c creates and switches in one command
  const command = startPoint
    ? `git switch -c ${branchName} ${startPoint}`
    : `git switch -c ${branchName}`;

  await runGitCommand(command);
  core.info(`Created and switched to branch: ${branchName}`);
}

// Examples
await createAndSwitchBranch("gsd/1");                    // Milestone branch
await createAndSwitchBranch("gsd/1-1-user-auth");        // Phase branch from current HEAD
await createAndSwitchBranch("gsd/1-2-sessions", "main"); // Phase branch from main
```

### Pattern 5: Configure Git Identity
**What:** Set local git user.name and user.email before committing
**When to use:** Before making any git commits in automation
**Example:**
```javascript
// Source: https://git-scm.com/docs/git-config
async function configureGitIdentity(name, email) {
  // Use --local (default) to set config only for this repository
  await runGitCommand(`git config set user.name "${name}"`);
  await runGitCommand(`git config set user.email "${email}"`);

  core.info(`Git identity configured: ${name} <${email}>`);
}

// Usage before commits
await configureGitIdentity(
  "github-actions[bot]",
  "41898282+github-actions[bot]@users.noreply.github.com"
);
```

### Pattern 6: Construct Workflow Run URL
**What:** Build clickable workflow run URL from GitHub context
**When to use:** Including workflow run links in error/success comments
**Example:**
```javascript
// Source: https://docs.github.com/en/actions/learn-github-actions/contexts
import * as github from "@actions/github";

function getWorkflowRunUrl() {
  const { server_url, repository, run_id, run_attempt } = github.context;
  return `${server_url}/${repository}/actions/runs/${run_id}/attempts/${run_attempt}`;
}

// Usage in comment body
const commentBody = `
## Execution Complete

**Workflow Run:** [View Details](${getWorkflowRunUrl()})

All tasks completed successfully.
`;
```

### Pattern 7: Structured Error Comment
**What:** Format errors with collapsible stack trace and actionable next steps
**When to use:** Posting error messages to issues/PRs
**Example:**
```javascript
function formatErrorComment(error, workflowUrl) {
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
4. If the issue persists, please report the error

<details>
<summary><strong>Stack Trace</strong></summary>

\`\`\`
${stackTrace}
\`\`\`

</details>
`;
}

// Usage
await postIssueComment(owner, repo, issueNumber, formatErrorComment(error, workflowUrl));
```

### Pattern 8: Rich Markdown Formatting
**What:** Use GitHub markdown features for professional, readable comments
**When to use:** All GitHub issue/PR comments
**Example:**
```javascript
const successComment = `
## Phase 04: GitHub Integration Complete

**Status:** :white_check_mark: Success

### Summary

Successfully implemented GitHub CLI operations including:
- Comment posting to issues and PRs
- Branch creation for milestones and phases
- Git configuration for automated commits
- Error handling with rate limiting

### Files Created

| File | Purpose |
|------|---------|
| src/lib/github.js | GitHub API operations wrapper |
| src/git/git.js | Git command executor |
| src/git/branches.js | Branch management functions |
| src/errors/formatter.js | Error message formatting |

<details>
<summary><strong>Implementation Details</strong></summary>

**Key Changes:**
- Added @octokit/plugin-throttling for rate limit handling
- Implemented git switch for branch operations
- Configured local git identity before commits
- Added structured error messages with workflow run links

**Configuration:**
- Git user: github-actions[bot]
- Retry attempts: 1 for rate limits
- Error link mode: errors-only

</details>

> [!NOTE]
This implementation follows Conventional Commits format with issue references.
`;
```

### Anti-Patterns to Avoid
- **Using gh CLI commands in CI:** Prefer octokit REST API for reliability; gh adds unnecessary dependency
- **Global git config:** Always use `--local` (default) scope; avoid affecting global git configuration
- **Manually implementing retry logic:** Use @octokit/plugin-throttling which implements GitHub's recommended practices
- **Ignoring stderr in git commands:** Always log stderr as warnings; git outputs useful information there
- **Posting raw error messages:** Always format errors with context and next steps for user-friendly output
- **Missing workflow run links:** Always include clickable workflow URLs in error comments for debugging
- **Not configuring git identity:** Failing to set user.name/user.email causes commits to fail

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub API authentication | Custom token management | `@actions/github` octokit | Handles auth automatically with GITHUB_TOKEN, respects permissions |
| Rate limit handling | Manual retry with setTimeout | `@octokit/plugin-throttling` | Implements GitHub's recommended throttling practices, respects headers |
| Async shell command execution | Custom promise wrappers | `util.promisify(exec)` | Built-in Node.js utility, handles all edge cases |
| Error/warning annotations | Custom log messages | `@actions/core` commands | Creates proper GitHub Actions annotations |
| Git command error handling | Try/catch with error parsing | `child_process.exec` error object | Provides exit code, stdout, stderr structured data |
| Branch creation logic | Complex if/else for different scenarios | `git switch -c` | Single command handles all cases with start-point parameter |
| Markdown formatting | Manual string concatenation | GitHub Flavored Markdown syntax | Standard syntax with rich features (tables, alerts, details) |

**Key insight:** GitHub Actions toolkit (@actions/core, @actions/github) and Octokit ecosystem provide production-ready solutions for all common patterns. Custom implementations are error-prone and miss edge cases like rate limit headers, git exit codes, and proper error annotation formats.

## Common Pitfalls

### Pitfall 1: GITHUB_TOKEN Rate Limit Exhaustion
**What goes wrong:** Action fails with 403 "API rate limit exceeded" errors after posting multiple comments
**Why it happens:** GITHUB_TOKEN has 1000 requests/hour per repository limit; heavy usage can exhaust quota
**How to avoid:** Use `@octokit/plugin-throttling` to respect rate limits; consider batching operations; use `onRateLimit` callback to log warnings
**Warning signs:** Octokit warnings about "Request quota exhausted", 403 errors from API

### Pitfall 2: Git Identity Not Configured
**What goes wrong:** Git commit fails with "Author identity unknown" or "Please tell me who you are" error
**Why it happens:** Git requires user.name and user.email configured before committing; defaults not set in CI environment
**How to avoid:** Always run `git config set user.name` and `git config set user.email` before any commit operations
**Warning signs:** Git commit errors about "empty ident name", commits failing silently

### Pitfall 3: Branch Already Exists
**What goes wrong:** `git switch -c` fails with "A branch named 'X' already exists"
**Why it happens:** Attempting to create a branch that already exists locally
**How to avoid:** Check if branch exists before creating, or use `git switch` (without -c) to switch to existing branch
**Warning signs:** Branch creation failing on re-runs of same command

### Pitfall 4: Workflow Run URL Incorrect
**What goes wrong:** Posted workflow URLs lead to 404 errors or wrong workflow run
**Why it happens:** Missing `run_attempt` in URL, or using wrong context properties
**How to avoid:** Use format: `${server_url}/${repository}/actions/runs/${run_id}/attempts/${run_attempt}`
**Warning signs:** Clicking "View Logs" links shows 404 or different run

### Pitfall 5: Secondary Rate Limits
**What goes wrong:** Action fails with 403 "secondary rate limit" errors even under hourly quota
**Why it happens:** GitHub has secondary limits for rapid parallel requests to prevent abuse
**How to avoid:** Throttling plugin handles primary limits; secondary limits may require manual intervention or reducing parallelism
**Warning signs:** Errors with "secondary rate limit" or "You have triggered an abuse detection mechanism"

### Pitfall 6: Markdown Rendering Issues
**What goes wrong:** Comment markdown doesn't render as expected (tables broken, details not collapsible)
**Why it happens:** Incorrect markdown syntax or GitHub-specific features not supported
**How to avoid:** Use standard GitHub Flavored Markdown; verify syntax in GitHub web UI before deploying
**Warning signs:** Tables misaligned, collapsible sections expanded by default, alerts not rendering

### Pitfall 7: Error Stack Traces Too Verbose
**What goes wrong:** Error comments contain massive stack traces that overwhelm users
**Why it happens:** Posting full error objects without formatting
**How to avoid:** Always wrap stack traces in `<details>` tags; provide concise summary outside
**Warning signs:** Users complaining about information overload, scrolling past massive errors

### Pitfall 8: Git Commands Succeed But Exit Code Non-Zero
**What goes wrong:** Promise resolves but git operation actually failed
**Why it happens:** Git commands sometimes succeed even with warnings (exit code 0) but have stderr output
**How to avoid:** Always check stderr for warnings; treat some warnings as errors based on context
**Warning signs:** Unexpected behavior despite "success" logs, stderr content ignored

## Code Examples

Verified patterns from official sources:

### Complete GitHub API Operations Module
```javascript
// src/lib/github.js
import * as core from "@actions/core";
import * as github from "@actions/github";
import { throttling } from "@octokit/plugin-throttling";

// Initialize throttled octokit instance
const ThrottledOctokit = github.GitHub.plugin(throttling);
const octokit = new ThrottledOctokit({
  auth: core.getInput("token") || process.env.GITHUB_TOKEN,
  throttle: {
    onRateLimit: (retryAfter, options, octokit, retryCount) => {
      octokit.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`
      );
      if (retryCount < 1) {
        octokit.log.info(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    onSecondaryRateLimit: (retryAfter, options, octokit) => {
      octokit.log.warn(
        `SecondaryRateLimit detected for request ${options.method} ${options.url}`
      );
    },
  },
});

/**
 * Post a comment to an issue or PR
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue or PR number
 * @param {string} body - Markdown comment body
 */
export async function postComment(owner, repo, issueNumber, body) {
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body
  });
  core.info(`Comment posted to issue #${issueNumber}`);
}

/**
 * Get current workflow run URL
 * @returns {string} Full URL to workflow run
 */
export function getWorkflowRunUrl() {
  const { server_url, repository, run_id, run_attempt } = github.context;
  return `${server_url}/${repository}/actions/runs/${run_id}/attempts/${run_attempt}`;
}
```

### Complete Git Operations Module
```javascript
// src/git/git.js
import { promisify } from "node:util";
import { exec } from "node:child_process";
import * as core from "@actions/core";

const execAsync = promisify(exec);

/**
 * Execute git command with error handling
 * @param {string} command - Git command to execute
 * @returns {Promise<string>} Command output
 */
export async function runGitCommand(command) {
  core.debug(`Executing: ${command}`);
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      core.warning(`Git command warning: ${stderr}`);
    }
    return stdout.trim();
  } catch (error) {
    core.error(`Git command failed: ${command}`);
    core.error(`Exit code: ${error.code}`);
    core.error(`Error: ${error.message}`);
    throw error;
  }
}

/**
 * Configure git identity for commits
 * @param {string} name - Git user name
 * @param {string} email - Git user email
 */
export async function configureGitIdentity(name, email) {
  await runGitCommand(`git config set user.name "${name}"`);
  await runGitCommand(`git config set user.email "${email}"`);
  core.info(`Git identity configured: ${name} <${email}>`);
}

/**
 * Create and switch to new branch
 * @param {string} branchName - Name of branch to create
 * @param {string} [startPoint] - Optional start point (commit, branch, tag)
 */
export async function createAndSwitchBranch(branchName, startPoint = null) {
  const command = startPoint
    ? `git switch -c ${branchName} ${startPoint}`
    : `git switch -c ${branchName}`;

  await runGitCommand(command);
  core.info(`Created and switched to branch: ${branchName}`);
}

/**
 * Switch to existing branch
 * @param {string} branchName - Name of branch to switch to
 */
export async function switchBranch(branchName) {
  await runGitCommand(`git switch ${branchName}`);
  core.info(`Switched to branch: ${branchName}`);
}
```

### Error Formatter Module
```javascript
// src/errors/formatter.js
import * as core from "@actions/core";

/**
 * Format error for GitHub comment
 * @param {Error} error - Error object
 * @param {string} workflowUrl - Link to workflow run
 * @returns {string} Formatted markdown error message
 */
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

/**
 * Format success comment with execution summary
 * @param {object} result - Execution result
 * @param {string} workflowUrl - Link to workflow run
 * @returns {string} Formatted markdown success message
 */
export function formatSuccessComment(result, workflowUrl) {
  return `
## Command Completed Successfully

**Workflow Run:** [View Details](${workflowUrl})

### Summary

${result.summary || "Command executed without errors."}

${result.filesCreated ? `
### Files Created

| File | Purpose |
|------|---------|
${result.filesCreated.map(file => `| ${file.name} | ${file.purpose} |`).join('\n')}
` : ''}

${result.decisions ? `
### Decisions Made

${result.decisions.map(d => `- ${d}`).join('\n')}
` : ''}
`;
}
```

### Branch Naming Convention
```javascript
// src/git/branches.js
import { createAndSwitchBranch, switchBranch } from "./git.js";

/**
 * Create milestone branch with naming convention
 * @param {number} milestoneNumber - Milestone number
 */
export async function createMilestoneBranch(milestoneNumber) {
  const branchName = `gsd/${milestoneNumber}`;
  await createAndSwitchBranch(branchName);
}

/**
 * Create phase branch with naming convention
 * Pattern: gsd/{milestone}-{phase}-{slugified-phase-name}
 * @param {number} milestoneNumber - Milestone number
 * @param {number} phaseNumber - Phase number within milestone
 * @param {string} phaseName - Phase name to slugify
 * @param {string} [startPoint] - Optional start point (default: current HEAD)
 */
export async function createPhaseBranch(milestoneNumber, phaseNumber, phaseName, startPoint = null) {
  const slug = slugify(phaseName);
  const branchName = `gsd/${milestoneNumber}-${phaseNumber}-${slug}`;
  await createAndSwitchBranch(branchName, startPoint);
}

/**
 * Slugify phase name for branch naming
 * @param {string} text - Text to slugify
 * @returns {string} Slugified text
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
}

// Usage examples
await createMilestoneBranch(1);                          // gsd/1
await createPhaseBranch(1, 1, "Basic User Auth");        // gsd/1-1-basic-user-auth
await createPhaseBranch(1, 2, "Session Management");      // gsd/1-2-session-management
```

### Centralized Error Handler with Retry
```javascript
// src/errors/handler.js
import * as core from "@actions/core";
import { formatErrorComment } from "./formatter.js";
import { postComment, getWorkflowRunUrl } from "../lib/github.js";

/**
 * Execute operation with error handling and GitHub comment posting
 * @param {Function} operation - Async operation to execute
 * @param {object} context - Context for error reporting
 * @returns {Promise<object>} Operation result
 */
export async function withErrorHandling(operation, context) {
  const workflowUrl = getWorkflowRunUrl();

  try {
    const result = await operation();
    return { success: true, ...result };
  } catch (error) {
    core.setFailed(error.message);

    // Post formatted error to issue/PR
    if (context.issueNumber) {
      const errorComment = formatErrorComment(error, workflowUrl);
      await postComment(context.owner, context.repo, context.issueNumber, errorComment);
    }

    return { success: false, error: error.message };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Git checkout for branches | Git switch | Git 2.23 (August 2019) | `git switch` is more explicit and safer for branch operations |
| CLI commands for GitHub API | Octokit REST API | Ongoing | Programmatic API more reliable in CI, no CLI dependency |
| Manual retry logic | @octokit/plugin-throttling | 2019+ | Plugin implements official GitHub recommendations |
| Callback-based child_process | util.promisify with async/await | Node.js 8 (2017) | Cleaner code, better error handling |

**Deprecated/outdated:**
- **Using `git checkout` for branch operations:** Use `git switch` instead (introduced in Git 2.23)
- **Global git config:** Always use local scope (`--local` or default) to avoid side effects
- **Custom retry with setTimeout:** Use `@octokit/plugin-throttling` which respects GitHub headers
- **Interactive git prompts:** Configure git with `-c core.editor=true` or use commands that don't require interaction

## Open Questions

1. **GitHub Actions Bot Identity**
   - What we know: Standard bot email format is `41898282+github-actions[bot]@users.noreply.github.com`
   - What's unclear: Whether to use this exact identity or a custom bot identity for GSD
   - Recommendation: Use github-actions[bot] for transparency, or create custom identity (Claude's Discretion)

2. **Branch Creation from Remote**
   - What we know: `git switch -c` can create from local branches or commits
   - What's unclear: How to create phase branches from remote milestone branch if not local
   - Recommendation: Implement `git fetch` before branch creation; check if local branch exists first

3. **Commit Granularity**
   - What we know: GSD plugin handles atomic commits automatically
   - What's unclear: Whether GitHub integration needs to make commits or just let plugin handle it
   - Recommendation: Defer to GSD plugin's commit behavior; only commit planning docs as specified

4. **Error Comment Frequency**
   - What we know: Should post errors to issue/PR
   - What's unclear: Whether to post success comments or only errors
   - Recommendation: Configure via config option (errors-only, all-comments, or none)

5. **Retry Strategy for Rate Limits**
   - What we know: @octokit/plugin-throttling can retry once by default
   - What's unclear: Optimal retry count and backoff strategy for this use case
   - Recommendation: Start with single retry; adjust based on production usage

## Sources

### Primary (HIGH confidence)
- [GitHub Actions Core Toolkit](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions) - Input/output, error handling
- [GitHub Actions GitHub Toolkit](https://github.com/actions/toolkit/tree/main/packages/github) - Octokit integration
- [Octokit REST API Documentation](https://octokit.github.io/rest.js/v20) - API reference and examples
- [Octokit Throttling Plugin](https://github.com/octokit/plugin-throttling.js) - Rate limit handling
- [Git Documentation: git-config](https://git-scm.com/docs/git-config) - Git configuration
- [Git Documentation: git-switch](https://git-scm.com/docs/git-switch) - Branch operations
- [Node.js Documentation: util.promisify](https://nodejs.org/api/util.html#utilpromisifyoriginal) - Promise conversion
- [Node.js Documentation: child_process.exec](https://nodejs.org/api/child_process.html#child_processexecsync-command-options) - Shell command execution
- [GitHub REST API Rate Limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) - Rate limit headers and quotas
- [GitHub Contexts Reference](https://docs.github.com/en/actions/learn-github-actions/contexts) - GitHub context variables
- [GitHub Markdown Syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github) - Markdown features

### Secondary (MEDIUM confidence)
- [GitHub CLI Documentation](https://cli.github.com/manual/gh_issue_comment) - Alternative CLI approach (not recommended for CI)
- [Conventional Commits Specification](https://www.conventionalcommits.org/en/v1.0.0/) - Commit message format

### Tertiary (LOW confidence)
- None - All findings from official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All from official documentation and well-established libraries
- Architecture: HIGH - Patterns verified with official docs and examples
- Pitfalls: HIGH - All documented in official sources or common GitHub Actions best practices
- Git configuration: MEDIUM - Standard practices documented, but bot identity is project decision
- Rate limiting: HIGH - Octokit plugin documentation is comprehensive

**Research date:** 2026-01-22
**Valid until:** 2026-02-21 (30 days - GitHub Actions and Octokit are stable; Git commands are stable)
