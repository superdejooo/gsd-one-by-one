import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasWriteAccess, getAuthContext, checkAuthorization } from './validator.js';

// Note: @actions/github is globally mocked in test/setup.js
// We'll override context values as needed in tests

describe('hasWriteAccess', () => {
  let mockOctokit;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        repos: {
          getCollaboratorPermissionLevel: vi.fn()
        }
      }
    };
  });

  it('returns true for admin permission', async () => {
    mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
      data: { permission: 'admin' }
    });

    const result = await hasWriteAccess(mockOctokit, 'test-owner', 'test-repo', 'admin-user');
    expect(result).toBe(true);
  });

  it('returns true for write permission', async () => {
    mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
      data: { permission: 'write' }
    });

    const result = await hasWriteAccess(mockOctokit, 'test-owner', 'test-repo', 'write-user');
    expect(result).toBe(true);
  });

  it('returns true for maintain permission', async () => {
    mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
      data: { permission: 'maintain' }
    });

    const result = await hasWriteAccess(mockOctokit, 'test-owner', 'test-repo', 'maintain-user');
    expect(result).toBe(true);
  });

  it('returns false for read permission', async () => {
    mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
      data: { permission: 'read' }
    });

    const result = await hasWriteAccess(mockOctokit, 'test-owner', 'test-repo', 'read-user');
    expect(result).toBe(false);
  });

  it('returns false for triage permission', async () => {
    mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
      data: { permission: 'triage' }
    });

    const result = await hasWriteAccess(mockOctokit, 'test-owner', 'test-repo', 'triage-user');
    expect(result).toBe(false);
  });

  it('returns false when 404 (not a collaborator)', async () => {
    const error = new Error('Not Found');
    error.status = 404;
    mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockRejectedValue(error);

    const result = await hasWriteAccess(mockOctokit, 'test-owner', 'test-repo', 'non-collaborator');
    expect(result).toBe(false);
  });

  it('throws for non-404 errors', async () => {
    const error = new Error('Server Error');
    error.status = 500;
    mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockRejectedValue(error);

    await expect(
      hasWriteAccess(mockOctokit, 'test-owner', 'test-repo', 'user')
    ).rejects.toThrow('Server Error');
  });
});

describe('getAuthContext', () => {
  it('returns username from payload.sender.login', () => {
    const context = getAuthContext();
    expect(context.username).toBe('test-user');
  });

  it('returns owner and repo from context', () => {
    const context = getAuthContext();
    expect(context.owner).toBe('test-owner');
    expect(context.repo).toBe('test-repo');
  });

  it('returns issueNumber from payload.issue', () => {
    const context = getAuthContext();
    expect(context.issueNumber).toBe(123);
  });

  it('sets isComment based on comment.id presence', () => {
    const context = getAuthContext();
    expect(context.isComment).toBe(true);
  });
});

describe('checkAuthorization', () => {
  let mockOctokit;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        repos: {
          getCollaboratorPermissionLevel: vi.fn()
        }
      }
    };
  });

  it('returns authorized: true for admin users', async () => {
    mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
      data: { permission: 'admin', role_name: 'admin' }
    });

    const result = await checkAuthorization(mockOctokit);
    expect(result.authorized).toBe(true);
    expect(result.username).toBe('test-user');
    expect(result.permission).toBe('admin');
    expect(result.roleName).toBe('admin');
  });

  it('returns authorized: true for write users', async () => {
    mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
      data: { permission: 'write', role_name: 'write' }
    });

    const result = await checkAuthorization(mockOctokit);
    expect(result.authorized).toBe(true);
    expect(result.username).toBe('test-user');
    expect(result.permission).toBe('write');
    expect(result.roleName).toBe('write');
  });

  it('returns authorized: false for read users', async () => {
    mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
      data: { permission: 'read', role_name: 'read' }
    });

    const result = await checkAuthorization(mockOctokit);
    expect(result.authorized).toBe(false);
    expect(result.username).toBe('test-user');
    expect(result.permission).toBe('read');
  });

  it('returns authorized: false with reason when 404', async () => {
    const error = new Error('Not Found');
    error.status = 404;
    mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockRejectedValue(error);

    const result = await checkAuthorization(mockOctokit);
    expect(result.authorized).toBe(false);
    expect(result.username).toBe('test-user');
    expect(result.permission).toBe(null);
    expect(result.reason).toBe('User is not a collaborator on this repository');
  });

  it('returns authorized: false when no sender in payload', async () => {
    // We need to mock the @actions/github context for this test
    const github = await import('@actions/github');
    const originalPayload = github.context.payload;

    // Temporarily override payload
    vi.mocked(github.context).payload = {};

    const result = await checkAuthorization(mockOctokit);
    expect(result.authorized).toBe(false);
    expect(result.username).toBe(null);
    expect(result.permission).toBe(null);
    expect(result.reason).toBe('Could not identify triggering user from webhook payload');

    // Restore original payload
    vi.mocked(github.context).payload = originalPayload;
  });

  it('includes permission and roleName in result', async () => {
    mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
      data: { permission: 'maintain', role_name: 'maintain' }
    });

    const result = await checkAuthorization(mockOctokit);
    expect(result).toHaveProperty('permission');
    expect(result).toHaveProperty('roleName');
    expect(result.permission).toBe('maintain');
    expect(result.roleName).toBe('maintain');
  });

  it('throws for non-404 errors', async () => {
    const error = new Error('Server Error');
    error.status = 500;
    mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockRejectedValue(error);

    await expect(checkAuthorization(mockOctokit)).rejects.toThrow('Server Error');
  });
});
