# Project Research Summary

**Project:** GSD for GitHub (GitHub Actions comment-triggered bot)
**Domain:** GitHub Actions automation / AI-powered project planning
**Researched:** 2026-01-21
**Confidence:** HIGH

## Executive Summary

This project is a GitHub Actions-based bot that responds to issue/PR comments to trigger AI-powered project planning workflows. Expert practitioners build GitHub Actions bots using serverless webhook triggers, the GitHub CLI for API interactions, and repository files as the source of truth for state. The recommended approach uses GitHub Actions with Node.js wrappers, avoiding persistent servers and external databases in favor of git-based artifact storage.

The key risk is security: comment-based triggers are vulnerable to command injection and permission misuse. Mitigation strategies include using least-privilege GITHUB_TOKEN permissions, sanitizing all user input, and explicitly setting git configuration for write operations. The 6-hour workflow timeout may constrain long-running AI operations, requiring careful design or async patterns for complex workflows.

## Key Findings

### Recommended Stack

The research indicates a serverless, GitHub-native approach is optimal for v1. GitHub Actions provides the execution platform, triggered by issue_comment webhooks. Node.js 24.x (Krypton, Active LTS through 2027) runs the wrapper code that bridges GitHub Actions to the GSD skill. The GitHub CLI (gh), pre-installed on Actions runners, handles all API interactions with automatic authentication via GITHUB_TOKEN. State is stored directly in the repository (.github/planning/ directory), eliminating the need for external databases.

**Core technologies:**

- GitHub Actions (current) — CI/CD execution platform with native webhook integration
- Node.js 24.x (Krypton) — Active LTS runtime matching latest action versions
- GitHub CLI (gh, latest) — API interactions with auto-auth via GH_TOKEN
- Git repository (N/A) — Primary state storage, no external database needed

### Expected Features

The feature landscape is well-documented for GitHub Actions bots. Users expect comment command parsing, event filtering, proper authentication/permissions, markdown-formatted responses, rate limit handling, and clear error reporting. For the GSD domain specifically, branch creation, issue generation, and planning file updates are essential v1 requirements.

**Must have (table stakes):**

- Comment command parsing — extract bot commands from issue/PR comments
- Event filtering (created vs edited) — only respond to new comments
- Authentication/permissions — scoped GITHUB_TOKEN for write access
- Comment response — user feedback via GitHub API
- Branch creation — create branches for milestone work
- Issue creation — generate issues for requirements
- File updates (.planning/) — commit generated planning files
- Error reporting — structured error messages to users
- Permission checking — authorize only collaborators
- Concurrency control — prevent duplicate workflow runs

**Should have (competitive):**

- Incremental documentation updates — merge with existing content
- Structured research synthesis — multi-domain parallel research
- Opinionated recommendations — clear guidance from synthesis

**Defer (v2+):**

- Conversation-based requirements gathering — multi-turn AI state tracking (HIGH complexity)
- Multi-domain parallel research — coordinating multiple workflows (HIGH complexity)
- Roadmap-aware milestone creation — parsing existing roadmap (HIGH complexity)
- Help/command discovery — nice-to-have but not core

### Architecture Approach

The architecture follows a serverless trigger-response pattern with clear component boundaries. A GitHub Actions workflow listens for issue_comment events, a Command Parser extracts bot commands, a Node.js Wrapper executes the GSD skill, and a Response Publisher posts results back to GitHub. Artifact Storage persists planning files in .github/planning/, committed as repository history. Each component has a single responsibility, and GSD skill isolation is enforced (wrapper cannot modify GSD internals).

**Major components:**

1. GitHub Actions Workflow — event trigger, orchestration, permissions management
2. Command Parser — extract and validate bot commands from comment text
3. GSD Skill Wrapper (Node.js) — bridge between workflow and GSD skill
4. Artifact Storage — persist planning files in .github/planning/ directory
5. Response Publisher — post formatted responses via GitHub CLI
6. Branch Manager (optional future) — create/manage planning branches

### Critical Pitfalls

The research identifies several critical pitfalls that can cause security vulnerabilities or broken functionality.

1. **Insufficient GITHUB_TOKEN permissions** — Explicitly set `contents: write`, `issues: write`, `pull-requests: write` in workflow permissions
2. **Command injection via comment parsing** — Never pass comment body directly to shell; validate and sanitize all user input
3. **Token credential leakage in logs** — Use environment variables for secrets and apply `::add-mask::` for sensitive values
4. **Missing git configuration for commits** — Set `git config user.name` and `user.email` before commit operations
5. **Wrong comment event type** — Use `issue_comment: created` for general comments, not `pull_request_review_comment`

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation (Workflow & Command Parsing)

**Rationale:** Cannot execute GSD without command structure, and workflow infrastructure is the prerequisite for all other work. This phase addresses the core entry point and follows the least-privilege security pattern from PITFALLS.md.
**Delivers:** GitHub Actions workflow skeleton with issue_comment trigger, command parser that extracts @gsd-bot commands and validates syntax
**Addresses:** Comment command parsing, event filtering, context preservation, concurrency control
**Avoids:** Insufficient permissions (set explicit scoped permissions), command injection (validate all input), wrong event type (use issue_comment:created only)
**Research flags:** Standard patterns — well-documented GitHub Actions triggers and shell parsing

### Phase 2: Wrapper Integration (GSD Execution)

**Rationale:** With command structure established, the wrapper can execute GSD and transform output. This phase depends on Phase 1 and implements the bridge pattern defined in ARCHITECTURE.md.
**Delivers:** Node.js wrapper that executes GSD skill, captures output, formats as markdown, handles errors
**Uses:** Node.js 24.x from STACK.md, @actions/core and @actions/exec libraries
**Implements:** GSD Skill Wrapper and Response Formatter components
**Addresses:** Error reporting, markdown rendering
**Research flags:** Needs phase research — Claude CLI integration with GitHub Actions is a custom pattern not widely documented

### Phase 3: GitHub Integration (Response & Artifacts)

**Rationale:** After GSD execution produces output, must store artifacts and respond to users. This implements the artifact persistence pattern and response publisher from ARCHITECTURE.md.
**Delivers:** Response publisher via GitHub CLI, artifact storage in .github/planning/, git configuration for commits
**Addresses:** Comment response, branch creation, issue creation, file updates, job status visibility
**Uses:** GitHub CLI (gh) from STACK.md, GITHUB_TOKEN for authentication
**Avoids:** Missing git configuration (set user.name/user.email), checkout token missing (use token parameter)
**Research flags:** Standard patterns — GitHub CLI and git operations are well-documented

### Phase 4: Security & Authorization

**Rationale:** Core functionality working before adding security prevents development blockers. This phase implements permission checking to prevent unauthorized access, a critical security requirement from FEATURES.md.
**Delivers:** Authorization checks (collaborator-only), input sanitization, rate limiting, audit logging
**Addresses:** Permission checking, rate limit handling
**Avoids:** Command injection (sanitization), token leakage (proper secret handling)
**Research flags:** Standard patterns — GitHub Actions security best practices are well-documented

### Phase 5: Polish & Differentiators (Optional v1+)

**Rationale:** Once MVP works, add features that differentiate the product. These are "should have" features from FEATURES.md that add value but aren't required for launch.
**Delivers:** Edit-last for multi-step responses, incremental documentation updates, structured research synthesis
**Implements:** Multi-step response updates, opinionated recommendations
**Research flags:** Needs phase research — incremental merge strategies and confidence scoring systems need validation

### Phase Ordering Rationale

The ordering follows clear dependency chains: commands must be parsed before GSD can execute (Phase 1 -> 2), output must be generated before it can be stored (Phase 2 -> 3), core functionality must work before security guardrails (Phase 3 -> 4), and differentiators come after MVP (Phase 4 -> 5). This grouping aligns with ARCHITECTURE.md's suggested build order and avoids the critical pitfalls identified in PITFALLS.md by addressing them early (permissions in Phase 1, git config in Phase 3).

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 2 (Wrapper Integration):** Claude CLI integration with GitHub Actions is a custom pattern. Research actual CLI invocation, environment variable passing, and output parsing.
- **Phase 5 (Differentiators):** Incremental document merge strategies and confidence scoring systems need validation. These are "differentiators" with less established patterns.

Phases with standard patterns (skip research-phase):

- **Phase 1 (Foundation):** GitHub Actions triggers, shell parsing, and concurrency are well-documented with established patterns
- **Phase 3 (GitHub Integration):** GitHub CLI usage, git operations, and artifact storage have extensive documentation
- **Phase 4 (Security):** GitHub Actions security best practices are comprehensively documented

## Confidence Assessment

| Area         | Confidence  | Notes                                                                                   |
| ------------ | ----------- | --------------------------------------------------------------------------------------- |
| Stack        | HIGH        | Node.js version and action versions verified via official sources                       |
| Features     | HIGH        | GitHub Actions bot features are well-documented patterns                                |
| Architecture | HIGH        | Component boundaries and patterns based on established GitHub Actions practices         |
| Pitfalls     | MEDIUM-HIGH | Security pitfalls verified via official docs; some integration patterns need validation |

**Overall confidence:** HIGH

### Gaps to Address

- **Claude CLI integration:** The specific pattern for invoking Claude CLI from GitHub Actions Node.js wrapper needs validation during implementation. STACK.md flags this as needing phase-specific research.
- **gh CLI GH_TOKEN authentication:** Verified via WebSearch but could benefit from official documentation confirmation. Not blocking for v1 as this is a standard pattern.
- **Long-running AI operations:** 6-hour workflow timeout may be limiting. Monitor during v1, consider async pattern with status polling for v2 if needed.
- **Fork security:** Verify actual GITHUB_TOKEN behavior for forked repositories during testing.
- **Incremental document merging:** Phase 5 differentiator requires research on strategies for merging generated content with existing documentation.

## Sources

### Primary (HIGH confidence)

- [Node.js Release Schedule](https://github.com/nodejs/Release) — Node.js 24.x Active LTS confirmation
- [Actions Runner Images](https://github.com/actions/runner-images) — Ubuntu 24.04 runner specs
- [GitHub Actions Permissions](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#permissions) — Token scoping
- [GitHub Actions Automatic Token Authentication](https://docs.github.com/en/actions/security-guides/automatic-token-authentication) — GITHUB_TOKEN behavior
- [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions) — Security best practices
- [GitHub Actions issue_comment Event](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issue_comment) — Event trigger configuration
- [GitHub CLI - issue comment](https://cli.github.com/manual/gh_issue_comment) — Comment posting commands
- [actions/checkout](https://github.com/actions/checkout) — Checkout action configuration and token parameter
- [GitHub Webhook Payloads - issue_comment](https://docs.github.com/en/webhooks-and-events/webhooks/webhook-events-and-payloads#issue_comment) — Payload structure

### Secondary (MEDIUM confidence)

- WebSearch results for gh CLI GH_TOKEN authentication pattern
- GitHub Apps Documentation — alternative approach considered for v2+
- GitHub Rate Limits documentation — API quota considerations

### Tertiary (LOW confidence)

- Claude CLI authentication (official docs URL returned 404, standard pattern assumed)
- GITHUB_TOKEN repository_dispatch limitations (contradictory WebSearch results)
- GitHub CLI specific GitHub Actions integration patterns (some docs returned 404)

---

_Research completed: 2026-01-21_
_Ready for roadmap: yes_
