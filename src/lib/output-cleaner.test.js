/**
 * Tests for output-cleaner.js
 */

import { describe, it, expect } from "vitest";
import { stripCcrLogs, extractErrorMessage } from "./output-cleaner.js";

describe("stripCcrLogs", () => {
  it("removes lines starting with [log_xxx]", () => {
    const input = `[log_abc123] sending request
actual output
[log_def456] response`;
    expect(stripCcrLogs(input)).toBe("actual output");
  });

  it("removes response NNN http: lines", () => {
    const input = `some output
response 200 http://localhost:3456
more output`;
    expect(stripCcrLogs(input)).toBe("some output\nmore output");
  });

  it("removes ReadableStream lines", () => {
    const input = `output
ReadableStream { locked: false }
more`;
    expect(stripCcrLogs(input)).toBe("output\nmore");
  });

  it("removes key: value patterns", () => {
    const input = `[log_123] start
  method: 'post',
  url: 'http://example.com',
  stream: true
end`;
    expect(stripCcrLogs(input)).toBe("end");
  });

  it("removes closing braces", () => {
    const input = `output
  }
  },
]
more`;
    expect(stripCcrLogs(input)).toBe("output\nmore");
  });

  it("preserves actual agent output", () => {
    const input = `## Task Complete

The task has been completed successfully.

- Created file A
- Modified file B`;
    expect(stripCcrLogs(input)).toBe(input);
  });

  it("handles complex CCR debug output", () => {
    const input = `[log_0e2385] sending request {
  method: 'post',
  url: 'http://127.0.0.1:3456/v1/messages?beta=true',
  options: {
    method: 'post',
    path: '/v1/messages?beta=true',
    body: {
      model: 'claude-haiku-4-5-20251001',
      messages: [Array],
      system: [Array],
      tools: [],
      tool_choice: undefined,
      metadata: [Object],
      max_tokens: 32000,
      thinking: undefined,
      stream: true
    },
    timeout: 60000,
    signal: AbortSignal { aborted: false },
    stream: true
  }
}`;
    expect(stripCcrLogs(input)).toBe("");
  });
});

describe("extractErrorMessage", () => {
  it("returns cleaned stdout when it has meaningful content", () => {
    const stdout = "Error: Something went wrong with the operation";
    const result = extractErrorMessage(stdout, "", "");
    expect(result).toBe("Error: Something went wrong with the operation");
  });

  it("extracts warning from ccr.log when stdout is only debug logs", () => {
    const stdout = `[log_abc] request
  method: 'post'
}`;
    const ccrLog = "Loaded config\nWarning: No content in the stream response!";
    const result = extractErrorMessage(stdout, "", ccrLog);
    expect(result).toBe("CCR Error: No content in the stream response!");
  });

  it("extracts error from ccr.log", () => {
    const stdout = "";
    const ccrLog = "Error: Connection refused";
    const result = extractErrorMessage(stdout, "", ccrLog);
    expect(result).toBe("CCR Error: Connection refused");
  });

  it("falls back to stderr when stdout and ccr.log are empty", () => {
    const stderr = "Process exited with error";
    const result = extractErrorMessage("", stderr, "");
    expect(result).toBe("Process exited with error");
  });

  it("returns fallback message when all sources are empty", () => {
    const result = extractErrorMessage("", "", "");
    expect(result).toBe(
      "Command execution failed with no output. Check workflow artifacts for ccr.log details.",
    );
  });

  it("returns fallback when stdout is only debug logs and ccr.log has no errors", () => {
    const stdout = `[log_123] sending request
  method: 'post'
}`;
    const ccrLog = "Loaded JSON config from: /path/to/config.json";
    const result = extractErrorMessage(stdout, "", ccrLog);
    expect(result).toBe(
      "Command execution failed with no output. Check workflow artifacts for ccr.log details.",
    );
  });

  it("truncates long stdout messages to 500 chars", () => {
    const stdout = "Error: " + "x".repeat(600);
    const result = extractErrorMessage(stdout, "", "");
    expect(result.length).toBe(500);
  });

  it("prioritizes stdout over ccr.log when both have content", () => {
    const stdout = "Meaningful error from agent output";
    const ccrLog = "Warning: Some CCR warning";
    const result = extractErrorMessage(stdout, "", ccrLog);
    expect(result).toBe("Meaningful error from agent output");
  });
});
