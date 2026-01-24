# Quick Task 013: Dedicated Parsers and Git Flow Fixes

## Problem

After quick-012, several issues remained with the label-triggered milestone creation workflow:

1. **Files not being pushed to repo** - Agent creates files but `pushBranchAndTags()` only does `git push`, not `git add`/`git commit`
2. **Git identity unknown** - Commits failed with "Author identity unknown"
3. **Log files committed** - ccr.log and output-*.txt were being committed to the repo
4. **Push rejected** - Concurrent commits caused "rejected - fetch first" errors
5. **Parser too rigid** - REQUIREMENTS.md parser couldn't handle format variations

## Solution

### Part 1: Git Commit/Push Flow Fixes

Updated `src/milestone/label-trigger.js` to:
- Check for changes with `git status --porcelain`
- Configure git identity: "Claude Code <claude-code@anthropic.com>"
- `git add -A` then `git reset HEAD -- ccr.log output-*.txt '*.log'` to exclude logs
- `git commit -m "chore: milestone created by GSD bot"`
- `git pull --rebase origin main` to handle concurrent commits
- Then `pushBranchAndTags()`

### Part 2: Dedicated Parsers for Each GSD File Type

Created specific parsers in `src/lib/planning-parser.js` for each file type:

| Parser | File | Extracts |
|--------|------|----------|
| `parseProject()` | PROJECT.md | title, coreValue, currentVersion |
| `parseRequirements()` | REQUIREMENTS.md | title, version, coreValue, status |
| `parseRoadmap()` | ROADMAP.md | title, version, status, totalPlans, phases |
| `parseState()` | STATE.md | milestone, phase, plan, status, lastActivity |
| `parsePlan()` | PLAN.md | phase, plan, type, wave, autonomous, objective, tasks |

Each parser handles format variations specific to that file type:
- Multiple title/version patterns for REQUIREMENTS.md
- Phase status detection from `[x]` checkboxes in ROADMAP.md
- YAML frontmatter + XML tasks in PLAN.md files
- Multiline Core Value text handling

## Files Changed

- `src/milestone/label-trigger.js` - Git add/commit/push flow, exclude logs
- `src/lib/planning-parser.js` - 5 dedicated parsers with format variations
- `src/lib/planning-parser.test.js` - 27 tests covering all parsers
- `dist/index.js` - Rebuild

## Commits

```
551e9d1 fix(parser): support REQUIREMENTS.md without version number
2b5246a fix(parser): correct title extraction and status detection
3a94eef feat(parser): add dedicated parsers for each GSD file type
f9ac941 fix(parser): make REQUIREMENTS.md parser more flexible
f795b29 fix(label-trigger): add git pull --rebase before push
6e84ba7 chore: remove accidentally committed log files
6e55d77 fix(label-trigger): exclude log files from commit using git reset
de65653 fix(label-trigger): only commit .planning directory, exclude log files
f1ded6c fix(label-trigger): use Claude Code identity for commits
2d07a2d fix(label-trigger): configure git identity before commit
```

## Verification

- 489 tests passing
- Parsers tested against real `.planning/` files
- All file formats correctly parsed
