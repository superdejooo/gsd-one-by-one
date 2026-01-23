---
phase: 06-security-authorization
plan: "01"
subsystem: authorization
tags: [github, authorization, permissions, security]
---

# Phase 6 Plan 1: Authorization Module - Summary

**Executed:** 2026-01-22
**Duration:** ~1 minute
**Commits:** 3

## Objective

Create the authorization module that validates user permissions before command execution. This is critical for production security - any user who can comment on an issue could otherwise invoke the agent to create branches and commit files.

## Truths Validated

- Action validates that triggering user has write access before executing
- Unauthorized users receive clear error message with permission requirements
- Authorization check uses GitHub REST API endpoint for collaborator permission

## Deliverables

| File                    | Purpose                            | Exports                                            |
| ----------------------- | ---------------------------------- | -------------------------------------------------- |
| `src/auth/validator.js` | Permission validation logic        | hasWriteAccess, getAuthContext, checkAuthorization |
| `src/auth/errors.js`    | Authorization-specific error types | AuthorizationError, formatAuthorizationError       |
| `src/auth/index.js`     | Public API for auth module         | All functions re-exported                          |

## Key Files Created

**src/auth/validator.js** (99 lines)

- `hasWriteAccess(octokit, owner, repo, username)` - Calls getCollaboratorPermissionLevel, checks admin/write/maintain
- `getAuthContext()` - Extracts username, owner, repo, issueNumber from webhook payload
- `checkAuthorization(octokit)` - Returns {authorized, username, permission, reason} object

**src/auth/errors.js** (44 lines)

- `AuthorizationError` - Error class with userMessage property for GitHub comments
- `formatAuthorizationError(username, repo, workflowUrl)` - Markdown-formatted error with permission guidance

**src/auth/index.js** (6 lines)

- Single import point re-exporting all auth functions

## Decisions Made

1. **Permission levels:** Only admin, write, and maintain grant write access (per 06-RESEARCH.md)
2. **404 handling:** User not found as collaborator returns false (not a throw), with helpful "not a collaborator" reason
3. **Error messages:** Include actionable guidance on how to request access

## Integration Points

- Validator uses `github.context.payload.sender.login` for username (via @actions/github)
- Validator calls `octokit.rest.repos.getCollaboratorPermissionLevel` for permission check
- Errors format consistently with existing `formatErrorComment` pattern in `src/errors/formatter.js`

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

None encountered during this plan.

## Next Phase Readiness

Authorization module is ready for integration into `src/index.js`:

- Import checkAuthorization from auth/index.js
- Call after command parsing, before any git operations
- On authorization failure, use formatAuthorizationError and post to issue

## Tech Stack Added

- No new dependencies - uses existing @actions/github and octokit patterns

## Dependency Graph

**Requires:**

- Phase 2 (Parser & Config) - Command parsing context
- Phase 3 (CCR Integration) - octokit instance

**Provides:**

- Authorization module for Phase 6 plans 2+

**Affects:**

- Future plans requiring permission validation before operations
