/**
 * Comprehensive tests for branches.js
 * Tests slugify function and git operations
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock git.js functions for git operation tests
const mockCreateAndSwitchBranch = vi.fn();
const mockSwitchBranch = vi.fn();
const mockRunGitCommand = vi.fn();

vi.mock("./git.js", () => ({
  createAndSwitchBranch: mockCreateAndSwitchBranch,
  switchBranch: mockSwitchBranch,
  runGitCommand: mockRunGitCommand,
}));

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
}));

// Import module under test after mocks
const { slugify, createMilestoneBranch, createPhaseBranch, branchExists } =
  await import("./branches.js");
import * as core from "@actions/core";

describe("slugify", () => {
  it("converts to lowercase", () => {
    const result = slugify("TEST PHASE");
    expect(result).toBe("test-phase");
  });

  it("replaces spaces with hyphens", () => {
    const result = slugify("my test phase");
    expect(result).toBe("my-test-phase");
  });

  it("replaces special characters with hyphens", () => {
    const result = slugify("test@phase#name");
    expect(result).toBe("test-phase-name");
  });

  it("removes leading/trailing hyphens", () => {
    const result = slugify("--test-phase--");
    expect(result).toBe("test-phase");
  });

  it("limits length to 50 characters", () => {
    const longName = "a".repeat(100);
    const result = slugify(longName);
    expect(result.length).toBe(50);
  });

  it("returns empty string for null", () => {
    const result = slugify(null);
    expect(result).toBe("");
  });

  it("returns empty string for undefined", () => {
    const result = slugify(undefined);
    expect(result).toBe("");
  });

  it("handles consecutive special characters (no double hyphens)", () => {
    const result = slugify("test@@@@phase");
    expect(result).toBe("test-phase");
    expect(result).not.toContain("--");
  });

  it("handles mixed case with numbers", () => {
    const result = slugify("Phase 7 Testing");
    expect(result).toBe("phase-7-testing");
  });

  it("handles strings with only special characters", () => {
    const result = slugify("@@##$$");
    expect(result).toBe("");
  });

  it("preserves hyphens from original text", () => {
    const result = slugify("already-kebab-case");
    expect(result).toBe("already-kebab-case");
  });

  it("handles empty string", () => {
    const result = slugify("");
    expect(result).toBe("");
  });

  it("handles string with tabs and newlines", () => {
    const result = slugify("test\tphase\nname");
    expect(result).toBe("test-phase-name");
  });

  it("handles unicode characters", () => {
    const result = slugify("tëst phåse");
    expect(result).toBe("t-st-ph-se");
  });

  it("handles leading special characters", () => {
    const result = slugify("###test");
    expect(result).toBe("test");
  });

  it("handles trailing special characters", () => {
    const result = slugify("test###");
    expect(result).toBe("test");
  });

  it("handles string at exactly 50 characters", () => {
    const name = "a".repeat(50);
    const result = slugify(name);
    expect(result.length).toBe(50);
  });

  it("handles string just over 50 characters", () => {
    const name = "a".repeat(51);
    const result = slugify(name);
    expect(result.length).toBe(50);
  });

  it("combines all transformations correctly", () => {
    const result = slugify("  My Test@Phase#123!!  ");
    expect(result).toBe("my-test-phase-123");
  });

  it("handles multiple consecutive spaces", () => {
    const result = slugify("test    phase");
    expect(result).toBe("test-phase");
  });
});

describe("Git operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createMilestoneBranch", () => {
    it("creates branch named gsd/{milestoneNumber}", async () => {
      await createMilestoneBranch(3);

      expect(mockCreateAndSwitchBranch).toHaveBeenCalledWith("gsd/3");
    });

    it("calls createAndSwitchBranch with correct name", async () => {
      await createMilestoneBranch(10);

      expect(mockCreateAndSwitchBranch).toHaveBeenCalledTimes(1);
      expect(mockCreateAndSwitchBranch).toHaveBeenCalledWith("gsd/10");
    });

    it("logs milestone branch creation", async () => {
      await createMilestoneBranch(5);

      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        "Created milestone branch: gsd/5",
      );
    });
  });

  describe("createPhaseBranch", () => {
    it("creates branch named gsd/{milestone}-{phase}-{slug}", async () => {
      await createPhaseBranch(2, 3, "Setup Database");

      expect(mockCreateAndSwitchBranch).toHaveBeenCalledWith(
        "gsd/2-3-setup-database",
        null,
      );
    });

    it("uses slugify for phase name", async () => {
      await createPhaseBranch(1, 1, "API Integration & Setup");

      expect(mockCreateAndSwitchBranch).toHaveBeenCalledWith(
        "gsd/1-1-api-integration-setup",
        null,
      );
    });

    it("includes startPoint when provided", async () => {
      await createPhaseBranch(2, 4, "Feature Work", "main");

      expect(mockCreateAndSwitchBranch).toHaveBeenCalledWith(
        "gsd/2-4-feature-work",
        "main",
      );
    });

    it("logs phase branch creation", async () => {
      await createPhaseBranch(1, 2, "Test Phase");

      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        'Created phase branch: gsd/1-2-test-phase (from "Test Phase")',
      );
    });
  });

  describe("branchExists", () => {
    it("returns true when git rev-parse succeeds", async () => {
      mockRunGitCommand.mockResolvedValue("abc123");

      const result = await branchExists("feature-branch");

      expect(result).toBe(true);
      expect(mockRunGitCommand).toHaveBeenCalledWith(
        "git rev-parse --verify feature-branch",
      );
    });

    it("returns false when git rev-parse throws (branch not found)", async () => {
      mockRunGitCommand.mockRejectedValue(new Error("fatal: not a valid ref"));

      const result = await branchExists("nonexistent-branch");

      expect(result).toBe(false);
    });

    it("does not throw on missing branch", async () => {
      mockRunGitCommand.mockRejectedValue(new Error("branch not found"));

      await expect(branchExists("missing")).resolves.toBe(false);
    });
  });
});
