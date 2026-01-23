/**
 * Comprehensive tests for parser.js
 * Tests parseComment, parseArguments, and parseDescriptionArg functions with edge cases
 */
import { describe, it, expect } from "vitest";
import {
  parseComment,
  parseArguments,
  parseDescriptionArg,
  parseSkillArg,
  VALID_SKILLS,
} from "./parser.js";

describe("parseComment", () => {
  it("returns null when bot not mentioned", () => {
    const result = parseComment("Regular comment without bot mention");
    expect(result).toBeNull();
  });

  it("returns null when mentioned but no command follows", () => {
    const result = parseComment("@gsd-bot");
    expect(result).toBeNull();
  });

  it('extracts command from "@gsd-bot new-milestone"', () => {
    const result = parseComment("@gsd-bot new-milestone");
    expect(result).toEqual({
      botMention: "@gsd-bot new-milestone",
      command: "new-milestone",
      args: "",
    });
  });

  it('extracts command and args from "@gsd-bot plan-phase --phase=7"', () => {
    const result = parseComment("@gsd-bot plan-phase --phase=7");
    expect(result).toEqual({
      botMention: "@gsd-bot plan-phase --phase=7",
      command: "plan-phase",
      args: "--phase=7",
    });
  });

  it('normalizes command to lowercase ("@gsd-bot NEW-MILESTONE" -> "new-milestone")', () => {
    const result = parseComment("@gsd-bot NEW-MILESTONE");
    expect(result).not.toBeNull();
    expect(result.command).toBe("new-milestone");
  });

  it("handles multiline comment (normalizes newlines)", () => {
    const result = parseComment("@gsd-bot\nplan-phase\n--phase=7");
    expect(result).toEqual({
      botMention: "@gsd-bot plan-phase --phase=7",
      command: "plan-phase",
      args: "--phase=7",
    });
  });

  it('case-insensitive bot mention ("@GSD-BOT" works)', () => {
    const result = parseComment("@GSD-BOT new-milestone");
    expect(result).not.toBeNull();
    expect(result.command).toBe("new-milestone");
  });

  it('handles mixed case in bot mention ("@GsD-bOt")', () => {
    const result = parseComment("@GsD-bOt execute-phase");
    expect(result).not.toBeNull();
    expect(result.command).toBe("execute-phase");
  });

  it("handles Windows line endings (CRLF)", () => {
    const result = parseComment("@gsd-bot\r\nplan-phase\r\n--phase=7");
    expect(result).toEqual({
      botMention: "@gsd-bot plan-phase --phase=7",
      command: "plan-phase",
      args: "--phase=7",
    });
  });

  it("trims whitespace from comment body", () => {
    const result = parseComment("  @gsd-bot new-milestone  ");
    expect(result).not.toBeNull();
    expect(result.command).toBe("new-milestone");
  });
});

describe("parseArguments", () => {
  it("returns empty object for empty string", () => {
    const result = parseArguments("");
    expect(result).toEqual({});
  });

  it("parses --key=value format", () => {
    const result = parseArguments("--phase=7");
    expect(result).toEqual({ phase: "7" });
  });

  it('parses quoted values: --name="My Milestone"', () => {
    const result = parseArguments('--name="My Milestone"');
    expect(result).toEqual({ name: "My Milestone" });
  });

  it("parses single-quoted values: --name='My Milestone'", () => {
    const result = parseArguments("--name='My Milestone'");
    expect(result).toEqual({ name: "My Milestone" });
  });

  it("handles multiple arguments", () => {
    const result = parseArguments(
      '--phase=7 --name="Testing Phase" --type=unit',
    );
    expect(result).toEqual({
      phase: "7",
      name: "Testing Phase",
      type: "unit",
    });
  });

  it("ignores malformed arguments (no =)", () => {
    const result = parseArguments('--phase=7 invalid --name="Test"');
    expect(result).toEqual({
      phase: "7",
      name: "Test",
    });
  });

  it("handles arguments with underscores in keys", () => {
    const result = parseArguments("--my_key=value");
    expect(result).toEqual({ my_key: "value" });
  });

  it("handles arguments with numbers in keys", () => {
    const result = parseArguments("--phase2=value");
    expect(result).toEqual({ phase2: "value" });
  });

  it("handles empty quoted values", () => {
    const result = parseArguments('--name=""');
    expect(result).toEqual({ name: "" });
  });

  it("handles values with spaces without quotes (takes first word)", () => {
    const result = parseArguments("--name=My Milestone");
    expect(result).toEqual({ name: "My" });
  });
});

describe("parseDescriptionArg", () => {
  it("returns description from simple text", () => {
    const result = parseDescriptionArg("This is my milestone description");
    expect(result).toBe("This is my milestone description");
  });

  it("returns null for empty string", () => {
    const result = parseDescriptionArg("");
    expect(result).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    const result = parseDescriptionArg("   ");
    expect(result).toBeNull();
  });

  it("trims whitespace from description", () => {
    const result = parseDescriptionArg(
      "  Build auth system with login and signup  ",
    );
    expect(result).toBe("Build auth system with login and signup");
  });

  it("captures long descriptions (5000+ chars)", () => {
    const longText = "a".repeat(5000);
    const result = parseDescriptionArg(longText);
    expect(result).toBe(longText);
    expect(result.length).toBe(5000);
  });

  it("captures very long descriptions (10000+ chars)", () => {
    const veryLongText = "This is a detailed milestone description. ".repeat(
      250,
    );
    const result = parseDescriptionArg(veryLongText);
    expect(result).toBe(veryLongText.trim());
    expect(result.length).toBeGreaterThan(10000);
  });

  it("preserves internal newlines and formatting", () => {
    const multiline = "Line 1\nLine 2\nLine 3";
    const result = parseDescriptionArg(multiline);
    expect(result).toBe("Line 1\nLine 2\nLine 3");
  });

  it("returns null for null input", () => {
    const result = parseDescriptionArg(null);
    expect(result).toBeNull();
  });

  it("returns null for undefined input", () => {
    const result = parseDescriptionArg(undefined);
    expect(result).toBeNull();
  });
});

describe("parseSkillArg", () => {
  it("returns null for empty args", () => {
    expect(parseSkillArg("")).toBeNull();
    expect(parseSkillArg(null)).toBeNull();
    expect(parseSkillArg(undefined)).toBeNull();
  });

  it("finds github-project-management skill in args", () => {
    const result = parseSkillArg("7 github-project-management");
    expect(result).toBe("github-project-management");
  });

  it("finds refactor skill in args", () => {
    const result = parseSkillArg("5 refactor");
    expect(result).toBe("refactor");
  });

  it("finds livewire-principles skill in args", () => {
    const result = parseSkillArg("livewire-principles 3");
    expect(result).toBe("livewire-principles");
  });

  it("returns null for invalid skill", () => {
    const result = parseSkillArg("7 invalid-skill");
    expect(result).toBeNull();
  });

  it("is case insensitive", () => {
    const result = parseSkillArg("7 GitHub-Project-Management");
    expect(result).toBe("github-project-management");
  });

  it("returns first valid skill if multiple present", () => {
    const result = parseSkillArg("7 github-project-management refactor");
    // Should return first valid skill found
    expect(VALID_SKILLS).toContain(result);
  });
});

describe("VALID_SKILLS", () => {
  it("contains expected skills", () => {
    expect(VALID_SKILLS).toContain("github-actions-templates");
    expect(VALID_SKILLS).toContain("github-actions-testing");
    expect(VALID_SKILLS).toContain("github-project-management");
    expect(VALID_SKILLS).toContain("livewire-principles");
    expect(VALID_SKILLS).toContain("refactor");
  });

  it("has at least 5 skills", () => {
    expect(VALID_SKILLS.length).toBeGreaterThanOrEqual(5);
  });
});
