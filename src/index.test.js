import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @actions/core FIRST (before any imports that use it)
vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
  error: vi.fn()
}));

// Mock @actions/github
vi.mock('@actions/github', () => {
  const mockOctokit = {
    rest: {
      repos: {
        getCollaboratorPermissionLevel: vi.fn()
      },
      issues: {
        createComment: vi.fn(),
        setLabels: vi.fn()
      }
    },
    graphql: vi.fn()
  };

  return {
    context: {
      repo: { owner: 'test-owner', repo: 'test-repo' },
      issue: { number: 123 },
      payload: {
        sender: { login: 'test-user' },
        comment: { id: 456 }
      },
      token: 'mock-token',
      server_url: 'https://github.com',
      repository: 'test-owner/test-repo',
      run_id: '12345',
      run_attempt: '1'
    },
    getOctokit: vi.fn(() => mockOctokit)
  };
});

// Mock all module dependencies
vi.mock('./auth/index.js', () => ({
  checkAuthorization: vi.fn(),
  formatAuthorizationError: vi.fn()
}));

vi.mock('./lib/github.js', () => ({
  octokit: {
    rest: {
      repos: {
        getCollaboratorPermissionLevel: vi.fn()
      },
      issues: {
        createComment: vi.fn(),
        setLabels: vi.fn()
      }
    },
    graphql: vi.fn()
  },
  postComment: vi.fn(),
  getWorkflowRunUrl: vi.fn(() => 'https://example.com/run/123')
}));

vi.mock('./lib/parser.js', () => ({
  parseComment: vi.fn(),
  parseArguments: vi.fn()
}));

vi.mock('./lib/validator.js', () => ({
  validateCommand: vi.fn(),
  sanitizeArguments: vi.fn()
}));

vi.mock('./lib/config.js', () => ({
  loadConfig: vi.fn()
}));

vi.mock('./errors/formatter.js', () => ({
  formatErrorComment: vi.fn(),
  formatSuccessComment: vi.fn()
}));

vi.mock('./errors/handler.js', () => ({
  withErrorHandling: vi.fn()
}));

vi.mock('./git/git.js', () => ({
  runGitCommand: vi.fn(),
  createAndSwitchBranch: vi.fn(),
  switchBranch: vi.fn(),
  configureGitIdentity: vi.fn()
}));

vi.mock('./git/branches.js', () => ({
  createMilestoneBranch: vi.fn(),
  createPhaseBranch: vi.fn(),
  slugify: vi.fn(),
  branchExists: vi.fn()
}));

vi.mock('./milestone/index.js', () => ({
  executeMilestoneWorkflow: vi.fn(),
  parseMilestoneNumber: vi.fn()
}));

vi.mock('./milestone/planning-docs.js', () => ({
  createPlanningDocs: vi.fn(),
  generateProjectMarkdown: vi.fn(),
  generateStateMarkdown: vi.fn(),
  generateRoadmapMarkdown: vi.fn()
}));

vi.mock('./milestone/phase-planner.js', () => ({
  executePhaseWorkflow: vi.fn()
}));

vi.mock('./milestone/phase-executor.js', () => ({
  executePhaseExecutionWorkflow: vi.fn()
}));

// Import modules AFTER mocks are defined
import * as core from '@actions/core';
import { withErrorHandling } from './errors/handler.js';
import { checkAuthorization, formatAuthorizationError } from './auth/index.js';
import { parseComment, parseArguments } from './lib/parser.js';
import { validateCommand, sanitizeArguments } from './lib/validator.js';
import { postComment, getWorkflowRunUrl } from './lib/github.js';
import { configureGitIdentity } from './git/git.js';
import { executeMilestoneWorkflow } from './milestone/index.js';
import { executePhaseWorkflow } from './milestone/phase-planner.js';
import { executePhaseExecutionWorkflow } from './milestone/phase-executor.js';

describe('index.js command dispatch', () => {
  let capturedOperation;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Capture the operation passed to withErrorHandling and execute it
    vi.mocked(withErrorHandling).mockImplementation(async (operation, context) => {
      capturedOperation = operation;
      // Execute the operation and return success
      const result = await operation();
      return { success: true, ...result };
    });

    // Default mock implementations
    vi.mocked(core.getInput).mockImplementation((name) => {
      const inputs = {
        'issue-number': '123',
        'repo-owner': 'test-owner',
        'repo-name': 'test-repo',
        'comment-body': '@gsd-bot new-milestone'
      };
      return inputs[name] || '';
    });

    vi.mocked(checkAuthorization).mockResolvedValue({
      authorized: true,
      username: 'test-user',
      permission: 'write'
    });

    vi.mocked(parseComment).mockReturnValue({
      botMention: '@gsd-bot new-milestone',
      command: 'new-milestone',
      args: ''
    });

    vi.mocked(parseArguments).mockReturnValue({});
    vi.mocked(validateCommand).mockReturnValue(undefined);
    vi.mocked(sanitizeArguments).mockReturnValue({});
    vi.mocked(configureGitIdentity).mockResolvedValue(undefined);
    vi.mocked(formatAuthorizationError).mockReturnValue('Authorization error message');
    vi.mocked(postComment).mockResolvedValue(undefined);
  });

  it('imports and runs index.js module', async () => {
    // Import index.js which will execute the main logic
    await import('./index.js');

    // Verify withErrorHandling was called
    expect(withErrorHandling).toHaveBeenCalled();

    // Verify core.getInput was called to extract GitHub Action inputs
    expect(core.getInput).toHaveBeenCalledWith('issue-number');
    expect(core.getInput).toHaveBeenCalledWith('repo-owner');
    expect(core.getInput).toHaveBeenCalledWith('repo-name');
    expect(core.getInput).toHaveBeenCalledWith('comment-body');
  });
});
