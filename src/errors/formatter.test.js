/**
 * Comprehensive tests for formatter.js
 * Tests formatErrorComment and formatSuccessComment with edge cases
 */
import { describe, it, expect, vi } from "vitest";
import { formatErrorComment, formatSuccessComment } from "./formatter.js";

// Mock github.js module
vi.mock("../lib/github.js", () => ({
  getWorkflowRunUrl: vi.fn(() => "https://example.com/actions/runs/123"),
}));

describe("formatErrorComment", () => {
  it("includes error message in output", () => {
    const error = new Error("Test error message");
    const result = formatErrorComment(error, "https://example.com/workflow");

    expect(result).toContain("Test error message");
  });

  it("includes workflow URL link", () => {
    const error = new Error("Test error");
    const workflowUrl = "https://github.com/owner/repo/actions/runs/123";
    const result = formatErrorComment(error, workflowUrl);

    expect(result).toContain(workflowUrl);
    expect(result).toContain("[View Logs]");
  });

  it("includes stack trace in details section", () => {
    const error = new Error("Test error");
    const result = formatErrorComment(error, "https://example.com/workflow");

    expect(result).toContain("<details>");
    expect(result).toContain("Stack Trace");
    expect(result).toContain("</details>");
    expect(result).toContain(error.stack);
  });

  it("handles error without stack trace gracefully", () => {
    const error = { message: "Test error without stack" };
    const result = formatErrorComment(error, "https://example.com/workflow");

    expect(result).toContain("Test error without stack");
    expect(result).toContain("No stack trace available");
  });

  it("output is valid markdown (has ##, <details>)", () => {
    const error = new Error("Test error");
    const result = formatErrorComment(error, "https://example.com/workflow");

    expect(result).toContain("## Error:");
    expect(result).toContain("<details>");
    expect(result).toContain("### Next Steps");
  });

  it('includes "Unknown error" for error without message', () => {
    const error = {};
    const result = formatErrorComment(error, "https://example.com/workflow");

    expect(result).toContain("Unknown error");
  });

  it("includes troubleshooting steps", () => {
    const error = new Error("Test error");
    const result = formatErrorComment(error, "https://example.com/workflow");

    expect(result).toContain("Next Steps");
    expect(result).toContain("Check the workflow run logs");
    expect(result).toContain("Review the command syntax");
  });
});

describe("formatSuccessComment", () => {
  it("includes summary in output", () => {
    const result = formatSuccessComment(
      { summary: "Test summary message" },
      "https://example.com/workflow",
    );

    expect(result).toContain("Test summary message");
  });

  it("includes workflow URL", () => {
    const workflowUrl = "https://github.com/owner/repo/actions/runs/123";
    const result = formatSuccessComment({ summary: "Test" }, workflowUrl);

    expect(result).toContain(workflowUrl);
    expect(result).toContain("[View Details]");
  });

  it("includes files table when filesCreated provided", () => {
    const resultData = {
      summary: "Test",
      filesCreated: [
        { name: "file1.md", purpose: "Documentation" },
        { name: "file2.js", purpose: "Implementation" },
      ],
    };
    const result = formatSuccessComment(
      resultData,
      "https://example.com/workflow",
    );

    expect(result).toContain("### Files Created");
    expect(result).toContain("| File | Purpose |");
    expect(result).toContain("file1.md");
    expect(result).toContain("Documentation");
    expect(result).toContain("file2.js");
    expect(result).toContain("Implementation");
  });

  it("includes decisions list when decisions provided", () => {
    const resultData = {
      summary: "Test",
      decisions: ["Used ESM modules", "Chose Vitest over Jest"],
    };
    const result = formatSuccessComment(
      resultData,
      "https://example.com/workflow",
    );

    expect(result).toContain("### Decisions Made");
    expect(result).toContain("- Used ESM modules");
    expect(result).toContain("- Chose Vitest over Jest");
  });

  it("handles missing optional fields gracefully", () => {
    const result = formatSuccessComment({}, "https://example.com/workflow");

    expect(result).toContain("Command Completed Successfully");
    expect(result).toContain("Command executed without errors");
    expect(result).not.toContain("### Files Created");
    expect(result).not.toContain("### Decisions Made");
  });

  it("handles empty filesCreated array", () => {
    const resultData = {
      summary: "Test",
      filesCreated: [],
    };
    const result = formatSuccessComment(
      resultData,
      "https://example.com/workflow",
    );

    expect(result).not.toContain("### Files Created");
  });

  it("handles empty decisions array", () => {
    const resultData = {
      summary: "Test",
      decisions: [],
    };
    const result = formatSuccessComment(
      resultData,
      "https://example.com/workflow",
    );

    expect(result).not.toContain("### Decisions Made");
  });

  it("includes both files and decisions when provided", () => {
    const resultData = {
      summary: "Test",
      filesCreated: [{ name: "test.md", purpose: "Testing" }],
      decisions: ["Made a decision"],
    };
    const result = formatSuccessComment(
      resultData,
      "https://example.com/workflow",
    );

    expect(result).toContain("### Files Created");
    expect(result).toContain("### Decisions Made");
    expect(result).toContain("test.md");
    expect(result).toContain("Made a decision");
  });

  it("uses default summary when not provided", () => {
    const result = formatSuccessComment({}, "https://example.com/workflow");

    expect(result).toContain("Command executed without errors");
  });
});
