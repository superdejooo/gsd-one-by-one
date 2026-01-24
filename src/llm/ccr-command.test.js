import { describe, it, expect } from "vitest";
import { formatCcrCommand, formatCcrCommandWithOutput } from "./ccr-command.js";

describe("ccr-command", () => {
  describe("formatCcrCommand", () => {
    it("formats GSD command with github-actions-testing skill load", () => {
      const result = formatCcrCommand("/gsd:plan-phase 7");

      expect(result).toContain("/gsd:plan-phase 7");
      expect(result).toContain(
        "but first load this skill .claude/skills/github-actions-testing/SKILL.md",
      );
      expect(result).toContain("STRICT RULE");
      expect(result).toContain("NON INTERACTIVE");
    });

    it("handles execute-phase command", () => {
      const result = formatCcrCommand("/gsd:execute-phase");

      expect(result).toContain("github-actions-testing");
      expect(result).toContain("/gsd:execute-phase");
    });

    it("handles complete-milestone command", () => {
      const result = formatCcrCommand("/gsd:complete-milestone");

      expect(result).toContain("github-actions-testing");
      expect(result).toContain("/gsd:complete-milestone");
    });

    it("appends prompt when provided", () => {
      const result = formatCcrCommand(
        "/gsd:new-milestone",
        "Build a login system",
      );

      expect(result).toContain("/gsd:new-milestone");
      expect(result).toContain("github-actions-testing");
      expect(result).toContain("and then: ' Build a login system'");
    });

    it("handles prompt with null value", () => {
      const result = formatCcrCommand("/gsd:plan-phase 7", null);

      expect(result).toContain("/gsd:plan-phase 7");
      expect(result).toContain("github-actions-testing");
      expect(result).not.toContain("and then:");
    });

    it("includes skill in command when provided", () => {
      const result = formatCcrCommand(
        "/gsd:plan-phase 7",
        null,
        "github-project-management",
      );

      expect(result).toContain("/gsd:plan-phase 7");
      expect(result).toContain(
        "but first load this skill .claude/skills/github-project-management/SKILL.md",
      );
    });

    it("includes skill with prompt parameter", () => {
      const result = formatCcrCommand(
        "/gsd:new-milestone",
        "Build login",
        "refactor",
      );

      expect(result).toContain("/gsd:new-milestone");
      expect(result).toContain(
        "but first load this skill .claude/skills/refactor/SKILL.md",
      );
      expect(result).toContain("and then: ' Build login'");
    });
  });

  describe("formatCcrCommandWithOutput", () => {
    it("returns object with command and separate stdout/stderr paths", () => {
      const result = formatCcrCommandWithOutput(
        "/gsd:plan-phase 5",
        "output-12345",
      );

      expect(result).toHaveProperty("command");
      expect(result).toHaveProperty("stdoutPath");
      expect(result).toHaveProperty("stderrPath");
      expect(result.stdoutPath).toBe("output-12345.txt");
      expect(result.stderrPath).toBe("output-12345-debug.txt");
      expect(result.command).toContain("/gsd:plan-phase 5");
      expect(result.command).toContain("github-actions-testing");
      expect(result.command).toContain("> output-12345.txt 2> output-12345-debug.txt");
    });

    it("handles dynamic output paths", () => {
      const result = formatCcrCommandWithOutput(
        "/gsd:execute-phase 3",
        "output-123456",
      );

      expect(result.stdoutPath).toBe("output-123456.txt");
      expect(result.stderrPath).toBe("output-123456-debug.txt");
      expect(result.command).toContain("> output-123456.txt 2> output-123456-debug.txt");
    });

    it("passes prompt to formatCcrCommand", () => {
      const result = formatCcrCommandWithOutput(
        "/gsd:verify-work",
        "output",
        "Check the API",
      );

      expect(result.command).toContain("/gsd:verify-work");
      expect(result.command).toContain("and then: ' Check the API'");
      expect(result.command).toContain("> output.txt 2> output-debug.txt");
    });

    it("works without prompt parameter", () => {
      const result = formatCcrCommandWithOutput(
        "/gsd:execute-phase 3",
        "output",
      );

      expect(result.command).toContain("/gsd:execute-phase 3");
      expect(result.command).toContain("github-actions-testing");
      expect(result.command).toContain("> output.txt 2> output-debug.txt");
      expect(result.command).not.toContain("and then:");
    });

    it("includes skill in command when provided", () => {
      const result = formatCcrCommandWithOutput(
        "/gsd:plan-phase 5",
        "output",
        null,
        "github-project-management",
      );

      expect(result.command).toContain("/gsd:plan-phase 5");
      expect(result.command).toContain(
        "but first load this skill .claude/skills/github-project-management/SKILL.md",
      );
      expect(result.command).toContain("> output.txt 2> output-debug.txt");
    });

    it("includes skill with prompt in command", () => {
      const result = formatCcrCommandWithOutput(
        "/gsd:new-milestone",
        "output",
        "Build API",
        "refactor",
      );

      expect(result.command).toContain("/gsd:new-milestone");
      expect(result.command).toContain(
        "but first load this skill .claude/skills/refactor/SKILL.md",
      );
      expect(result.command).toContain("and then: ' Build API'");
      expect(result.command).toContain("> output.txt 2> output-debug.txt");
    });
  });
});
