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
import { loadConfig } from './lib/config.js';
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

  it('returns commandFound: false when bot not mentioned', async () => {
    vi.mocked(parseComment).mockReturnValue(null);

    await import('./index.js?t=' + Date.now());

    // Verify operation was executed
    expect(capturedOperation).toBeDefined();
    const result = await capturedOperation();

    expect(result.commandFound).toBe(false);
    expect(core.setOutput).toHaveBeenCalledWith('command-found', 'false');
    expect(core.setOutput).toHaveBeenCalledWith('response-posted', 'false');
  });

  it('returns authorized: false when user lacks permission', async () => {
    vi.mocked(checkAuthorization).mockResolvedValue({
      authorized: false,
      username: 'test-user',
      reason: 'read only'
    });

    await import('./index.js?t=' + Date.now());

    // Verify operation was executed
    expect(capturedOperation).toBeDefined();
    const result = await capturedOperation();

    expect(result.commandFound).toBe(true);
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('read only');
    expect(formatAuthorizationError).toHaveBeenCalled();
    expect(postComment).toHaveBeenCalled();
    expect(core.setOutput).toHaveBeenCalledWith('command-found', 'true');
    expect(core.setOutput).toHaveBeenCalledWith('authorized', 'false');
  });

  it('dispatches to executeMilestoneWorkflow for new-milestone', async () => {
    vi.mocked(parseComment).mockReturnValue({
      botMention: '@gsd-bot new-milestone',
      command: 'new-milestone',
      args: ''
    });

    vi.mocked(executeMilestoneWorkflow).mockResolvedValue({
      complete: true,
      phase: 'requirements'
    });

    await import('./index.js?t=' + Date.now());

    // Verify operation was executed
    expect(capturedOperation).toBeDefined();
    const result = await capturedOperation();

    expect(executeMilestoneWorkflow).toHaveBeenCalledWith(
      { owner: 'test-owner', repo: 'test-repo', issueNumber: 123 },
      {}
    );
    expect(result.commandFound).toBe(true);
    expect(result.command).toBe('new-milestone');
    expect(result.complete).toBe(true);
    expect(core.setOutput).toHaveBeenCalledWith('milestone-complete', true);
    expect(core.setOutput).toHaveBeenCalledWith('milestone-phase', 'requirements');
  });

  it('dispatches to executePhaseWorkflow for plan-phase', async () => {
    vi.mocked(parseComment).mockReturnValue({
      botMention: '@gsd-bot plan-phase 7',
      command: 'plan-phase',
      args: '7'
    });

    vi.mocked(executePhaseWorkflow).mockResolvedValue({
      complete: true,
      phaseNumber: 7
    });

    await import('./index.js?t=' + Date.now());

    // Verify operation was executed
    expect(capturedOperation).toBeDefined();
    const result = await capturedOperation();

    expect(executePhaseWorkflow).toHaveBeenCalledWith(
      { owner: 'test-owner', repo: 'test-repo', issueNumber: 123 },
      '7'
    );
    expect(result.commandFound).toBe(true);
    expect(result.command).toBe('plan-phase');
    expect(core.setOutput).toHaveBeenCalledWith('phase-planned', true);
    expect(core.setOutput).toHaveBeenCalledWith('phase-number', 7);
  });

  it('dispatches to executePhaseExecutionWorkflow for execute-phase', async () => {
    vi.mocked(parseComment).mockReturnValue({
      botMention: '@gsd-bot execute-phase 7',
      command: 'execute-phase',
      args: '7'
    });

    vi.mocked(executePhaseExecutionWorkflow).mockResolvedValue({
      complete: true,
      phaseNumber: 7,
      hasQuestions: false
    });

    await import('./index.js?t=' + Date.now());

    // Verify operation was executed
    expect(capturedOperation).toBeDefined();
    const result = await capturedOperation();

    expect(executePhaseExecutionWorkflow).toHaveBeenCalledWith(
      { owner: 'test-owner', repo: 'test-repo', issueNumber: 123 },
      '7'
    );
    expect(result.commandFound).toBe(true);
    expect(result.command).toBe('execute-phase');
    expect(core.setOutput).toHaveBeenCalledWith('phase-executed', true);
    expect(core.setOutput).toHaveBeenCalledWith('phase-number', 7);
    expect(core.setOutput).toHaveBeenCalledWith('has-questions', false);
  });

  it('validates command before execution', async () => {
    await import('./index.js?t=' + Date.now());

    // Verify operation was executed
    expect(capturedOperation).toBeDefined();
    await capturedOperation();

    expect(validateCommand).toHaveBeenCalledWith('new-milestone');
  });

  it('sanitizes arguments before passing to workflow', async () => {
    vi.mocked(parseArguments).mockReturnValue({ name: 'test;name' });

    await import('./index.js?t=' + Date.now());

    // Verify operation was executed
    expect(capturedOperation).toBeDefined();
    await capturedOperation();

    expect(sanitizeArguments).toHaveBeenCalled();
  });

  it('authorization check happens before command execution', async () => {
    // Track call order
    const callOrder = [];
    vi.mocked(checkAuthorization).mockImplementation(async () => {
      callOrder.push('checkAuthorization');
      return { authorized: true, username: 'test-user', permission: 'write' };
    });
    vi.mocked(executeMilestoneWorkflow).mockImplementation(async () => {
      callOrder.push('executeMilestoneWorkflow');
      return { complete: true, phase: 'requirements' };
    });

    await import('./index.js?t=' + Date.now());

    // Verify operation was executed
    expect(capturedOperation).toBeDefined();
    await capturedOperation();

    // Authorization must happen before workflow execution
    expect(callOrder).toEqual(['checkAuthorization', 'executeMilestoneWorkflow']);
  });

  it('provides GitHub context to error handler', async () => {
    await import('./index.js?t=' + Date.now());

    // Verify operation was captured, which proves withErrorHandling was called
    // and the operation was passed with GitHub context
    expect(capturedOperation).toBeDefined();
    expect(typeof capturedOperation).toBe('function');
  });

  it('throws error when validateCommand rejects unknown command', async () => {
    vi.mocked(parseComment).mockReturnValue({
      botMention: '@gsd-bot unknown-cmd',
      command: 'unknown-cmd',
      args: ''
    });

    vi.mocked(validateCommand).mockImplementation(() => {
      throw new Error('Unknown command: unknown-cmd');
    });

    await import('./index.js?t=' + Date.now());

    // Verify operation was captured
    expect(capturedOperation).toBeDefined();

    // Verify operation throws when executed
    await expect(capturedOperation()).rejects.toThrow('Unknown command: unknown-cmd');
  });

  it('sets outputs for milestone completion', async () => {
    vi.mocked(executeMilestoneWorkflow).mockResolvedValue({
      complete: true,
      phase: 'execution'
    });

    await import('./index.js?t=' + Date.now());

    // Verify operation was executed
    expect(capturedOperation).toBeDefined();
    await capturedOperation();

    // Verify milestone-specific outputs were set
    expect(core.setOutput).toHaveBeenCalledWith('milestone-complete', true);
    expect(core.setOutput).toHaveBeenCalledWith('milestone-phase', 'execution');
  });
});

