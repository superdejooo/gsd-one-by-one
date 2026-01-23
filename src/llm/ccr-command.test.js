import { describe, it, expect } from "vitest";
import { formatCcrCommand, formatCcrCommandWithOutput } from "./ccr-command.js";

describe("ccr-command", () => {
  describe("formatCcrCommand", () => {
    it("formats GSD command with github-actions-testing prefix", () => {
      const result = formatCcrCommand("/gsd:plan-phase 7");

      expect(result).toBe(
        'ccr code --print "/gsd:plan-phase 7 /github-actions-testing"',
      );
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

      expect(result).toBe(
        'ccr code --print "/gsd:new-milestone /github-actions-testing Build a login system"',
      );
    });

    it("handles prompt with null value", () => {
      const result = formatCcrCommand("/gsd:plan-phase 7", null);

      expect(result).toBe(
        'ccr code --print "/gsd:plan-phase 7 /github-actions-testing"',
      );
    });

    it("includes skill in command when provided", () => {
      const result = formatCcrCommand(
        "/gsd:plan-phase 7",
        null,
        "github-project-management",
      );

      expect(result).toBe(
        'ccr code --print "/gsd:plan-phase 7 /github-project-management /github-actions-testing"',
      );
    });

    it("includes skill with prompt parameter", () => {
      const result = formatCcrCommand(
        "/gsd:new-milestone",
        "Build login",
        "refactor",
      );

      expect(result).toBe(
        'ccr code --print "/gsd:new-milestone /refactor /github-actions-testing Build login"',
      );
    });
  });

  describe("formatCcrCommandWithOutput", () => {
    it("adds output redirect", () => {
      const result = formatCcrCommandWithOutput(
        "/gsd:plan-phase 5",
        "output.txt",
      );

      expect(result).toBe(
        'ccr code --print "/gsd:plan-phase 5 /github-actions-testing" > output.txt 2>&1',
      );
    });

    it("handles dynamic output paths", () => {
      const result = formatCcrCommandWithOutput(
        "/gsd:execute-phase 3",
        "output-123456.txt",
      );

      expect(result).toContain("> output-123456.txt 2>&1");
    });

    it("passes prompt to formatCcrCommand", () => {
      const result = formatCcrCommandWithOutput(
        "/gsd:verify-work",
        "output.txt",
        "Check the API",
      );

      expect(result).toBe(
        'ccr code --print "/gsd:verify-work /github-actions-testing Check the API" > output.txt 2>&1',
      );
    });

    it("works without prompt parameter", () => {
      const result = formatCcrCommandWithOutput(
        "/gsd:execute-phase 3",
        "output.txt",
      );

      expect(result).toBe(
        'ccr code --print "/gsd:execute-phase 3 /github-actions-testing" > output.txt 2>&1',
      );
    });

    it("includes skill in command when provided", () => {
      const result = formatCcrCommandWithOutput(
        "/gsd:plan-phase 5",
        "output.txt",
        null,
        "github-project-management",
      );

      expect(result).toBe(
        'ccr code --print "/gsd:plan-phase 5 /github-project-management /github-actions-testing" > output.txt 2>&1',
      );
    });

    it("includes skill with prompt in command", () => {
      const result = formatCcrCommandWithOutput(
        "/gsd:new-milestone",
        "output.txt",
        "Build API",
        "refactor",
      );

      expect(result).toBe(
        'ccr code --print "/gsd:new-milestone /refactor /github-actions-testing Build API" > output.txt 2>&1',
      );
    });
  });
});
