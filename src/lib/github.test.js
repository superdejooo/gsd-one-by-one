import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock octokit
const mockOctokit = {
  rest: {
    issues: {
      createComment: vi.fn()
    }
  }
};

// Mock @actions/core (globally mocked in setup.js)
const core = await import('@actions/core');

// Mock @actions/github
vi.mock('@actions/github', async () => {
  const actual = await vi.importActual('@actions/github');
  return {
    ...actual,
    getOctokit: vi.fn(() => mockOctokit),
    context: {
      token: 'mock-token',
      server_url: 'https://github.com',
      repository: 'owner/repo',
      run_id: '12345',
      run_attempt: '1'
    }
  };
});

// Import after mocking
const { postComment, getWorkflowRunUrl } = await import('./github.js');

describe('postComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls createComment with owner, repo, issue_number, body', async () => {
    mockOctokit.rest.issues.createComment.mockResolvedValue({});

    await postComment('test-owner', 'test-repo', 123, 'Test comment');

    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      body: 'Test comment'
    });
  });

  it('logs success message', async () => {
    mockOctokit.rest.issues.createComment.mockResolvedValue({});

    await postComment('test-owner', 'test-repo', 456, 'Another comment');

    expect(core.info).toHaveBeenCalledWith('Comment posted to issue #456');
  });

  it('handles multiline comment bodies', async () => {
    mockOctokit.rest.issues.createComment.mockResolvedValue({});

    const multilineBody = `# Test Comment

This is a multiline comment.

- Item 1
- Item 2`;

    await postComment('test-owner', 'test-repo', 789, multilineBody);

    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 789,
      body: multilineBody
    });
  });
});

describe('getWorkflowRunUrl', () => {
  it('returns correct URL format', () => {
    const url = getWorkflowRunUrl();
    expect(url).toBe('https://github.com/owner/repo/actions/runs/12345/attempts/1');
  });

  it('includes server_url', () => {
    const url = getWorkflowRunUrl();
    expect(url).toMatch(/^https:\/\/github\.com/);
  });

  it('includes repository', () => {
    const url = getWorkflowRunUrl();
    expect(url).toContain('owner/repo');
  });

  it('includes run_id', () => {
    const url = getWorkflowRunUrl();
    expect(url).toContain('12345');
  });

  it('includes run_attempt', () => {
    const url = getWorkflowRunUrl();
    expect(url).toContain('/attempts/1');
  });
});
