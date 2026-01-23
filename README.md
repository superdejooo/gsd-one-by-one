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
  group: ${{ github.workflow }}-${{ github.head_ref || github.ref }}
  cancel-in-progress: true

jobs:
  handle-gsd-command:
    # Only run on @gsd-bot execute-phase command, not from bots
    if: github.event.comment.user.type != 'Bot' && contains(github.event.comment.body, '@gsd-bot execute-phase')
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'

      - name: Install dependencies
        run: npm ci

      - name: Install Bun
        run: |
          curl -fsSL https://bun.sh/install | bash
          echo "$HOME/.bun/bin" >> $GITHUB_PATH
      - name: Install Claude Code, CCR and GSD Skill
        run: |
          ~/.bun/bin/bun install -g @anthropic-ai/claude-code @musistudio/claude-code-router get-shit-done-cc
          # Add bun global bin to PATH for subsequent steps
          echo "$HOME/.bun/install/global/node_modules/.bin" >> $GITHUB_PATH
      - name: Verify Installations
        run: |
          echo "CCR location: $(which ccr)"
          echo "Claude location: $(which claude)"
          ccr -v || echo "CCR installed (version check optional)"
          claude --version || echo "Claude installed (version check optional)"
      - name: Generate CCR Configuration
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
        run: npm run setup:ccr

      - name: Start CCR Service
        run: |
          nohup ccr start > ccr.log 2>&1 &
          # Retry health check up to 10 times (30 seconds total)
          for i in {1..10}; do
            sleep 3
            if curl -sf http://127.0.0.1:3456/health > /dev/null 2>&1; then
              echo "CCR service started successfully"
              exit 0
            fi
            echo "Health check attempt $i failed, retrying..."
          done
          echo "CCR service failed to start after 30 seconds"
          cat ccr.log
          exit 1
      - name: Run Action
        uses: ./
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_LOG: debug
        with:
          issue-number: ${{ github.event.issue.number }}
          repo-owner: ${{ github.repository_owner }}
          repo-name: ${{ github.event.repository.name }}
          comment-body: ${{ github.event.comment.body }}
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload CCR logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ccr-logs-${{ github.run_id }}
          path: |
            ccr.log
            output-*.txt
            ~/.claude-code-router/logs/
            ~/.claude-code-router/claude-code-router.log
          retention-days: 7
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

## Documentation

- **[Project Board Setup](docs/project-setup.md)** — Set up GitHub Projects for visual milestone tracking

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
