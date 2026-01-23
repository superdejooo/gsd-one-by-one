import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock git.js functions
const mockCreateAndSwitchBranch = vi.fn();
const mockSwitchBranch = vi.fn();
const mockRunGitCommand = vi.fn();

vi.mock('./git.js', () => ({
  createAndSwitchBranch: mockCreateAndSwitchBranch,
  switchBranch: mockSwitchBranch,
  runGitCommand: mockRunGitCommand
}));

// Mock @actions/core
vi.mock('@actions/core', () => ({
  info: vi.fn()
}));

// Import module under test after mocks
const { slugify, createMilestoneBranch, createPhaseBranch, branchExists } = await import('./branches.js');
import * as core from '@actions/core';

describe('branches.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('slugify', () => {
    it('converts to lowercase', () => {
      expect(slugify('Test Branch')).toBe('test-branch');
    });

    it('replaces spaces with hyphens', () => {
      expect(slugify('my test branch')).toBe('my-test-branch');
    });

    it('removes special characters', () => {
      expect(slugify('test@#$branch')).toBe('test-branch');
    });

    it('removes leading and trailing hyphens', () => {
      expect(slugify('---test-branch---')).toBe('test-branch');
    });

    it('limits length to 50 characters', () => {
      const longString = 'a'.repeat(100);
      expect(slugify(longString)).toHaveLength(50);
    });

    it('handles empty string', () => {
      expect(slugify('')).toBe('');
    });

    it('handles null/undefined', () => {
      expect(slugify(null)).toBe('');
      expect(slugify(undefined)).toBe('');
    });

    it('collapses multiple hyphens', () => {
      expect(slugify('test   branch')).toBe('test-branch');
    });
  });

  describe('createMilestoneBranch', () => {
    it('creates branch named gsd/{milestoneNumber}', async () => {
      await createMilestoneBranch(3);

      expect(mockCreateAndSwitchBranch).toHaveBeenCalledWith('gsd/3');
    });

    it('calls createAndSwitchBranch with correct name', async () => {
      await createMilestoneBranch(10);

      expect(mockCreateAndSwitchBranch).toHaveBeenCalledTimes(1);
      expect(mockCreateAndSwitchBranch).toHaveBeenCalledWith('gsd/10');
    });

    it('logs milestone branch creation', async () => {
      await createMilestoneBranch(5);

      expect(vi.mocked(core.info)).toHaveBeenCalledWith('Created milestone branch: gsd/5');
    });
  });

  describe('createPhaseBranch', () => {
    it('creates branch named gsd/{milestone}-{phase}-{slug}', async () => {
      await createPhaseBranch(2, 3, 'Setup Database');

      expect(mockCreateAndSwitchBranch).toHaveBeenCalledWith('gsd/2-3-setup-database', null);
    });

    it('uses slugify for phase name', async () => {
      await createPhaseBranch(1, 1, 'API Integration & Setup');

      expect(mockCreateAndSwitchBranch).toHaveBeenCalledWith('gsd/1-1-api-integration-setup', null);
    });

    it('includes startPoint when provided', async () => {
      await createPhaseBranch(2, 4, 'Feature Work', 'main');

      expect(mockCreateAndSwitchBranch).toHaveBeenCalledWith('gsd/2-4-feature-work', 'main');
    });

    it('logs phase branch creation', async () => {
      await createPhaseBranch(1, 2, 'Test Phase');

      expect(vi.mocked(core.info)).toHaveBeenCalledWith('Created phase branch: gsd/1-2-test-phase (from "Test Phase")');
    });
  });

  describe('branchExists', () => {
    it('returns true when git rev-parse succeeds', async () => {
      mockRunGitCommand.mockResolvedValue('abc123');

      const result = await branchExists('feature-branch');

      expect(result).toBe(true);
      expect(mockRunGitCommand).toHaveBeenCalledWith('git rev-parse --verify feature-branch');
    });

    it('returns false when git rev-parse throws (branch not found)', async () => {
      mockRunGitCommand.mockRejectedValue(new Error('fatal: not a valid ref'));

      const result = await branchExists('nonexistent-branch');

      expect(result).toBe(false);
    });

    it('does not throw on missing branch', async () => {
      mockRunGitCommand.mockRejectedValue(new Error('branch not found'));

      await expect(branchExists('missing')).resolves.toBe(false);
    });
  });
});
