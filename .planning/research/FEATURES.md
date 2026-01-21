# Feature Landscape

**Domain:** GitHub Actions comment-triggered bots
**Researched:** 2026-01-21
**Overall confidence:** HIGH

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Comment command parsing | Bots are triggered by comment-based commands | Medium | Must parse commands like `/gsd-new-milestone` from issue/PR comments |
| Event filtering (created vs edited vs deleted) | Users only want bots to respond to new comments, not edits | Low | Use `types: [created]` to filter `issue_comment` events |
| Issue vs PR distinction | Commands should work on both issues and pull requests | Low | Check `github.event.issue.pull_request` property |
| Authentication/permissions | Bot needs write access to create branches, issues, comments | Medium | Use GITHUB_TOKEN or installation tokens with scoped permissions |
| Comment response | Users expect feedback that the bot processed their command | Low | Post status updates via GitHub API |
| Markdown rendering | Bots communicate via formatted comments | Low | Support code blocks, lists, links, emojis for clear communication |
| Rate limit handling | API limits (5,000 req/hr for tokens, 1,000 for GITHUB_TOKEN) | Medium | Implement backoff or queuing for high-volume usage |
| Permission checking | Only authorized users should trigger sensitive operations | Medium | Validate commenter has write access before executing |
| Error reporting | Failed operations must be communicated clearly | Medium | Post structured error messages with troubleshooting guidance |
| Branch creation | V1 requires creating branches for milestone work | Medium | Use Git References API with blob→tree→commit→reference pattern |
| Issue creation | V1 requires creating issues for requirements | Low | Standard Issues API CRUD operations |
| File updates (planning files) | V1 requires updating `.planning/` directory files | Medium | Use Contents API to create/commit changes |
| Concurrency control | Prevent duplicate workflow runs from multiple comments | Low | Use `concurrency` with `cancel-in-progress: true` |
| Job status visibility | Users need to see workflow execution status | Low | Link to workflow run in initial comment response |
| Context preservation | Bot must track which issue/PR triggered it | Low | Pass `github.event.issue.number` through workflow |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Conversation-based requirements gathering | AI-driven back-and-forth instead of static forms | High | LLM integration with context tracking across comments |
| Incremental documentation updates | Planning files grow organically vs monolithic generation | Medium | Detect existing content, append/merge rather than overwrite |
| Structured research synthesis | Research files organized by domain with confidence levels | High | Multi-researcher coordination, confidence scoring system |
| Roadmap-aware milestone creation | Milestones respect existing project structure and dependencies | High | Parse existing roadmap, suggest phasing, avoid conflicts |
| Multi-domain parallel research | Different researchers handle stack, features, architecture in parallel | High | Spawn multiple workflows with coordination |
| Phase-specific depth flags | Research flags indicate which phases need deeper investigation | Medium | Tag findings with "research in X required" metadata |
| Opinionated recommendations | Clear "use X because Y" not just options lists | Medium | Synthesize research into actionable guidance |
| Anti-pattern prevention | Built-in warnings about known mistakes in the domain | Medium | PITFALLS.md integration with phase-specific warnings |
| Template-based file generation | Consistent file structure with .planning/ directory conventions | Low | Use templates for research files, enforce conventions |
| Help/command discovery | Users can ask `/help` to see available commands | Low | Parse `/help`, `/gsd-help`, respond with command list |
| Multi-line command support | Complex commands can span multiple comment lines | Medium | Parse continued commands across comments with delimiter detection |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Persistent bot servers | GitHub Actions-based bots should be serverless | Use GitHub Actions workflows triggered by webhook events |
| Database for state | Adds unnecessary complexity and maintenance burden | Use GitHub repository as source of truth (files, issues) |
| Unrestricted write permissions | Security risk; any repo write user can read secrets | Use GITHUB_TOKEN with minimal permissions (write only to needed resources) |
| Fork execution | Running workflows on forks exposes secrets to untrusted code | Check `github.event.repository.fork` and deny write access to forks |
| Workflow dispatch as primary trigger | Comment triggers are more intuitive for this use case | Use `issue_comment` events; reserve `workflow_dispatch` for manual/debugging |
| Inline script execution | Security risk; allows code injection from untrusted comments | Use JavaScript actions or shell scripts with proper quoting |
| Tag-pinned actions | Tags are mutable, creating supply chain risk | Pin to full-length commit SHAs for third-party actions |
| Blocking operations in main workflow | Long-running AI operations should not block the trigger workflow | Spawn child workflows via `workflow_run` or repository_dispatch |
| Manual retry logic | GitHub Actions has built-in retry and re-run capabilities | Let platform handle failures; surface error messages for manual re-trigger |
| Custom authentication systems | GitHub Apps provide built-in auth with installation tokens | Use standard GitHub App authentication flow |
| UI/HTML rendering in comments | GitHub comments use GitHub-flavored Markdown, not HTML | Use standard Markdown formatting for rich display |
| Direct file writes via raw git | Contents API is safer and more atomic | Use GitHub REST Contents API for file operations |
| Secret storage in plain text | GitHub provides secret management with masking | Use GitHub Secrets; apply `::add-mask::` for generated secrets |
| Self-hosted runners for public repos | Security risk; persistently compromised by untrusted code | Use GitHub-hosted runners; avoid self-hosted for public repos |

## Feature Dependencies

```
Command parsing (base)
  ├─> Comment response (depends on parsed command)
  ├─> Permission checking (depends on parsed user)
  ├─> Concurrency control (depends on triggering issue/number)
  └─> Error reporting (depends on parsing outcome)

Authentication/permissions (base)
  ├─> Branch creation (needs write permission)
  ├─> Issue creation (needs write permission)
  └─> File updates (needs write permission)

Markdown rendering (base)
  ├─> Comment response (formatting)
  └─> Error reporting (structured error messages)

Issue vs PR distinction (base)
  ├─> Context preservation (knowing target type)
  └─> File updates (correct target reference)

AI integration (V1 - optional)
  ├─> Conversation-based requirements gathering
  ├─> Research synthesis
  └─> Opinionated recommendations

Concurrent research workflows (V1 - optional)
  ├─> Multi-domain parallel research
  ├─> Structured output files
  └─> Template-based file generation
```

## MVP Recommendation

For MVP (V1 scope: `gsd-new-milestone` command only), prioritize:

1. **Comment command parsing** - Extract `/gsd-new-milestone` and any flags
2. **Comment response** - Acknowledge command, link to workflow run
3. **Issue vs PR distinction** - Check if triggered on issue or PR
4. **Context preservation** - Pass issue/PR number through workflow
5. **Branch creation** - Create branch for milestone planning
6. **Issue creation** - Create issues for each requirement comment
7. **File updates** - Generate planning files in `.planning/` directory
8. **Error reporting** - Clear error messages with troubleshooting
9. **Permission checking** - Only allow repo collaborators to trigger
10. **Concurrency control** - Prevent duplicate runs

Defer to post-MVP:

- **Conversation-based requirements gathering** - AI back-and-forth (complexity: HIGH)
- **Multi-domain parallel research** - Coordinate multiple researchers (complexity: HIGH)
- **Roadmap-aware milestone creation** - Parse existing roadmap (complexity: HIGH)
- **Multi-line command support** - Advanced parsing (complexity: MEDIUM)
- **Help/command discovery** - Nice-to-have but not core (complexity: LOW)

## Complexity Notes

### Low Complexity (can ship in first iteration)
- Event filtering, issue vs PR distinction, comment response
- Markdown rendering, permission checking, concurrency control
- Issue creation, job status visibility, context preservation

### Medium Complexity (requires careful design)
- Command parsing (handle edge cases, flags, partial commands)
- Authentication/permissions (proper scoping, security)
- Rate limit handling (backoff, queuing)
- Error reporting (structured messages, actionable guidance)
- Branch creation (blob→tree→commit→reference pattern)
- File updates (atomic commits, conflict handling)
- Help/command discovery, multi-line command support

### High Complexity (requires dedicated research/POC)
- AI integration (LLM context management, hallucination handling)
- Conversation-based requirements gathering (multi-turn state tracking)
- Multi-domain parallel research (coordinating multiple workflows)
- Roadmap-aware milestone creation (parsing existing structure)
- Structured research synthesis (confidence scoring, opinionation)

## Sources

- [GitHub Apps Documentation](https://docs.github.com/en/apps) - HIGH confidence
- [GitHub Webhooks Documentation](https://docs.github.com/en/webhooks-and-events/webhooks/about-webhooks) - HIGH confidence
- [GitHub Actions `workflow_run` Event](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_run) - HIGH confidence
- [GitHub Actions `issue_comment` Event](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issue_comment) - HIGH confidence
- [GitHub REST API: Git](https://docs.github.com/en/rest/git) - HIGH confidence
- [GitHub REST API: Issues](https://docs.github.com/en/rest/issues) - HIGH confidence
- [GitHub Rate Limits](https://docs.github.com/en/rest/overview/rate-limits-for-the-rest-api) - HIGH confidence
- [GitHub Markdown Syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax) - HIGH confidence
- [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions) - HIGH confidence
- [GitHub Actions Concurrency](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#concurrency) - HIGH confidence
- [GitHub Actions Job Summaries](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#adding-a-job-summary) - HIGH confidence
