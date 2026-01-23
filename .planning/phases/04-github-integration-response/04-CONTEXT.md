# Phase 4: GitHub Integration & Response - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable the bot to interact with GitHub via CLI - posting comments to issues/PRs, creating milestone and phase branches, configuring git, and committing planning artifacts. This phase delivers the GitHub integration layer that connects CCR execution (Phase 3) to GitHub itself for communication and artifact persistence.

</domain>

<decisions>
## Implementation Decisions

### Branch naming & structure

- Milestone branches: `gsd/1`, `gsd/2` (minimal format)
- Phase branches: `gsd/1-1-basic-user-auth` (flat, not nested - milestone-phase-slug)
- Phase branch slugs include descriptive phase name from roadmap
- Pattern: `gsd/{milestone}-{phase}-{phase-name-slug}`
- Example: `gsd/1-1-basic-user-auth`, `gsd/1-2-session-management`

### Comment formatting & tone

- Technical & precise tone - detailed, accurate, no casual language
- Full output in success comments - complete agent output, all files created, all decisions
- Rich markdown formatting - code blocks, tables, collapsible sections, badges
- No emojis - professional text only

### Git commit patterns

- Conventional Commits format - `feat:`, `fix:`, `docs:` prefix with scope
- Commit granularity already configured in GSD plugin - defer to plugin's atomic commit behavior
- Always reference triggering issue in commit messages - full traceability
- Format: `type(scope): message (issue #N)`

### Error communication

- Error summary with stack trace in collapsible details section
- Workflow run links configurable - can be enabled for errors only, all comments, or none (config option)
- Always suggest next steps - every error includes actionable guidance or retry instructions
- Rate limit handling: auto-retry with exponential backoff - transparent to user

### Claude's Discretion

- Exact markdown formatting structure (heading levels, table layouts)
- Git author identity (github-actions[bot] vs gsd-bot vs custom)
- Collapsible section implementation details
- Retry backoff timing and max attempts for rate limits
- Specific next-step suggestions for different error types

</decisions>

<specifics>
## Specific Ideas

- Commit granularity is already handled by GSD plugin's atomic commit strategy - respect existing behavior
- Workflow run links should be configurable (enable for errors, all, or none) - gives users flexibility
- Branch naming follows Git flat structure best practices rather than attempting nested hierarchy

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

_Phase: 04-github-integration-response_
_Context gathered: 2026-01-22_
