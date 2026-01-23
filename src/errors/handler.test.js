import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthorizationError } from "../auth/errors.js";

// Mock dependencies using factory functions
vi.mock("@actions/core", () => ({
  setFailed: vi.fn(),
  info: vi.fn(),
}));

vi.mock("../lib/github.js", () => ({
  postComment: vi.fn(),
  getWorkflowRunUrl: vi.fn(() => "https://example.com/run/123"),
}));

vi.mock("./formatter.js", () => ({
  formatErrorComment: vi.fn((err) => `Error: ${err.message}`),
}));

// Import after mocks
import { withErrorHandling } from "./handler.js";
import * as core from "@actions/core";
import * as github from "../lib/github.js";
import * as formatter from "./formatter.js";

describe("withErrorHandling", () => {
  const context = {
    owner: "test-owner",
    repo: "test-repo",
    issueNumber: 123,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success: true on successful operation", async () => {
    const operation = vi.fn().mockResolvedValue({ data: "test" });

    const result = await withErrorHandling(operation, context);

    expect(result.success).toBe(true);
  });

  it("spreads operation result into return", async () => {
    const operation = vi.fn().mockResolvedValue({ data: "test", count: 5 });

    const result = await withErrorHandling(operation, context);

    expect(result).toEqual({
      success: true,
      data: "test",
      count: 5,
    });
  });

  it("calls setFailed on error", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("Test error"));

    await withErrorHandling(operation, context);

    expect(core.setFailed).toHaveBeenCalledWith("Test error");
  });

  it("posts formatted error comment for technical errors", async () => {
    const error = new Error("Technical failure");
    const operation = vi.fn().mockRejectedValue(error);

    await withErrorHandling(operation, context);

    expect(formatter.formatErrorComment).toHaveBeenCalledWith(
      error,
      "https://example.com/run/123",
    );
    expect(github.postComment).toHaveBeenCalledWith(
      "test-owner",
      "test-repo",
      123,
      "Error: Technical failure",
    );
  });

  it("posts userMessage for AuthorizationError (not formatted)", async () => {
    const authError = new AuthorizationError(
      "alice",
      "read",
      "User does not have write access",
    );
    const operation = vi.fn().mockRejectedValue(authError);

    await withErrorHandling(operation, context);

    // Should post userMessage directly, not call formatErrorComment
    expect(formatter.formatErrorComment).not.toHaveBeenCalled();
    expect(github.postComment).toHaveBeenCalledWith(
      "test-owner",
      "test-repo",
      123,
      authError.userMessage,
    );
  });

  it("returns success: false with error message", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("Test error"));

    const result = await withErrorHandling(operation, context);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Test error");
  });

  it("returns isAuthorizationError: true for auth errors", async () => {
    const authError = new AuthorizationError(
      "alice",
      "read",
      "User does not have write access",
    );
    const operation = vi.fn().mockRejectedValue(authError);

    const result = await withErrorHandling(operation, context);

    expect(result.success).toBe(false);
    expect(result.isAuthorizationError).toBe(true);
  });

  it("does not include isAuthorizationError for technical errors", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("Test error"));

    const result = await withErrorHandling(operation, context);

    expect(result.isAuthorizationError).toBeUndefined();
  });

  it("skips posting comment when no issueNumber provided", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("Test error"));
    const contextWithoutIssue = { owner: "test-owner", repo: "test-repo" };

    await withErrorHandling(operation, contextWithoutIssue);

    expect(github.postComment).not.toHaveBeenCalled();
  });

  it("executes the operation", async () => {
    const operation = vi.fn().mockResolvedValue({ data: "test" });

    await withErrorHandling(operation, context);

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("logs info when authorization error detected", async () => {
    const authError = new AuthorizationError(
      "alice",
      "read",
      "User does not have write access",
    );
    const operation = vi.fn().mockRejectedValue(authError);

    await withErrorHandling(operation, context);

    expect(core.info).toHaveBeenCalledWith(
      "Authorization error detected - posting user-friendly message",
    );
  });
});
