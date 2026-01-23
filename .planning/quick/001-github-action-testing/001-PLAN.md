---
phase: quick-github-action-testing
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Build succeeds without errors"
    - "All tests pass locally"
    - "dist/index.js is generated and ready for action execution"
  artifacts:
    - path: "dist/index.js"
      exists: true
      min_lines: 1000
    - path: "licenses.txt"
      exists: true
  key_links:
    - from: "dist/index.js"
      to: "src/index.js"
      via: "ncc build"
      pattern: "ncc build"
---

<objective>
Verify GitHub Actions testing workflow is operational by running the build process and tests locally. This ensures the action is properly bundled and tests pass before pushing to the repository.

Purpose: Confirm the development workflow works correctly and catch any issues early.
Output: Passing build and test suite, ready-to-deploy dist/index.js
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md

This is a verification task for an existing GitHub Actions project. The workflow at `.github/workflows/test.yml` runs on push/PR, but we want to verify locally first.

Key files:

- `src/index.js` — Action entry point (bundled to dist/)
- `package.json` — Contains build and test scripts
- `.github/workflows/test.yml` — CI test workflow
  </context>

<tasks>

<task type="auto">
  <name>Build the GitHub Action</name>
  <files>dist/index.js, licenses.txt</files>
  <action>
    Run `npm run build` to bundle src/index.js into dist/index.js using @vercel/ncc.

    This produces:
    - dist/index.js — The bundled action ready for GitHub Actions execution
    - licenses.txt — License attribution file (required by GitHub Marketplace)

    The build command is: `ncc build src/index.js --license licenses.txt && rm -f dist/package.json`

  </action>
  <verify>
    Command: `npm run build && ls -la dist/index.js licenses.txt`
    Expected: Both files exist, dist/index.js is several thousand lines
  </verify>
  <done>
    Build completes successfully, dist/index.js and licenses.txt are generated
  </done>
</task>

<task type="auto">
  <name>Run test suite</name>
  <files>coverage/</files>
  <action>
    Run `npm run test:ci` to execute the full vitest test suite with coverage.

    This runs all tests in `src/**/*.test.js` files and generates coverage report.

  </action>
  <verify>
    Command: `npm run test:ci`
    Expected: All tests pass, coverage report generated in coverage/ directory
  </verify>
  <done>
    All tests pass, coverage report available at coverage/index.html (or lcov.info)
  </done>
</task>

</tasks>

<verification>
After both tasks complete:
1. `ls dist/index.js` — File should exist and be substantial (~15KB+)
2. `ls licenses.txt` — License attribution should exist
3. `npm run test:ci` — Should show all tests passing with coverage >90%
</verification>

<success_criteria>

- Build completes without errors
- dist/index.js is generated (ready for GitHub Actions)
- All tests pass with coverage report generated
- No lint or build warnings
  </success_criteria>

<output>
After completion, create `.planning/quick/001-github-action-testing/001-SUMMARY.md`
</output>
