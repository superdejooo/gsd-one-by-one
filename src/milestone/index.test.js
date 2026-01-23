import { describe, it, expect, vi, beforeEach } from "vitest";

// Create mock objects
const mockRequirements = {
  getNewComments: vi.fn(),
  parseUserAnswers: vi.fn(),
  formatRequirementsQuestions: vi.fn(),
  parseAnswersFromResponse: vi.fn(),
  DEFAULT_QUESTIONS: [
    { id: "scope", question: "What is the primary goal?", required: true },
    { id: "features", question: "What are the key features?", required: true },
  ],
};

const mockPlanningDocs = {
  createPlanningDocs: vi.fn(),
};

const mockGithub = {
  postComment: vi.fn(),
  getWorkflowRunUrl: vi.fn(() => "https://example.com/run/123"),
};

const mockBranches = {
  createMilestoneBranch: vi.fn(),
  branchExists: vi.fn(),
};

const mockGit = {
  runGitCommand: vi.fn(),
  configureGitIdentity: vi.fn(),
};

const mockState = {
  loadState: vi.fn(),
  saveState: vi.fn(),
  createInitialState: vi.fn(),
  isRequirementsComplete: vi.fn(),
  updateRequirementsAnswer: vi.fn(),
  initializePendingQuestions: vi.fn(),
  updateWorkflowRun: vi.fn(),
  markRequirementsComplete: vi.fn(),
};

const mockSummarizer = {
  generateMilestoneSummary: vi.fn(),
};

const mockProjects = {
  findIteration: vi.fn(),
};

const mockConfig = {
  loadConfig: vi.fn(),
};

// Mock modules
vi.mock("./requirements.js", () => mockRequirements);
vi.mock("./planning-docs.js", () => mockPlanningDocs);
vi.mock("../lib/github.js", () => mockGithub);
vi.mock("../git/branches.js", () => mockBranches);
vi.mock("../git/git.js", () => mockGit);
vi.mock("./state.js", () => mockState);
vi.mock("./summarizer.js", () => mockSummarizer);
vi.mock("../lib/projects.js", () => mockProjects);
vi.mock("../lib/config.js", () => mockConfig);
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

// Import after mocking
const {
  parseMilestoneNumber,
  parseMilestoneDescription,
  executeMilestoneWorkflow,
} = await import("./index.js");

describe("parseMilestoneNumber", () => {
  it("parses --milestone 1", () => {
    expect(parseMilestoneNumber("--milestone 1")).toBe(1);
  });

  it("parses --milestone=1", () => {
    expect(parseMilestoneNumber("--milestone=1")).toBe(1);
  });

  it("parses -m 1", () => {
    expect(parseMilestoneNumber("-m 1")).toBe(1);
  });

  it("parses -m=1", () => {
    expect(parseMilestoneNumber("-m=1")).toBe(1);
  });

  it("parses standalone number", () => {
    expect(parseMilestoneNumber("1")).toBe(1);
  });

  it("parses multi-digit numbers", () => {
    expect(parseMilestoneNumber("42")).toBe(42);
  });

  it("throws for non-numeric value", () => {
    expect(() => parseMilestoneNumber("abc")).toThrow(
      "Could not parse milestone number",
    );
  });

  it("throws for empty string", () => {
    expect(() => parseMilestoneNumber("")).toThrow(
      "Milestone number is required",
    );
  });

  it("throws for null", () => {
    expect(() => parseMilestoneNumber(null)).toThrow(
      "Milestone number is required",
    );
  });
});

describe("parseMilestoneDescription", () => {
  it("extracts description from simple text", () => {
    expect(
      parseMilestoneDescription("Build auth system with login and signup"),
    ).toBe("Build auth system with login and signup");
  });

  it("extracts description and removes --milestone flag", () => {
    expect(parseMilestoneDescription("--milestone 1 Build auth system")).toBe(
      "Build auth system",
    );
  });

  it("extracts description and removes --milestone=N flag", () => {
    expect(parseMilestoneDescription("--milestone=1 Build auth system")).toBe(
      "Build auth system",
    );
  });

  it("extracts description and removes -m flag", () => {
    expect(parseMilestoneDescription("-m 1 Build auth system")).toBe(
      "Build auth system",
    );
  });

  it("extracts description and removes -m=N flag", () => {
    expect(parseMilestoneDescription("-m=1 Build auth system")).toBe(
      "Build auth system",
    );
  });

  it("throws for empty string", () => {
    expect(() => parseMilestoneDescription("")).toThrow(
      "Milestone description is required",
    );
  });

  it("throws for whitespace-only string", () => {
    expect(() => parseMilestoneDescription("   ")).toThrow(
      "Milestone description is required",
    );
  });

  it("throws for only milestone flag without description", () => {
    expect(() => parseMilestoneDescription("--milestone 1")).toThrow(
      "Milestone description is required",
    );
  });

  it("throws for null", () => {
    expect(() => parseMilestoneDescription(null)).toThrow(
      "Milestone description is required",
    );
  });

  it("handles long descriptions", () => {
    const longDesc = "a".repeat(1000);
    expect(parseMilestoneDescription(longDesc)).toBe(longDesc);
  });
});

describe("executeMilestoneWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockState.loadState.mockResolvedValue({
      requirements: {
        answered: {},
        pending: [],
      },
      workflow: {
        lastCommentId: 0,
        runCount: 0,
      },
      createdAt: "2025-01-01T00:00:00Z",
    });
    mockRequirements.getNewComments.mockResolvedValue([]);
    mockRequirements.parseUserAnswers.mockReturnValue([]);
    mockState.isRequirementsComplete.mockReturnValue(false);
    mockRequirements.formatRequirementsQuestions.mockReturnValue(
      "## Questions\n...",
    );
    mockConfig.loadConfig.mockResolvedValue({});
    mockPlanningDocs.createPlanningDocs.mockResolvedValue({
      project: {
        path: ".github/planning/milestones/1/PROJECT.md",
        purpose: "Context",
      },
      state: {
        path: ".github/planning/milestones/1/STATE.md",
        purpose: "Status",
      },
    });
    mockBranches.branchExists.mockResolvedValue(false);
    mockSummarizer.generateMilestoneSummary.mockReturnValue("## Summary");
    mockProjects.findIteration.mockResolvedValue(null);
  });

  it("parses milestone number from arguments", async () => {
    const context = { owner: "test", repo: "repo", issueNumber: 1 };

    // Must include description to avoid error
    await executeMilestoneWorkflow(
      context,
      "--milestone 5 Build authentication system",
    );

    expect(mockState.loadState).toHaveBeenCalledWith("test", "repo", 5);
  });

  it("loads existing state", async () => {
    const context = { owner: "test", repo: "repo", issueNumber: 1 };

    // Must include description
    await executeMilestoneWorkflow(context, "1 Build auth system");

    expect(mockState.loadState).toHaveBeenCalledWith("test", "repo", 1);
  });

  it("updates workflow run metadata", async () => {
    const context = { owner: "test", repo: "repo", issueNumber: 1 };
    const mockStateObj = {
      requirements: { answered: {}, pending: [] },
      workflow: { lastCommentId: 0 },
    };
    mockState.loadState.mockResolvedValue(mockStateObj);

    await executeMilestoneWorkflow(context, "1 Build auth system");

    expect(mockState.updateWorkflowRun).toHaveBeenCalledWith(mockStateObj);
  });

  it("throws error when description is missing", async () => {
    const context = { owner: "test", repo: "repo", issueNumber: 1 };

    await expect(executeMilestoneWorkflow(context, "1")).rejects.toThrow(
      "Milestone description is required",
    );
  });

  it("throws error when only milestone flag provided", async () => {
    const context = { owner: "test", repo: "repo", issueNumber: 1 };

    await expect(
      executeMilestoneWorkflow(context, "--milestone 1"),
    ).rejects.toThrow("Milestone description is required");
  });

  it("populates requirements with description and skips Q&A", async () => {
    const context = { owner: "test", repo: "repo", issueNumber: 1 };
    const mockStateObj = {
      requirements: {
        answered: {},
        pending: [],
      },
      workflow: { lastCommentId: 0 },
      createdAt: "2025-01-01T00:00:00Z",
    };
    mockState.loadState.mockResolvedValue(mockStateObj);
    mockPlanningDocs.createPlanningDocs.mockResolvedValue({
      project: {
        path: ".github/planning/milestones/1/PROJECT.md",
        purpose: "Context",
      },
      state: {
        path: ".github/planning/milestones/1/STATE.md",
        purpose: "Status",
      },
    });
    mockBranches.branchExists.mockResolvedValue(false);
    mockSummarizer.generateMilestoneSummary.mockReturnValue("## Summary");

    const result = await executeMilestoneWorkflow(
      context,
      "1 Build auth system with login and signup",
    );

    // Verify description was populated into requirements
    expect(mockStateObj.requirements.answered.scope).toBe(
      "Build auth system with login and signup",
    );
    expect(mockStateObj.requirements.answered.features).toBe(
      "Build auth system with login and signup",
    );
    expect(mockState.markRequirementsComplete).toHaveBeenCalled();
    expect(mockPlanningDocs.createPlanningDocs).toHaveBeenCalled();
    expect(result.complete).toBe(true);
    expect(result.phase).toBe("milestone-created");
  });

  it("commits planning docs to milestone branch", async () => {
    const context = { owner: "test", repo: "repo", issueNumber: 1 };
    mockState.loadState.mockResolvedValue({
      requirements: {
        answered: {},
        pending: [],
      },
      workflow: { lastCommentId: 0 },
    });
    mockPlanningDocs.createPlanningDocs.mockResolvedValue({
      project: {
        path: ".github/planning/milestones/1/PROJECT.md",
        purpose: "Context",
      },
    });
    mockBranches.branchExists.mockResolvedValue(false);
    mockSummarizer.generateMilestoneSummary.mockReturnValue("## Summary");

    await executeMilestoneWorkflow(context, "1 Build test system");

    expect(mockGit.configureGitIdentity).toHaveBeenCalledWith(
      "github-actions[bot]",
      "41898282+github-actions[bot]@users.noreply.github.com",
    );
    expect(mockBranches.createMilestoneBranch).toHaveBeenCalledWith(1);
  });

  it("posts summary comment on completion", async () => {
    const context = { owner: "test", repo: "repo", issueNumber: 1 };
    mockState.loadState.mockResolvedValue({
      requirements: {
        answered: {},
        pending: [],
      },
      workflow: { lastCommentId: 0 },
    });
    mockPlanningDocs.createPlanningDocs.mockResolvedValue({
      project: {
        path: ".github/planning/milestones/1/PROJECT.md",
        purpose: "Context",
      },
    });
    mockBranches.branchExists.mockResolvedValue(false);
    mockSummarizer.generateMilestoneSummary.mockReturnValue(
      "## Milestone Summary",
    );

    await executeMilestoneWorkflow(context, "1 Build test system");

    expect(mockSummarizer.generateMilestoneSummary).toHaveBeenCalled();
    expect(mockGithub.postComment).toHaveBeenCalledWith(
      "test",
      "repo",
      1,
      "## Milestone Summary",
    );
  });

  it("returns workflow result with files and branch", async () => {
    const context = { owner: "test", repo: "repo", issueNumber: 1 };
    mockState.loadState.mockResolvedValue({
      requirements: {
        answered: {},
        pending: [],
      },
      workflow: { lastCommentId: 0 },
    });
    mockPlanningDocs.createPlanningDocs.mockResolvedValue({
      project: {
        path: ".github/planning/milestones/1/PROJECT.md",
        purpose: "Context",
      },
      state: {
        path: ".github/planning/milestones/1/STATE.md",
        purpose: "Status",
      },
    });
    mockBranches.branchExists.mockResolvedValue(false);
    mockSummarizer.generateMilestoneSummary.mockReturnValue("## Summary");

    const result = await executeMilestoneWorkflow(
      context,
      "1 Build test system",
    );

    expect(result).toEqual({
      complete: true,
      phase: "milestone-created",
      milestone: 1,
      files: [
        ".github/planning/milestones/1/PROJECT.md",
        ".github/planning/milestones/1/STATE.md",
      ],
      branch: "gsd/1",
      projectIteration: expect.any(Object),
      message: "Milestone created successfully with planning documents",
    });
  });
});

describe("executeMilestoneWorkflow with optional milestone number", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockState.loadState.mockResolvedValue({
      requirements: {
        answered: {},
        pending: [],
      },
      workflow: {
        lastCommentId: 0,
        runCount: 0,
      },
      createdAt: "2025-01-01T00:00:00Z",
    });
    mockConfig.loadConfig.mockResolvedValue({});
  });

  it("should work without milestone number (description only)", async () => {
    const context = { owner: "test", repo: "repo", issueNumber: 1 };

    // Call with just description (no number)
    const result = await executeMilestoneWorkflow(
      context,
      "Build a login system with JWT authentication",
    );

    // Verify it returns GSD-managed flow result
    expect(result).toEqual({
      complete: true,
      phase: "gsd-managed",
      message: "GSD will determine milestone number and create planning artifacts",
      description: "Build a login system with JWT authentication",
    });

    // Verify no state loading or branch creation attempted
    expect(mockState.loadState).not.toHaveBeenCalled();
    expect(mockBranches.createMilestoneBranch).not.toHaveBeenCalled();
    expect(mockPlanningDocs.createPlanningDocs).not.toHaveBeenCalled();
  });

  it("should still work with milestone number (backward compatible)", async () => {
    const context = { owner: "test", repo: "repo", issueNumber: 1 };
    mockState.loadState.mockResolvedValue({
      requirements: {
        answered: {},
        pending: [],
      },
      workflow: { lastCommentId: 0 },
      createdAt: "2025-01-01T00:00:00Z",
    });
    mockPlanningDocs.createPlanningDocs.mockResolvedValue({
      project: {
        path: ".github/planning/milestones/2/PROJECT.md",
        purpose: "Context",
      },
    });
    mockBranches.branchExists.mockResolvedValue(false);
    mockSummarizer.generateMilestoneSummary.mockReturnValue("## Summary");
    mockProjects.findIteration.mockResolvedValue(null);

    // Call with milestone number
    const result = await executeMilestoneWorkflow(
      context,
      "2 Build a login system",
    );

    // Verify traditional flow was used
    expect(mockState.loadState).toHaveBeenCalledWith("test", "repo", 2);
    expect(mockBranches.createMilestoneBranch).toHaveBeenCalledWith(2);
    expect(mockPlanningDocs.createPlanningDocs).toHaveBeenCalled();
    expect(result.phase).toBe("milestone-created");
    expect(result.milestone).toBe(2);
  });

  it("should pass full description as prompt when no number", async () => {
    const context = { owner: "test", repo: "repo", issueNumber: 1 };
    const fullDescription = "Build authentication with OAuth2 and refresh tokens";

    const result = await executeMilestoneWorkflow(context, fullDescription);

    // Verify the entire commandArgs becomes the description
    // No stripping of milestone number
    expect(result.description).toBe(fullDescription);
    expect(result.phase).toBe("gsd-managed");
  });

  it("should reject empty description when no number", async () => {
    const context = { owner: "test", repo: "repo", issueNumber: 1 };

    // Empty description should throw
    await expect(executeMilestoneWorkflow(context, "")).rejects.toThrow(
      "Milestone description is required",
    );

    // Whitespace-only should throw
    await expect(executeMilestoneWorkflow(context, "   ")).rejects.toThrow(
      "Milestone description is required",
    );
  });

  it("should handle description with numbers in text (not milestone number)", async () => {
    const context = { owner: "test", repo: "repo", issueNumber: 1 };

    // Description that starts with text, not a milestone number
    const result = await executeMilestoneWorkflow(
      context,
      "Build v2 API with 3 endpoints",
    );

    // Should treat as GSD-managed (no parseable milestone number)
    expect(result.phase).toBe("gsd-managed");
    expect(result.description).toBe("Build v2 API with 3 endpoints");
  });
});
