# Phase 10: Test for Each Service, Method, Feature and Flow - Research

**Researched:** 2026-01-23
**Domain:** Node.js 24 ESM testing for GitHub Actions
**Confidence:** HIGH

## Summary

This research investigates testing strategies for a Node.js 24 ESM GitHub Action with multiple service modules (auth, git, GitHub API, LLM, milestone workflows). The codebase already has Vitest 4.0.18 installed, which is the optimal choice for ESM projects in 2026.

**Key findings:**
- Vitest is purpose-built for ESM, offers 10-20x faster test execution than Jest, and natively supports Node.js 24
- The project has 7 distinct module categories requiring different testing approaches (pure logic, GitHub API, git operations, error handling, workflow orchestrators, parsers/validators, LLM integration)
- fetch-mock or vitest-fetch-mock are the standard for mocking Octokit REST API calls (used by Octokit's own test suite)
- vi.mock() with hoisted mocks is the ESM-compatible pattern for mocking Node.js built-ins like child_process
- Colocated test files (module.test.js next to module.js) are recommended for this project size

**Primary recommendation:** Implement a layered testing strategy with unit tests for pure logic (parsers, validators), integration tests for service modules (auth, git, GitHub API), and focused workflow tests for orchestrators. Target 80%+ coverage with pragmatic mocking of external dependencies.

## Standard Stack

The established libraries/tools for Node.js 24 ESM testing:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^4.0.18 | Test framework | Native ESM support, 10-20x faster than Jest, designed for Vite ecosystem, already installed |
| @vitest/ui | latest | Test UI dashboard | Official Vitest browser-based test runner UI (optional but useful) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest-fetch-mock | latest | Mock fetch API | Mocking Octokit REST API calls (simpler than fetch-mock) |
| fetch-mock | latest | Advanced fetch mocking | If need more control (used by Octokit's own tests) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Jest 30 | Jest requires CJS/ESM transform overhead, 10-20x slower, not designed for Vite |
| vitest-fetch-mock | Manual vi.fn() mocks | More boilerplate, harder to maintain |
| Colocated tests | __tests__ directories | More overhead for this project size (23 modules) |

**Installation:**
```bash
npm install -D vitest-fetch-mock
# Optional: npm install -D @vitest/ui
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── auth/
│   ├── validator.js
│   ├── validator.test.js      # Unit tests for hasWriteAccess, checkAuthorization
│   ├── errors.js
│   └── errors.test.js
├── lib/
│   ├── parser.js
│   ├── parser.test.js          # Unit tests for parseComment, parseArguments
│   ├── validator.js
│   ├── validator.test.js       # Unit tests for validateCommand, sanitizeArguments
│   ├── github.js
│   └── github.test.js          # Integration tests with mocked Octokit
├── git/
│   ├── git.js
│   ├── git.test.js             # Integration tests with mocked child_process
│   ├── branches.js
│   └── branches.test.js
├── errors/
│   ├── formatter.js
│   ├── formatter.test.js       # Unit tests for error formatting
│   ├── handler.js
│   └── handler.test.js         # Integration tests with mocked GitHub API
├── llm/
│   ├── prompts.js
│   ├── prompts.test.js         # Unit tests (if pure functions)
│   └── config-generator.test.js
├── milestone/
│   ├── phase-executor.js
│   ├── phase-executor.test.js  # Integration tests with mocked exec
│   ├── phase-planner.js
│   └── phase-planner.test.js
└── index.test.js               # Integration tests for main entry point
```

### Pattern 1: Pure Function Unit Tests
**What:** Test pure logic without external dependencies (parsers, validators, formatters)
**When to use:** For modules that don't call external APIs or system commands
**Example:**
```javascript
// Source: Vitest official documentation
import { describe, it, expect } from 'vitest';
import { parseComment, parseArguments } from './parser.js';

describe('parseComment', () => {
  it('extracts command from @gsd-bot mention', () => {
    const result = parseComment('@gsd-bot new-milestone --name=v2');
    expect(result.command).toBe('new-milestone');
    expect(result.args).toBe('--name=v2');
  });

  it('returns null when bot not mentioned', () => {
    const result = parseComment('Regular comment text');
    expect(result).toBeNull();
  });

  it('normalizes command to lowercase', () => {
    const result = parseComment('@gsd-bot New-Milestone');
    expect(result.command).toBe('new-milestone');
  });
});
```

### Pattern 2: Mocking Octokit REST API
**What:** Use vitest-fetch-mock or fetch-mock to intercept HTTP requests
**When to use:** Testing auth/validator.js, lib/github.js, errors/handler.js
**Example:**
```javascript
// Source: Octokit request.js test suite + vitest-fetch-mock docs
import { describe, it, expect, beforeEach, vi } from 'vitest';
import createFetchMock from 'vitest-fetch-mock';
import { checkAuthorization } from './validator.js';

const fetchMocker = createFetchMock(vi);
fetchMocker.enableMocks();

describe('checkAuthorization', () => {
  beforeEach(() => {
    fetchMocker.resetMocks();
  });

  it('returns authorized true for admin users', async () => {
    fetchMocker.mockResponseOnce(JSON.stringify({
      permission: 'admin',
      role_name: 'admin'
    }));

    const result = await checkAuthorization(mockOctokit);

    expect(result.authorized).toBe(true);
    expect(result.permission).toBe('admin');
  });

  it('returns authorized false for read-only users', async () => {
    fetchMocker.mockResponseOnce(JSON.stringify({
      permission: 'read'
    }));

    const result = await checkAuthorization(mockOctokit);

    expect(result.authorized).toBe(false);
  });

  it('handles 404 as not a collaborator', async () => {
    fetchMocker.mockRejectOnce({
      status: 404
    });

    const result = await checkAuthorization(mockOctokit);

    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('not a collaborator');
  });
});
```

### Pattern 3: Mocking child_process for Git Operations
**What:** Use vi.mock() to mock exec/promisify for testing git commands
**When to use:** Testing git/git.js, git/branches.js
**Example:**
```javascript
// Source: Vitest mocking guide + GitHub discussions
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGitCommand, configureGitIdentity } from './git.js';

// Mock node:child_process with hoisted vi.mock()
vi.mock('node:child_process', () => ({
  exec: vi.fn((cmd, callback) => {
    // Simulate successful git command
    callback(null, { stdout: 'success', stderr: '' });
  })
}));

vi.mock('util', async () => {
  const actual = await vi.importActual('util');
  return {
    ...actual,
    promisify: (fn) => async (...args) => {
      return new Promise((resolve, reject) => {
        fn(...args, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });
    }
  };
});

describe('runGitCommand', () => {
  it('executes git command and returns stdout', async () => {
    const result = await runGitCommand('git status');
    expect(result).toBe('success');
  });

  it('throws error when git command fails', async () => {
    vi.mocked(exec).mockImplementationOnce((cmd, callback) => {
      callback(new Error('Command failed'), null);
    });

    await expect(runGitCommand('git invalid')).rejects.toThrow('Command failed');
  });
});
```

### Pattern 4: Mocking @actions/core and @actions/github
**What:** Mock GitHub Actions context and core utilities
**When to use:** Testing index.js, milestone workflows
**Example:**
```javascript
// Source: Vitest ESM mocking patterns
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as core from '@actions/core';
import * as github from '@actions/github';

vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
  error: vi.fn()
}));

vi.mock('@actions/github', () => ({
  context: {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    issue: { number: 123 },
    payload: {
      sender: { login: 'test-user' },
      comment: { id: 456 }
    }
  },
  getOctokit: vi.fn()
}));

describe('index.js main flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts inputs from action.yml', async () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      const inputs = {
        'issue-number': '123',
        'repo-owner': 'test-owner',
        'repo-name': 'test-repo',
        'comment-body': '@gsd-bot new-milestone'
      };
      return inputs[name];
    });

    // Test logic that uses core.getInput()
    expect(core.getInput('issue-number')).toBe('123');
  });
});
```

### Pattern 5: Integration Tests for Workflow Orchestrators
**What:** Test milestone/phase-executor.js, phase-planner.js with mocked CCR execution
**When to use:** Testing complex workflows that integrate multiple services
**Example:**
```javascript
// Source: Testing best practices 2026
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePhaseNumber, executePhaseExecutionWorkflow } from './phase-executor.js';

describe('parsePhaseNumber', () => {
  it('extracts phase from --phase flag', () => {
    expect(parsePhaseNumber('--phase 7')).toBe(7);
    expect(parsePhaseNumber('--phase=7')).toBe(7);
  });

  it('extracts phase from -p shorthand', () => {
    expect(parsePhaseNumber('-p 7')).toBe(7);
    expect(parsePhaseNumber('-p=7')).toBe(7);
  });

  it('extracts standalone phase number', () => {
    expect(parsePhaseNumber('7')).toBe(7);
  });

  it('throws error when phase cannot be parsed', () => {
    expect(() => parsePhaseNumber('')).toThrow('Phase number is required');
    expect(() => parsePhaseNumber('invalid')).toThrow('Could not parse');
  });
});

// Integration test with mocked exec
vi.mock('node:child_process');

describe('executePhaseExecutionWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes CCR command and parses output', async () => {
    // Mock exec to return structured output
    vi.mocked(execAsync).mockResolvedValueOnce({
      stdout: 'Completed: Task 1\nNext steps:\n- Step 1\n- Step 2',
      stderr: ''
    });

    const result = await executePhaseExecutionWorkflow(context, '7');

    expect(result.phaseNumber).toBe(7);
    expect(result.complete).toBe(true);
  });
});
```

### Anti-Patterns to Avoid

- **Testing implementation details:** Don't test private functions or internal state. Test public APIs and observable behavior.
- **Over-mocking:** Don't mock everything. Mock only external dependencies (HTTP, file system, exec). Keep business logic testable without mocks.
- **Brittle assertions:** Don't assert exact error messages. Test error conditions, not exact text (which may change).
- **No cleanup:** Always use `beforeEach` or `afterEach` to reset mocks. Failing to do so causes test pollution.
- **Ignoring async:** Don't forget `async/await` when testing promises. Missing await causes tests to pass incorrectly.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fetch mocking | Manual fetch stubs | vitest-fetch-mock | Handles edge cases (network errors, timeouts, response types), battle-tested by Octokit |
| Test coverage reporting | Custom coverage scripts | Vitest built-in `--coverage` | Integrated with c8/istanbul, generates JSON/HTML/LCOV reports |
| Test file discovery | Custom glob patterns | Vitest auto-discovery | Finds `.test.js` and `.spec.js` automatically, configurable via `include` |
| Async test utilities | Custom promise helpers | Vitest native async/await | Built-in support for promises, async/await, timers |
| Snapshot testing | Manual JSON comparisons | Vitest `toMatchSnapshot()` | Manages snapshot files, diffs, updates automatically |

**Key insight:** Vitest is a complete testing solution. Don't build custom test infrastructure—use what's included.

## Common Pitfalls

### Pitfall 1: ESM Hoisting Confusion with vi.mock()
**What goes wrong:** vi.mock() calls appear after imports but must be processed first, leading to "module not found" errors.
**Why it happens:** Developers write mocks after imports because that's the logical flow, but Vitest hoists vi.mock() calls to the top of the file automatically.
**How to avoid:**
- Always write vi.mock() calls at the top of test files, before imports
- Use `await vi.importActual()` inside mock factories for partial mocks
- Remember: vi.mock() is hoisted, but the factory function executes during import
**Warning signs:**
- "Cannot find module" errors when running tests
- Mocks not taking effect even though vi.mock() is called
- Different behavior between test files

### Pitfall 2: Not Resetting Mocks Between Tests
**What goes wrong:** Tests pass individually but fail when run together. Mock state leaks between tests.
**Why it happens:** Vitest maintains mock state across tests unless explicitly cleared.
**How to avoid:**
```javascript
import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.clearAllMocks(); // Clears call history
  // OR
  vi.resetAllMocks(); // Clears and removes implementations
  // OR
  vi.restoreAllMocks(); // Restores original implementations
});
```
**Warning signs:**
- Tests fail when run in suite but pass in isolation
- Mock call counts are wrong
- Test order affects results

### Pitfall 3: Mocking promisify Incorrectly
**What goes wrong:** Tests hang or fail with timeout when mocking `promisify(exec)`.
**Why it happens:** The mock doesn't properly simulate callback-to-promise conversion.
**How to avoid:** Mock both `exec` callback pattern AND `promisify` utility:
```javascript
vi.mock('node:child_process', () => ({
  exec: vi.fn((cmd, callback) => {
    callback(null, { stdout: 'output', stderr: '' });
  })
}));

vi.mock('util', async () => {
  const actual = await vi.importActual('util');
  return {
    ...actual,
    promisify: (fn) => async (...args) => {
      return new Promise((resolve, reject) => {
        fn(...args, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });
    }
  };
});
```
**Warning signs:**
- Test timeouts with no error
- Promises never resolve
- exec mocks never called

### Pitfall 4: Octokit Context Mismatch
**What goes wrong:** Tests fail because mocked Octokit doesn't match real API response structure.
**Why it happens:** GitHub API responses have nested data structures (response.data.permission, not response.permission).
**How to avoid:**
- Use fetch-mock to mock at HTTP layer (more realistic)
- Study actual API responses from GitHub API docs
- Mock complete response objects: `{ data: { permission: 'admin' } }`
**Warning signs:**
- "Cannot read property of undefined" in auth tests
- Tests pass but real API calls fail

### Pitfall 5: Testing Environment Pollution
**What goes wrong:** Tests fail in CI but pass locally, or vice versa.
**Why it happens:** Tests rely on environment variables or global state not properly isolated.
**How to avoid:**
- Mock environment variables explicitly
- Don't rely on actual GITHUB_TOKEN in tests
- Use `beforeEach` to set known test state
```javascript
beforeEach(() => {
  process.env.GITHUB_TOKEN = 'test-token-123';
});

afterEach(() => {
  delete process.env.GITHUB_TOKEN;
});
```
**Warning signs:**
- CI failures with "unauthorized" or "token not found"
- Tests that only pass with certain env vars set
- Different results on different machines

## Code Examples

Verified patterns from official sources:

### Vitest Configuration for Node.js ESM
```javascript
// Source: https://vitest.dev/config/
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false, // Don't auto-import describe/it (explicit imports preferred)
    environment: 'node', // Use Node.js environment (not jsdom)
    coverage: {
      provider: 'v8', // Use v8 for native Node.js coverage
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.js',
        '**/*.config.js'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    setupFiles: ['./test/setup.js'] // Optional: global test setup
  }
});
```

### Test Setup File
```javascript
// Source: vitest-fetch-mock docs
// test/setup.js
import { beforeAll, afterEach, vi } from 'vitest';
import createFetchMock from 'vitest-fetch-mock';

// Enable fetch mocking globally
const fetchMocker = createFetchMock(vi);
fetchMocker.enableMocks();

beforeAll(() => {
  // Global test setup
});

afterEach(() => {
  // Reset mocks after each test
  vi.clearAllMocks();
  fetchMocker.resetMocks();
});
```

### Package.json Test Scripts
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:run": "vitest run"
  }
}
```

### AAA Pattern Test Structure
```javascript
// Source: Testing best practices 2026
import { describe, it, expect } from 'vitest';

describe('Module Name', () => {
  it('describes expected behavior in plain English', () => {
    // Arrange: Setup test data and dependencies
    const input = 'test data';
    const expectedOutput = 'expected result';

    // Act: Execute the function under test
    const result = functionUnderTest(input);

    // Assert: Verify the outcome
    expect(result).toBe(expectedOutput);
  });
});
```

### Parallel Test Execution
```javascript
// Source: Vitest guide
// Vitest runs tests in parallel by default (one worker per CPU core)
// Use concurrent for tests that can run in parallel
describe('Fast parallel tests', () => {
  it.concurrent('test 1', async () => {
    // This test runs in parallel with others
  });

  it.concurrent('test 2', async () => {
    // Also runs in parallel
  });
});

// Use sequential for tests that must run in order
describe.sequential('Tests that need order', () => {
  it('runs first', () => {});
  it('runs second', () => {});
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest with babel-transform | Vitest native ESM | 2021-2023 | 10-20x faster tests, no transpilation |
| jest-fetch-mock | vitest-fetch-mock | 2023+ | Better ESM compatibility |
| Manual ESM/CJS interop | "type": "module" | Node 20+ | Native ESM, simpler imports |
| __tests__ directories | Colocated .test.js | 2024+ trend | Easier maintenance for small-medium projects |
| 100% coverage goals | 80-90% pragmatic coverage | 2025+ | Focus on critical paths, not artificial metrics |

**Deprecated/outdated:**
- **Jest for ESM projects**: Requires complex transforms, slower. Use Vitest.
- **Manual vi.fn() for fetch**: Use vitest-fetch-mock instead for less boilerplate.
- **Separate test directories for small projects**: Colocate tests with source for easier navigation.
- **Testing private functions**: Test public APIs and observable behavior only.

## Open Questions

Things that couldn't be fully resolved:

1. **LLM/CCR Integration Testing**
   - What we know: src/llm/agent.js is deprecated, actual execution uses stdin pipe to CCR
   - What's unclear: How to test CCR execution without running real LLM calls (expensive, slow, non-deterministic)
   - Recommendation: Mock exec for CCR commands, test output parsing separately. Consider integration tests with mock CCR responses if needed.

2. **GitHub Actions Environment Variables**
   - What we know: @actions/core and @actions/github rely on specific env vars (GITHUB_TOKEN, GITHUB_CONTEXT)
   - What's unclear: Best approach to mock entire GitHub Actions runtime environment
   - Recommendation: Use vi.mock() for @actions packages, provide mock context objects. Document required env vars in test setup.

3. **Test Coverage Threshold**
   - What we know: 75% minimum, 90%+ ideal for JavaScript
   - What's unclear: Appropriate threshold for this GitHub Action (has deprecated code, external integrations)
   - Recommendation: Start with 80% overall, require 90%+ for critical modules (auth, parser, validator), allow lower for workflow orchestrators (harder to test without full integration).

4. **Integration vs E2E Testing**
   - What we know: Should have unit tests for modules, integration tests for workflows
   - What's unclear: Whether to add E2E tests that run actual GitHub Action in test repository
   - Recommendation: Focus on unit and integration tests first. E2E testing via GitHub Actions can be added in later phase if needed (expensive to maintain).

## Sources

### Primary (HIGH confidence)
- [Vitest Official Guide](https://vitest.dev/guide/) - Getting started, configuration, testing patterns
- [Vitest Mocking Documentation](https://vitest.dev/guide/mocking) - Module mocking, ESM patterns, spies vs mocks
- [Vitest Configuration Reference](https://vitest.dev/config/) - Configuration options, coverage setup
- [Octokit request.js test suite](https://github.com/octokit/request.js/blob/main/test/request.test.ts) - Real-world example of Octokit testing with Vitest
- [Node.js Code Coverage Guide](https://nodejs.org/en/learn/test-runner/collecting-code-coverage) - Official Node.js coverage documentation

### Secondary (MEDIUM confidence)
- [Testing in 2026: Jest, React Testing Library, and Full Stack Testing Strategies](https://www.nucamp.co/blog/testing-in-2026-jest-react-testing-library-and-full-stack-testing-strategies) - 2026 testing landscape, Vitest vs Jest comparison
- [Vitest vs Jest 30: Why 2026 is the Year of Browser-Native Testing](https://dev.to/dataformathub/vitest-vs-jest-30-why-2026-is-the-year-of-browser-native-testing-2fgb) - Performance comparisons, ESM support analysis
- [GitHub - goldbergyoni/nodejs-testing-best-practices](https://github.com/goldbergyoni/nodejs-testing-best-practices) - Node.js testing patterns, coverage recommendations
- [How to Mock Fetch API in Vitest](https://runthatline.com/how-to-mock-fetch-api-with-vitest/) - vitest-fetch-mock examples
- [vitest-fetch-mock npm package](https://www.npmjs.com/package/vitest-fetch-mock) - Package documentation
- [Mock child_process.exec in Vitest](https://gist.github.com/joemaller/f9171aa19a187f59f406ef1ffe87d9ac) - Community example
- [Where to put your tests in a Node project](https://www.coreycleary.me/where-to-put-your-tests-in-a-node-project-structure) - Test file organization patterns
- [Colocation of Tests: A Cross-Language Perspective](https://itsmariodias.medium.com/colocation-of-tests-a-cross-language-perspective-982e75c872d8) - Colocated vs __tests__ tradeoffs

### Tertiary (LOW confidence)
- WebSearch results about GitHub Actions ESM support challenges - Some results from 2021-2024 may be outdated for 2026 landscape

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vitest is established standard for ESM, already installed in project
- Architecture: HIGH - Patterns verified from official docs and Octokit's own test suite
- Pitfalls: MEDIUM - Based on community discussions and common issues, not all project-specific

**Research date:** 2026-01-23
**Valid until:** 2026-02-23 (30 days - testing tools are relatively stable)

**Notes:**
- Vitest 4.0.18 already installed, no migration needed
- Project uses ESM exclusively ("type": "module"), Vitest is optimal choice
- 23 source modules identified across 7 categories
- No existing tests found, greenfield test implementation
- Focus on pragmatic coverage (80%+) rather than artificial 100% goal
