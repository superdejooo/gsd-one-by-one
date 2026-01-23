# Domain Pitfalls

**Domain:** GitHub Actions comment-triggered bots
**Researched:** 2026-01-21
**Overall Confidence:** MEDIUM

## Critical Pitfalls

Mistakes that cause rewrites, security vulnerabilities, or major issues.

### Pitfall 1: Insufficient GITHUB_TOKEN Permissions

**What goes wrong:** Workflow runs but fails when trying to perform operations because permissions weren't granted. Common failures:

- Cannot create branches (writes to repository)
- Cannot post comments back to issues/PRs
- Cannot update files
- Operations fail silently with cryptic error messages

**Why it happens:**

- Default `GITHUB_TOKEN` permissions are often read-only
- Workflow author forgets to explicitly set required permissions
- Organization-level restrictions override workflow settings
- Forked repository contexts have different permission rules

**Consequences:**

- Workflow appears to succeed but does nothing
- Users get no feedback about failures
- Bot becomes unusable for certain operations

**Prevention:**

```yaml
permissions:
  contents: write # Required for file operations, branches, commits
  issues: write # Required for commenting on issues
  pull-requests: write # Required for commenting on PRs
```

**Detection:**

- Look for "Resource not accessible by integration" errors
- Check workflow permissions are explicitly set
- Verify organization doesn't have overly restrictive permission policies

**Phase to address:** Foundation/Infrastructure setup

**Sources:**

- GitHub Actions automatic token authentication (MEDIUM confidence) - https://docs.github.com/en/actions/security-guides/automatic-token-authentication
- GITHUB_TOKEN permission restrictions (MEDIUM confidence) - verified from official docs

---

### Pitfall 2: Command Injection via Comment Parsing

**What goes wrong:** Attacker can execute arbitrary commands by crafting malicious issue comments. For example, if the bot parses comments like `/claude: {user_input}` and passes user_input directly to shell or eval.

**Why it happens:**

- Comment body (`${{ github.event.comment.body }}`) is treated as trusted input
- Direct execution of comment content in shell commands
- No sanitization or validation of command structure
- Using `run: ${{ github.event.comment.body }}` or similar patterns

**Consequences:**

- Remote code execution in CI/CD environment
- Secret exfiltration via workflow logs
- Repository compromise

**Prevention:**

```yaml
# BAD - Direct execution
- run: claude ${{ github.event.comment.body }}

# GOOD - Extract and validate
- name: Extract command
  id: command
  run: |
    COMMENT="${{ github.event.comment.body }}"
    # Extract only approved commands
    COMMAND=$(echo "$COMMENT" | grep -oP '(?<=/claude:).*' | head -c 1000)
    echo "command=$COMMAND" >> $GITHUB_OUTPUT

# BETTER - Use dedicated action
- uses: your-org/parse-comment-action@v1
  with:
    body: ${{ github.event.comment.body }}
```

**Detection:**

- Audit workflow files for direct context usage in `run:` steps
- Check if comment body is passed directly to shell commands
- Look for `eval` or command substitution patterns

**Phase to address:** Command parsing implementation

**Sources:**

- GitHub Actions security hardening (HIGH confidence) - https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions

---

### Pitfall 3: Token Credential Leakage in Logs

**What goes wrong:** Sensitive tokens (Claude API key, GitHub token) appear in workflow logs and are visible to all repository users.

**Why it happens:**

- Secrets printed in debug output or error messages
- Using `echo $SECRET` for debugging
- Secrets passed as command arguments visible in process listing
- Not using `::add-mask::` for generated sensitive values

**Consequences:**

- API keys stolen and abused
- GitHub token used for unauthorized operations
- Credential rotation required

**Prevention:**

```yaml
# Use environment variables for secrets
env:
  CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}

# Mask sensitive values
- name: Run Claude
  run: |
    RESPONSE=$(claude --api-key $CLAUDE_API_KEY "$INPUT")
    echo "::add-mask::$RESPONSE"  # Mask if response contains sensitive data

# Never echo secrets directly
- run: echo "API key is ${{ secrets.CLAUDE_API_KEY }}"  # DON'T DO THIS
```

**Detection:**

- Check workflow logs for masked values (should show `***`)
- Audit workflow files for `echo ${{ secrets.* }}` patterns
- Review debug statements

**Phase to address:** Authentication setup

**Sources:**

- GitHub Actions security hardening (HIGH confidence) - https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions

---

### Pitfall 4: Commit Failures Due to Missing Git Configuration

**What goes wrong:** Workflow attempts to create commits but fails with "Author identity unknown" or "Please tell me who you are."

**Why it happens:**

- `actions/checkout` doesn't configure git user by default
- Bot needs to create branches and push commits
- Git requires user.name and user.email for commits

**Consequences:**

- Workflow fails after processing command
- Changes are lost
- No feedback to user about partial success

**Prevention:**

```yaml
- uses: actions/checkout@v4
  with:
    token: ${{ secrets.GITHUB_TOKEN }} # Must use token parameter for writes

- name: Configure git
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"

# Now commits will work
- name: Create commit
  run: |
    git commit -m "Update files"
    git push
```

**Detection:**

- Look for git commands in workflow
- Check if git config is set before commit operations
- Verify `actions/checkout` has token parameter for write operations

**Phase to address:** File operations implementation

**Sources:**

- actions/checkout README (HIGH confidence) - https://github.com/actions/checkout

---

### Pitfall 5: Wrong Comment Event Triggered

**What goes wrong:** Bot doesn't respond to PR review comments, only responds to general issue/PR comments, or vice versa.

**Why it happens:**

- Using `issue_comment` event expecting PR diff comments
- Not understanding difference between `issue_comment` and `pull_request_review_comment`
- `issue_comment` fires for general comments (not diff comments)
- `pull_request_review_comment` fires only for inline diff comments

**Consequences:**

- Bot is unresponsive in certain contexts
- User confusion about when bot works
- Missed automation opportunities

**Prevention:**

```yaml
# For general issue/PR comments (not inline diff)
on:
  issue_comment:
    types: [created]

# For PR inline diff comments only
on:
  pull_request_review_comment:
    types: [created]

# For both, you need separate workflows or conditional logic
```

**Detection:**

- Verify which event types bot should support
- Test both general comments and inline review comments
- Check if `github.event.comment` has expected fields

**Phase to address:** Workflow event configuration

**Sources:**

- GitHub webhook events (HIGH confidence) - verified from official docs showing issue_comment vs pull_request_review_comment distinction

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or functional limitations.

### Pitfall 6: No Comment Command Validation

**What goes wrong:** Bot accepts any comment as a command, processing noise and spam, wasting API credits and workflow runs.

**Why it happens:**

- No command prefix check (e.g., `/claude:` prefix)
- No authorization check (any user can trigger)
- No rate limiting per issue/user

**Consequences:**

- Wasted compute resources
- API quota exhaustion (especially important for paid Claude API)
- Spam processing
- Cost overruns

**Prevention:**

```yaml
- name: Validate comment
  run: |
    COMMENT="${{ github.event.comment.body }}"
    if [[ ! "$COMMENT" =~ ^/claude: ]]; then
      echo "Not a command for this bot"
      exit 78  # Neutral exit code
    fi

    # Optional: Check for authorized users/teams
    AUTHOR="${{ github.event.comment.user.login }}"
    if ! is_authorized "$AUTHOR"; then
      echo "User not authorized"
      exit 78
    fi
```

**Detection:**

- Review workflow for command prefix validation
- Check for authorization logic
- Monitor for unusual workflow run patterns

**Phase to address:** Command parsing implementation

---

### Pitfall 7: Branch Naming Conflicts

**What goes wrong:** Multiple concurrent runs create branches with same names, causing conflicts and push failures.

**Why it happens:**

- Static branch names (e.g., `gsd/update`)
- No unique identifier per workflow run
- Run number not incorporated into branch name

**Consequences:**

- Concurrent runs fail
- Race conditions
- Lost changes

**Prevention:**

```yaml
- name: GSD Branch Setup
  run: |
    BRANCH_NAME="gsd/update-${GITHUB_RUN_NUMBER}-${GITHUB_SHA:0:7}"
    git checkout -b "$BRANCH_NAME"
    echo "branch_name=$BRANCH_NAME" >> $GITHUB_OUTPUT
```

**Detection:**

- Look for static branch names in workflow
- Check if multiple workflow runs could conflict
- Test concurrent runs

**Phase to address:** Branch management implementation

---

### Pitfall 8: Large Repo Checkout Performance Issues

**What goes wrong:** Workflow takes extremely long because it checks out entire repository including full history for large repos.

**Why it happens:**

- Not using `fetch-depth: 0` for shallow clone
- Not using `sparse-checkout` for partial checkout
- Default checkout fetches full commit history

**Consequences:**

- Slow workflow execution (minutes vs seconds)
- High runner usage
- Poor user experience

**Prevention:**

```yaml
- uses: actions/checkout@v4
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    fetch-depth: 0 # Shallow clone - latest commit only
    # sparse-checkout: 'src/'  # Optional: check out only needed paths
```

**Detection:**

- Measure workflow execution time
- Check checkout action for fetch-depth parameter
- Monitor runner usage

**Phase to address:** Workflow optimization

**Sources:**

- actions/checkout README (HIGH confidence) - verified sparse-checkout and fetch-depth options

---

### Pitfall 9: No Error Communication to User

**What goes wrong:** Bot fails silently or only logs to workflow logs, leaving user with no feedback about what went wrong.

**Why it happens:**

- Error only exits workflow, doesn't post comment back
- No try-catch or error handling around API calls
- Claude API errors not captured and reported

**Consequences:**

- Poor user experience
- Hard to debug issues
- Users don't know to retry

**Prevention:**

```yaml
- name: Run Claude
  id: claude
  continue-on-error: true
  run: |
    OUTPUT=$(claude --api-key $CLAUDE_API_KEY "$INPUT" 2>&1)
    EXIT_CODE=$?

    if [ $EXIT_CODE -ne 0 ]; then
      # Post error back to issue
      gh issue comment $ISSUE_NUMBER --body "Error: $OUTPUT"
      exit $EXIT_CODE
    fi

    echo "output=$OUTPUT" >> $GITHUB_OUTPUT
```

**Detection:**

- Check if error handling posts comments back
- Look for `continue-on-error: true` without notification
- Test error scenarios

**Phase to address:** Error handling implementation

---

### Pitfall 10: Missing Checkout Token for Write Operations

**What goes wrong:** `actions/checkout` uses default GITHUB_TOKEN but operations requiring authentication fail.

**Why it happens:**

- Checkout action by default uses `github.token` but for write operations, need explicit token
- Not understanding token parameter in checkout action
- Separate authentication scope for checkout vs API calls

**Consequences:**

- Push operations fail with authentication errors
- Cannot create branches or commits
- Works in read-only but fails in write scenarios

**Prevention:**

```yaml
- uses: actions/checkout@v4
  with:
    token: ${{ secrets.GITHUB_TOKEN }} # Explicit for write operations
```

**Detection:**

- Verify checkout has token parameter if doing writes
- Check for authentication errors in git operations
- Test commit/push operations

**Phase to address:** File operations implementation

**Sources:**

- actions/checkout README (HIGH confidence) - verified token parameter usage

**Confidence:** HIGH

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 11: No Workflow Run Artifact Persistence

**What goes wrong:** Claude outputs or intermediate files are lost after workflow run, preventing debugging.

**Prevention:**

```yaml
- name: Save outputs
  uses: actions/upload-artifact@v4
  with:
    name: claude-output-${{ github.run_number }}
    path: ./claude-output.json
```

**Phase to address:** Debugging setup

---

### Pitfall 12: No Request ID or Correlation Tracking

**What goes wrong:** Cannot correlate Claude API calls with specific workflow runs when debugging issues.

**Prevention:**

- Include GITHUB_RUN_ID in Claude context
- Return workflow URL in bot comment
- Use request IDs for API calls

**Phase to address:** Observability implementation

---

### Pitfall 13: Workflow Run Name Not Informative

**What goes wrong:** Workflow list shows generic names, making it hard to identify which run corresponds to which issue.

**Prevention:**

```yaml
name: GSD Bot - ${{ github.event.comment.user.login }} on #${{ github.event.issue.number }}
```

**Phase to address:** Workflow configuration

---

## Phase-Specific Warnings

| Phase Topic               | Likely Pitfall                        | Mitigation                                                 |
| ------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Foundation/Infrastructure | Insufficient GITHUB_TOKEN permissions | Explicitly set contents: write, issues: write              |
| Command Parsing           | Command injection via comment parsing | Validate and sanitize all input                            |
| Command Parsing           | No command validation                 | Add prefix check and authorization                         |
| Authentication            | Token leakage in logs                 | Use ::add-mask:: and env vars                              |
| File Operations           | Missing git configuration             | Set user.name and user.email before commits                |
| File Operations           | Checkout token missing                | Add token parameter to actions/checkout                    |
| Workflow Events           | Wrong comment event type              | Use issue_comment vs pull_request_review_comment correctly |
| Branch Management         | Branch naming conflicts               | Use run number/SHA in branch names                         |
| Workflow Optimization     | Large repo checkout                   | Use fetch-depth: 0 and sparse-checkout                     |
| Error Handling            | No user communication                 | Post errors back via gh comment                            |
| Observability             | No correlation tracking               | Include run IDs in outputs                                 |

## LOW Confidence Areas Requiring Validation

The following areas could not be fully verified and should be validated during implementation:

1. **GITHUB_TOKEN Event Triggering Limitation:** Some sources suggest GITHUB_TOKEN cannot trigger other workflows (like repository_dispatch), but this was not definitively confirmed in official documentation. Verify if your bot needs to trigger other workflows.

2. **Claude CLI Authentication:** Official documentation URL returned 404. Verify current Claude CLI authentication methods (likely environment variable ANTHROPIC_API_KEY).

3. **GitHub CLI in GitHub Actions:** Some documentation URLs returned 404. Verify current best practices for using `gh` command in workflows (likely uses GITHUB_TOKEN automatically).

4. **Forked Repository Permissions:** While docs mention write tokens from forks can be restricted, verify exact behavior for your use case if you expect fork interactions.

5. **PR Comment vs Issue Comment Scope:** Verify whether issue_comment event can access PR-specific fields and if separate handling is needed.

6. **Rate Limits:** GitHub API and GitHub Actions have rate limits that were not fully documented in searched sources. Monitor and implement rate limiting.

## Gaps to Address

- Verify Claude CLI current authentication mechanism
- Test GITHUB_TOKEN permissions in actual repository environment
- Validate behavior with both issues and pull requests
- Test concurrent workflow runs and branch conflicts
- Measure performance with various repository sizes
- Confirm exact error messages for common failure modes

## Sources

| Finding                                      | Confidence | Source                                                                                     |
| -------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| GITHUB_TOKEN permissions                     | HIGH       | https://docs.github.com/en/actions/security-guides/automatic-token-authentication          |
| Security best practices                      | HIGH       | https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions   |
| issue_comment vs pull_request_review_comment | HIGH       | https://docs.github.com/en/webhooks/webhook-events-and-payloads (official docs comparison) |
| actions/checkout token parameter             | HIGH       | https://github.com/actions/checkout (README)                                               |
| actions/checkout sparse-checkout             | HIGH       | https://github.com/actions/checkout (README)                                               |
| GITHUB_TOKEN event triggering limitation     | LOW        | WebSearch results contradictory, needs verification                                        |
| Claude CLI authentication                    | LOW        | Official docs URL returned 404                                                             |
| GitHub CLI in workflows                      | LOW        | Some docs returned 404                                                                     |
