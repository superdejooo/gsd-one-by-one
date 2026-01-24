import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process
const mockExecAsync = vi.fn();
vi.mock("child_process", () => ({
  exec: vi.fn(),
}));
vi.mock("util", () => ({
  promisify: () => mockExecAsync,
}));

// Mock fs/promises
const mockReadFile = vi.fn();
const mockUnlink = vi.fn();
vi.mock("fs/promises", () => ({
  default: {
    readFile: mockReadFile,
    unlink: mockUnlink,
  },
}));

// Mock ccr-command.js
vi.mock("../llm/ccr-command.js", () => ({
  formatCcrCommandWithOutput: (gsdCmd, basePath, prompt, skill) => ({
    command: `ccr code --print "${gsdCmd} /github-actions-testing ${prompt || ""}" > ${basePath}.txt 2> ${basePath}-debug.txt`,
    stdoutPath: `${basePath}.txt`,
    stderrPath: `${basePath}-debug.txt`,
  }),
}));

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  getInput: vi.fn(() => "mock-token"),
}));

// Mock github.js module (where updateIssueBody and postComment are imported from)
const mockUpdateIssueBody = vi.fn();
const mockPostComment = vi.fn();
vi.mock("../lib/github.js", () => ({
  updateIssueBody: mockUpdateIssueBody,
  postComment: mockPostComment,
}));

// Mock @actions/github
vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(() => ({
    rest: {
      issues: {
        createComment: vi.fn(),
        update: vi.fn(),
      },
    },
  })),
  context: {
    token: "mock-token",
  },
}));

// Mock planning-parser.js
const mockParseMilestoneMetadata = vi.fn();
vi.mock("../lib/planning-parser.js", () => ({
  parseMilestoneMetadata: mockParseMilestoneMetadata,
}));

// Import module under test after mocks
const { executeLabelTriggerWorkflow } =
  await import("./label-trigger.js");
import * as core from "@actions/core";

describe("label-trigger.js", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("executeLabelTriggerWorkflow", () => {
    const mockContext = {
      owner: "test-owner",
      repo: "test-repo",
      issueNumber: 42,
      issueTitle: "Build a login system",
      issueBody: "We need authentication with JWT tokens\n\nRequirements:\n- Email/password login\n- Token refresh",
    };

    beforeEach(() => {
      // Reset mocks with default success behavior
      mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
      mockReadFile.mockResolvedValue(
        "Milestone creation completed successfully",
      );
      mockUnlink.mockResolvedValue(undefined);
      // Mock metadata parsing to return null by default (simulates missing planning files)
      mockParseMilestoneMetadata.mockResolvedValue(null);
    });

    it("joins title and body with --- separator", async () => {
      await executeLabelTriggerWorkflow(mockContext);

      const expectedPrompt = `${mockContext.issueTitle}\n---\n${mockContext.issueBody}`;
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining(expectedPrompt),
        expect.any(Object),
      );
    });

    it("handles empty issue body", async () => {
      const contextWithoutBody = {
        ...mockContext,
        issueBody: "",
      };

      await executeLabelTriggerWorkflow(contextWithoutBody);

      const expectedPrompt = `${mockContext.issueTitle}\n---\n`;
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining(expectedPrompt),
        expect.any(Object),
      );
    });

    it("executes CCR command with /gsd:new-milestone", async () => {
      await executeLabelTriggerWorkflow(mockContext);

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('ccr code --print "/gsd:new-milestone'),
        expect.objectContaining({ timeout: 600000 }),
      );
    });

    it("uses 10-minute timeout", async () => {
      await executeLabelTriggerWorkflow(mockContext);

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 600000 }),
      );
    });

    it("returns success result on completion", async () => {
      const expectedOutput = "Milestone created successfully";
      mockReadFile.mockResolvedValue(expectedOutput);

      const result = await executeLabelTriggerWorkflow(mockContext);

      expect(result.complete).toBe(true);
      expect(result.phase).toBe("gsd-complete-no-metadata");
    });

    it("throws error on CCR failure", async () => {
      const error = new Error("Command failed");
      error.code = 1;
      mockExecAsync.mockRejectedValue(error);
      mockReadFile.mockResolvedValue("Error: Milestone creation failed");

      await expect(executeLabelTriggerWorkflow(mockContext)).rejects.toThrow(
        "Label trigger failed",
      );
    });

    it("detects error patterns in output", async () => {
      mockReadFile.mockResolvedValue("Error: Permission Denied");

      await expect(executeLabelTriggerWorkflow(mockContext)).rejects.toThrow(
        "Label trigger failed",
      );
    });

    it("handles command timeout", async () => {
      const timeoutError = new Error("Command timed out");
      timeoutError.code = "ETIMEDOUT";
      mockExecAsync.mockRejectedValue(timeoutError);
      mockReadFile.mockResolvedValue("(No output captured)");

      await expect(executeLabelTriggerWorkflow(mockContext)).rejects.toThrow();

      expect(vi.mocked(core.warning)).toHaveBeenCalledWith(
        expect.stringContaining("exited with code"),
      );
    });

    it("logs workflow progress", async () => {
      await executeLabelTriggerWorkflow(mockContext);

      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        "Starting label trigger workflow for test-owner/test-repo#42",
      );
      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        `Issue title: ${mockContext.issueTitle}`,
      );
      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        "Label trigger workflow complete",
      );
    });

    it("handles missing output file", async () => {
      mockReadFile.mockRejectedValue(new Error("File not found"));

      const result = await executeLabelTriggerWorkflow(mockContext);

      expect(result.complete).toBe(true);
      expect(result.phase).toBe("gsd-complete-no-metadata");
    });
  });

  describe("executeLabelTriggerWorkflow - issue update", () => {
    const mockContext = {
      owner: "test-owner",
      repo: "test-repo",
      issueNumber: 42,
      issueTitle: "Build a login system",
      issueBody: "Need authentication",
    };

    beforeEach(() => {
      mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
      mockReadFile.mockResolvedValue("Milestone creation completed");
      mockUnlink.mockResolvedValue(undefined);
      mockUpdateIssueBody.mockResolvedValue(undefined);
      mockPostComment.mockResolvedValue(undefined);
      mockParseMilestoneMetadata.mockResolvedValue({
        title: "Test Project",
        version: "v1.0",
        coreValue: "Testing the system.",
        phases: [
          { number: "1", name: "Setup", status: "not-started" },
          { number: "2", name: "Implementation", status: "complete" },
        ],
      });
    });

    it("should update issue with milestone info after GSD completes", async () => {
      const result = await executeLabelTriggerWorkflow(mockContext);

      expect(result.complete).toBe(true);
      expect(result.phase).toBe("milestone-created");
      expect(result.title).toBe("Test Project");
      expect(result.version).toBe("v1.0");
      expect(result.phaseCount).toBe(2);
    });

    it("should preserve original issue body", async () => {
      await executeLabelTriggerWorkflow(mockContext);

      expect(mockUpdateIssueBody).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        42,
        expect.stringContaining("Need authentication"),
      );
    });

    it("should include milestone section with phases", async () => {
      await executeLabelTriggerWorkflow(mockContext);

      expect(mockUpdateIssueBody).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        42,
        expect.stringContaining("Milestone Created: Test Project v1.0"),
      );
      expect(mockUpdateIssueBody).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        42,
        expect.stringContaining("Phase 1: Setup"),
      );
    });

    it("should post success comment", async () => {
      await executeLabelTriggerWorkflow(mockContext);

      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        42,
        expect.stringContaining("Milestone Created"),
      );
    });

    it("should handle metadata parsing failure gracefully", async () => {
      mockParseMilestoneMetadata.mockRejectedValue(new Error("Parse error"));

      const result = await executeLabelTriggerWorkflow(mockContext);

      expect(result.complete).toBe(true);
      expect(result.phase).toBe("gsd-complete-no-metadata");
      expect(vi.mocked(core.warning)).toHaveBeenCalledWith(
        expect.stringContaining("Failed to parse milestone metadata"),
      );
    });

    it("should handle null metadata gracefully", async () => {
      mockParseMilestoneMetadata.mockResolvedValue(null);

      const result = await executeLabelTriggerWorkflow(mockContext);

      expect(result.complete).toBe(true);
      expect(result.phase).toBe("gsd-complete-no-metadata");
      expect(vi.mocked(core.warning)).toHaveBeenCalledWith(
        expect.stringContaining("Could not parse milestone metadata"),
      );
    });

    it("should handle issue update failure gracefully", async () => {
      mockUpdateIssueBody.mockRejectedValueOnce(new Error("Update failed"));

      const result = await executeLabelTriggerWorkflow(mockContext);

      expect(result.complete).toBe(true);
      expect(result.phase).toBe("milestone-created");
      expect(vi.mocked(core.error)).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update issue body"),
      );
    });
  });
});
