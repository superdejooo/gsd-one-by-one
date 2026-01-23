# Quick Task 004: Add Commit and Push After Agent Completes

## Context

The GSD quick skill (`/gsd:quick`) orchestrates planning and execution but currently relies on the executor agent to handle commits. The user wants an explicit commit and push step AFTER the executor agent returns, ensuring all changes are committed and pushed to remote.

## Current Behavior

- Step 8 of gsd:quick does commit but doesn't push
- The executor agent may or may not commit during execution
- No explicit push to remote after completion

## Desired Behavior

After the executor agent completes:
1. Stage all changes (plan, summary, any code changes)
2. Commit with standard GSD format
3. Push to remote branch

## Tasks

<task id="1" priority="high">
<title>Locate and update gsd:quick skill definition</title>
<description>
Find where the gsd:quick skill is defined (likely in get-shit-done-cc package or local .claude/skills) and modify Step 8 to add git push after commit.

The change should:
1. After the commit in Step 8, add: `git push origin HEAD`
2. Handle push failures gracefully (log warning, don't fail the task)
3. Update the completion output to show push status

Modified Step 8 should look like:
```bash
# Stage and commit
git add ${QUICK_DIR}/${next_num}-PLAN.md
git add ${QUICK_DIR}/${next_num}-SUMMARY.md
git add .planning/STATE.md
git add -A  # Catch any other changes from executor

git commit -m "docs(quick-${next_num}): ${DESCRIPTION}

Quick task completed.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# Push to remote
git push origin HEAD || echo "Warning: Push failed, changes are committed locally"

commit_hash=$(git rev-parse --short HEAD)
```
</description>
<acceptance_criteria>
- [ ] gsd:quick Step 8 includes git push after commit
- [ ] Push failure doesn't break the workflow
- [ ] Completion output shows commit hash and push status
</acceptance_criteria>
</task>

## Notes

- This is a skill definition change, not code change
- The skill may be in npm package (get-shit-done-cc) or local override
- If in npm package, may need to create local override in .claude/skills/

## Verification

After change:
1. Run `/gsd:quick` with a test task
2. Verify changes are committed AND pushed to remote
3. Check `git log` and `git status` show clean state
