/**
 * Global test setup for GSD GitHub Action
 *
 * CRITICAL: @actions/core and @actions/github must be mocked here
 * because src/lib/github.js executes getOctokit() at module load time.
 * Without these global mocks, any test importing modules that use
 * github.js will fail with "getInput is not a function" errors.
 */
import { vi, afterEach } from 'vitest';
import createFetchMock from 'vitest-fetch-mock';

// ============================================================
// GLOBAL MOCKS FOR @actions PACKAGES
// These MUST be defined before any source modules are imported
// ============================================================

// Mock @actions/core - prevents github.js from failing on import
vi.mock('@actions/core', () => ({
  getInput: vi.fn(() => 'mock-token'),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
  error: vi.fn()
}));

// Mock @actions/github with full context
vi.mock('@actions/github', () => ({
  getOctokit: vi.fn(() => ({
    rest: {
      issues: {
        createComment: vi.fn(),
        listComments: vi.fn(),
        addLabels: vi.fn(),
        setLabels: vi.fn(),
        listLabelsOnIssue: vi.fn(),
        listLabelsForRepo: vi.fn(),
        createLabel: vi.fn()
      },
      repos: {
        getCollaboratorPermissionLevel: vi.fn()
      }
    },
    graphql: vi.fn(),
    paginate: vi.fn()
  })),
  context: {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    issue: { number: 123 },
    payload: {
      sender: { login: 'test-user' },
      comment: { id: 456 },
      issue: { number: 123 }
    },
    token: 'mock-token',
    server_url: 'https://github.com',
    repository: 'test-owner/test-repo',
    run_id: '12345',
    run_attempt: '1'
  }
}));

// ============================================================
// FETCH MOCKING
// ============================================================
const fetchMocker = createFetchMock(vi);
fetchMocker.enableMocks();

// ============================================================
// CLEANUP
// ============================================================
afterEach(() => {
  vi.clearAllMocks();
  fetchMocker.resetMocks();
});

export { fetchMocker };
