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
const mockFormatCcrCommandWithOutput = vi.fn();
vi.mock("../llm/ccr-command.js", () => ({
  formatCcrCommandWithOutput: mockFormatCcrCommandWithOutput,
}));

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

// Import module under test after mocks
const { executeReplyWorkflow } = await import("./reply.js");
import * as core from "@actions/core";

describe("Reply Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks with default success behavior
    mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
    mockReadFile.mockResolvedValue("Response from Claude");
    mockUnlink.mockResolvedValue(undefined);
  });

  it("should execute reply workflow with text as prompt", async () => {
    // Arrange
    const context = {
      owner: "test-owner",
      repo: "test-repo",
      issueNumber: 123,
    };
    const commandArgs = "Can you help me with this issue?";
    const outputContent = "Here's my response to your question...";

    mockFormatCcrCommandWithOutput.mockReturnValue(
      'ccr code --print " /github-actions-testing Can you help me with this issue?" > output.txt 2>&1',
    );
    mockReadFile.mockResolvedValue(outputContent);

    // Act
    const result = await executeReplyWorkflow(context, commandArgs);

    // Assert
    expect(result).toEqual({
      complete: true,
      message: "Reply sent successfully",
    });
    expect(mockFormatCcrCommandWithOutput).toHaveBeenCalledWith(
      "",
      expect.stringMatching(/^output-\d+\.txt$/),
      commandArgs,
      null,
    );
    expect(mockPostComment).toHaveBeenCalledWith(
      "test-owner",
      "test-repo",
      123,
      outputContent,
    );
  });

  it("should throw error when text is empty", async () => {
    // Arrange
    const context = {
      owner: "test-owner",
      repo: "test-repo",
      issueNumber: 123,
    };

    // Act & Assert
    await expect(executeReplyWorkflow(context, "")).rejects.toThrow(
      "Reply text is required",
    );
    await expect(executeReplyWorkflow(context, "   ")).rejects.toThrow(
      "Reply text is required",
    );
  });

  it("should pass skill parameter to CCR command formatter", async () => {
    // Arrange
    const context = {
      owner: "test-owner",
      repo: "test-repo",
      issueNumber: 123,
    };
    const commandArgs = "Help with refactoring";
    const skill = "refactor";
    const outputContent = "Refactoring suggestions...";

    mockFormatCcrCommandWithOutput.mockReturnValue(
      'ccr code --print " /refactor /github-actions-testing Help with refactoring" > output.txt 2>&1',
    );
    mockReadFile.mockResolvedValue(outputContent);

    // Act
    const result = await executeReplyWorkflow(context, commandArgs, skill);

    // Assert
    expect(result.complete).toBe(true);
    expect(mockFormatCcrCommandWithOutput).toHaveBeenCalledWith(
      "",
      expect.stringMatching(/^output-\d+\.txt$/),
      commandArgs,
      skill,
    );
  });

  it("should handle CCR execution errors", async () => {
    // Arrange
    const context = {
      owner: "test-owner",
      repo: "test-repo",
      issueNumber: 123,
    };
    const commandArgs = "Test question";

    const error = new Error("Command failed");
    error.code = 1;
    mockExecAsync.mockRejectedValue(error);
    mockReadFile.mockResolvedValue("Error: Something went wrong");

    // Act & Assert
    await expect(
      executeReplyWorkflow(context, commandArgs),
    ).rejects.toThrow("Reply failed:");
  });
});
