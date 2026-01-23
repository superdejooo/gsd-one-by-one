# Phase 6: Security & Authorization - Research

**Researched:** 2026-01-22
**Domain:** GitHub API authorization, webhook security, access control
**Confidence:** HIGH

## Summary

Phase 6 implements permission validation for the GitHub Action to ensure only users with write access can trigger the `gsd:new-milestone` workflow. This is critical for production security as any user who can comment on an issue could otherwise invoke the agent to create branches and commit files.

The implementation relies on GitHub's REST API endpoint `GET /repos/{owner}/{repo}/collaborators/{username}/permission` to check if the triggering user has write access. The webhook payload's `sender` object provides the triggering user's username, which is used for permission lookup. Authorization failures should return clear, user-friendly error messages explaining the permission requirements.

**Primary recommendation:** Create an authorization module that validates user permissions early in the execution flow, before any git operations or command processing begins.

## Standard Stack

The established libraries and patterns for GitHub Action authorization:

### Core

| Library                      | Version | Purpose                                                 | Why Standard                                                     |
| ---------------------------- | ------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| `@actions/github`            | ^7.0.0  | Webhook context, repository info, sender identification | Official GitHub Actions toolkit, provides context.payload access |
| `@octokit/plugin-throttling` | ^11.0.3 | Rate-limited API calls                                  | Already in project dependencies, handles GitHub API rate limits  |

### Authorization Flow

```
issue_comment webhook
  -> github.context.payload.sender.login (triggering user)
  -> octokit.repos.getCollaboratorPermissionLevel({owner, repo, username})
  -> Check permission in ["write", "maintain", "admin"]
  -> Continue execution OR post authorization error
```

### API Endpoint for Permission Check

| Endpoint                                                        | Purpose                     | Required Permission |
| --------------------------------------------------------------- | --------------------------- | ------------------- |
| `GET /repos/{owner}/{repo}/collaborators/{username}/permission` | Check user permission level | `Metadata: read`    |

### Permission Level Mapping

| Permission Value | Has Write Access | Notes                                      |
| ---------------- | ---------------- | ------------------------------------------ |
| `admin`          | YES              | Full write access including admin features |
| `write`          | YES              | Standard write access                      |
| `maintain`       | YES              | Maps to write access                       |
| `read`           | NO               | Read-only access                           |
| `triage`         | NO               | Maps to read access                        |
| `none`           | NO               | No access                                  |

**Installation:**

```bash
# Dependencies already in package.json
npm install @actions/github @octokit/plugin-throttling
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── auth/
│   ├── validator.js        # Permission validation logic
│   ├── errors.js           # Authorization-specific errors
│   └── index.js            # Public API
└── ...
```

### Pattern 1: Authorization Module

**What:** Standalone module that validates user permissions before command execution
**When to use:** At the entry point of command processing, after parsing but before any operations
**Example:**

```javascript
// Source: GitHub REST API documentation
import * as github from "@actions/github";

/**
 * Check if user has write access to repository
 * @param {object} octokit - Authenticated Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} username - GitHub username to check
 * @returns {Promise<boolean>} True if user has write access
 */
export async function hasWriteAccess(octokit, owner, repo, username) {
  try {
    const response = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username,
    });

    const permission = response.data.permission;
    // write, maintain, and admin all have write access
    return ["admin", "write", "maintain"].includes(permission);
  } catch (error) {
    if (error.status === 404) {
      // User is not a collaborator at all
      return false;
    }
    throw error; // Rethrow unexpected errors
  }
}

/**
 * Get authorization context from webhook payload
 * @returns {object} Authorization context with user and repo info
 */
export function getAuthContext() {
  const payload = github.context.payload;
  const sender = payload.sender;

  return {
    username: sender?.login,
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issueNumber: payload.issue?.number || payload.pull_request?.number,
    isComment: payload.comment?.id !== undefined,
  };
}
```

### Pattern 2: Authorization Error with User Feedback

**What:** Specialized error type for authorization failures with markdown-formatted messages
**When to use:** When permission check fails, before any state-modifying operations
**Example:**

```javascript
/**
 * Authorization error with user-friendly message
 */
export class AuthorizationError extends Error {
  constructor(message, userMessage) {
    super(message);
    this.name = "AuthorizationError";
    this.userMessage = userMessage;
    this.isAuthorizationError = true;
  }
}

/**
 * Format authorization error for GitHub comment
 * @param {string} username - Triggering username
 * @param {string} repo - Repository name
 * @param {string} workflowUrl - Link to workflow run
 * @returns {string} Formatted markdown error message
 */
export function formatAuthorizationError(username, repo, workflowUrl) {
  return `## Permission Denied

@${username} does not have write access to this repository.

### Required Permissions

To trigger the GSD milestone workflow, you need:
- **Write** access to \`${repo}\`, or
- **Maintain** role, or
- **Admin** role

### How to Request Access

1. Contact a repository maintainer or admin
2. Ask them to add you as a collaborator with write permissions
3. Once added, you'll be able to use the @gsd-bot commands

**Workflow Run:** [View Logs](${workflowUrl})`;
}
```

### Pattern 3: Integration with Existing Error Handler

**What:** Extend the existing `withErrorHandling` to support authorization-specific error handling
**When to use:** In the main action entry point
**Example:**

```javascript
import {
  hasWriteAccess,
  getAuthContext,
  AuthorizationError,
} from "./auth/validator.js";
import { formatAuthorizationError } from "./auth/errors.js";
import { postComment } from "./lib/github.js";

/**
 * Validate authorization before executing command
 * @param {object} octokit - Authenticated Octokit instance
 * @param {object} context - Authorization context
 * @throws {AuthorizationError} If user lacks write access
 */
export async function validateAuthorization(octokit, context) {
  const hasAccess = await hasWriteAccess(
    octokit,
    context.owner,
    context.repo,
    context.username,
  );

  if (!hasAccess) {
    throw new AuthorizationError(
      `User ${context.username} lacks write access to ${context.owner}/${context.repo}`,
      `You do not have write access to this repository.`,
    );
  }
}

// In index.js, after parsing command:
const authContext = getAuthContext();
await validateAuthorization(octokit, authContext);
```

### Anti-Patterns to Avoid

- **Relying solely on GITHUB_TOKEN permissions:** The token has permissions, but that doesn't mean the triggering user does. Always check user permissions explicitly.

- **Checking permissions after state modification:** Authorization must happen before any git operations, branch creation, or file writes.

- **Using repository-level permission checks only:** Organization-level permissions differ from repository-level. The `getCollaboratorPermissionLevel` endpoint checks repository-specific access.

- **Silent failures for 404 errors:** A 404 from the permission endpoint means the user is not a collaborator at all - this should be treated as "no write access" with a helpful message.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                                | Don't Build                                 | Use Instead                                   | Why                                                    |
| -------------------------------------- | ------------------------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| Permission level determination         | Custom logic mapping roles to access levels | API's `permission` field values               | The API already maps maintain/triage roles correctly   |
| Rate limit handling for permission API | Custom retry logic                          | Existing `@octokit/plugin-throttling`         | Already configured in `octokit` instance               |
| Authorization error formatting         | Build custom markdown from scratch          | `formatAuthorizationError()` pattern          | Consistent with existing error formatting              |
| Sender identification from webhook     | Parse raw webhook payload                   | `github.context.payload.sender`               | Official @actions/github library provides typed access |
| User-friendly permission errors        | Generic "access denied"                     | Specific message explaining how to get access | Reduces support burden, improves UX                    |

**Key insight:** The GitHub API's permission endpoint is the authoritative source for access levels. Building custom logic to determine "write access" from other endpoints (like listing repository contributors) would be incomplete and potentially incorrect.

## Common Pitfalls

### Pitfall 1: Using GITHUB_TOKEN Permissions Instead of User Permissions

**What goes wrong:** The action runs with the GITHUB*TOKEN's permissions, but authorization should check if the \_triggering user* has write access. The token is either bot-owned or app-owned, not the user.

**Why it happens:** Confusing token authorization (what the action can do) with user authorization (what the user is allowed to trigger).

**How to avoid:** Always call `repos.getCollaboratorPermissionLevel` for the `sender.login` from the webhook payload, not the token's permissions.

**Warning signs:**

- Action responds to all users regardless of their actual repository access
- "I can trigger the bot but it fails later" complaints
- Logs show successful execution when user should be blocked

### Pitfall 2: Authorization After Git Operations

**What goes wrong:** Checking permissions after creating branches or other git operations, resulting in partial state changes from unauthorized users.

**Why it happens:** Placing authorization checks too late in the execution flow, after command parsing and git setup.

**How to avoid:** Validate authorization immediately after command parsing, before any `createBranch`, `configureGitIdentity`, or other state-modifying calls.

**Warning signs:**

- Ghost branches created by unauthorized users
- Partial workflow state left behind after authorization failure
- Need to clean up after authorization failures

### Pitfall 3: Ignoring 404 Responses

**What goes wrong:** Treating a 404 from the permission endpoint as an error rather than "no access."

**Why it happens:** 404 means "user is not a collaborator" which is a valid authorization state (just not authorized).

**How to avoid:** Explicitly check for 404 status in permission check and return `false` (no write access) rather than throwing.

**Warning signs:**

- Authorization errors in logs for users not in the collaborator list
- Generic error messages instead of helpful "request access" guidance

### Pitfall 4: Not Explaining How to Get Access

**What goes wrong:** Authorization errors say "permission denied" without explaining what permissions are needed or how to obtain them.

**Why it happens:** Generic error handling that doesn't consider the user experience for authorization failures.

**How to avoid:** Include specific guidance in authorization error messages about required access levels and how to request them.

**Warning signs:**

- Users opening support issues asking "why can't I use this?"
- Confusion about what "write access" means in the GitHub context

### Pitfall 5: Caching Permission Results Incorrectly

**What goes wrong:** Caching permission checks across different users or workflow runs, leading to authorization bypass.

**Why it happens:** Reusing permission check results inappropriately, especially in workflows with multiple commands.

**How to avoid:** Always check permissions for the current `sender.login` fresh, don't cache across users or long time periods.

**Warning signs:**

- Authorization working for one user but another user gets their permissions
- Permission checks seem to return stale results

## Code Examples

### Authorization Validation Flow

```javascript
// Source: GitHub REST API + @actions/github context pattern
import * as github from "@actions/github";
import * as core from "@actions/core";

/**
 * Complete authorization check flow
 * @param {object} octokit - Authenticated Octokit instance
 * @returns {Promise<object>} Authorization result
 */
export async function checkAuthorization(octokit) {
  const payload = github.context.payload;

  // Get triggering user from webhook sender
  const username = payload.sender?.login;
  if (!username) {
    return {
      authorized: false,
      reason: "Could not identify triggering user",
    };
  }

  const { owner, repo } = github.context.repo;

  try {
    // Check collaborator permission level
    const response = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username,
    });

    const permission = response.data.permission;
    const hasWriteAccess = ["admin", "write", "maintain"].includes(permission);

    return {
      authorized: hasWriteAccess,
      username,
      permission,
      roleName: response.data.role_name,
    };
  } catch (error) {
    if (error.status === 404) {
      // User is not a collaborator
      return {
        authorized: false,
        username,
        reason: "User is not a collaborator on this repository",
      };
    }
    // Re-throw unexpected errors
    throw error;
  }
}
```

### Integration with Main Entry Point

```javascript
// Source: Based on existing index.js pattern
import { checkAuthorization } from "./auth/validator.js";
import { formatAuthorizationError } from "./auth/errors.js";
import { postComment, getWorkflowRunUrl } from "./lib/github.js";

async function main() {
  const authResult = await checkAuthorization(octokit);

  if (!authResult.authorized) {
    const workflowUrl = getWorkflowRunUrl();
    const errorMessage = formatAuthorizationError(
      authResult.username || "unknown",
      `${github.context.repo.owner}/${github.context.repo.repo}`,
      workflowUrl,
    );

    // Post clear error to the issue
    await postComment(
      github.context.repo.owner,
      github.context.repo.repo,
      github.context.issue?.number,
      errorMessage,
    );

    core.setFailed(`Authorization failed: ${authResult.reason}`);
    return;
  }

  core.info(
    `Authorization verified: ${authResult.username} has ${authResult.permission} access`,
  );

  // Continue with command execution...
}
```

### Error Message Format

```markdown
## Permission Denied

@username does not have write access to this repository.

### Required Permissions

To trigger the GSD milestone workflow, you need:

- **Write** access to `owner/repo`, or
- **Maintain** role, or
- **Admin** role

### How to Request Access

1. Contact a repository maintainer or admin
2. Ask them to add you as a collaborator with write permissions
3. Once added, you'll be able to use the @gsd-bot commands

**Workflow Run:** [View Logs](url)
```

## State of the Art

| Old Approach               | Current Approach                  | When Changed           | Impact                                     |
| -------------------------- | --------------------------------- | ---------------------- | ------------------------------------------ |
| No authorization check     | Explicit permission validation    | GSD for GitHub Phase 6 | Only authorized users can trigger workflow |
| GITHUB_TOKEN used for auth | User permission checked via API   | GSD for GitHub Phase 6 | Prevents unauthorized users from executing |
| Generic error messages     | User-friendly permission guidance | GSD for GitHub Phase 6 | Reduces support burden                     |

**OWASP Security Guidelines Applied:**

- **Principle of least privilege:** GITHUB_TOKEN permissions scoped to minimum required
- **Access control verification:** `repos.getCollaboratorPermissionLevel` validates user access
- **Input validation:** Shell metacharacters sanitized (per prior decisions)
- **Config allowlist validation:** Per OWASP guidelines (per prior decisions)

**Deprecated/outdated:**

- Relying on repository visibility alone (public repos can have unauthorized commenters)
- Checking only whether user is organization member (org members may lack repo access)

## Open Questions

1. **Should authorization be configurable?**
   - What we know: Some organizations may want stricter (owner/admin only) or looser (read access) rules
   - What's unclear: Whether this requirement exists in current REQUIREMENTS.md
   - Recommendation: Check REQUIREMENTS.md for AUTH-03 scope; if configurable auth needed, add config option

2. **Should authorization be cached during workflow?**
   - What we know: Multiple git operations may occur in one workflow run
   - What's unclear: Performance requirements for permission check frequency
   - Recommendation: Check permission once at entry, use cached result for subsequent checks within same run

3. **How to handle fork PR comments?**
   - What we know: Fork contributors typically don't have write access to the base repo
   - What's unclear: Whether fork scenarios need special handling
   - Recommendation: Standard authorization check works; forks won't have write access by design

## Sources

### Primary (HIGH confidence)

- [GitHub REST API - Collaborators](https://docs.github.com/en/rest/collaborators/collaborators) - Permission checking endpoint documentation
- [GitHub REST API - Repos](https://docs.github.com/en/rest/repos/repos) - Repository permission response format
- [GitHub Webhook Events - issue_comment](https://docs.github.com/en/webhooks/webhook-events-and-payloads#issue_comment) - Webhook payload structure with sender object
- [@actions/github Toolkit](https://github.com/actions/toolkit/tree/main/packages/github) - Context access patterns

### Secondary (MEDIUM confidence)

- [OWASP IDOR Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html) - Access control verification patterns
- [GitHub Security Hardening for Actions](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions) - Token permissions and least privilege

### Tertiary (LOW confidence)

- [Octokit REST.js](https://github.com/octokit/rest.js) - Library documentation (general usage, specific methods from API docs)

## Metadata

**Confidence breakdown:**

- Standard Stack: HIGH - GitHub API and @actions/github are authoritative sources
- Architecture: HIGH - Patterns derived from official documentation and GitHub Actions best practices
- Pitfalls: HIGH - Common authorization mistakes documented in security hardening guides

**Research date:** 2026-01-22
**Valid until:** 2026-07-22 (6 months - GitHub API is stable)

**Existing codebase integration points:**

- Uses existing `octokit` instance from `src/lib/github.js`
- Integrates with `formatErrorComment` pattern from `src/errors/formatter.js`
- Uses `withErrorHandling` pattern from `src/errors/handler.js`
- Follows existing module structure in `src/`
