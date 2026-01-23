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
  formatCcrCommandWithOutput: (gsdCmd, outputPath, prompt, skill) =>
    `ccr code --print "${gsdCmd} /github-actions-testing ${prompt || ""}" > ${outputPath} 2>&1`,
}));

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
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

      expect(result).toEqual({
        complete: true,
        output: expectedOutput,
        message: "Label trigger completed successfully",
      });
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

    it("cleans up output file on success", async () => {
      await executeLabelTriggerWorkflow(mockContext);

      expect(mockUnlink).toHaveBeenCalledWith(
        expect.stringMatching(/output-\d+\.txt/),
      );
    });

    it("handles cleanup failure gracefully", async () => {
      mockUnlink.mockRejectedValue(new Error("File not found"));

      await executeLabelTriggerWorkflow(mockContext);

      expect(vi.mocked(core.warning)).toHaveBeenCalledWith(
        expect.stringContaining("Failed to cleanup"),
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

      expect(result.output).toBe("(No output captured)");
      expect(result.complete).toBe(true);
    });
  });
});
