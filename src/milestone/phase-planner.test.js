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

// Mock github.js
const mockPostComment = vi.fn();
vi.mock("../lib/github.js", () => ({
  postComment: mockPostComment,
}));

// Mock ccr-command.js
vi.mock("../llm/ccr-command.js", () => ({
  formatCcrCommandWithOutput: (gsdCmd, outputPath) =>
    `ccr code --print "${gsdCmd}" > ${outputPath} 2>&1`,
}));

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

// Import module under test after mocks
const { parsePhaseNumber, executePhaseWorkflow } =
  await import("./phase-planner.js");
import * as core from "@actions/core";

describe("phase-planner.js", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parsePhaseNumber", () => {
    it('parses "--phase 7"', () => {
      expect(parsePhaseNumber("--phase 7")).toBe(7);
    });

    it('parses "--phase=7"', () => {
      expect(parsePhaseNumber("--phase=7")).toBe(7);
    });

    it('parses "-p 7"', () => {
      expect(parsePhaseNumber("-p 7")).toBe(7);
    });

    it('parses "-p=7"', () => {
      expect(parsePhaseNumber("-p=7")).toBe(7);
    });

    it('parses standalone "7"', () => {
      expect(parsePhaseNumber("7")).toBe(7);
    });

    it("parses standalone with trailing text", () => {
      expect(parsePhaseNumber("some text 7")).toBe(7);
    });

    it("throws for empty string", () => {
      expect(() => parsePhaseNumber("")).toThrow("Phase number is required");
    });

    it("throws for non-numeric input", () => {
      expect(() => parsePhaseNumber("invalid")).toThrow("Could not parse");
    });
  });

  describe("executePhaseWorkflow", () => {
    const mockContext = {
      owner: "test-owner",
      repo: "test-repo",
      issueNumber: 42,
    };

    beforeEach(() => {
      // Reset mocks with default success behavior
      mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
      mockReadFile.mockResolvedValue(
        "Phase planning completed successfully\n\nNext steps:\n- Review the plan",
      );
      mockUnlink.mockResolvedValue(undefined);
    });

    it("executes CCR command with correct phase number", async () => {
      await executePhaseWorkflow(mockContext, "7");

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('ccr code --print "/gsd:plan-phase 7"'),
        expect.objectContaining({ timeout: 600000 }),
      );
    });

    it("uses 10-minute timeout", async () => {
      await executePhaseWorkflow(mockContext, "5");

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 600000 }),
      );
    });

    it("posts output to GitHub on success", async () => {
      const expectedOutput = "Phase 3 planned successfully";
      mockReadFile.mockResolvedValue(expectedOutput);

      await executePhaseWorkflow(mockContext, "3");

      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        42,
        expectedOutput,
      );
    });

    it("throws error on failure (withErrorHandling posts comment)", async () => {
      const error = new Error("Command failed");
      error.code = 1;
      mockExecAsync.mockRejectedValue(error);
      mockReadFile.mockResolvedValue("Error: Planning failed");

      await expect(executePhaseWorkflow(mockContext, "2")).rejects.toThrow(
        "Phase planning failed",
      );
      // Error comment posting is delegated to withErrorHandling wrapper
    });

    it("handles command timeout", async () => {
      const timeoutError = new Error("Command timed out");
      timeoutError.code = "ETIMEDOUT";
      mockExecAsync.mockRejectedValue(timeoutError);
      mockReadFile.mockResolvedValue("(No output captured)");

      await expect(executePhaseWorkflow(mockContext, "8")).rejects.toThrow();

      expect(vi.mocked(core.warning)).toHaveBeenCalledWith(
        expect.stringContaining("exited with code"),
      );
    });

    it("cleans up output file on success", async () => {
      await executePhaseWorkflow(mockContext, "4");

      expect(mockUnlink).toHaveBeenCalledWith(
        expect.stringMatching(/output-\d+\.txt/),
      );
    });

    it("handles cleanup failure gracefully", async () => {
      mockUnlink.mockRejectedValue(new Error("File not found"));

      await executePhaseWorkflow(mockContext, "1");

      expect(vi.mocked(core.warning)).toHaveBeenCalledWith(
        expect.stringContaining("Failed to cleanup"),
      );
    });

    it("returns workflow result on success", async () => {
      const result = await executePhaseWorkflow(mockContext, "6");

      expect(result).toEqual({
        complete: true,
        phaseNumber: 6,
        issuesCreated: 0,
        message: "Phase planning completed successfully",
      });
    });

    it("logs workflow progress", async () => {
      await executePhaseWorkflow(mockContext, "9");

      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        "Starting phase planning workflow for test-owner/test-repo#42",
      );
      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        "Parsed phase number: 9",
      );
      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        "Phase 9 planning workflow complete",
      );
    });

    it("detects error patterns in output", async () => {
      mockReadFile.mockResolvedValue("Error: Permission Denied");

      await expect(executePhaseWorkflow(mockContext, "3")).rejects.toThrow(
        "Phase planning failed",
      );
      // Error comment posting is delegated to withErrorHandling wrapper
    });
  });
});
