import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the github.js module that exports octokit
vi.mock('./github.js', () => ({
  octokit: {
    rest: {
      issues: {
        listLabelsForRepo: vi.fn(),
        createLabel: vi.fn(),
        addLabels: vi.fn(),
        listLabelsOnIssue: vi.fn(),
        setLabels: vi.fn()
      }
    }
  }
}));

// Import after mocking
const { STATUS_LABELS, ensureLabelsExist, applyLabels, updateIssueStatus } = await import('./labels.js');
const { octokit: mockOctokit } = await import('./github.js');

// Mock @actions/core (already globally mocked, but we can access it)
const core = await import('@actions/core');

describe('STATUS_LABELS', () => {
  it('contains 4 status labels', () => {
    expect(STATUS_LABELS).toHaveLength(4);
  });

  it('each label has name, color, description', () => {
    STATUS_LABELS.forEach(label => {
      expect(label).toHaveProperty('name');
      expect(label).toHaveProperty('color');
      expect(label).toHaveProperty('description');
      expect(typeof label.name).toBe('string');
      expect(typeof label.color).toBe('string');
      expect(typeof label.description).toBe('string');
    });
  });

  it('all labels have status: prefix', () => {
    STATUS_LABELS.forEach(label => {
      expect(label.name).toMatch(/^status:/);
    });
  });
});

describe('ensureLabelsExist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates missing labels', async () => {
    // Mock existing labels (none match our labels)
    mockOctokit.rest.issues.listLabelsForRepo.mockResolvedValue({
      data: [
        { name: 'bug', color: 'ff0000' }
      ]
    });

    mockOctokit.rest.issues.createLabel.mockResolvedValue({});

    const labelsToCreate = [
      { name: 'status:pending', color: 'd4c5f9', description: 'Pending' }
    ];

    await ensureLabelsExist('test-owner', 'test-repo', labelsToCreate);

    expect(mockOctokit.rest.issues.createLabel).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      name: 'status:pending',
      color: 'd4c5f9',
      description: 'Pending'
    });
    expect(core.info).toHaveBeenCalledWith('Created label: status:pending');
  });

  it('skips existing labels', async () => {
    // Mock existing labels (includes our label)
    mockOctokit.rest.issues.listLabelsForRepo.mockResolvedValue({
      data: [
        { name: 'status:pending', color: 'd4c5f9' }
      ]
    });

    const labelsToCreate = [
      { name: 'status:pending', color: 'd4c5f9', description: 'Pending' }
    ];

    await ensureLabelsExist('test-owner', 'test-repo', labelsToCreate);

    expect(mockOctokit.rest.issues.createLabel).not.toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith('Label already exists: status:pending');
  });

  it('handles 422 error gracefully (race condition)', async () => {
    // Mock no existing labels
    mockOctokit.rest.issues.listLabelsForRepo.mockResolvedValue({
      data: []
    });

    // Mock 422 error (label already exists)
    const error = new Error('Validation Failed');
    error.status = 422;
    mockOctokit.rest.issues.createLabel.mockRejectedValue(error);

    const labelsToCreate = [
      { name: 'status:pending', color: 'd4c5f9', description: 'Pending' }
    ];

    // Should not throw
    await expect(
      ensureLabelsExist('test-owner', 'test-repo', labelsToCreate)
    ).resolves.not.toThrow();

    expect(core.info).toHaveBeenCalledWith('Label already exists: status:pending');
  });

  it('throws on non-422 errors', async () => {
    mockOctokit.rest.issues.listLabelsForRepo.mockResolvedValue({
      data: []
    });

    const error = new Error('Server Error');
    error.status = 500;
    mockOctokit.rest.issues.createLabel.mockRejectedValue(error);

    const labelsToCreate = [
      { name: 'status:pending', color: 'd4c5f9', description: 'Pending' }
    ];

    await expect(
      ensureLabelsExist('test-owner', 'test-repo', labelsToCreate)
    ).rejects.toThrow('Server Error');
  });
});

describe('applyLabels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls addLabels with correct params', async () => {
    mockOctokit.rest.issues.addLabels.mockResolvedValue({});

    await applyLabels('test-owner', 'test-repo', 123, ['status:pending', 'enhancement']);

    expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      labels: ['status:pending', 'enhancement']
    });
  });

  it('logs applied labels', async () => {
    mockOctokit.rest.issues.addLabels.mockResolvedValue({});

    await applyLabels('test-owner', 'test-repo', 123, ['status:pending', 'enhancement']);

    expect(core.info).toHaveBeenCalledWith('Applied labels to issue #123: status:pending, enhancement');
  });
});

describe('updateIssueStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws for invalid status', async () => {
    await expect(
      updateIssueStatus('test-owner', 'test-repo', 123, 'invalid-status')
    ).rejects.toThrow('Invalid status: invalid-status');
  });

  it('accepts valid status: pending', async () => {
    mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
      data: []
    });
    mockOctokit.rest.issues.setLabels.mockResolvedValue({});

    await updateIssueStatus('test-owner', 'test-repo', 123, 'pending');

    expect(mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      labels: ['status:pending']
    });
  });

  it('accepts valid status: in-progress', async () => {
    mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
      data: []
    });
    mockOctokit.rest.issues.setLabels.mockResolvedValue({});

    await updateIssueStatus('test-owner', 'test-repo', 123, 'in-progress');

    expect(mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      labels: ['status:in-progress']
    });
  });

  it('accepts valid status: complete', async () => {
    mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
      data: []
    });
    mockOctokit.rest.issues.setLabels.mockResolvedValue({});

    await updateIssueStatus('test-owner', 'test-repo', 123, 'complete');

    expect(mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      labels: ['status:complete']
    });
  });

  it('accepts valid status: blocked', async () => {
    mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
      data: []
    });
    mockOctokit.rest.issues.setLabels.mockResolvedValue({});

    await updateIssueStatus('test-owner', 'test-repo', 123, 'blocked');

    expect(mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      labels: ['status:blocked']
    });
  });

  it('removes existing status labels', async () => {
    mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
      data: [
        { name: 'status:pending' },
        { name: 'bug' },
        { name: 'enhancement' }
      ]
    });
    mockOctokit.rest.issues.setLabels.mockResolvedValue({});

    await updateIssueStatus('test-owner', 'test-repo', 123, 'in-progress');

    expect(mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      labels: ['bug', 'enhancement', 'status:in-progress']
    });
  });

  it('keeps non-status labels', async () => {
    mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
      data: [
        { name: 'bug' },
        { name: 'priority:high' },
        { name: 'good-first-issue' }
      ]
    });
    mockOctokit.rest.issues.setLabels.mockResolvedValue({});

    await updateIssueStatus('test-owner', 'test-repo', 123, 'complete');

    expect(mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      labels: ['bug', 'priority:high', 'good-first-issue', 'status:complete']
    });
  });

  it('sets new status label atomically', async () => {
    mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
      data: [
        { name: 'status:pending' }
      ]
    });
    mockOctokit.rest.issues.setLabels.mockResolvedValue({});

    await updateIssueStatus('test-owner', 'test-repo', 123, 'complete');

    // Should call setLabels (atomic), not addLabels (additive)
    expect(mockOctokit.rest.issues.setLabels).toHaveBeenCalled();
    expect(mockOctokit.rest.issues.addLabels).not.toHaveBeenCalled();
  });

  it('logs status update', async () => {
    mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
      data: []
    });
    mockOctokit.rest.issues.setLabels.mockResolvedValue({});

    await updateIssueStatus('test-owner', 'test-repo', 123, 'in-progress');

    expect(core.info).toHaveBeenCalledWith('Updated issue #123 status to: status:in-progress');
  });
});
