import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises using factory function
vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    writeFile: vi.fn()
  }
}));

vi.mock('@actions/core', () => ({
  info: vi.fn()
}));

// Import after mocks
import { createPlanningDocs, generateProjectMarkdown, generateStateMarkdown, generateRoadmapMarkdown } from './planning-docs.js';
import fs from 'node:fs/promises';

describe('createPlanningDocs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates directory structure', async () => {
    const milestoneData = {
      owner: 'test-owner',
      repo: 'test-repo',
      milestoneNumber: 1,
      title: 'Test Milestone',
      goal: 'Build something',
      scope: 'Limited scope',
      features: ['Feature 1', 'Feature 2'],
      requirements: { complete: true, answered: ['scope', 'features'], pending: [] },
      phases: [],
      status: 'planning'
    };

    await createPlanningDocs(milestoneData);

    expect(fs.mkdir).toHaveBeenCalledWith('.github/planning/milestones/1', { recursive: true });
    expect(fs.mkdir).toHaveBeenCalledWith('.github/planning/milestones/1/phases', { recursive: true });
  });

  it('creates PROJECT.md', async () => {
    const milestoneData = {
      owner: 'test-owner',
      repo: 'test-repo',
      milestoneNumber: 1,
      title: 'Test Milestone',
      goal: 'Build something',
      scope: 'Limited scope',
      features: ['Feature 1'],
      requirements: {},
      phases: [],
      status: 'planning'
    };

    await createPlanningDocs(milestoneData);

    expect(fs.writeFile).toHaveBeenCalledWith(
      '.github/planning/milestones/1/PROJECT.md',
      expect.stringContaining('# Milestone 1: Test Milestone')
    );
  });

  it('creates STATE.md', async () => {
    const milestoneData = {
      owner: 'test-owner',
      repo: 'test-repo',
      milestoneNumber: 1,
      title: 'Test Milestone',
      goal: 'Build something',
      features: [],
      requirements: {},
      phases: [],
      status: 'planning'
    };

    await createPlanningDocs(milestoneData);

    expect(fs.writeFile).toHaveBeenCalledWith(
      '.github/planning/milestones/1/STATE.md',
      expect.stringContaining('# Milestone 1 State')
    );
  });

  it('creates ROADMAP.md', async () => {
    const milestoneData = {
      owner: 'test-owner',
      repo: 'test-repo',
      milestoneNumber: 1,
      title: 'Test Milestone',
      goal: 'Build something',
      features: [],
      requirements: {},
      phases: [],
      status: 'planning'
    };

    await createPlanningDocs(milestoneData);

    expect(fs.writeFile).toHaveBeenCalledWith(
      '.github/planning/milestones/1/ROADMAP.md',
      expect.stringContaining('# Milestone 1 Roadmap')
    );
  });

  it('returns files map with paths and purposes', async () => {
    const milestoneData = {
      owner: 'test-owner',
      repo: 'test-repo',
      milestoneNumber: 1,
      title: 'Test Milestone',
      goal: 'Build something',
      features: [],
      requirements: {},
      phases: [],
      status: 'planning'
    };

    const files = await createPlanningDocs(milestoneData);

    expect(files.project).toEqual({
      path: '.github/planning/milestones/1/PROJECT.md',
      purpose: 'Milestone context and goals'
    });
    expect(files.state).toEqual({
      path: '.github/planning/milestones/1/STATE.md',
      purpose: 'Milestone number and status'
    });
    expect(files.roadmap).toEqual({
      path: '.github/planning/milestones/1/ROADMAP.md',
      purpose: 'Phase structure'
    });
  });
});

describe('generateProjectMarkdown', () => {
  it('includes milestone number and title', () => {
    const data = {
      milestoneNumber: 5,
      title: 'Authentication System',
      goal: 'Build auth',
      features: []
    };

    const result = generateProjectMarkdown(data);

    expect(result).toContain('# Milestone 5: Authentication System');
  });

  it('includes goal and scope', () => {
    const data = {
      milestoneNumber: 1,
      title: 'Test',
      goal: 'Primary goal here',
      scope: 'Scope description here',
      features: []
    };

    const result = generateProjectMarkdown(data);

    expect(result).toContain('## Goal');
    expect(result).toContain('Primary goal here');
    expect(result).toContain('## Scope');
    expect(result).toContain('Scope description here');
  });

  it('formats features as bullet list', () => {
    const data = {
      milestoneNumber: 1,
      title: 'Test',
      goal: 'Test',
      features: ['Feature 1', 'Feature 2', 'Feature 3']
    };

    const result = generateProjectMarkdown(data);

    expect(result).toContain('- Feature 1');
    expect(result).toContain('- Feature 2');
    expect(result).toContain('- Feature 3');
  });

  it('handles missing optional fields', () => {
    const data = {
      milestoneNumber: 1,
      title: 'Test',
      features: []
    };

    const result = generateProjectMarkdown(data);

    expect(result).toContain('To be defined during requirements gathering');
  });

  it('includes requirements summary table', () => {
    const data = {
      milestoneNumber: 1,
      title: 'Test',
      goal: 'Test',
      features: [],
      requirements: {
        answered: {
          scope: 'Build auth system',
          features: 'Login, signup'
        }
      }
    };

    const result = generateProjectMarkdown(data);

    expect(result).toContain('## Requirements Summary');
    expect(result).toContain('| Question | Answer |');
    expect(result).toContain('Build auth system');
    expect(result).toContain('Login, signup');
  });

  it('handles empty features array', () => {
    const data = {
      milestoneNumber: 1,
      title: 'Test',
      goal: 'Test',
      features: []
    };

    const result = generateProjectMarkdown(data);

    expect(result).toContain('- To be defined');
  });
});

describe('generateStateMarkdown', () => {
  it('includes milestone number', () => {
    const data = {
      milestoneNumber: 7,
      status: 'planning',
      phases: [],
      requirements: {}
    };

    const result = generateStateMarkdown(data);

    expect(result).toContain('# Milestone 7 State');
    expect(result).toContain('**Milestone:** 7');
  });

  it('includes phase status table', () => {
    const data = {
      milestoneNumber: 1,
      status: 'planning',
      phases: [
        { name: 'Setup', status: 'pending' },
        { name: 'Implementation', status: 'in-progress' }
      ],
      requirements: {}
    };

    const result = generateStateMarkdown(data);

    expect(result).toContain('| Phase | Name | Status |');
    expect(result).toContain('Setup');
    expect(result).toContain('Implementation');
    expect(result).toContain('pending');
    expect(result).toContain('in-progress');
  });

  it('includes requirements gathering status', () => {
    const data = {
      milestoneNumber: 1,
      status: 'planning',
      phases: [],
      requirements: {
        complete: true,
        answered: { scope: 'Test', features: 'Test' },
        pending: []
      }
    };

    const result = generateStateMarkdown(data);

    expect(result).toContain('## Requirements Gathering');
    expect(result).toContain('**Status:** Complete');
    expect(result).toContain('**Questions Answered:** 2');
    expect(result).toContain('**Questions Pending:** 0');
  });

  it('includes workflow timestamps', () => {
    const data = {
      milestoneNumber: 1,
      status: 'planning',
      phases: [],
      requirements: {},
      createdAt: '2025-01-01T00:00:00Z',
      lastRunAt: '2025-01-02T00:00:00Z',
      runCount: 5
    };

    const result = generateStateMarkdown(data);

    expect(result).toContain('## Workflow');
    expect(result).toContain('**Started:** 2025-01-01T00:00:00Z');
    expect(result).toContain('**Last Run:** 2025-01-02T00:00:00Z');
    expect(result).toContain('**Run Count:** 5');
  });
});

describe('generateRoadmapMarkdown', () => {
  it('includes total phases count', () => {
    const data = {
      milestoneNumber: 1,
      totalPhases: 6,
      phases: []
    };

    const result = generateRoadmapMarkdown(data);

    expect(result).toContain('**Total Phases:** 6');
  });

  it('formats phase structure', () => {
    const data = {
      milestoneNumber: 1,
      phases: [
        {
          name: 'Foundation',
          goal: 'Setup project',
          dependencies: 'None',
          status: 'pending'
        },
        {
          name: 'Implementation',
          goal: 'Build features',
          dependencies: 'Phase 1',
          status: 'pending'
        }
      ]
    };

    const result = generateRoadmapMarkdown(data);

    expect(result).toContain('### Phase 1: Foundation');
    expect(result).toContain('- **Goal:** Setup project');
    expect(result).toContain('- **Dependencies:** None');
    expect(result).toContain('### Phase 2: Implementation');
    expect(result).toContain('- **Goal:** Build features');
    expect(result).toContain('- **Dependencies:** Phase 1');
  });

  it('includes execution order', () => {
    const data = {
      milestoneNumber: 1,
      phases: [
        { name: 'Foundation', status: 'pending' },
        { name: 'Implementation', status: 'pending' }
      ]
    };

    const result = generateRoadmapMarkdown(data);

    expect(result).toContain('## Execution Order');
    expect(result).toContain('1. Phase 1: Foundation');
    expect(result).toContain('2. Phase 2: Implementation');
  });

  it('handles empty phases array', () => {
    const data = {
      milestoneNumber: 1,
      phases: [],
      totalPhases: 0
    };

    const result = generateRoadmapMarkdown(data);

    expect(result).toContain('Phases will be defined during planning');
  });
});
