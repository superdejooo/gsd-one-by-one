# Phase 1: GitHub Action Foundation - Research

**Researched:** 2026-01-21
**Domain:** GitHub Actions (Reusable Composite/JavaScript Actions)
**Confidence:** HIGH

## Summary

This phase research focuses on establishing a reusable GitHub Action infrastructure that can be referenced from other repositories via `uses: OWNER/repo@v1`. The core approach is creating a JavaScript-based action with composite-like capabilities, using Node.js 24.x runtime, scoped permissions, and branch-based concurrency control.

**Primary recommendation:** Use a JavaScript action structure with `runs.using: 'node24'` in action.yml, bundle with `@vercel/ncc` or rollup, version using git tags (@v1, @v2), and use a workflow file that declares scoped permissions and branch-based concurrency groups.

## Standard Stack

### Core

| Library                | Version | Purpose                                     | Why Standard                                  |
| ---------------------- | ------- | ------------------------------------------- | --------------------------------------------- |
| GitHub Actions Runtime | node24  | Execute action code                         | Officially supported runtime for Node.js 24.x |
| @actions/core          | Latest  | Core toolkit for inputs/outputs/exit codes  | Official GitHub Actions toolkit               |
| @actions/github        | Latest  | GitHub API client for repo/issue operations | Official GitHub Actions toolkit               |
| @vercel/ncc            | Latest  | Bundle Node.js code into single file        | Recommended bundler for JavaScript actions    |

### Supporting

| Tool                                                           | Purpose             | When to Use                               |
| -------------------------------------------------------------- | ------------------- | ----------------------------------------- |
| rollup + @rollup/plugin-commonjs + @rollup/plugin-node-resolve | Alternative bundler | When using rollup workflow instead of ncc |
| bash                                                           | Shell for steps     | Composite action shell commands           |

### Alternatives Considered

| Instead of        | Could Use               | Tradeoff                                                                                                 |
| ----------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| JavaScript action | Composite action        | Composite is simpler for shell commands but JavaScript actions offer more flexibility and better tooling |
| JavaScript action | Docker container action | Docker is slower due to container build latency and only works on Linux runners                          |

**Installation:**

```bash
npm init -y
npm install --save-dev @vercel/ncc
npm install @actions/core @actions/github
```

## Architecture Patterns

### Recommended Project Structure

```
gsd-github-action/
├── action.yml              # Action metadata (inputs, outputs, runs config)
├── dist/
│   └── index.js            # Bundled output (committed)
├── src/
│   └── index.js            # Source code (entry point)
├── package.json
├── package-lock.json
└── README.md
```

### Pattern 1: Action.yml Metadata for JavaScript Action

**What:** Defines the action interface and runtime configuration
**When to use:** Required for all GitHub Actions
**Example:**

```yaml
# Source: https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action
name: "GSD GitHub Action"
description: "Responds to GSD commands in issue comments"

inputs:
  issue-number:
    description: "The issue or PR number"
    required: true
  repo-owner:
    description: "The repository owner"
    required: true
  repo-name:
    description: "The repository name"
    required: true
  comment-body:
    description: "The comment body text"
    required: true

outputs:
  response-posted:
    description: "Whether the response was successfully posted"

runs:
  using: "node24"
  main: "dist/index.js"
```

### Pattern 2: Workflow File with Scoped Permissions and Concurrency

**What:** Consumer workflow that references the reusable action
**When to use:** Projects that want to use the GSD action
**Example:**

```yaml
# Source: https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#permissions
# Source: https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#concurrency
name: GSD Command Handler

on:
  issue_comment:
    types: [created]

# Scoped permissions - minimum required access (principle of least privilege)
permissions:
  contents: write
  issues: write
  pull-requests: write

# Branch-based concurrency - one run per branch, cancel previous on same branch
concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.ref }}
  cancel-in-progress: true

jobs:
  handle-gsd-command:
    runs-on: ubuntu-latest
    steps:
      - uses: superdejooo/gsd-github-action@v1
        with:
          issue-number: ${{ github.event.issue.number }}
          repo-owner: ${{ github.repository_owner }}
          repo-name: ${{ github.event.repository.name }}
          comment-body: ${{ github.event.comment.body }}
```

### Pattern 3: Entry Point with Clean Exit Handling

**What:** JavaScript code that processes the command and exits cleanly
**When to use:** Main action execution logic
**Example:**

```javascript
// Source: https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action
import * as core from "@actions/core";
import * as github from "@actions/github";

try {
  // Get inputs
  const issueNumber = core.getInput("issue-number");
  const repoOwner = core.getInput("repo-owner");
  const repoName = core.getInput("repo-name");
  const commentBody = core.getInput("comment-body");

  // Process command
  // ... logic here ...

  // Set outputs
  core.setOutput("response-posted", "true");

  // Clean exit - no explicit return needed, just avoid uncaught errors
} catch (error) {
  // Set failed exit code
  core.setFailed(error.message);
}
```

### Pattern 4: Bundle with @vercel/ncc

**What:** Compile source and dependencies into single distributable file
**When to use:** Preparing action for distribution
**Example:**

```bash
# Source: https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action
ncc build src/index.js --license licenses.txt
# Creates dist/index.js to be committed
```

### Anti-Patterns to Avoid

- **Missing scoped permissions:** Using `permissions: write-all` or omitting permissions entirely violates least privilege
- **Branch-specific concurrency without fallback:** Using `github.head_ref` without fallback fails on non-PR events
- **Bundling node_modules:** Don't commit node_modules; use bundler to create dist/index.js instead
- **Using node_modules directly in action.yml:** Don't point to src/index.js with dependencies, always use bundled dist/

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                       | Don't Build                   | Use Instead                            | Why                                                     |
| ----------------------------- | ----------------------------- | -------------------------------------- | ------------------------------------------------------- |
| Parsing GitHub event payloads | Custom JSON parsing           | `@actions/github`                      | Handles all event types, provides typed context         |
| Input/output management       | Manual environment variables  | `@actions/core.getInput()/setOutput()` | Handles escaping, type conversion, validation           |
| Error handling and exit codes | try/catch with process.exit() | `@actions/core.setFailed()`            | Sets proper exit codes, integrates with workflow status |
| Authentication                | Personal access tokens        | `GITHUB_TOKEN`                         | Auto-provisioned, no secrets management needed          |
| File bundling                 | Manual copy of dependencies   | `@vercel/ncc` or rollup                | Handles tree-shaking, license compliance                |
| HTTP requests to GitHub API   | fetch/axios                   | `@actions/github`                      | Proper auth handling, retry logic, API versioning       |

**Key insight:** GitHub provides a mature toolkit (@actions/core, @actions/github) that handles all common action patterns. Custom implementations are usually more complex, less reliable, and miss edge cases like rate limiting, authentication, and error handling.

## Common Pitfalls

### Pitfall 1: Workflow Only Runs on Default Branch

**What goes wrong:** Workflows don't trigger on feature branches because the workflow file only exists on main/default branch
**Why it happens:** The issue_comment event "will only trigger a workflow run if the workflow file exists on the default branch"
**How to avoid:** Ensure the workflow file is committed to the default branch; the action code can be in a separate repository
**Warning signs:** No workflow runs when commenting on PRs from feature branches

### Pitfall 2: Concurrency Group Naming Collisions

**What goes wrong:** Different workflows cancel each other's runs because they share the same concurrency group name
**Why it happens:** Not including `github.workflow` in the group name
**How to avoid:** Always include workflow identifier: `group: ${{ github.workflow }}-${{ github.head_ref || github.ref }}`
**Warning signs:** Workflows mysteriously cancel when unrelated workflows run

### Pitfall 3: Concurrency Fails on Non-PR Events

**What goes wrong:** Workflow crashes with "Property 'head_ref' is undefined" when triggered on issue comments (not PRs)
**Why it happens:** `github.head_ref` only exists for pull request events
**How to avoid:** Always provide fallback: `${{ github.head_ref || github.ref }}`
**Warning signs:** Workflow fails on issue comments but works on PR comments

### Pitfall 4: Silent Permission Failures

**What goes wrong:** Action fails silently because GITHUB_TOKEN lacks required permissions
**Why it happens:** Not declaring explicit permissions, relying on defaults (which may be insufficient)
**How to avoid:** Always declare required permissions explicitly in workflow file
**Warning signs:** API calls return 403 errors or fail silently

### Pitfall 5: Forked Repository Permission Restrictions

**What goes wrong:** Actions don't work for pull requests from forks due to read-only GITHUB_TOKEN
**Why it happens:** "GITHUB_TOKEN has read-only permissions in pull requests from forked repositories"
**How to avoid:** Document that write operations require maintainer approval or use alternative auth patterns for forks (out of scope for v1)
**Warning signs:** Fails only on external PRs, works fine on internal PRs

### Pitfall 6: Forgetting to Commit dist/

**What goes wrong:** Action fails because dist/index.js doesn't exist in repository
**Why it happens:** Running bundler locally but forgetting to commit output
**How to avoid:** Add dist/index.js to git, consider adding build step to CI that checks dist exists
**Warning signs:** "File not found" errors when action runs

## Code Examples

Verified patterns from official sources:

### Complete Action Structure

```yaml
# Source: https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action
# action.yml
name: "GSD GitHub Action"
description: "Processes GSD commands in issue comments"

inputs:
  issue-number:
    description: "Issue or PR number"
    required: true
  repo-owner:
    description: "Repository owner"
    required: true
  repo-name:
    description: "Repository name"
    required: true
  comment-body:
    description: "Comment body text"
    required: true

outputs:
  response-posted:
    description: "Whether response was posted successfully"
    value: ${{ steps.process.outputs.response-posted }}

runs:
  using: "node24"
  main: "dist/index.js"
```

### Consumer Workflow with All Required Features

```yaml
# Source: https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions
name: GSD Command Handler

on:
  issue_comment:
    types: [created]

permissions:
  contents: write
  issues: write
  pull-requests: write

concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.ref }}
  cancel-in-progress: true

jobs:
  handle-command:
    runs-on: ubuntu-latest
    steps:
      - uses: superdejooo/gsd-github-action@v1
        with:
          issue-number: ${{ github.event.issue.number }}
          repo-owner: ${{ github.repository_owner }}
          repo-name: ${{ github.event.repository.name }}
          comment-body: ${{ github.event.comment.body }}
```

### Distinguish Issue vs PR Comments

```javascript
// Source: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issue_comment
const isPullRequest = github.context.payload.issue.pull_request !== undefined;
if (isPullRequest) {
  // This is a PR comment
} else {
  // This is an issue comment
}
```

### Clean Exit Pattern

```javascript
// Source: https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action
import * as core from "@actions/core";

try {
  // Action logic here
  core.info("Processing command...");

  // Success - clean exit
  core.info("Command processed successfully");
} catch (error) {
  // Failure - sets exit code to non-zero
  core.setFailed(`Action failed: ${error.message}`);
}
```

## State of the Art

| Old Approach            | Current Approach               | When Changed | Impact                                        |
| ----------------------- | ------------------------------ | ------------ | --------------------------------------------- |
| node16, node20          | node24                         | 2024-2025    | Use node24 for latest LTS                     |
| Shell scripts only      | JavaScript + composite actions | 2019+        | JavaScript offers better maintainability      |
| Committing node_modules | Bundling with ncc/rollup       | 2020+        | Smaller distribution, better license handling |

**Deprecated/outdated:**

- Using `runs-on: node-12` or `node-16`: No longer supported, use node20 or node24
- Using `GITHUB_TOKEN` without explicit permissions: Security risk, always declare permissions
- Using workflow_run trigger for simple comment handling: Overly complex for this use case

## Open Questions

1. **User Write Access Validation (AUTH-03)**
   - What we know: GitHub context provides `github.actor` (username who triggered workflow), but there's no direct way to check user permissions from context
   - What's unclear: How to programmatically verify if the triggering user has write access to the repository
   - Recommendation: Use `@actions/github` to call the repository permissions API (GET /repos/{owner}/{repo}/collaborators/{username}) or check if actor is in the repository's write-access list via organization/team membership API

2. **Action Distribution to GitHub Marketplace**
   - What we know: Actions can be versioned with git tags (@v1, @v2) and referenced from other repositories
   - What's unclear: Whether publishing to GitHub Marketplace is required for the `uses: OWNER/repo@v1` pattern to work
   - Recommendation: Confirm that git tags alone are sufficient for cross-repository reference (this should be verified during implementation)

## Sources

### Primary (HIGH confidence)

- GitHub Actions - About Custom Actions: https://docs.github.com/en/actions/creating-actions/about-custom-actions
- GitHub Actions - Creating a Composite Action: https://docs.github.com/en/actions/creating-actions/creating-a-composite-action
- GitHub Actions - Creating a JavaScript Action: https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action
- GitHub Actions - Workflow Syntax (permissions): https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#permissions
- GitHub Actions - Workflow Syntax (concurrency): https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#concurrency
- GitHub Actions - Workflow Syntax (metadata for runs.using): https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions#runs
- GitHub Actions - issue_comment Event: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issue_comment
- GitHub Actions - Automatic Token Authentication: https://docs.github.com/en/actions/security-guides/automatic-token-authentication
- GitHub Actions - Contexts Reference: https://docs.github.com/en/actions/learn-github-actions/contexts
- GitHub Webhooks - issue_comment Payload: https://docs.github.com/en/webhooks-and-events/webhooks/webhook-events-and-payloads#issue_comment

### Secondary (MEDIUM confidence)

- None - all findings from official documentation

### Tertiary (LOW confidence)

- None - all findings from official documentation

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All from official GitHub documentation
- Architecture: HIGH - All patterns from official GitHub documentation
- Pitfalls: HIGH - All from official GitHub documentation with direct quotes

**Research date:** 2026-01-21
**Valid until:** 2026-02-20 (30 days - GitHub Actions documentation is stable but new Node.js versions may be released)
