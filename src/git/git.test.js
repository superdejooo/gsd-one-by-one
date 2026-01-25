import { describe, it, expect, vi, beforeEach } from "vitest";
import * as core from "@actions/core";

// Mock child_process exec
const mockExec = vi.fn();
vi.mock("node:child_process", () => ({
  exec: mockExec,
}));

// Mock util.promisify to return our controlled async function
vi.mock("node:util", async () => {
  const actual = await vi.importActual("node:util");
  return {
    ...actual,
    promisify: () => async (command) => {
      return new Promise((resolve, reject) => {
        // Use the mockExec to control behavior
        const result = mockExec(command);
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result || { stdout: "", stderr: "" });
        }
      });
    },
  };
});

// Import module under test after mocks
const {
  runGitCommand,
  configureGitIdentity,
  createAndSwitchBranch,
  switchBranch,
} = await import("./git.js");

describe("git.js", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("runGitCommand", () => {
    it("returns stdout trimmed on success", async () => {
      mockExec.mockReturnValue({ stdout: "  branch-name  \n", stderr: "" });

      const result = await runGitCommand("git branch");

      expect(result).toBe("branch-name");
      expect(mockExec).toHaveBeenCalledWith("git branch");
      expect(vi.mocked(core.debug)).toHaveBeenCalledWith(
        "Executing: git branch",
      );
    });

    it("logs warning when stderr contains warning/error keywords", async () => {
      mockExec.mockReturnValue({ stdout: "output", stderr: "warning: unstaged changes" });

      const result = await runGitCommand("git status");

      expect(result).toBe("output");
      expect(vi.mocked(core.warning)).toHaveBeenCalledWith(
        "Git: warning: unstaged changes",
      );
    });

    it("logs info when stderr is informational (no warning keywords)", async () => {
      mockExec.mockReturnValue({ stdout: "output", stderr: "To https://github.com/repo main -> main" });

      const result = await runGitCommand("git push");

      expect(result).toBe("output");
      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        "Git: To https://github.com/repo main -> main",
      );
      expect(vi.mocked(core.warning)).not.toHaveBeenCalled();
    });

    it("throws error when command fails", async () => {
      const error = new Error("Command failed");
      error.code = 128;
      mockExec.mockReturnValue(error);

      await expect(runGitCommand("git invalid")).rejects.toThrow(
        "Command failed",
      );

      expect(vi.mocked(core.error)).toHaveBeenCalledWith(
        "Git command failed: git invalid",
      );
      expect(vi.mocked(core.error)).toHaveBeenCalledWith("Exit code: 128");
    });

    it("logs command being executed", async () => {
      mockExec.mockReturnValue({ stdout: "output", stderr: "" });

      await runGitCommand("git log");

      expect(vi.mocked(core.debug)).toHaveBeenCalledWith("Executing: git log");
    });
  });

  describe("configureGitIdentity", () => {
    it("runs git config for user.name", async () => {
      mockExec.mockReturnValue({ stdout: "", stderr: "" });

      await configureGitIdentity("Test User", "test@example.com");

      expect(mockExec).toHaveBeenCalledWith(
        'git config set user.name "Test User"',
      );
    });

    it("runs git config for user.email", async () => {
      mockExec.mockReturnValue({ stdout: "", stderr: "" });

      await configureGitIdentity("Test User", "test@example.com");

      expect(mockExec).toHaveBeenCalledWith(
        'git config set user.email "test@example.com"',
      );
    });

    it("logs success message", async () => {
      mockExec.mockReturnValue({ stdout: "", stderr: "" });

      await configureGitIdentity("Test User", "test@example.com");

      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        "Git identity configured: Test User <test@example.com>",
      );
    });
  });

  describe("createAndSwitchBranch", () => {
    it("runs git switch -c {branchName}", async () => {
      mockExec.mockReturnValue({ stdout: "", stderr: "" });

      await createAndSwitchBranch("feature-branch");

      expect(mockExec).toHaveBeenCalledWith("git switch -c feature-branch");
    });

    it("includes startPoint when provided", async () => {
      mockExec.mockReturnValue({ stdout: "", stderr: "" });

      await createAndSwitchBranch("feature-branch", "main");

      expect(mockExec).toHaveBeenCalledWith(
        "git switch -c feature-branch main",
      );
    });

    it("logs branch creation", async () => {
      mockExec.mockReturnValue({ stdout: "", stderr: "" });

      await createAndSwitchBranch("feature-branch");

      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        "Created and switched to branch: feature-branch",
      );
    });
  });

  describe("switchBranch", () => {
    it("runs git switch {branchName}", async () => {
      mockExec.mockReturnValue({ stdout: "", stderr: "" });

      await switchBranch("main");

      expect(mockExec).toHaveBeenCalledWith("git switch main");
    });

    it("logs branch switch", async () => {
      mockExec.mockReturnValue({ stdout: "", stderr: "" });

      await switchBranch("main");

      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        "Switched to branch: main",
      );
    });
  });
});
