# Architecture Patterns

**Domain:** GitHub Actions comment-triggered bots
**Researched:** 2026-01-21

## System Components

```
+---------------------+     +---------------------+     +---------------------+
|  GitHub Issue/PR    |---->|  GitHub Actions     |---->|  Workflow Runner    |
|  Comment Event      |     |  Workflow Trigger   |     |  (ubuntu-latest)    |
+---------------------+     +---------------------+     +----------+----------+
                                                                   |
                                                                   v
                                                         +---------------------+
                                                         |  Workflow Jobs      |
                                                         |  (parsing, validation|
                                                         |   orchestration)    |
                                                         +----------+----------+
                                                                   |
            +----------------------+                +---------------v----------------+
            |  GitHub Context      |                |   GSD Skill Wrapper (Node.js) |
            |  (event data)        |                |   - Comment parsing          |
            +----------------------+                |   - Command validation       |
                      ^                            |   - Output formatting        |
                      |                            +---------------+----------------+
                      |                                            |
            +----------+-----------+                    +-----------v-----------+
            |  GitHub API Response |                    |  GSD Skill (Claude CLI)|
            |  (comment posted)    |<-------------------+  - Planning           |
            +----------------------+                    |  - Artifact generation |
                                                          +---------------------+
```

### Component 1: GitHub Actions Workflow

**Purpose:** Entry point triggered by issue comment events

**Responsibilities:**

- Listen for `issue_comment` events (`created` activity type)
- Extract comment body and metadata from GitHub context
- Set up environment with required permissions
- Orchestrate job execution flow
- Handle authentication via GITHUB_TOKEN

**Location:** `.github/workflows/gsd-bot.yml`

### Component 2: Command Parser (JavaScript/Shell)

**Purpose:** Extract and validate bot commands from comment text

**Responsibilities:**

- Parse comment body for bot command pattern (`@gsd-bot`)
- Extract command parameters and context
- Validate command syntax
- Extract issue/PR number and repository details
- Filter bot mentions from other comments

**Input:** `github.event.comment.body`
**Output:** Structured command object (issue number, command type, parameters)

### Component 3: GSD Skill Wrapper (Node.js)

**Purpose:** Bridge between GitHub Actions workflow and existing GSD skill

**Responsibilities:**

- Receive parsed command data
- Format arguments for Claude CLI/GSD skill
- Execute GSD skill via subprocess
- Capture and parse GSD skill output
- Transform output to GitHub comment format
- Handle errors and provide user-friendly feedback

**Constraint:** Must NOT modify existing GSD skill - only wrap it

### Component 4: Artifact Storage

**Purpose:** Persist planning artifacts for reference

**Responsibilities:**

- Store GSD output files in `.github/planning/`
- Use GitHub artifacts for temporary file storage if needed
- Commit generated files back to repository
- Maintain artifact lifecycle (creation, updates, archival)

**Location:** `.github/planning/` directory structure

### Component 5: Response Publisher

**Purpose:** Post bot responses back to GitHub

**Responsibilities:**

- Use `gh issue comment` or `gh pr comment` CLI
- Format output for readability (code blocks, markdown)
- Update existing comments for multi-step responses
- Handle comment creation failures
- Include references to stored artifacts

**CLI Commands:** `gh issue comment {number} --body-file -` or `gh pr comment {number} --body-file -`

### Component 6: Branch Manager (Optional Future)

**Purpose:** Create and manage branches for planning work

**Responsibilities:**

- Use `gh repo create-branch` or similar
- Switch to planning branch
- Commit artifacts to branch
- Create PR for planning artifacts (if applicable)

## Component Boundaries

| Component               | Responsibility                            | Communicates With                                    | Data Flow                                       |
| ----------------------- | ----------------------------------------- | ---------------------------------------------------- | ----------------------------------------------- |
| GitHub Actions Workflow | Event trigger, orchestration, permissions | Command Parser, Response Publisher                   | Comment event → Parsed command → Final response |
| Command Parser          | Extract/validate commands                 | GitHub Actions, GSD Wrapper                          | Comment body → Command object                   |
| GSD Skill Wrapper       | Execute GSD skill, transform output       | Command Parser, Artifact Storage, Response Publisher | Command → GSD execution → Formatted output      |
| Artifact Storage        | Persist planning files                    | GSD Wrapper, GitHub Actions                          | GSD output → Repository files                   |
| Response Publisher      | Post responses to GitHub                  | GSD Wrapper, GitHub Actions API                      | Formatted output → GitHub comment               |
| Branch Manager          | Create/manage planning branches           | Artifact Storage, GitHub Actions API                 | Branch name → GitHub branch                     |

**Boundary Design Principles:**

1. **GSD Skill Isolation:** Wrapper has NO access to modify GSD skill internals - only execute it
2. **GitHub API Abstraction:** All GitHub interactions go through GitHub CLI, not direct REST calls
3. **Environment Cleanliness:** Each workflow run is isolated with fresh checkout
4. **Single Responsibility:** Each component has one clear purpose

## Data Flow

### Complete Flow: Comment → Analysis → Response

```
1. USER ACTION
   User posts comment: "@gsd-bot help with feature X"
                     |
                     v
2. GITHUB WEBHOOK
   issue_comment event fires
   (action: created)
                     |
                     v
3. GITHUB ACTIONS TRIGGER
   Workflow: gsd-bot.yml
   Context: github.event.comment
   Available data:
   - comment.body
   - comment.user.login
   - issue.number
   - repository.name
   - repository.owner.login
                     |
                     v
4. COMMAND PARSING
   Extract: "@gsd-bot" trigger
   Parse: "help with feature X"
   Validate: Is valid command?
                     |
                     v
5. VALIDATION
   - Is user authorized?
   - Is command syntax correct?
   - Is repository configured for GSD?
                     |
          +----------+----------+
          |                     |
          v                     v
     VALID             INVALID
          |                     |
          v                     v
6. GSD EXECUTION       ERROR RESPONSE
   Wrapper runs:        gh issue comment $ISSUE
   claude gsd ...        --body "Error: ..."
                     |
                     v
7. GSD SKILL PROCESSING
   - Read project context
   - Execute GSD analysis
   - Generate artifacts
                     |
                     v
8. OUTPUT TRANSFORMATION
   - Parse GSD output
   - Format as markdown
   - Add status indicators
                     |
                     v
9. ARTIFACT STORAGE
   - Write to .github/planning/
   - Commit files
                     |
                     v
10. RESPONSE PUBLISHING
    gh issue comment $ISSUE
    --body-file response.md
    or
    gh pr comment $PR
    --body-file response.md
                     |
                     v
11. USER SEES RESPONSE
    Markdown-formatted analysis
    Links to artifacts
    Next steps available
```

### Multi-Step Interaction Flow

For complex GSD workflows that require multiple steps:

```
Step 1: Initial Trigger
   @gsd-bot new-project "AI Agent Platform"
             |
             v
Step 1 Response: Creates artifacts, prompts for more info
   "Created planning structure. Please provide:
    1. Target users
    2. Key features
    3. Tech stack preferences"
             |
             v
Step 2: User Follow-up Comment
   @gsd-bot users: developers, features: X, stack: Node.js
             |
             v
Step 2 Response: Uses --edit-last to update initial comment
   gh issue comment --edit-last
   --body-file updated-response.md
             |
             v
Step 3: Continue until workflow complete
```

## GitHub Actions Workflow Structure

### Recommended Workflow Layout

```yaml
name: GSD Bot

on:
  issue_comment:
    types: [created]

permissions:
  contents: read
  issues: write
  pull-requests: write

# Reusable workflow pattern for composability
on:
  workflow_call:
    inputs:
      command:
        required: true
        type: string
    secrets:
      github-token:
        required: true

jobs:
  parse-command:
    name: Parse Comment Command
    runs-on: ubuntu-latest
    outputs:
      command-type: ${{ steps.parse.outputs.command-type }}
      is-valid: ${{ steps.parse.outputs.is-valid }}
      issue-number: ${{ steps.parse.outputs.issue-number }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Parse comment for GSD command
        id: parse
        run: .github/scripts/parse-comment.sh
        env:
          COMMENT_BODY: ${{ github.event.comment.body }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}

  validate:
    name: Validate Command
    needs: parse-command
    runs-on: ubuntu-latest
    if: needs.parse-command.outputs.is-valid == 'true'
    steps:
      - name: Check authorization
        id: auth
        run: .github/scripts/check-authorization.sh

  execute-gsd:
    name: Execute GSD Skill
    needs: [parse-command, validate]
    runs-on: ubuntu-latest
    if: needs.parse-command.outputs.is-valid == 'true'
    outputs:
      has-artifacts: ${{ steps.gsd.outputs.has-artifacts }}
      artifact-paths: ${{ steps.gsd.outputs.artifact-paths }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Execute GSD wrapper
        id: gsd
        run: node .github/actions/gsd-wrapper/index.js
        env:
          COMMAND_TYPE: ${{ needs.parse-command.outputs.command-type }}
          ISSUE_NUMBER: ${{ needs.parse-command.outputs.issue-number }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          REPO_NAME: ${{ github.repository }}

  store-artifacts:
    name: Store Planning Artifacts
    needs: execute-gsd
    runs-on: ubuntu-latest
    if: needs.execute-gsd.outputs.has-artifacts == 'true'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Upload planning artifacts
        uses: actions/upload-artifact@v4
        with:
          name: gsd-planning-artifacts
          path: |
            .github/planning/**/*.md
            .github/planning/**/*.json
          retention-days: 30

      - name: Commit artifacts to repository
        run: |
          git config user.name "gsd-bot[bot]"
          git config user.email "gsd-bot[bot]@users.noreply.github.com"
          git add .github/planning/
          git commit -m "docs: update planning artifacts [skip ci]"
          git push

  publish-response:
    name: Publish Bot Response
    needs: [parse-command, execute-gsd]
    runs-on: ubuntu-latest
    steps:
      - name: Download artifacts
        uses: actions/download-artifact@v4
        with:
          name: gsd-planning-artifacts
          path: ./artifacts

      - name: Post response comment
        run: |
          if [ "${{ github.event.issue.pull_request }}" != "" ]; then
            gh pr comment ${{ github.event.issue.number }} \
              --body-file response.md
          else
            gh issue comment ${{ github.event.issue.number }} \
              --body-file response.md
          fi
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  error-handler:
    name: Handle Errors
    needs: [parse-command, validate]
    runs-on: ubuntu-latest
    if: failure()
    steps:
      - name: Post error comment
        run: |
          gh issue comment ${{ github.event.issue.number }} \
            --body "Sorry, I encountered an error. Please try again or contact maintainers."
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Composite Action Alternative

For better reusability, wrap the GSD execution logic in a composite action:

**File:** `.github/actions/gsd-bot/action.yml`

```yaml
name: "GSD Bot Action"
description: "Execute GSD skill from GitHub comment"

inputs:
  comment-body:
    description: "Comment body to parse"
    required: true
  issue-number:
    description: "Issue or PR number"
    required: true
  command-type:
    description: "Type of GSD command to execute"
    required: true

outputs:
  response-file:
    description: "Path to generated response file"
  has-artifacts:
    description: "Whether artifacts were generated"

runs:
  using: "composite"
  steps:
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: "20"

    - name: Parse comment
      shell: bash
      run: |
        node ${{ github.action_path }}/scripts/parse.js \
          --body "${{ inputs.comment-body }}" \
          --type "${{ inputs.command-type }}"

    - name: Execute GSD
      shell: bash
      run: |
        node ${{ github.action_path }}/index.js \
          --issue "${{ inputs.issue-number }}" \
          --command "${{ inputs.command-type }}"

    - name: Format response
      shell: bash
      run: |
        node ${{ github.action_path }}/scripts/format-response.js

    - name: Set outputs
      shell: bash
      run: |
        echo "response-file=response.md" >> $GITHUB_OUTPUT
        echo "has-artifacts=true" >> $GITHUB_OUTPUT
```

### Simplified Workflow Using Composite Action

```yaml
name: GSD Bot

on:
  issue_comment:
    types: [created]

permissions:
  contents: read
  issues: write
  pull-requests: write

jobs:
  gsd-bot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Parse comment and execute GSD
        id: gsd
        uses: ./.github/actions/gsd-bot
        with:
          comment-body: ${{ github.event.comment.body }}
          issue-number: ${{ github.event.issue.number }}
          command-type: ${{ steps.parse.outputs.type }}

      - name: Post response
        run: |
          gh issue comment ${{ github.event.issue.number }} \
            --body-file ${{ steps.gsd.outputs.response-file }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Patterns to Follow

### Pattern 1: Least Privilege Permissions

**What:** Grant only the minimum permissions required for the workflow to function

**When:** Always, for security and compliance

**Why:** Limits blast radius if workflow is compromised

**Example:**

```yaml
permissions:
  contents: read # Only need to read repository files
  issues: write # Need to post comments
  pull-requests: write # Need to post PR comments
  # All other permissions default to none
```

**Source:** [GitHub Actions Security Documentation](https://docs.github.com/en/actions/security-guides/automatic-token-authentication) - HIGH confidence

### Pattern 2: Command Pattern for Bot Interactions

**What:** Use structured command format with clear verb-object syntax

**When:** Designing bot command interface

**Why:** Makes parsing easier and user experience more intuitive

**Example:**

```
@gsd-bot new-project "Project Name"
@gsd-bot help
@gsd-bot roadmap --phase=2
@gsd-bot status --feature="authentication"
```

**Implementation:**

```javascript
// parse-comment.js
function parseCommand(commentBody) {
  const match = commentBody.match(/@gsd-bot\s+(\w+)(?:\s+(.+))?/);
  if (!match) return null;

  return {
    trigger: "@gsd-bot",
    command: match[1], // new-project, help, roadmap, status
    args: match[2] || "",
  };
}
```

### Pattern 3: Edit-Last for Multi-Step Responses

**What:** Update the same comment for multi-step workflows instead of creating multiple comments

**When:** GSD workflow requires multiple steps with intermediate status

**Why:** Reduces comment noise and keeps related updates together

**Example:**

```bash
# Initial status comment
gh issue comment 123 --body "Analyzing project..."

# Update the same comment
gh issue comment --edit-last --body "Analysis complete. Creating roadmap..."

# Final update
gh issue comment --edit-last --body-file final-response.md
```

**Source:** [GitHub CLI Documentation](https://cli.github.com/manual/gh_issue_comment) - HIGH confidence

### Pattern 4: Artifact Persistence via Repository Commits

**What:** Store planning artifacts by committing them to the repository

**When:** Artifacts need to persist longer than 90 days or be part of project history

**Why:** Artifacts become part of codebase history, reviewable via git

**Example:**

```bash
# After GSD generates artifacts
git config user.name "gsd-bot[bot]"
git config user.email "gsd-bot[bot]@users.noreply.github.com"
git add .github/planning/
git commit -m "docs: generate project roadmap"
git push
```

### Pattern 5: Conditional Job Execution

**What:** Use job-level `if` conditions to skip unnecessary work

**When:** Validating commands or handling errors

**Why:** Saves workflow minutes and provides cleaner error handling

**Example:**

```yaml
jobs:
  validate:
    runs-on: ubuntu-latest
    outputs:
      is-valid: ${{ steps.validate.outputs.valid }}
    steps:
      - id: validate
        run: echo "valid=true" >> $GITHUB_OUTPUT

  execute:
    needs: validate
    if: needs.validate.outputs.is-valid == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Only runs if valid"
```

### Pattern 6: Issue vs PR Differentiation

**What:** Use conditional logic to handle issue comments differently from PR comments

**When:** Bot behavior should differ between issues and PRs

**Why:** Issues may be for planning, PRs may be for code review

**Example:**

```yaml
jobs:
  handle-comment:
    runs-on: ubuntu-latest
    steps:
      - name: Check if PR
        id: is-pr
        run: |
          if [ "${{ github.event.issue.pull_request }}" != "" ]; then
            echo "is-pr=true" >> $GITHUB_OUTPUT
          else
            echo "is-pr=false" >> $GITHUB_OUTPUT
          fi

      - name: Use different commands based on type
        run: |
          if [ "${{ steps.is-pr.outputs.is-pr }}" == "true" ]; then
            gh pr comment ...
          else
            gh issue comment ...
          fi
```

**Source:** [GitHub Events Documentation](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issue_comment) - HIGH confidence

## Anti-Patterns to Avoid

### Anti-Pattern 1: Excessive Permissions

**What:** Granting `write-all` or unnecessary permissions

**Why bad:** Major security risk if workflow is compromised

**Instead:** Use principle of least privilege

```yaml
# BAD
permissions: write-all

# GOOD
permissions:
  contents: read
  issues: write
  pull-requests: write
```

**Source:** [GitHub Security Best Practices](https://docs.github.com/en/actions/security-guides/automatic-token-authentication) - HIGH confidence

### Anti-Pattern 2: Synchronous Long-Running Operations

**What:** Running long GSD analyses directly in workflow job (may time out)

**Why bad:** GitHub Actions jobs have 6-hour timeout, users see no progress

**Instead:**

1. Break into smaller chunks
2. Use comment updates to show progress
3. For very long operations, consider async pattern with status comment

### Anti-Pattern 3: Direct API Calls Instead of GitHub CLI

**What:** Making direct REST API calls instead of using `gh` CLI

**Why bad:** Loses authentication handling, requires more boilerplate

**Instead:** Use GitHub CLI for all GitHub interactions

```bash
# BAD
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/$REPO/issues/$NUMBER/comments \
  -d '{"body": "response"}'

# GOOD
echo "response" | gh issue comment $NUMBER --body-file -
```

### Anti-Pattern 4: Ignoring Webhook Payload Structure

**What:** Assuming `github.event` has properties that don't exist

**Why bad:** Workflow fails with cryptic errors

**Instead:** Reference official webhook payload documentation

**Key issue_comment properties:**

- `github.event.comment.body` - Comment text
- `github.event.comment.user.login` - Who commented
- `github.event.issue.number` - Issue/PR number
- `github.event.issue.pull_request` - Boolean, PR vs issue
- `github.event.action` - Action type (created, edited, deleted)

**Source:** [Webhook Payload Documentation](https://docs.github.com/en/webhooks-and-events/webhooks/webhook-events-and-payloads#issue_comment) - HIGH confidence

### Anti-Pattern 5: Hardcoding Repository Details

**What:** Hardcoding repository names, owner, or paths

**Why bad:** Breaks when repository is forked or renamed

**Instead:** Use GitHub context variables

```bash
# BAD
REPO="myorg/myrepo"

# GOOD
REPO="${{ github.repository }}"
OWNER="${{ github.repository_owner }}"
```

### Anti-Pattern 6: Not Distinguishing Created vs Edited Comments

**What:** Triggering on all comment activity including edits

**Why bad:** Bot processes edited comments, causing duplicate work

**Instead:** Filter to only `created` activity type

```yaml
# BAD
on: issue_comment  # Triggers on created, edited, deleted

# GOOD
on:
  issue_comment:
    types: [created]  # Only trigger on new comments
```

**Source:** [Events That Trigger Workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issue_comment) - HIGH confidence

## Scalability Considerations

| Concern                     | At 100 users               | At 10K users          | At 1M users                         |
| --------------------------- | -------------------------- | --------------------- | ----------------------------------- |
| **Workflow execution time** | Single job (2-5 min)       | Single job (5-15 min) | Queued execution, cache results     |
| **Storage**                 | Repository commits         | Repository commits    | Dedicated storage service, S3       |
| **Rate limits**             | Within GITHUB_TOKEN limits | May hit API limits    | GitHub App with higher limits       |
| **Artifact retention**      | 90-day artifact retention  | Repository commits    | Separate artifact database          |
| **Concurrency**             | Sequential workflows       | Parallel jobs by repo | Distributed processing              |
| **Authentication**          | GITHUB_TOKEN               | Personal Access Token | GitHub App with installation tokens |

### Scaling Recommendations

**At 10K users:**

- Add caching for frequently accessed project data
- Use reusable workflows to reduce duplication
- Implement rate limit handling and backoff

**At 1M users:**

- Move from GITHUB_TOKEN to GitHub App for higher rate limits
- Consider external artifact storage (S3, database)
- Implement job queue for handling high concurrency
- Add telemetry and monitoring

## Suggested Build Order

Based on component dependencies, build in this order:

### Phase 1: Foundation (Core Infrastructure)

1. **GitHub Actions Workflow Skeleton**
   - Basic workflow file with issue_comment trigger
   - Minimal permissions configuration
   - Checkout and setup steps

2. **Command Parser**
   - Extract @gsd-bot trigger from comment body
   - Parse command type and arguments
   - Validate command syntax
   - Output structured command object

**Dependencies:** None (can start immediately)
**Tests:** Mock webhook payloads for various command formats

### Phase 2: Wrapper Integration

3. **GSD Skill Wrapper (Node.js)**
   - Accept command object from parser
   - Execute GSD skill via subprocess
   - Capture stdout/stderr
   - Handle process errors

4. **Response Formatter**
   - Parse GSD output
   - Transform to GitHub comment format
   - Add markdown formatting, code blocks

**Dependencies:** Requires Command Parser (Phase 1)
**Tests:** Mock GSD skill execution, verify output transformation

### Phase 3: GitHub Integration

5. **Response Publisher**
   - Implement gh comment posting
   - Handle both issue and PR comments
   - Add error handling for failed posts

6. **Artifact Storage**
   - Create .github/planning/ directory
   - Write GSD output to files
   - Commit artifacts to repository

**Dependencies:** Requires GSD Wrapper (Phase 2)
**Tests:** Real GitHub CLI calls on test repository

### Phase 4: Polish & Features

7. **Multi-Step Response Updates**
   - Implement --edit-last pattern
   - Add progress indicators
   - Handle long-running operations

8. **Branch Management (Optional)**
   - Create planning branches
   - Switch branches before artifact commits
   - Create PRs for planning artifacts

**Dependencies:** Requires Response Publisher (Phase 3)
**Tests:** Multi-command workflows, branch operations

### Phase 5: Production Readiness

9. **Error Handling**
   - Graceful error messages to users
   - Retry logic for transient failures
   - Logging and debugging support

10. **Security Hardening**
    - Authorization checks (who can invoke)
    - Input sanitization
    - Audit logging

**Dependencies:** Requires all previous phases
**Tests:** Security scenarios, failure cases

### Build Order Rationale

1. **Parser first:** Cannot execute GSD without knowing what command to run
2. **Wrapper second:** Need command structure before can wrap GSD execution
3. **Publisher third:** Cannot post responses without formatted output
4. **Branch management last:** Core functionality should work before adding optional features
5. **Security last:** Add after functional to avoid blocking development

## GitHub Actions Integration Patterns

### Pattern: Modular Workflows

Use reusable workflows for different GSD command types:

```yaml
# .github/workflows/gsd-bot-new-project.yml
name: GSD Bot - New Project

on:
  workflow_call:
    inputs:
      project-name:
        required: true
        type: string
    secrets:
      github-token:
        required: true

jobs:
  create-project:
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/workflows/gsd-bot-core.yml
        with:
          command-type: "new-project"
          args: ${{ inputs.project-name }}
```

### Pattern: Shared Composite Actions

Create reusable composite actions for common operations:

```yaml
# .github/actions/post-comment/action.yml
name: "Post Comment"
inputs:
  issue-number:
    required: true
  body-file:
    required: true
  is-pr:
    required: false
    default: "false"

runs:
  using: "composite"
  steps:
    - name: Post to issue
      if: inputs.is-pr == 'false'
      shell: bash
      run: |
        gh issue comment ${{ inputs.issue-number }} \
          --body-file ${{ inputs.body-file }}

    - name: Post to PR
      if: inputs.is-pr == 'true'
      shell: bash
      run: |
        gh pr comment ${{ inputs.issue-number }} \
          --body-file ${{ inputs.body-file }}
```

### Pattern: Context Propagation

Pass context data between jobs using job outputs:

```yaml
jobs:
  parse:
    runs-on: ubuntu-latest
    outputs:
      command: ${{ steps.parse.outputs.command }}
      user: ${{ steps.parse.outputs.user }}
    steps:
      - id: parse
        run: |
          echo "command=help" >> $GITHUB_OUTPUT
          echo "user=${{ github.event.comment.user.login }}" >> $GITHUB_OUTPUT

  execute:
    needs: parse
    runs-on: ubuntu-latest
    steps:
      - run: echo "User ${{ needs.parse.outputs.user }} wants ${{ needs.parse.outputs.command }}"
```

### Pattern: Artifact Data Transfer

Use artifacts to pass files between jobs:

```yaml
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - run: echo "output" > result.txt
      - uses: actions/upload-artifact@v4
        with:
          name: gsd-result
          path: result.txt

  consume:
    needs: generate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: gsd-result
      - run: cat result.txt
```

**Source:** [Artifact Storage Documentation](https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts) - HIGH confidence

### Pattern: Matrix Strategy for Multiple Commands

Process multiple command types in parallel:

```yaml
jobs:
  gsd-bot:
    strategy:
      matrix:
        command: [new-project, new-milestone, help, status]
    runs-on: ubuntu-latest
    steps:
      - name: Execute ${{ matrix.command }}
        if: contains(steps.parse.outputs.command, matrix.command)
        run: node wrapper.js --command ${{ matrix.command }}
```

## Environment Variables and Secrets

### Required Environment Variables

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  REPOSITORY: ${{ github.repository }}
  OWNER: ${{ github.repository_owner }}
  ISSUE_NUMBER: ${{ github.event.issue.number }}
  COMMENT_BODY: ${{ github.event.comment.body }}
  COMMENT_AUTHOR: ${{ github.event.comment.user.login }}
```

### Optional Secrets for Production

```yaml
# Claude API key (if using Anthropic API directly)
CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}

# Custom GitHub token with higher permissions (if needed)
CUSTOM_GITHUB_TOKEN: ${{ secrets.CUSTOM_GITHUB_TOKEN }}

# External storage credentials (S3, etc.)
S3_ACCESS_KEY: ${{ secrets.S3_ACCESS_KEY }}
S3_SECRET_KEY: ${{ secrets.S3_SECRET_KEY }}
```

## Sources

- [GitHub Actions Events - issue_comment](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issue_comment) - HIGH confidence
- [GitHub Webhook Payloads - issue_comment](https://docs.github.com/en/webhooks-and-events/webhooks/webhook-events-and-payloads#issue_comment) - HIGH confidence
- [GitHub CLI - issue comment](https://cli.github.com/manual/gh_issue_comment) - HIGH confidence
- [GitHub CLI - PR comment](https://cli.github.com/manual/gh_pr_comment) - HIGH confidence
- [GitHub Actions - Permissions](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#permissions) - HIGH confidence
- [GitHub Actions - Automatic Token Authentication](https://docs.github.com/en/actions/security-guides/automatic-token-authentication) - HIGH confidence
- [GitHub Actions - Artifact Storage](https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts) - HIGH confidence
- [GitHub Actions - Reusable Workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows) - HIGH confidence
- [GitHub Actions - Composite Actions](https://docs.github.com/en/actions/creating-actions/creating-a-composite-action) - HIGH confidence
- [GitHub Actions - Contexts](https://docs.github.com/en/actions/learn-github-actions/contexts) - HIGH confidence
