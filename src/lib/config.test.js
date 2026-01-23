import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies using factory functions
const mockOctokit = {
  rest: {
    repos: {
      getContent: vi.fn(),
    },
  },
};

vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(() => mockOctokit),
}));

vi.mock("@actions/core", () => ({
  getInput: vi.fn(),
  info: vi.fn(),
}));

// Import after mocks
import { loadConfig } from "./config.js";
import * as core from "@actions/core";

describe("loadConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(core.getInput).mockReturnValue("test-token");
  });

  it("returns default config when no overrides", async () => {
    mockOctokit.rest.repos.getContent.mockRejectedValue({ status: 404 });

    const config = await loadConfig("owner", "repo");

    expect(config).toHaveProperty("labels");
    expect(config).toHaveProperty("paths");
    expect(config.labels).toHaveProperty("phases");
    expect(config.labels).toHaveProperty("status");
  });

  it("uses GitHub token from input or env", async () => {
    mockOctokit.rest.repos.getContent.mockRejectedValue({ status: 404 });

    await loadConfig("owner", "repo");

    expect(core.getInput).toHaveBeenCalledWith("token", { required: false });
  });

  it("includes default paths", async () => {
    mockOctokit.rest.repos.getContent.mockRejectedValue({ status: 404 });

    const config = await loadConfig("owner", "repo");

    expect(config.paths).toEqual({
      planning: ".github/planning/",
      milestones: ".github/planning/milestones/",
      phases: ".github/planning/phases/",
    });
  });

  it("includes default phases", async () => {
    mockOctokit.rest.repos.getContent.mockRejectedValue({ status: 404 });

    const config = await loadConfig("owner", "repo");

    expect(config.labels.phases).toBeDefined();
    expect(Object.keys(config.labels.phases).length).toBeGreaterThan(0);
  });

  it("includes default status labels", async () => {
    mockOctokit.rest.repos.getContent.mockRejectedValue({ status: 404 });

    const config = await loadConfig("owner", "repo");

    expect(config.labels.status).toEqual({
      todo: "To Do",
      "in-progress": "In Progress",
      done: "Done",
      blocked: "Blocked",
    });
  });

  it("loads config from .github/gsd-config.json when present", async () => {
    const customConfig = {
      labels: {
        phases: { "custom-phase": "Custom Phase" },
        status: { custom: "Custom Status" },
      },
      paths: {
        planning: "custom-planning/",
        milestones: "custom-milestones/",
        phases: "custom-phases/",
      },
    };

    const encodedContent = Buffer.from(JSON.stringify(customConfig)).toString(
      "base64",
    );
    mockOctokit.rest.repos.getContent.mockResolvedValue({
      data: {
        content: encodedContent,
      },
    });

    const config = await loadConfig("owner", "repo");

    expect(config).toEqual(customConfig);
    expect(core.info).toHaveBeenCalledWith(
      "Loaded config from .github/gsd-config.json",
    );
  });

  it("throws error for non-404 failures", async () => {
    mockOctokit.rest.repos.getContent.mockRejectedValue({
      status: 500,
      message: "Server error",
    });

    await expect(loadConfig("owner", "repo")).rejects.toThrow(
      "Failed to load config",
    );
  });
});
