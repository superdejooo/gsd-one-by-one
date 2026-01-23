/**
 * Comprehensive tests for planning-parser.js
 * Tests parseRequirements, parseRoadmap, and parseMilestoneMetadata functions
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs/promises";
import {
  parseRequirements,
  parseRoadmap,
  parseMilestoneMetadata,
} from "./planning-parser.js";

vi.mock("fs/promises");
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

describe("parseRequirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse title and version from REQUIREMENTS.md", async () => {
    fs.readFile.mockResolvedValue(`# Requirements: GSD for GitHub v1.1

**Defined:** 2026-01-22
**Milestone:** v1.1 - Plan & Execute Commands
**Core Value:** Enable autonomous AI-driven development that runs in CI/CD, responds to GitHub issue comments.

## Requirements
...`);

    const result = await parseRequirements();

    expect(result.title).toBe("GSD for GitHub");
    expect(result.version).toBe("v1.1");
    expect(result.coreValue).toContain("autonomous AI-driven");
  });

  it("should return null if REQUIREMENTS.md not found", async () => {
    const error = new Error("ENOENT");
    error.code = "ENOENT";
    fs.readFile.mockRejectedValue(error);

    const result = await parseRequirements();
    expect(result).toBeNull();
  });

  it("should return null if title cannot be parsed", async () => {
    fs.readFile.mockResolvedValue("# Some other format");

    const result = await parseRequirements();
    expect(result).toBeNull();
  });

  it("should parse title with decimal version (v2.0)", async () => {
    fs.readFile.mockResolvedValue(`# Requirements: Test Project v2.0

**Core Value:** Testing.`);

    const result = await parseRequirements();
    expect(result.title).toBe("Test Project");
    expect(result.version).toBe("v2.0");
  });

  it("should return null coreValue if not found", async () => {
    fs.readFile.mockResolvedValue(`# Requirements: Minimal Project v1.0

**Defined:** 2026-01-22`);

    const result = await parseRequirements();
    expect(result.title).toBe("Minimal Project");
    expect(result.version).toBe("v1.0");
    expect(result.coreValue).toBeNull();
  });

  it("should handle multiline core value", async () => {
    fs.readFile.mockResolvedValue(`# Requirements: GSD for GitHub v1.1

**Core Value:** Enable autonomous AI-driven development that runs in CI/CD,
responds to GitHub issue comments, creates and updates planning artifacts
in the repo, and tracks progress via GitHub issues.

## Requirements`);

    const result = await parseRequirements();
    expect(result.coreValue).toContain("autonomous AI-driven development");
    expect(result.coreValue).toContain("tracks progress via GitHub issues");
  });
});

describe("parseRoadmap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse phases from ROADMAP.md", async () => {
    fs.readFile.mockResolvedValue(`# Roadmap

### Phase 7: Phase Planning Command

**Status:** Complete

### Phase 8: Phase Execution Command

**Status:** Not started
`);

    const result = await parseRoadmap();

    expect(result.phases).toHaveLength(2);
    expect(result.phases[0]).toEqual({
      number: "7",
      name: "Phase Planning Command",
      status: "complete",
    });
    expect(result.phases[1]).toEqual({
      number: "8",
      name: "Phase Execution Command",
      status: "not-started",
    });
  });

  it("should handle phases with decimal numbers (8.1)", async () => {
    fs.readFile.mockResolvedValue(`### Phase 8.1: GitHub Projects

**Status:** Complete`);

    const result = await parseRoadmap();
    expect(result.phases[0].number).toBe("8.1");
    expect(result.phases[0].name).toBe("GitHub Projects");
    expect(result.phases[0].status).toBe("complete");
  });

  it("should return empty phases if ROADMAP.md not found", async () => {
    const error = new Error("ENOENT");
    error.code = "ENOENT";
    fs.readFile.mockRejectedValue(error);

    const result = await parseRoadmap();
    expect(result.phases).toEqual([]);
  });

  it("should handle 'in progress' status", async () => {
    fs.readFile.mockResolvedValue(`### Phase 9: Issue Tracking

**Status:** In progress`);

    const result = await parseRoadmap();
    expect(result.phases[0].status).toBe("in-progress");
  });

  it("should default to 'not started' if status not found", async () => {
    fs.readFile.mockResolvedValue(`### Phase 10: Testing

**Goal:** Comprehensive testing`);

    const result = await parseRoadmap();
    expect(result.phases[0].status).toBe("not-started");
  });

  it("should handle phase title without colon", async () => {
    fs.readFile.mockResolvedValue(`### Phase 11 Error Handling

**Status:** Complete`);

    const result = await parseRoadmap();
    expect(result.phases[0].number).toBe("11");
    expect(result.phases[0].name).toBe("Error Handling");
  });

  it("should parse multiple phases correctly", async () => {
    fs.readFile.mockResolvedValue(`# Roadmap

### Phase 1: Foundation
**Status:** Complete

### Phase 2: Core Features
**Status:** In progress

### Phase 3: Testing
**Status:** Not started

### Phase 3.1: Unit Tests
**Status:** Not started
`);

    const result = await parseRoadmap();
    expect(result.phases).toHaveLength(4);
    expect(result.phases[0].number).toBe("1");
    expect(result.phases[1].number).toBe("2");
    expect(result.phases[2].number).toBe("3");
    expect(result.phases[3].number).toBe("3.1");
  });
});

describe("parseMilestoneMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should combine requirements and roadmap data", async () => {
    fs.readFile
      .mockResolvedValueOnce(
        "# Requirements: Test Project v2.0\n\n**Core Value:** Testing.\n\n## Requirements",
      )
      .mockResolvedValueOnce(
        "### Phase 1: Setup\n\n**Status:** Complete",
      );

    const result = await parseMilestoneMetadata();

    expect(result.title).toBe("Test Project");
    expect(result.version).toBe("v2.0");
    expect(result.coreValue).toBe("Testing.");
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0].number).toBe("1");
  });

  it("should handle missing requirements gracefully", async () => {
    const error = new Error("ENOENT");
    error.code = "ENOENT";
    fs.readFile
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce("### Phase 1: Setup\n\n**Status:** Complete");

    const result = await parseMilestoneMetadata();

    expect(result.title).toBeUndefined();
    expect(result.version).toBeUndefined();
    expect(result.coreValue).toBeUndefined();
    expect(result.phases).toHaveLength(1);
  });

  it("should handle missing roadmap gracefully", async () => {
    const error = new Error("ENOENT");
    error.code = "ENOENT";
    fs.readFile
      .mockResolvedValueOnce(
        "# Requirements: Test Project v1.0\n\n**Core Value:** Testing.\n\n## Requirements",
      )
      .mockRejectedValueOnce(error);

    const result = await parseMilestoneMetadata();

    expect(result.title).toBe("Test Project");
    expect(result.version).toBe("v1.0");
    expect(result.phases).toEqual([]);
  });

  it("should handle both files missing", async () => {
    const error = new Error("ENOENT");
    error.code = "ENOENT";
    fs.readFile.mockRejectedValue(error);

    const result = await parseMilestoneMetadata();

    expect(result.title).toBeUndefined();
    expect(result.version).toBeUndefined();
    expect(result.coreValue).toBeUndefined();
    expect(result.phases).toEqual([]);
  });
});
