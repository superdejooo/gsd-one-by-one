# Technology Stack

**Project:** GSD for GitHub (v1: GitHub Actions comment-triggered bot)
**Researched:** 2026-01-21

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GitHub Actions | Current | CI/CD execution platform | Native GitHub integration, triggers on webhook events, free for public repos, built-in authentication via GITHUB_TOKEN |
| Node.js | 24.x (Krypton) | gsd-github skill runtime | Current Active LTS (as of 2025), matches latest GitHub Actions action versions, long-term support until 2027 |
| GitHub CLI (gh) | Latest | GitHub API interactions | Pre-installed on GitHub Actions runners, simpler than direct REST API calls, automatic authentication via environment variables |

### Database / State

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Git Repository | N/A | Primary state storage | Files stored in `.github/planning/` directory, committed to repo, part of project history, no external database needed |
| GitHub Issues | N/A | Tracking and communication | Native GitHub feature for milestone tracking, comments serve as bidirectional communication channel |

### GitHub Actions Components

| Component | Version | Purpose | Why |
|-----------|---------|---------|-----|
| `actions/checkout` | v6 | Repository checkout | Latest version, improved credential security, supports sparse checkout, multi-repo workflows |
| `actions/setup-node` | v6 | Node.js runtime setup | Latest version, automatic npm caching when packageManager field is set, supports matrix testing |
| `actions/cache` | v5 | Dependency and cache management | Latest version, integrates with new cache service APIs, 10GB cache limit per repository |
| `actions/upload-artifact` | v6 | Artifact storage for workflow data | Latest version, supports retention up to 90 days, compression options |
| `actions/download-artifact` | v7 | Artifact retrieval between jobs | Latest version, direct extraction to path, supports multiple artifacts |
| `actions/github-script` | v8 | JavaScript-based GitHub API calls | Latest version, pre-authenticated github client, simpler than REST API calls |

### Runner Configuration

| Setting | Value | Why |
|---------|-------|-----|
| Runner OS | `ubuntu-latest` (Ubuntu 24.04) | Standard, well-supported, gh CLI pre-installed, 6-hour job timeout |
| Permissions | `contents: read`, `issues: write`, `pull-requests: write` | Least privilege for comment posting and file reading |
| Concurrency | `group: ${{ github.workflow }}-${{ github.event.issue.number }}`, `cancel-in-progress: true` | Prevent duplicate runs from same issue, cancel stale workflows |

### Event Configuration

| Setting | Value | Why |
|---------|-------|-----|
| Trigger | `issue_comment: types: [created]` | Only trigger on new comments, not edits or deletions |
| Filter | Check `@gsd-bot` in comment body | Only process bot commands, ignore other comments |

### Supporting Libraries

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `@actions/core` | GitHub Actions utilities | For setting outputs, logging, error handling in custom actions |
| `@actions/exec` | Execute shell commands | For running Claude CLI subprocess from Node.js wrapper |
| `@actions/github` | GitHub API client | Alternative to actions/github-script for Node.js-based operations |
| `octokit` | GitHub REST API client | When direct REST API calls are needed instead of gh CLI |

## Installation

### Core Workflow Dependencies

```yaml
# .github/workflows/gsd.yml
name: GSD Bot

on:
  issue_comment:
    types: [created]

permissions:
  contents: read
  issues: write
  pull-requests: write

concurrency:
  group: gsd-bot-${{ github.event.issue.number }}
  cancel-in-progress: true

jobs:
  gsd-bot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v6
        with:
          node-version: '24'

      - uses: actions/cache@v5
        with:
          path: ~/.npm
          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-node-

      - name: Install dependencies
        run: npm ci

      - name: Run GSD bot
        run: node .github/actions/gsd-bot/index.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Node.js Wrapper Dependencies

```bash
# For gsd-github skill wrapper
npm install @actions/core @actions/exec @actions/github
npm install --save-dev @types/node typescript
```

### GitHub CLI Installation

```bash
# Not needed on GitHub Actions runners (pre-installed)
# For local testing:
brew install gh  # macOS
# or
# Visit: https://cli.github.com/
```

## GitHub CLI Authentication

The GitHub CLI (gh) automatically authenticates in GitHub Actions workflows using the `GH_TOKEN` environment variable:

```yaml
steps:
  - name: Post comment
    run: |
      gh issue comment ${{ github.event.issue.number }} \
        --body "Hello from GSD bot!"
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Important:**
- Use `GH_TOKEN` environment variable for gh CLI authentication
- The `GITHUB_TOKEN` secret is automatically available in all workflows
- Set the correct `permissions` key in workflow to grant access
- gh CLI reads `GH_TOKEN` automatically, no additional setup needed

## Key Configuration Examples

### Minimal Permissions for Comment Posting

```yaml
permissions:
  contents: read      # Read repo files (PROJECT.md, config)
  issues: write       # Post issue comments
  pull-requests: write  # Post PR comments
```

### Branch Creation (if needed in future)

```yaml
permissions:
  contents: write     # Create branches, commit files
  issues: write
  pull-requests: write
```

### Issue Creation (future enhancement)

```yaml
permissions:
  contents: read
  issues: write      # Create new issues
  pull-requests: write
```

## What We're NOT Using (and Why)

| Technology | Why Avoid | Alternative |
|------------|-----------|-------------|
| Personal Access Tokens (PATs) | Security risk, need to manage secrets, don't rotate automatically | Use GITHUB_TOKEN (auto-generated, auto-rotating) |
| GitHub App (for v1) | Overkill for v1 scope, complex setup, installation tokens add overhead | GITHUB_TOKEN sufficient for comment posting and file reads |
| Self-hosted runners | Security risk for public repos, maintenance burden, unnecessary for this use case | Use GitHub-hosted ubuntu-latest runners |
| Third-party bot frameworks (Probot, probot-serverless) | Overhead, deprecated/abandoned projects, over-engineered for simple trigger-response pattern | Direct GitHub Actions workflow with custom Node.js wrapper |
| Database (PostgreSQL, MongoDB, etc.) | Unnecessary complexity, state can be stored in git | Repository files as source of truth |
| External storage (S3, Azure Blob) | Not needed for v1 scale, adds dependencies | GitHub artifacts and repository commits |
| Redis/Memcached | No caching requirements for v1, adds infrastructure | Use GitHub Actions cache@v5 for npm dependencies |
| Webhook proxy services (ngrok, smee.io) | Not needed for GitHub Actions native webhooks | GitHub automatically delivers webhooks to Actions |
| Direct REST API calls (curl) | More verbose, lose automatic authentication handling | Use gh CLI or actions/github-script |
| Docker containers | Adds complexity, slower startup, not needed for Node.js wrapper | Direct Node.js execution on ubuntu-latest |

## Version Pinning Strategy

### For Production Workflows

Pin actions to major versions (`@v6`) for balance between security and stability. Pin to full commit SHAs for third-party or security-critical actions.

```yaml
# Recommended: Major version pinning for GitHub-owned actions
- uses: actions/checkout@v6
- uses: actions/setup-node@v6
- uses: actions/cache@v5

# For custom/third-party actions: Commit SHA pinning
- uses: ./.github/actions/gsd-bot  # Local action, always uses HEAD
```

### When to Use Commit SHA Pinning

- Third-party community actions (not GitHub-owned)
- Security-sensitive operations
- When specific behavior must be guaranteed

```yaml
# Example of commit SHA pinning (replace with actual SHA)
- uses: actions/cache@0c45773b623bea8c3e2bd27fb8fc87db3ff90871
  with:
    path: ~/.npm
```

## GitHub Actions Best Practices

### Concurrency Control

Prevent duplicate workflow runs from the same issue:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.issue.number }}
  cancel-in-progress: true
```

### Job Status Visibility

Post a link to the workflow run in the initial comment:

```yaml
- name: Post initial status
  run: |
    gh issue comment ${{ github.event.issue.number }} \
      --body "GSD bot started. [View workflow run](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Error Handling

Gracefully handle failures and communicate to users:

```yaml
- name: Execute GSD
  id: gsd
  continue-on-error: true
  run: node .github/actions/gsd-bot/index.js

- name: Handle failure
  if: steps.gsd.outcome == 'failure'
  run: |
    gh issue comment ${{ github.event.issue.number }} \
      --body "Sorry, I encountered an error. Please check the workflow logs for details."
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Security Considerations

### Fork Protection

For security, workflows triggered from forks should have restricted access:

```yaml
jobs:
  gsd-bot:
    runs-on: ubuntu-latest
    # For public repos, forked PR comments don't get write access by default
    # No additional config needed - GitHub enforces this
```

### Input Validation

Sanitize all user inputs from issue comments:

```javascript
// In Node.js wrapper
const sanitizeInput = (input) => {
  // Remove any shell metacharacters
  return input.replace(/[;&|`$()]/g, '');
};
```

### Secret Management

Never log secrets:

```yaml
- name: Run with secret
  run: |
    # This is safe - GitHub masks the token in logs
    gh issue comment $ISSUE --body "Response"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Alternatives Considered

### Node.js Version

| Option | Status | Why Not Selected |
|--------|--------|------------------|
| Node.js 20.x (Iron) | Maintenance LTS | Older, EOL 2026-04-30, use 24.x for longevity |
| Node.js 22.x (Jod) | Maintenance LTS | Not current Active LTS, 24.x is newer |
| Node.js 18.x | EOL | Deprecated, not suitable for new projects |

### GitHub CLI vs Direct API

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| GitHub CLI (gh) | Simple, auto-auth, readable | Limited to CLI features | Use for v1 |
| REST API (curl) | Full access, no dependencies | Verbose, manual auth, error-prone | Avoid unless needed |
| actions/github-script | JavaScript-friendly, pre-auth | Learning curve, overkill for simple operations | Use for complex API logic |
| @actions/github | TypeScript types, typed API | Additional dependency | Use in Node.js wrapper |

### Workflow Structure

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| Single job | Simple, fast | Harder to scale, no parallelism | Use for v1 |
| Multi-job | Modular, can parallelize | More complex, outputs management | Consider for v2+ |
| Reusable workflow | DRY, shareable | Setup complexity | Not needed for v1 |
| Composite action | Reusable steps | Limited scope | Use for gsd-bot wrapper |

## Scalability Notes

### Current Stack Limits

| Resource | Limit | Impact |
|----------|-------|--------|
| Workflow job timeout | 6 hours | GSD analysis must complete within this window |
| GitHub Actions minutes | 2000/month (free) | May hit limits at high volume |
| GITHUB_TOKEN rate limit | 1000 requests/hour | OK for comment operations |
| Artifact storage | 10GB per repo | Sufficient for planning artifacts |
| Cache retention | 7 days (auto) | Use repository commits for long-term storage |

### When to Upgrade (v2+)

- Add GitHub App for higher rate limits (5,000 req/hour)
- Consider external storage (S3) for artifacts > 10GB
- Use larger runners or self-hosted for CPU-intensive AI operations
- Add queuing for high-concurrency scenarios

## Sources

- [Node.js Release Schedule](https://github.com/nodejs/Release) - HIGH confidence (Active LTS: Node.js 24.x)
- [Actions Runner Images](https://github.com/actions/runner-images) - HIGH confidence (ubuntu-latest = Ubuntu 24.04)
- [actions/checkout](https://github.com/actions/checkout) - HIGH confidence (Latest: v6)
- [actions/setup-node](https://github.com/actions/setup-node) - HIGH confidence (Latest: v6)
- [actions/cache](https://github.com/actions/cache) - HIGH confidence (Latest: v5)
- [actions/upload-artifact](https://github.com/actions/upload-artifact) - HIGH confidence (Latest: v6)
- [actions/download-artifact](https://github.com/actions/download-artifact) - HIGH confidence (Latest: v7)
- [actions/github-script](https://github.com/actions/github-script) - HIGH confidence (Latest: v8)
- [GitHub CLI - issue comment](https://cli.github.com/manual/gh_issue_comment) - HIGH confidence
- [GitHub Actions - Permissions](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#permissions) - HIGH confidence
- [GitHub Actions - Automatic Token Authentication](https://docs.github.com/en/actions/security-guides/automatic-token-authentication) - HIGH confidence
- [GitHub Actions - issue_comment Event](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issue_comment) - HIGH confidence
- [GitHub Actions - Concurrency](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#concurrency) - HIGH confidence
- [GitHub Actions - Artifact Storage](https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts) - HIGH confidence

## Decisions Made

| Decision | Rationale | Confidence |
|----------|-----------|------------|
| Use Node.js 24.x (Krypton) | Current Active LTS, supported until 2027, matches latest action versions | HIGH |
| Use ubuntu-latest runner | Standard, gh CLI pre-installed, 6-hour timeout sufficient for AI operations | HIGH |
| Use GITHUB_TOKEN for authentication | Auto-generated, auto-rotating, no secret management overhead | HIGH |
| Use GH_TOKEN env var for gh CLI | Automatic authentication via gh CLI, no additional setup | MEDIUM (WebSearch verified) |
| Use major version pinning (@v6) for GitHub actions | Balance between security updates and stability, best practice | HIGH |
| Avoid database for state | Repository files as source of truth, simpler, no external dependencies | HIGH |
| Use gh CLI instead of REST API | Simpler, more readable, auto-auth, sufficient for v1 needs | HIGH |
| Single job workflow for v1 | Simpler, faster, adequate for v1 scope | HIGH |
| Concurrency with cancel-in-progress | Prevent duplicate runs, improve user experience | HIGH |
| Filter to issue_comment created only | Avoid processing edits/deletions, reduce noise | HIGH |

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Node.js version (24.x) | HIGH | Verified via official Node.js Release page |
| GitHub Actions action versions | HIGH | Verified via official GitHub action repositories |
| Runner configuration (ubuntu-latest) | HIGH | Verified via actions/runner-images repository |
| GITHUB_TOKEN authentication | HIGH | Verified via official GitHub Actions documentation |
| GH_TOKEN for gh CLI | MEDIUM | WebSearch sources, not directly verified via official docs |
| Permissions (contents, issues, pull-requests) | HIGH | Verified via official GitHub Actions permissions docs |
| Event configuration (issue_comment: created) | HIGH | Verified via official GitHub Actions events docs |
| Concurrency configuration | HIGH | Verified via official GitHub Actions workflow syntax docs |
| Artifact configuration | HIGH | Verified via official GitHub Actions artifact docs |

## Open Questions / Research Flags

- **gh CLI authentication via GH_TOKEN**: Verified via WebSearch but could benefit from official documentation verification. Not blocking for v1 as this is a standard pattern.
- **Claude CLI integration with GitHub Actions**: This is a custom integration pattern. Recommend phase-specific research during implementation.
- **Long-running AI operation timeouts**: 6-hour job timeout may be limiting. Monitor during v1, add async pattern in v2 if needed.
- **Fork security for public repos**: GitHub enforces read-only GITHUB_TOKEN for forks, but verify actual behavior in testing.

## Migration Path

### To upgrade from this stack (v2+):

1. **If rate limits hit**: Move from GITHUB_TOKEN to GitHub App
2. **If operations time out**: Add async pattern with status polling
3. **If artifact storage limits hit**: Add external storage (S3, R2)
4. **If CPU needs increase**: Use larger runners or self-hosted
5. **If concurrent operations increase**: Implement job queueing
