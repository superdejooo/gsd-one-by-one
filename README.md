# GSD for GitHub

> **⚠️ Work in Progress** — This project is under active development. Contributions and feedback are welcome!

A **reusable GitHub Action** that brings autonomous AI-driven project management to your repository through GitHub Issue comments.

Built on [Claude Code](https://claude.ai/code) and the [GSD (Get Shit Done)](https://www.npmjs.com/package/get-shit-done-cc) skill, this Action enables AI-powered planning, execution, and verification workflows — all triggered by commenting on GitHub Issues.

## Quick Start

### 1. Add the Workflow

Create `.github/workflows/gsd.yml` in your repository:

```yaml
name: GSD Bot

on:
  issue_comment:
    types: [created]

permissions:
  contents: write
  issues: write
  pull-requests: write

concurrency:
  group: gsd-${{ github.event.issue.number }}
  cancel-in-progress: true

jobs:
  gsd:
    if: contains(github.event.comment.body, '@gsd-bot')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: superdejooo/gsd-one-by-one@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          # Or use OpenRouter/DeepSeek as alternatives
          # OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          # DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
```

### 2. Add Your API Key

Go to **Settings → Secrets and variables → Actions** and add:
- `ANTHROPIC_API_KEY` — Your Anthropic API key

### 3. Start Using

Create an issue and comment:

```
@gsd-bot new-milestone 1
```

The bot will respond and guide you through requirements gathering.

## Available Commands

| Command | Description |
|---------|-------------|
| `@gsd-bot new-milestone N` | Start a new milestone, gather requirements interactively |
| `@gsd-bot plan-phase N` | Create detailed execution plan for phase N |
| `@gsd-bot execute-phase N` | Execute the plan for phase N with atomic commits |

## How It Works

```
You comment: @gsd-bot new-milestone 1
                    ↓
GitHub Actions triggers the workflow
                    ↓
Action parses command and validates permissions
                    ↓
GSD skill executes via Claude Code Router
                    ↓
Bot replies with questions or results
                    ↓
Planning docs created in .planning/ folder
```

### The GSD Workflow

1. **new-milestone** — Define what you want to build (multi-turn conversation)
2. **plan-phase** — Research and plan implementation for each phase
3. **execute-phase** — AI implements the plan with atomic commits
4. **verify-work** — Validate features work as expected *(coming soon)*

## Planning Documents

All artifacts are stored in `.planning/` (GSD standard):

```
.planning/
├── PROJECT.md          # Project overview and requirements
├── STATE.md            # Current progress and context
├── ROADMAP.md          # Phase breakdown
├── milestones/
│   └── {n}/            # Per-milestone docs
└── phases/
    └── {n}/            # Per-phase plans and summaries
        ├── RESEARCH.md
        ├── PLAN.md
        └── SUMMARY.md
```

## Requirements

- GitHub repository with Issues enabled
- One of: `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, or `DEEPSEEK_API_KEY`
- Users must have write access to trigger commands

## Built With

- [Claude Code](https://claude.ai/code) — Anthropic's AI coding assistant
- [GSD Skill](https://www.npmjs.com/package/get-shit-done-cc) — Project management plugin
- [Claude Code Router](https://www.npmjs.com/package/@musistudio/claude-code-router) — CI-safe LLM proxy

## License

MIT
