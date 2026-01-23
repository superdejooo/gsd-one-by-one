import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the github.js module with GraphQL support
vi.mock('./github.js', () => ({
  octokit: {
    graphql: vi.fn()
  }
}));

// Import after mocking
const { getProject, getIterations, findIteration } = await import('./projects.js');
const { octokit: mockOctokit } = await import('./github.js');

// Mock @actions/core
const core = await import('@actions/core');

describe('getProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns project for organization (isOrg: true)', async () => {
    mockOctokit.graphql.mockResolvedValue({
      organization: {
        projectV2: {
          id: 'proj_123',
          title: 'Test Project',
          url: 'https://github.com/orgs/test-org/projects/1'
        }
      }
    });

    const result = await getProject('test-org', 1, true);

    expect(result).toEqual({
      id: 'proj_123',
      title: 'Test Project',
      url: 'https://github.com/orgs/test-org/projects/1'
    });
    expect(mockOctokit.graphql).toHaveBeenCalledWith(
      expect.stringContaining('organization(login: $owner)'),
      { owner: 'test-org', number: 1 }
    );
    expect(core.info).toHaveBeenCalledWith('Found project: Test Project (https://github.com/orgs/test-org/projects/1)');
  });

  it('returns project for user (isOrg: false)', async () => {
    mockOctokit.graphql.mockResolvedValue({
      user: {
        projectV2: {
          id: 'proj_456',
          title: 'User Project',
          url: 'https://github.com/users/test-user/projects/2'
        }
      }
    });

    const result = await getProject('test-user', 2, false);

    expect(result).toEqual({
      id: 'proj_456',
      title: 'User Project',
      url: 'https://github.com/users/test-user/projects/2'
    });
    expect(mockOctokit.graphql).toHaveBeenCalledWith(
      expect.stringContaining('user(login: $owner)'),
      { owner: 'test-user', number: 2 }
    );
  });

  it('returns null when project not found', async () => {
    mockOctokit.graphql.mockResolvedValue({
      organization: {
        projectV2: null
      }
    });

    const result = await getProject('test-org', 999, true);

    expect(result).toBeNull();
    expect(core.warning).toHaveBeenCalledWith('Project #999 not found for test-org');
  });

  it('returns null on 404 error', async () => {
    const error = new Error('Not Found');
    error.status = 404;
    mockOctokit.graphql.mockRejectedValue(error);

    const result = await getProject('test-org', 1, true);

    expect(result).toBeNull();
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Project #1 not found or no permission')
    );
  });

  it('returns null on 403 error (no permission)', async () => {
    const error = new Error('Forbidden');
    error.status = 403;
    mockOctokit.graphql.mockRejectedValue(error);

    const result = await getProject('private-org', 1, true);

    expect(result).toBeNull();
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Project #1 not found or no permission')
    );
  });

  it('logs warning for not found', async () => {
    mockOctokit.graphql.mockResolvedValue({
      organization: {}
    });

    await getProject('test-org', 99, true);

    expect(core.warning).toHaveBeenCalled();
  });

  it('returns null on other GraphQL errors', async () => {
    const error = new Error('GraphQL error');
    error.status = 500;
    mockOctokit.graphql.mockRejectedValue(error);

    const result = await getProject('test-org', 1, true);

    expect(result).toBeNull();
    expect(core.error).toHaveBeenCalledWith(
      expect.stringContaining('GraphQL error fetching project')
    );
  });
});

describe('getIterations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns iterations array from project', async () => {
    mockOctokit.graphql.mockResolvedValue({
      node: {
        fields: {
          nodes: [
            {
              id: 'field_1',
              name: 'Iteration',
              configuration: {
                iterations: [
                  { id: 'iter_1', title: 'Sprint 1', startDate: '2024-01-01' },
                  { id: 'iter_2', title: 'Sprint 2', startDate: '2024-01-15' }
                ]
              }
            }
          ]
        }
      }
    });

    const result = await getIterations('proj_123');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'iter_1',
      title: 'Sprint 1',
      startDate: '2024-01-01'
    });
    expect(result[1]).toEqual({
      id: 'iter_2',
      title: 'Sprint 2',
      startDate: '2024-01-15'
    });
    expect(core.info).toHaveBeenCalledWith('Found 2 iterations in project');
  });

  it('returns empty array when no iteration field', async () => {
    mockOctokit.graphql.mockResolvedValue({
      node: {
        fields: {
          nodes: [
            {
              id: 'field_1',
              name: 'Status',
              // No configuration.iterations
            }
          ]
        }
      }
    });

    const result = await getIterations('proj_123');

    expect(result).toEqual([]);
    expect(core.warning).toHaveBeenCalledWith('No iteration field found in project');
  });

  it('returns empty array on GraphQL error', async () => {
    const error = new Error('GraphQL error');
    mockOctokit.graphql.mockRejectedValue(error);

    const result = await getIterations('proj_123');

    expect(result).toEqual([]);
    expect(core.error).toHaveBeenCalledWith(
      expect.stringContaining('GraphQL error fetching iterations')
    );
  });

  it('logs iteration count', async () => {
    mockOctokit.graphql.mockResolvedValue({
      node: {
        fields: {
          nodes: [
            {
              configuration: {
                iterations: [
                  { id: 'iter_1', title: 'Sprint 1', startDate: '2024-01-01' }
                ]
              }
            }
          ]
        }
      }
    });

    await getIterations('proj_123');

    expect(core.info).toHaveBeenCalledWith('Found 1 iterations in project');
  });

  it('handles empty iterations array', async () => {
    mockOctokit.graphql.mockResolvedValue({
      node: {
        fields: {
          nodes: [
            {
              configuration: {
                iterations: []
              }
            }
          ]
        }
      }
    });

    const result = await getIterations('proj_123');

    expect(result).toEqual([]);
    expect(core.info).toHaveBeenCalledWith('Found 0 iterations in project');
  });
});

describe('findIteration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds iteration by title (case-insensitive match)', async () => {
    // Mock getProject
    mockOctokit.graphql
      .mockResolvedValueOnce({
        organization: {
          projectV2: {
            id: 'proj_123',
            title: 'Test Project',
            url: 'https://github.com/orgs/test/projects/1'
          }
        }
      })
      // Mock getIterations
      .mockResolvedValueOnce({
        node: {
          fields: {
            nodes: [
              {
                configuration: {
                  iterations: [
                    { id: 'iter_1', title: 'Sprint 1', startDate: '2024-01-01' },
                    { id: 'iter_2', title: 'Sprint 2', startDate: '2024-01-15' }
                  ]
                }
              }
            ]
          }
        }
      });

    const result = await findIteration('test-org', 1, 'sprint 1', true);

    expect(result).toEqual({
      id: 'iter_1',
      title: 'Sprint 1',
      startDate: '2024-01-01'
    });
    expect(core.info).toHaveBeenCalledWith('Found iteration: Sprint 1');
  });

  it('returns null when project not found', async () => {
    mockOctokit.graphql.mockResolvedValue({
      organization: {
        projectV2: null
      }
    });

    const result = await findIteration('test-org', 999, 'Sprint 1', true);

    expect(result).toBeNull();
  });

  it('returns null when iteration not found', async () => {
    // Mock getProject
    mockOctokit.graphql
      .mockResolvedValueOnce({
        organization: {
          projectV2: {
            id: 'proj_123',
            title: 'Test Project',
            url: 'https://github.com/orgs/test/projects/1'
          }
        }
      })
      // Mock getIterations
      .mockResolvedValueOnce({
        node: {
          fields: {
            nodes: [
              {
                configuration: {
                  iterations: [
                    { id: 'iter_1', title: 'Sprint 1', startDate: '2024-01-01' }
                  ]
                }
              }
            ]
          }
        }
      });

    const result = await findIteration('test-org', 1, 'Sprint 99', true);

    expect(result).toBeNull();
    expect(core.warning).toHaveBeenCalledWith('Iteration "Sprint 99" not found in project #1');
  });

  it('logs found/not found status', async () => {
    // Mock getProject
    mockOctokit.graphql
      .mockResolvedValueOnce({
        organization: {
          projectV2: {
            id: 'proj_123',
            title: 'Test Project',
            url: 'https://github.com/orgs/test/projects/1'
          }
        }
      })
      // Mock getIterations
      .mockResolvedValueOnce({
        node: {
          fields: {
            nodes: [
              {
                configuration: {
                  iterations: [
                    { id: 'iter_1', title: 'v1.0', startDate: '2024-01-01' }
                  ]
                }
              }
            ]
          }
        }
      });

    await findIteration('test-org', 1, 'v1.0', true);

    expect(core.info).toHaveBeenCalledWith('Found iteration: v1.0');
  });

  it('handles case-insensitive matching', async () => {
    // Mock getProject
    mockOctokit.graphql
      .mockResolvedValueOnce({
        organization: {
          projectV2: {
            id: 'proj_123',
            title: 'Test Project',
            url: 'https://github.com/orgs/test/projects/1'
          }
        }
      })
      // Mock getIterations
      .mockResolvedValueOnce({
        node: {
          fields: {
            nodes: [
              {
                configuration: {
                  iterations: [
                    { id: 'iter_1', title: 'V1.0 Release', startDate: '2024-01-01' }
                  ]
                }
              }
            ]
          }
        }
      });

    const result = await findIteration('test-org', 1, 'v1.0 release', true);

    expect(result).not.toBeNull();
    expect(result.title).toBe('V1.0 Release');
  });
});
