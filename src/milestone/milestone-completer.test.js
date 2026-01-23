import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("util", () => ({
  promisify: vi.fn((fn) => {
    return async (...args) => {
      return new Promise((resolve, reject) => {
        fn(args[0], args[1], (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve({ stdout, stderr });
        });
      });
    };
  }),
}));

vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    unlink: vi.fn(),
  },
}));

vi.mock("../lib/github.js", () => ({
  postComment: vi.fn().mockResolvedValue(undefined),
}));

// Mock ccr-command.js
vi.mock("../llm/ccr-command.js", () => ({
  formatCcrCommandWithOutput: (gsdCmd, outputPath) =>
    `ccr code --print "${gsdCmd}" > ${outputPath} 2>&1`,
}));

import { exec } from "node:child_process";
import fs from "fs/promises";
import { postComment } from "../lib/github.js";
import { executeMilestoneCompletionWorkflow } from "./milestone-completer.js";

describe("milestone-completer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("executeMilestoneCompletionWorkflow", () => {
    it("executes GSD complete-milestone command and posts result", async () => {
      const mockOutput = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► MILESTONE COMPLETED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

v1.1 milestone archived successfully.
`;

      exec.mockImplementation((cmd, opts, callback) => {
        callback(null, "", "");
      });
      fs.readFile.mockResolvedValue(mockOutput);
      fs.unlink.mockResolvedValue(undefined);

      const result = await executeMilestoneCompletionWorkflow({
        owner: "test-owner",
        repo: "test-repo",
        issueNumber: 123,
      });

      expect(result.complete).toBe(true);
      expect(result.message).toContain("archived");
      expect(postComment).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
        123,
        expect.stringContaining("Milestone Completion"),
      );
    });

    it("throws error on command failure", async () => {
      const error = new Error("Command failed");
      error.code = 1;
      exec.mockImplementation((cmd, opts, callback) => {
        callback(error, "", "");
      });
      fs.readFile.mockResolvedValue("Error: Something went wrong");

      await expect(
        executeMilestoneCompletionWorkflow({
          owner: "test-owner",
          repo: "test-repo",
          issueNumber: 123,
        }),
      ).rejects.toThrow("Milestone completion failed");
    });

    it("strips CCR debug logs from output", async () => {
      const mockOutput = `[log_abc123] sending request
method: 'post'
url: 'http://127.0.0.1:3456/v1/messages'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► MILESTONE COMPLETED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

      exec.mockImplementation((cmd, opts, callback) => {
        callback(null, "", "");
      });
      fs.readFile.mockResolvedValue(mockOutput);
      fs.unlink.mockResolvedValue(undefined);

      await executeMilestoneCompletionWorkflow({
        owner: "test-owner",
        repo: "test-repo",
        issueNumber: 123,
      });

      const postedComment = postComment.mock.calls[0][3];
      expect(postedComment).not.toContain("[log_");
      expect(postedComment).not.toContain("method: 'post'");
      expect(postedComment).toContain("GSD ►");
    });

    it("handles missing output file gracefully", async () => {
      exec.mockImplementation((cmd, opts, callback) => {
        callback(null, "", "");
      });
      fs.readFile.mockRejectedValue(new Error("ENOENT: file not found"));
      fs.unlink.mockResolvedValue(undefined);

      // Should still succeed with "(No output captured)"
      const result = await executeMilestoneCompletionWorkflow({
        owner: "test-owner",
        repo: "test-repo",
        issueNumber: 123,
      });

      expect(result.complete).toBe(true);
    });
  });
});
