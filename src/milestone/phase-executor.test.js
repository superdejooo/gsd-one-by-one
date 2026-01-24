import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process
const mockExecAsync = vi.fn();
vi.mock("node:child_process", () => ({
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
  formatCcrCommandWithOutput: (gsdCmd, basePath) => ({
    command: `ccr code --print "${gsdCmd}" > ${basePath}.txt 2> ${basePath}-debug.txt`,
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
}));

// Import module under test after mocks
const { parsePhaseNumber, executePhaseExecutionWorkflow } =
  await import("./phase-executor.js");
import * as core from "@actions/core";

describe("phase-executor.js", () => {
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

    it("returns null for empty string (auto-detect next phase)", () => {
      expect(parsePhaseNumber("")).toBeNull();
    });

    it("returns null for non-numeric input (auto-detect next phase)", () => {
      expect(parsePhaseNumber("invalid")).toBeNull();
    });

    it("returns null for null input (auto-detect next phase)", () => {
      expect(parsePhaseNumber(null)).toBeNull();
    });

    it("returns null for undefined input (auto-detect next phase)", () => {
      expect(parsePhaseNumber(undefined)).toBeNull();
    });
  });

  describe("parseExecutionOutput (via workflow)", () => {
    const mockContext = {
      owner: "test-owner",
      repo: "test-repo",
      issueNumber: 100,
    };

    beforeEach(() => {
      mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
      mockUnlink.mockResolvedValue(undefined);
    });

    it("extracts completed actions from [x] markers", async () => {
      const output = `
- [x] Task 1 completed
- [x] Task 2 completed
- [ ] Task 3 pending
`;
      mockReadFile.mockResolvedValue(output);

      await executePhaseExecutionWorkflow(mockContext, "3");

      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.stringContaining("[x] Task 1 completed"),
      );
      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.stringContaining("[x] Task 2 completed"),
      );
    });

    it("extracts next steps section", async () => {
      const output = `
Next steps:
- Review the changes
- Test the feature
- Deploy to staging
`;
      mockReadFile.mockResolvedValue(output);

      await executePhaseExecutionWorkflow(mockContext, "2");

      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.stringContaining("Review the changes"),
      );
      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.stringContaining("Test the feature"),
      );
    });

    it("extracts questions section", async () => {
      const output = `
Questions:
- What color should button be?
- Which database to use?
`;
      mockReadFile.mockResolvedValue(output);

      await executePhaseExecutionWorkflow(mockContext, "4");

      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.stringContaining("What color should button be?"),
      );
      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.stringContaining("Which database to use?"),
      );
    });

    it("sets hasQuestions when questions present", async () => {
      const output = `
Questions:
- Need user input here
`;
      mockReadFile.mockResolvedValue(output);

      const result = await executePhaseExecutionWorkflow(mockContext, "5");

      expect(result.hasQuestions).toBe(true);
      expect(result.complete).toBe(false);
      expect(result.message).toContain("paused");
    });

    it("handles output without sections gracefully", async () => {
      const output = "Simple output without structured sections";
      mockReadFile.mockResolvedValue(output);

      const result = await executePhaseExecutionWorkflow(mockContext, "1");

      expect(result.complete).toBe(true);
      expect(result.hasQuestions).toBe(false);
      expect(result.completedCount).toBe(0);
    });
  });

  describe("formatExecutionComment (via workflow)", () => {
    const mockContext = {
      owner: "test-owner",
      repo: "test-repo",
      issueNumber: 100,
    };

    beforeEach(() => {
      mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
      mockUnlink.mockResolvedValue(undefined);
    });

    it("includes completed actions", async () => {
      mockReadFile.mockResolvedValue("[x] Action completed");

      await executePhaseExecutionWorkflow(mockContext, "1");

      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.stringMatching(/### Completed/),
      );
    });

    it("includes next steps", async () => {
      mockReadFile.mockResolvedValue(`
Next steps:
- Step 1
- Step 2
`);

      await executePhaseExecutionWorkflow(mockContext, "2");

      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.stringMatching(/### Next Steps/),
      );
    });

    it("includes questions with reply prompt", async () => {
      mockReadFile.mockResolvedValue(`
Questions:
- Question 1
`);

      await executePhaseExecutionWorkflow(mockContext, "3");

      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.stringContaining("Reply to this comment"),
      );
    });

    it("includes raw output in code block when no structured content", async () => {
      const rawOutput = "Raw execution output here";
      mockReadFile.mockResolvedValue(rawOutput);

      await executePhaseExecutionWorkflow(mockContext, "4");

      // Without structured content, output is shown in code block directly
      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.stringContaining("```"),
      );
      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.stringContaining("Raw execution output here"),
      );
    });

    it("includes details section when structured content found", async () => {
      const output = `
[x] Task 1 completed
[x] Task 2 completed
Some other text
`;
      mockReadFile.mockResolvedValue(output);

      await executePhaseExecutionWorkflow(mockContext, "4");

      // With structured content, raw output goes in collapsible details
      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.stringMatching(/<details>/),
      );
      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.stringContaining("Full Output"),
      );
    });

    it("strips CCR debug logs from output", async () => {
      const output = `[log_abc123] sending request
method: 'post'
url: 'http://127.0.0.1:3456/v1/messages'
response 200 http://127.0.0.1:3456 Headers {
durationMs: 1234
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
All done!`;
      mockReadFile.mockResolvedValue(output);

      await executePhaseExecutionWorkflow(mockContext, "5");

      // Should not include CCR logs
      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.not.stringContaining("[log_abc123]"),
      );
      // Should include GSD block
      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.stringContaining("GSD ► PHASE COMPLETE"),
      );
    });

    it("extracts GSD block from last GSD marker", async () => {
      const output = `Earlier content
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► FIRST MARKER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Middle content
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► LAST MARKER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Final content`;
      mockReadFile.mockResolvedValue(output);

      await executePhaseExecutionWorkflow(mockContext, "6");

      // Should include last GSD marker, not first
      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.stringContaining("GSD ► LAST MARKER"),
      );
    });
  });

  describe("executePhaseExecutionWorkflow", () => {
    const mockContext = {
      owner: "test-owner",
      repo: "test-repo",
      issueNumber: 100,
    };

    beforeEach(() => {
      mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
      mockReadFile.mockResolvedValue("Execution complete");
      mockUnlink.mockResolvedValue(undefined);
    });

    it("uses 30-minute timeout (vs 10 min for planner)", async () => {
      await executePhaseExecutionWorkflow(mockContext, "5");

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 1800000 }), // 30 minutes
      );
    });

    it("returns hasQuestions flag", async () => {
      mockReadFile.mockResolvedValue(`
Questions:
- User input needed
`);

      const result = await executePhaseExecutionWorkflow(mockContext, "6");

      expect(result.hasQuestions).toBe(true);
    });

    it("returns completedCount", async () => {
      mockReadFile.mockResolvedValue(`
[x] Task 1 completed
[x] Task 2 completed
[x] Task 3 completed
`);

      const result = await executePhaseExecutionWorkflow(mockContext, "7");

      expect(result.completedCount).toBe(3);
    });

    it("posts structured comment (not raw output)", async () => {
      const rawOutput = `
[x] Task completed

Next steps:
- Review code
`;
      mockReadFile.mockResolvedValue(rawOutput);

      await executePhaseExecutionWorkflow(mockContext, "8");

      // Should post formatted comment with sections
      expect(mockPostComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        expect.stringMatching(/## Phase Execution Update/),
      );
      // Not just raw pass-through
      expect(mockPostComment).not.toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        100,
        rawOutput,
      );
    });

    it("executes correct GSD command with phase number", async () => {
      await executePhaseExecutionWorkflow(mockContext, "9");

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('ccr code --print "/gsd:execute-phase 9"'),
        expect.any(Object),
      );
    });

    it("executes GSD command without phase number (auto-detect)", async () => {
      await executePhaseExecutionWorkflow(mockContext, "");

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('ccr code --print "/gsd:execute-phase"'),
        expect.any(Object),
      );
      // Should NOT contain a number
      expect(mockExecAsync).not.toHaveBeenCalledWith(
        expect.stringMatching(/execute-phase \d/),
        expect.any(Object),
      );
    });

    it("throws error on failure (withErrorHandling posts comment)", async () => {
      const error = new Error("Execution failed");
      error.code = 1;
      mockExecAsync.mockRejectedValue(error);
      mockReadFile.mockResolvedValue("Error: Execution failed");

      await expect(
        executePhaseExecutionWorkflow(mockContext, "11"),
      ).rejects.toThrow("Phase execution failed");
      // Error comment posting is delegated to withErrorHandling wrapper
    });

    it("logs workflow progress", async () => {
      await executePhaseExecutionWorkflow(mockContext, "12");

      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        "Starting phase execution workflow for test-owner/test-repo#100",
      );
      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        "Parsed phase number: 12",
      );
      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        "Phase 12 execution workflow complete",
      );
    });
  });
});
