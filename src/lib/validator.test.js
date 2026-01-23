/**
 * Comprehensive tests for validator.js
 * Tests validateCommand and sanitizeArguments with edge cases
 */
import { describe, it, expect } from "vitest";
import {
  validateCommand,
  sanitizeArguments,
  SKILL_COMMAND_MAP,
  isValidSkillForCommand,
  getValidSkillsForCommand,
} from "./validator.js";
import * as core from "@actions/core";
import { vi } from "vitest";

describe("validateCommand", () => {
  it('accepts "new-milestone" (in allowlist)', () => {
    expect(() => validateCommand("new-milestone")).not.toThrow();
    expect(vi.mocked(core.info)).toHaveBeenCalledWith(
      "Command validated: new-milestone",
    );
  });

  it('accepts "plan-phase" (in allowlist)', () => {
    expect(() => validateCommand("plan-phase")).not.toThrow();
    expect(vi.mocked(core.info)).toHaveBeenCalledWith(
      "Command validated: plan-phase",
    );
  });

  it('accepts "execute-phase" (in allowlist)', () => {
    expect(() => validateCommand("execute-phase")).not.toThrow();
    expect(vi.mocked(core.info)).toHaveBeenCalledWith(
      "Command validated: execute-phase",
    );
  });

  it('accepts "complete-milestone" (in allowlist)', () => {
    expect(() => validateCommand("complete-milestone")).not.toThrow();
    expect(vi.mocked(core.info)).toHaveBeenCalledWith(
      "Command validated: complete-milestone",
    );
  });

  it('throws for unknown command "invalid-command"', () => {
    expect(() => validateCommand("invalid-command")).toThrow(
      "Unknown command: invalid-command",
    );
  });

  it('throws for non-kebab-case command "NewMilestone"', () => {
    expect(() => validateCommand("NewMilestone")).toThrow(
      "Unknown command: NewMilestone",
    );
  });

  it("error message includes valid commands list", () => {
    expect(() => validateCommand("unknown")).toThrow(
      "Valid commands: new-milestone, plan-phase, execute-phase, complete-milestone",
    );
  });

  it("throws for command with uppercase letters", () => {
    expect(() => validateCommand("PLAN-PHASE")).toThrow(
      "Unknown command: PLAN-PHASE",
    );
  });

  it("throws for command with spaces", () => {
    expect(() => validateCommand("new milestone")).toThrow(
      "Unknown command: new milestone",
    );
  });

  it("throws for command with special characters", () => {
    expect(() => validateCommand("plan_phase")).toThrow(
      "Unknown command: plan_phase",
    );
  });
});

describe("sanitizeArguments", () => {
  it("returns sanitized object for valid args", () => {
    const args = { phase: "7", name: "Test" };
    const result = sanitizeArguments(args);
    expect(result).toEqual({ phase: "7", name: "Test" });
  });

  it("throws for empty value", () => {
    const args = { phase: "" };
    expect(() => sanitizeArguments(args)).toThrow(
      "Argument phase cannot be empty",
    );
  });

  it("throws for value exceeding 500 chars", () => {
    const args = { name: "a".repeat(501) };
    expect(() => sanitizeArguments(args)).toThrow(
      "Argument name exceeds maximum length (500 chars)",
    );
  });

  it("removes semicolon shell metacharacter", () => {
    const args = { name: "test;rm -rf /" };
    const result = sanitizeArguments(args);
    expect(result.name).toBe("testrm -rf /");
    expect(result.name).not.toContain(";");
  });

  it("removes ampersand shell metacharacter", () => {
    const args = { name: "test&whoami" };
    const result = sanitizeArguments(args);
    expect(result.name).toBe("testwhoami");
    expect(result.name).not.toContain("&");
  });

  it("removes pipe shell metacharacter", () => {
    const args = { name: "test|cat /etc/passwd" };
    const result = sanitizeArguments(args);
    expect(result.name).toBe("testcat /etc/passwd");
    expect(result.name).not.toContain("|");
  });

  it("removes backtick shell metacharacter", () => {
    const args = { name: "test`whoami`" };
    const result = sanitizeArguments(args);
    expect(result.name).toBe("testwhoami");
    expect(result.name).not.toContain("`");
  });

  it("removes dollar sign shell metacharacter", () => {
    const args = { name: "test$(whoami)" };
    const result = sanitizeArguments(args);
    expect(result.name).toBe("testwhoami");
    expect(result.name).not.toContain("$");
  });

  it("removes parentheses shell metacharacters", () => {
    const args = { name: "test(command)" };
    const result = sanitizeArguments(args);
    expect(result.name).toBe("testcommand");
    expect(result.name).not.toContain("(");
    expect(result.name).not.toContain(")");
  });

  it("removes all shell metacharacters: ; & | ` $ ( )", () => {
    const args = { name: ";test&value|here`with$metacharacters(all)" };
    const result = sanitizeArguments(args);
    expect(result.name).toBe("testvalueherewithmetacharactersall");
  });

  it("trims whitespace from values", () => {
    const args = { name: "  Test Value  " };
    const result = sanitizeArguments(args);
    expect(result.name).toBe("Test Value");
  });

  it("handles multiple arguments with sanitization", () => {
    const args = {
      phase: "  7  ",
      name: "test;injection",
      type: "unit|test",
    };
    const result = sanitizeArguments(args);
    expect(result).toEqual({
      phase: "7",
      name: "testinjection",
      type: "unittest",
    });
  });

  it("allows exactly 500 characters", () => {
    const args = { name: "a".repeat(500) };
    expect(() => sanitizeArguments(args)).not.toThrow();
  });

  it("throws for null value", () => {
    const args = { name: null };
    expect(() => sanitizeArguments(args)).toThrow(
      "Argument name cannot be empty",
    );
  });

  it("throws for undefined value", () => {
    const args = { name: undefined };
    expect(() => sanitizeArguments(args)).toThrow(
      "Argument name cannot be empty",
    );
  });

  it("preserves valid special characters (hyphens, underscores)", () => {
    const args = { name: "test-value_with-special" };
    const result = sanitizeArguments(args);
    expect(result.name).toBe("test-value_with-special");
  });

  it("preserves numbers and letters", () => {
    const args = { name: "test123ABC" };
    const result = sanitizeArguments(args);
    expect(result.name).toBe("test123ABC");
  });

  describe("description argument special handling", () => {
    it("allows description with 500+ characters", () => {
      const args = { description: "a".repeat(600) };
      expect(() => sanitizeArguments(args)).not.toThrow();
    });

    it("allows description with 10000 characters", () => {
      const args = { description: "a".repeat(10000) };
      const result = sanitizeArguments(args);
      expect(result.description.length).toBe(10000);
    });

    it("allows description with exactly 50000 characters", () => {
      const args = { description: "a".repeat(50000) };
      expect(() => sanitizeArguments(args)).not.toThrow();
    });

    it("throws for description exceeding 50000 characters", () => {
      const args = { description: "a".repeat(50001) };
      expect(() => sanitizeArguments(args)).toThrow(
        "Argument description exceeds maximum length (50000 chars)",
      );
    });

    it("still removes shell metacharacters from description", () => {
      const args = { description: "test;rm -rf /&whoami|cat`cmd`$(exec)" };
      const result = sanitizeArguments(args);
      expect(result.description).toBe("testrm -rf /whoamicatcmdexec");
      expect(result.description).not.toContain(";");
      expect(result.description).not.toContain("&");
      expect(result.description).not.toContain("|");
      expect(result.description).not.toContain("`");
      expect(result.description).not.toContain("$");
      expect(result.description).not.toContain("(");
      expect(result.description).not.toContain(")");
    });

    it("other arguments still have 500 char limit", () => {
      const args = {
        description: "a".repeat(1000),
        name: "a".repeat(501),
      };
      expect(() => sanitizeArguments(args)).toThrow(
        "Argument name exceeds maximum length (500 chars)",
      );
    });
  });
});

describe("SKILL_COMMAND_MAP", () => {
  it("contains expected skills", () => {
    expect(SKILL_COMMAND_MAP).toHaveProperty("github-actions-templates");
    expect(SKILL_COMMAND_MAP).toHaveProperty("github-actions-testing");
    expect(SKILL_COMMAND_MAP).toHaveProperty("github-project-management");
    expect(SKILL_COMMAND_MAP).toHaveProperty("livewire-principles");
    expect(SKILL_COMMAND_MAP).toHaveProperty("refactor");
  });

  it("github-actions-testing is valid for all commands (null)", () => {
    expect(SKILL_COMMAND_MAP["github-actions-testing"]).toBeNull();
  });

  it("github-project-management is valid for all commands", () => {
    expect(SKILL_COMMAND_MAP["github-project-management"]).toContain(
      "new-milestone",
    );
    expect(SKILL_COMMAND_MAP["github-project-management"]).toContain(
      "plan-phase",
    );
    expect(SKILL_COMMAND_MAP["github-project-management"]).toContain(
      "execute-phase",
    );
    expect(SKILL_COMMAND_MAP["github-project-management"]).toContain(
      "complete-milestone",
    );
  });

  it("refactor is valid for plan-phase and execute-phase", () => {
    expect(SKILL_COMMAND_MAP["refactor"]).toContain("plan-phase");
    expect(SKILL_COMMAND_MAP["refactor"]).toContain("execute-phase");
    expect(SKILL_COMMAND_MAP["refactor"]).not.toContain("new-milestone");
  });
});

describe("isValidSkillForCommand", () => {
  it("returns true for null skill", () => {
    expect(isValidSkillForCommand(null, "plan-phase")).toBe(true);
    expect(isValidSkillForCommand(undefined, "execute-phase")).toBe(true);
  });

  it("returns true for github-actions-testing with any command", () => {
    expect(
      isValidSkillForCommand("github-actions-testing", "new-milestone"),
    ).toBe(true);
    expect(isValidSkillForCommand("github-actions-testing", "plan-phase")).toBe(
      true,
    );
    expect(
      isValidSkillForCommand("github-actions-testing", "execute-phase"),
    ).toBe(true);
    expect(
      isValidSkillForCommand("github-actions-testing", "complete-milestone"),
    ).toBe(true);
  });

  it("returns true for refactor with plan-phase", () => {
    expect(isValidSkillForCommand("refactor", "plan-phase")).toBe(true);
  });

  it("returns false for refactor with new-milestone", () => {
    expect(isValidSkillForCommand("refactor", "new-milestone")).toBe(false);
  });

  it("returns false for unknown skill", () => {
    expect(isValidSkillForCommand("unknown-skill", "plan-phase")).toBe(false);
  });
});

describe("getValidSkillsForCommand", () => {
  it("returns all skills for plan-phase", () => {
    const skills = getValidSkillsForCommand("plan-phase");
    expect(skills).toContain("github-actions-templates");
    expect(skills).toContain("github-actions-testing");
    expect(skills).toContain("github-project-management");
    expect(skills).toContain("livewire-principles");
    expect(skills).toContain("refactor");
  });

  it("returns only allowed skills for new-milestone", () => {
    const skills = getValidSkillsForCommand("new-milestone");
    expect(skills).toContain("github-actions-testing");
    expect(skills).toContain("github-project-management");
    expect(skills).not.toContain("refactor");
    expect(skills).not.toContain("livewire-principles");
  });
});
