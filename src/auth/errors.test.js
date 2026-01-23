/**
 * Comprehensive tests for auth/errors.js
 * Tests AuthorizationError class and formatAuthorizationError function
 */
import { describe, it, expect } from "vitest";
import { AuthorizationError, formatAuthorizationError } from "./errors.js";

describe("AuthorizationError", () => {
  it("is instance of Error", () => {
    const error = new AuthorizationError("Test error", "User message");
    expect(error).toBeInstanceOf(Error);
  });

  it('has name "AuthorizationError"', () => {
    const error = new AuthorizationError("Test error", "User message");
    expect(error.name).toBe("AuthorizationError");
  });

  it("has isAuthorizationError property set to true", () => {
    const error = new AuthorizationError("Test error", "User message");
    expect(error.isAuthorizationError).toBe(true);
  });

  it("stores technical message", () => {
    const error = new AuthorizationError(
      "Technical error message",
      "User message",
    );
    expect(error.message).toBe("Technical error message");
  });

  it("stores userMessage separately", () => {
    const error = new AuthorizationError("Technical", "User-friendly message");
    expect(error.userMessage).toBe("User-friendly message");
  });

  it("can be caught as Error", () => {
    try {
      throw new AuthorizationError("Test", "User message");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e.name).toBe("AuthorizationError");
    }
  });

  it("can be identified by isAuthorizationError property", () => {
    const error = new AuthorizationError("Test", "User message");
    const regularError = new Error("Regular error");

    expect(error.isAuthorizationError).toBe(true);
    expect(regularError.isAuthorizationError).toBeUndefined();
  });

  it("preserves stack trace", () => {
    const error = new AuthorizationError("Test", "User message");
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("AuthorizationError");
  });
});

describe("formatAuthorizationError", () => {
  it("includes username in output", () => {
    const result = formatAuthorizationError(
      "testuser",
      "owner/repo",
      "https://example.com/workflow",
    );

    expect(result).toContain("@testuser");
  });

  it("includes repository name", () => {
    const result = formatAuthorizationError(
      "user",
      "owner/test-repo",
      "https://example.com/workflow",
    );

    expect(result).toContain("owner/test-repo");
  });

  it("includes workflow URL", () => {
    const workflowUrl = "https://github.com/owner/repo/actions/runs/123";
    const result = formatAuthorizationError("user", "owner/repo", workflowUrl);

    expect(result).toContain(workflowUrl);
    expect(result).toContain("[View Logs]");
  });

  it('contains "Permission Denied" header', () => {
    const result = formatAuthorizationError(
      "user",
      "owner/repo",
      "https://example.com/workflow",
    );

    expect(result).toContain("## Permission Denied");
  });

  it("lists required permissions (Write, Maintain, Admin)", () => {
    const result = formatAuthorizationError(
      "user",
      "owner/repo",
      "https://example.com/workflow",
    );

    expect(result).toContain("Write");
    expect(result).toContain("Maintain");
    expect(result).toContain("Admin");
  });

  it("contains instructions for requesting access", () => {
    const result = formatAuthorizationError(
      "user",
      "owner/repo",
      "https://example.com/workflow",
    );

    expect(result).toContain("How to Request Access");
    expect(result).toContain("Contact a repository maintainer");
    expect(result).toContain("add you as a collaborator");
  });

  it("explains what access is needed", () => {
    const result = formatAuthorizationError(
      "user",
      "owner/repo",
      "https://example.com/workflow",
    );

    expect(result).toContain("does not have write access");
  });

  it("mentions @gsd-bot commands", () => {
    const result = formatAuthorizationError(
      "user",
      "owner/repo",
      "https://example.com/workflow",
    );

    expect(result).toContain("@gsd-bot");
  });

  it("is formatted as valid markdown", () => {
    const result = formatAuthorizationError(
      "user",
      "owner/repo",
      "https://example.com/workflow",
    );

    expect(result).toContain("##");
    expect(result).toContain("###");
    expect(result).toContain("-");
  });

  it("includes actionable next steps", () => {
    const result = formatAuthorizationError(
      "user",
      "owner/repo",
      "https://example.com/workflow",
    );

    expect(result).toMatch(/1\./);
    expect(result).toMatch(/2\./);
    expect(result).toMatch(/3\./);
  });

  it("handles special characters in username", () => {
    const result = formatAuthorizationError(
      "user-with-dashes",
      "owner/repo",
      "https://example.com/workflow",
    );

    expect(result).toContain("@user-with-dashes");
  });

  it("handles special characters in repo name", () => {
    const result = formatAuthorizationError(
      "user",
      "owner/repo-with-dashes",
      "https://example.com/workflow",
    );

    expect(result).toContain("owner/repo-with-dashes");
  });
});
