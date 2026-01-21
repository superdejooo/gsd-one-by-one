import { query } from "@anthropic-ai/claude-agent-sdk";

/**
 * Execute a task with Claude Agent SDK via CCR proxy
 *
 * Architecture:
 * - Agent SDK is CLIENT library (bundled in this action)
 * - CCR is PROXY SERVICE (installed globally in workflow, runs at http://127.0.0.1:3456)
 * - SDK automatically routes through CCR when ANTHROPIC_BASE_URL=http://127.0.0.1:3456
 * - CCR intercepts requests, routes to configured provider (OpenRouter, Anthropic, DeepSeek)
 *
 * CI-safe configuration:
 * - permissionMode: "acceptEdits" - Auto-approve file edits, no interactive prompts
 * - allowedTools: Restricted set for security
 * - maxTurns: Reasonable limit to prevent runaway execution
 *
 * @param {string} prompt - The task prompt for Claude
 * @param {object} options - SDK configuration options
 * @param {string} [options.model="claude-sonnet-4-5-20250929"] - Model to use
 * @param {string} [options.permissionMode="acceptEdits"] - Permission mode for CI
 * @param {string[]} [options.allowedTools] - Tools the agent can use
 * @param {number} [options.maxTurns=50] - Maximum conversation turns
 * @returns {Promise<{success: boolean, output?: string, error?: string}>}
 */
export async function executeLLMTask(prompt, options = {}) {
  try {
    const messages = [];

    // Agent SDK automatically uses ANTHROPIC_BASE_URL if set
    // Routes to CCR proxy at http://127.0.0.1:3456
    for await (const msg of query({
      prompt,
      options: {
        model: options.model || "claude-sonnet-4-5-20250929",
        permissionMode: "acceptEdits", // Non-interactive for CI
        allowedTools: options.allowedTools || [
          "Read",
          "Write",
          "Bash",
          "Glob",
          "Grep",
        ],
        maxTurns: options.maxTurns || 50,
        ...options,
      },
    })) {
      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if ("text" in block) {
            messages.push(block.text);
          }
        }
      }
    }

    return {
      success: true,
      output: messages.join("\n"),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Execute LLM task with exponential backoff retry logic
 *
 * Retries on:
 * - Rate limit errors (429)
 * - Overloaded errors (529)
 *
 * Does NOT retry on:
 * - Authentication errors (401) - fail fast
 *
 * Note: Current SDK may return API errors as text in message stream
 * instead of throwing exceptions. This function checks for both.
 *
 * @param {string} prompt - The task prompt
 * @param {object} options - SDK options
 * @param {number} [maxRetries=3] - Maximum retry attempts
 * @returns {Promise<{success: boolean, output?: string, error?: string}>}
 */
export async function executeLLMTaskWithRetry(
  prompt,
  options = {},
  maxRetries = 3,
) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeLLMTask(prompt, options);

      // Check if result contains API errors in text content
      // SDK may return errors as messages instead of exceptions
      if (result.success && result.output) {
        // Rate limit errors
        if (
          result.output.includes("429") ||
          result.output.toLowerCase().includes("rate limit")
        ) {
          throw new Error("Rate limited");
        }

        // Overloaded errors
        if (
          result.output.includes("529") ||
          result.output.toLowerCase().includes("overloaded")
        ) {
          throw new Error("Service overloaded");
        }

        // Authentication errors - don't retry
        if (
          result.output.includes("401") ||
          result.output.toLowerCase().includes("authentication")
        ) {
          return {
            success: false,
            error: "Authentication failed - check API keys",
          };
        }
      }

      return result;
    } catch (error) {
      lastError = error;

      // Don't retry authentication errors
      if (
        error.message.includes("401") ||
        error.message.toLowerCase().includes("authentication")
      ) {
        return {
          success: false,
          error: `Authentication error: ${error.message}`,
        };
      }

      // Exponential backoff for retryable errors
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  return {
    success: false,
    error: `Failed after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`,
  };
}
