import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock octokit
const mockOctokit = {
  rest: {
    issues: {
      listComments: vi.fn()
    }
  },
  paginate: vi.fn()
};

// Mock @actions/github
vi.mock('@actions/github', () => ({
  getOctokit: vi.fn(() => mockOctokit)
}));

// Mock @actions/core
vi.mock('@actions/core', () => ({
  getInput: vi.fn(() => 'mock-token'),
  info: vi.fn()
}));

// Import after mocking
const {
  DEFAULT_QUESTIONS,
  getNewComments,
  parseUserAnswers,
  formatRequirementsQuestions,
  parseAnswersFromResponse
} = await import('./requirements.js');

describe('DEFAULT_QUESTIONS', () => {
  it('contains 4 questions', () => {
    expect(DEFAULT_QUESTIONS).toHaveLength(4);
  });

  it('each question has id, question, and required fields', () => {
    for (const q of DEFAULT_QUESTIONS) {
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('question');
      expect(q).toHaveProperty('required');
      expect(typeof q.id).toBe('string');
      expect(typeof q.question).toBe('string');
      expect(typeof q.required).toBe('boolean');
    }
  });

  it('scope and features are required', () => {
    const scope = DEFAULT_QUESTIONS.find(q => q.id === 'scope');
    const features = DEFAULT_QUESTIONS.find(q => q.id === 'features');
    expect(scope.required).toBe(true);
    expect(features.required).toBe(true);
  });

  it('constraints and timeline are optional', () => {
    const constraints = DEFAULT_QUESTIONS.find(q => q.id === 'constraints');
    const timeline = DEFAULT_QUESTIONS.find(q => q.id === 'timeline');
    expect(constraints.required).toBe(false);
    expect(timeline.required).toBe(false);
  });
});

describe('getNewComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns comments newer than lastProcessedId', async () => {
    const comments = [
      { id: 1, user: { login: 'user1', type: 'User' }, body: 'Comment 1' },
      { id: 2, user: { login: 'user2', type: 'User' }, body: 'Comment 2' },
      { id: 3, user: { login: 'user3', type: 'User' }, body: 'Comment 3' }
    ];

    mockOctokit.paginate.mockResolvedValue(comments);

    const result = await getNewComments('owner', 'repo', 1, 1);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(2);
    expect(result[1].id).toBe(3);
  });

  it('filters out github-actions[bot] comments', async () => {
    const comments = [
      { id: 1, user: { login: 'user1', type: 'User' }, body: 'User comment' },
      { id: 2, user: { login: 'github-actions[bot]', type: 'Bot' }, body: 'Bot comment' }
    ];

    mockOctokit.paginate.mockResolvedValue(comments);

    const result = await getNewComments('owner', 'repo', 1, 0);

    expect(result).toHaveLength(1);
    expect(result[0].user.login).toBe('user1');
  });

  it('filters out Bot type users', async () => {
    const comments = [
      { id: 1, user: { login: 'user1', type: 'User' }, body: 'User comment' },
      { id: 2, user: { login: 'some-bot', type: 'Bot' }, body: 'Bot comment' }
    ];

    mockOctokit.paginate.mockResolvedValue(comments);

    const result = await getNewComments('owner', 'repo', 1, 0);

    expect(result).toHaveLength(1);
    expect(result[0].user.login).toBe('user1');
  });

  it('sorts comments by ID ascending', async () => {
    const comments = [
      { id: 5, user: { login: 'user1', type: 'User' }, body: 'Comment 5' },
      { id: 3, user: { login: 'user2', type: 'User' }, body: 'Comment 3' },
      { id: 4, user: { login: 'user3', type: 'User' }, body: 'Comment 4' }
    ];

    mockOctokit.paginate.mockResolvedValue(comments);

    const result = await getNewComments('owner', 'repo', 1, 0);

    expect(result[0].id).toBe(3);
    expect(result[1].id).toBe(4);
    expect(result[2].id).toBe(5);
  });

  it('defaults lastProcessedId to 0', async () => {
    const comments = [
      { id: 1, user: { login: 'user1', type: 'User' }, body: 'Comment 1' }
    ];

    mockOctokit.paginate.mockResolvedValue(comments);

    const result = await getNewComments('owner', 'repo', 1);

    expect(result).toHaveLength(1);
  });

  it('calls octokit.paginate with correct parameters', async () => {
    mockOctokit.paginate.mockResolvedValue([]);

    await getNewComments('test-owner', 'test-repo', 42, 0);

    expect(mockOctokit.paginate).toHaveBeenCalledWith(
      mockOctokit.rest.issues.listComments,
      {
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 42,
        per_page: 100
      }
    );
  });
});

describe('parseUserAnswers', () => {
  it('extracts user, body, and timestamp from comments', () => {
    const comments = [
      {
        id: 1,
        user: { login: 'alice', type: 'User' },
        body: 'Answer 1',
        created_at: '2025-01-01T12:00:00Z'
      }
    ];

    const result = parseUserAnswers(comments);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      commentId: 1,
      user: 'alice',
      body: 'Answer 1',
      timestamp: '2025-01-01T12:00:00Z'
    });
  });

  it('skips bot comments', () => {
    const comments = [
      {
        id: 1,
        user: { login: 'alice', type: 'User' },
        body: 'User answer',
        created_at: '2025-01-01T12:00:00Z'
      },
      {
        id: 2,
        user: { login: 'github-actions[bot]', type: 'Bot' },
        body: 'Bot message',
        created_at: '2025-01-01T12:01:00Z'
      }
    ];

    const result = parseUserAnswers(comments);

    expect(result).toHaveLength(1);
    expect(result[0].user).toBe('alice');
  });

  it('returns array of answer objects', () => {
    const comments = [
      {
        id: 1,
        user: { login: 'alice', type: 'User' },
        body: 'Answer 1',
        created_at: '2025-01-01T12:00:00Z'
      },
      {
        id: 2,
        user: { login: 'bob', type: 'User' },
        body: 'Answer 2',
        created_at: '2025-01-01T12:01:00Z'
      }
    ];

    const result = parseUserAnswers(comments);

    expect(result).toHaveLength(2);
    expect(result[0].commentId).toBe(1);
    expect(result[1].commentId).toBe(2);
  });

  it('handles empty comments array', () => {
    const result = parseUserAnswers([]);
    expect(result).toEqual([]);
  });
});

describe('formatRequirementsQuestions', () => {
  it('formats questions with status icons', () => {
    const questions = [
      { id: 'q1', question: 'Question 1?', required: true },
      { id: 'q2', question: 'Question 2?', required: false }
    ];
    const existingAnswers = { q1: 'Answer 1' };

    const result = formatRequirementsQuestions(questions, existingAnswers);

    expect(result).toContain(':white_check_mark:');
    expect(result).toContain(':hourglass:');
  });

  it('shows :white_check_mark: for answered questions', () => {
    const questions = [
      { id: 'q1', question: 'Question 1?', required: true }
    ];
    const existingAnswers = { q1: 'Answer 1' };

    const result = formatRequirementsQuestions(questions, existingAnswers);

    expect(result).toContain(':white_check_mark: Question 1?');
  });

  it('shows :hourglass: for pending questions', () => {
    const questions = [
      { id: 'q1', question: 'Question 1?', required: true }
    ];
    const existingAnswers = {};

    const result = formatRequirementsQuestions(questions, existingAnswers);

    expect(result).toContain(':hourglass: Question 1?');
  });

  it('includes existing answers in blockquotes', () => {
    const questions = [
      { id: 'q1', question: 'Question 1?', required: true }
    ];
    const existingAnswers = { q1: 'My answer here' };

    const result = formatRequirementsQuestions(questions, existingAnswers);

    expect(result).toContain('> My answer here');
  });

  it('includes instructions header', () => {
    const questions = [
      { id: 'q1', question: 'Question 1?', required: true }
    ];

    const result = formatRequirementsQuestions(questions);

    expect(result).toContain('## Requirements Gathering');
    expect(result).toContain('Please answer the following questions');
  });

  it('handles empty existingAnswers', () => {
    const questions = [
      { id: 'q1', question: 'Question 1?', required: true }
    ];

    const result = formatRequirementsQuestions(questions);

    expect(result).not.toContain(':white_check_mark:');
    expect(result).toContain(':hourglass:');
  });
});

describe('parseAnswersFromResponse', () => {
  const questions = [
    { id: 'scope', question: 'What is the goal?', required: true },
    { id: 'features', question: 'What are the features?', required: true }
  ];

  it('parses question ID with colon prefix', () => {
    const body = 'scope: Build an auth system';
    const result = parseAnswersFromResponse(body, questions);

    expect(result.scope).toBe('Build an auth system');
  });

  it('parses question ID with space prefix', () => {
    const body = 'scope Build an auth system';
    const result = parseAnswersFromResponse(body, questions);

    expect(result.scope).toBe('Build an auth system');
  });

  it('parses paragraph-order fallback', () => {
    const body = `Build an auth system
Login, signup, password reset`;
    const result = parseAnswersFromResponse(body, questions);

    expect(result.scope).toBe('Build an auth system');
    expect(result.features).toBe('Login, signup, password reset');
  });

  it('skips headers and list markers', () => {
    const body = `### Answers
- Build an auth system
- Login, signup`;

    const result = parseAnswersFromResponse(body, questions);

    // Should skip the header, treat list items as paragraph-order
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });

  it('handles partial answers', () => {
    const body = 'scope: Build an auth system';
    const result = parseAnswersFromResponse(body, questions);

    expect(result.scope).toBe('Build an auth system');
    expect(result.features).toBeUndefined();
  });

  it('respects existing answers in paragraph-order fallback', () => {
    const body = `Login, signup, password reset`;
    const existingAnswers = { scope: 'Build an auth system' };

    const result = parseAnswersFromResponse(body, questions, existingAnswers);

    // Should only parse pending question (features)
    expect(result.features).toBe('Login, signup, password reset');
    expect(result.scope).toBeUndefined();
  });

  it('handles empty body', () => {
    const result = parseAnswersFromResponse('', questions);
    expect(result).toEqual({});
  });

  it('handles multiline answers', () => {
    const body = `scope: Build an auth system
features: Login and signup`;

    const result = parseAnswersFromResponse(body, questions);

    expect(result.scope).toBe('Build an auth system');
    expect(result.features).toBe('Login and signup');
  });
});
