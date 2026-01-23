/**
 * Comprehensive tests for prompts.js
 * Tests createMilestonePrompt template function
 */
import { describe, it, expect } from "vitest";
import { createMilestonePrompt } from "./prompts.js";

describe("createMilestonePrompt", () => {
  it("returns string containing milestone specification", () => {
    const args = { name: "Test Milestone" };
    const result = createMilestonePrompt(args);

    expect(typeof result).toBe("string");
    expect(result).toContain("this specification");
  });

  it("includes JSON representation of args", () => {
    const args = { name: "Test Milestone", description: "Test description" };
    const result = createMilestonePrompt(args);

    expect(result).toContain('"name": "Test Milestone"');
    expect(result).toContain('"description": "Test description"');
  });

  it("contains expected instruction sections", () => {
    const args = { name: "Test" };
    const result = createMilestonePrompt(args);

    expect(result).toContain("Instructions:");
    expect(result).toContain("Review the existing codebase");
    expect(result).toContain("Create planning documents");
    expect(result).toContain("Follow GSD planning standards");
  });

  it("handles empty args object", () => {
    const result = createMilestonePrompt({});

    expect(result).toContain("{}");
    expect(result).toContain("Instructions:");
  });

  it("handles args with special characters (escaped properly in JSON)", () => {
    const args = {
      name: 'Test "Milestone"',
      description: "Description with\nnewlines and\ttabs",
    };
    const result = createMilestonePrompt(args);

    // JSON should properly escape special characters
    expect(result).toContain('Test \\"Milestone\\"');
    expect(result).toContain("\\n");
    expect(result).toContain("\\t");
  });

  it("mentions .github/planning/ directory", () => {
    const result = createMilestonePrompt({ name: "Test" });

    expect(result).toContain(".github/planning/");
  });

  it("mentions PROJECT.md, ROADMAP.md, and STATE.md", () => {
    const result = createMilestonePrompt({ name: "Test" });

    expect(result).toContain("PROJECT.md");
    expect(result).toContain("ROADMAP.md");
    expect(result).toContain("STATE.md");
  });

  it("mentions requirements gathering", () => {
    const result = createMilestonePrompt({ name: "Test" });

    expect(result).toContain("clarifying questions");
  });

  it("handles args with nested structure", () => {
    const args = {
      name: "Test",
      metadata: {
        type: "feature",
        priority: "high",
      },
    };
    const result = createMilestonePrompt(args);

    expect(result).toContain('"metadata"');
    expect(result).toContain('"type": "feature"');
  });

  it("handles args with arrays", () => {
    const args = {
      name: "Test",
      tags: ["feature", "testing"],
    };
    const result = createMilestonePrompt(args);

    expect(result).toContain('"tags"');
    expect(result).toContain("feature");
    expect(result).toContain("testing");
  });

  it("includes all milestone planning documents", () => {
    const result = createMilestonePrompt({ name: "Test" });

    expect(result).toContain("PROJECT.md");
    expect(result).toContain("ROADMAP.md");
    expect(result).toContain("STATE.md");
  });

  it("includes context about project type", () => {
    const result = createMilestonePrompt({ name: "Test" });

    expect(result).toContain("project type");
  });

  it("includes reference to existing patterns", () => {
    const result = createMilestonePrompt({ name: "Test" });

    expect(result).toContain("existing patterns");
  });

  it("formats with proper indentation (2 spaces)", () => {
    const args = { name: "Test", phase: 1 };
    const result = createMilestonePrompt(args);

    // JSON.stringify with 2 space indent
    expect(result).toContain('  "name"');
    expect(result).toContain('  "phase"');
  });
});
