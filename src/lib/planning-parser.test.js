/**
 * Comprehensive tests for planning-parser.js
 * Tests parseProject, parseRequirements, parseRoadmap, parseState, parsePlan, and parseMilestoneMetadata
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs/promises";
import {
  parseProject,
  parseRequirements,
  parseRoadmap,
  parseState,
  parsePlan,
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
    expect(result.phases[0].number).toBe("7");
    expect(result.phases[0].name).toBe("Phase Planning Command");
    expect(result.phases[0].status).toBe("complete");
    expect(result.phases[1].number).toBe("8");
    expect(result.phases[1].name).toBe("Phase Execution Command");
    expect(result.phases[1].status).toBe("not-started");
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

    // Now returns defaults instead of undefined
    expect(result.title).toBe("Untitled Milestone");
    expect(result.version).toBe("v0.0");
    expect(result.coreValue).toBeNull();
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

    // Now returns defaults instead of undefined
    expect(result.title).toBe("Untitled Milestone");
    expect(result.version).toBe("v0.0");
    expect(result.coreValue).toBeNull();
    expect(result.phases).toEqual([]);
  });
});

describe("parseProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse title and core value from PROJECT.md", async () => {
    fs.readFile.mockResolvedValue(`# GSD for GitHub

## What This Is

A reusable GitHub Action.

## Core Value

Enable autonomous AI-driven development that runs in CI/CD.

## Tech Stack
`);

    const result = await parseProject();

    expect(result.title).toBe("GSD for GitHub");
    expect(result.coreValue).toContain("autonomous AI-driven");
  });

  it("should extract current version from state header", async () => {
    fs.readFile.mockResolvedValue(`# My Project

## Current State (v1.2 shipped)

Status: complete
`);

    const result = await parseProject();
    expect(result.currentVersion).toBe("v1.2");
  });

  it("should return null if PROJECT.md not found", async () => {
    const error = new Error("ENOENT");
    error.code = "ENOENT";
    fs.readFile.mockRejectedValue(error);

    const result = await parseProject();
    expect(result).toBeNull();
  });
});

describe("parseState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse current position from STATE.md", async () => {
    fs.readFile.mockResolvedValue(`# Project State

## Current Position

Milestone: v1.1 — SHIPPED (2026-01-23)
Phase: None (milestone complete)
Plan: All phases complete
Status: Ready for next milestone
Last activity: 2026-01-23 — Completed quick-009

## Performance
`);

    const result = await parseState();

    expect(result.milestone).toContain("v1.1");
    expect(result.phase).toBe("None (milestone complete)");
    expect(result.plan).toBe("All phases complete");
    expect(result.status).toBe("Ready for next milestone");
    expect(result.lastActivity).toContain("2026-01-23");
  });

  it("should return null if STATE.md not found", async () => {
    const error = new Error("ENOENT");
    error.code = "ENOENT";
    fs.readFile.mockRejectedValue(error);

    const result = await parseState();
    expect(result).toBeNull();
  });

  it("should return null if Current Position section not found", async () => {
    fs.readFile.mockResolvedValue(`# Project State

## Overview

Some content.
`);

    const result = await parseState();
    expect(result).toBeNull();
  });
});

describe("parsePlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse PLAN.md with YAML frontmatter and tasks", async () => {
    fs.readFile.mockResolvedValue(`---
phase: "07-phase-planning-command"
plan: "01"
type: "execute"
wave: 1
autonomous: true
---

<objective>
Wire GSD's built-in plan-phase command.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Add plan-phase to ALLOWLIST</name>
  <files>src/lib/validator.js</files>
  <action>Add plan-phase to the array</action>
  <verify>grep plan-phase</verify>
  <done>Done</done>
</task>
</tasks>
`);

    const result = await parsePlan("test.md");

    expect(result.phase).toBe("07-phase-planning-command");
    expect(result.plan).toBe("01");
    expect(result.type).toBe("execute");
    expect(result.wave).toBe(1);
    expect(result.autonomous).toBe(true);
    expect(result.objective).toContain("plan-phase command");
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].name).toBe("Task 1: Add plan-phase to ALLOWLIST");
    expect(result.tasks[0].type).toBe("auto");
  });

  it("should return null if PLAN.md not found", async () => {
    const error = new Error("ENOENT");
    error.code = "ENOENT";
    fs.readFile.mockRejectedValue(error);

    const result = await parsePlan("missing.md");
    expect(result).toBeNull();
  });

  it("should return null if no frontmatter found", async () => {
    fs.readFile.mockResolvedValue(`# Just a title

Some content.
`);

    const result = await parsePlan("test.md");
    expect(result).toBeNull();
  });

  it("should parse multiple tasks", async () => {
    fs.readFile.mockResolvedValue(`---
phase: "08"
plan: "02"
---

<tasks>
<task type="manual">
  <name>First task</name>
</task>
<task type="auto">
  <name>Second task</name>
</task>
</tasks>
`);

    const result = await parsePlan("test.md");

    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].type).toBe("manual");
    expect(result.tasks[1].type).toBe("auto");
  });
});
