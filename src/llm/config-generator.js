import fs from "fs";
import os from "os";
import path from "path";

/**
 * Generate Claude Code Router service configuration
 * Creates ~/.claude-code-router/config.json with multi-provider support
 *
 * CCR service config (not SDK config):
 * - Uses $VAR_NAME syntax for env var interpolation (CCR replaces at service start)
 * - NON_INTERACTIVE_MODE: true prevents prompts/hangs in CI
 * - Multi-provider routing for cost optimization
 *
 * Architecture:
 * 1. Workflow sets GitHub Secrets as env vars (OPENROUTER_API_KEY, etc.)
 * 2. This function generates config.json with $VAR_NAME placeholders
 * 3. Workflow installs CCR globally: npm install -g @musistudio/claude-code-router
 * 4. Workflow starts CCR service: ccr start (reads config, interpolates env vars)
 * 5. Workflow sets ANTHROPIC_BASE_URL=http://127.0.0.1:3456
 * 6. Agent SDK routes to CCR proxy automatically
 *
 * @throws {Error} If no API keys are available
 */
export function generateCCRConfig() {
  // Check which providers have API keys defined
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;

  if (!hasOpenRouter && !hasAnthropic && !hasDeepSeek) {
    throw new Error(
      "At least one API key required: OPENROUTER_API_KEY, ANTHROPIC_API_KEY, or DEEPSEEK_API_KEY"
    );
  }

  // Build providers array based on available API keys
  const providers = [];

  if (hasOpenRouter) {
    providers.push({
      name: "openrouter",
      api_base_url: "https://openrouter.ai/api/v1/chat/completions",
      api_key: "$OPENROUTER_API_KEY", // CCR interpolates at service start
      models: ["anthropic/claude-sonnet-4", "google/gemini-2.5-pro-preview"],
      transformer: {
        use: ["openrouter"],
      },
    });
  }

  if (hasAnthropic) {
    providers.push({
      name: "anthropic",
      api_base_url: "https://api.anthropic.com/v1",
      api_key: "$ANTHROPIC_API_KEY", // CCR interpolates at service start
      models: ["claude-sonnet-4-5-20250929"],
      transformer: {
        use: ["anthropic"],
      },
    });
  }

  if (hasDeepSeek) {
    providers.push({
      name: "deepseek",
      api_base_url: "https://api.deepseek.com/chat/completions",
      api_key: "$DEEPSEEK_API_KEY", // CCR interpolates at service start
      models: ["deepseek-chat", "deepseek-reasoner"],
      transformer: {
        use: ["deepseek"],
      },
    });
  }

  // Build router config with priority: OpenRouter > Anthropic > DeepSeek
  const router = {
    default: hasOpenRouter
      ? "openrouter,anthropic/claude-sonnet-4"
      : hasAnthropic
        ? "anthropic,claude-sonnet-4-5-20250929"
        : "deepseek,deepseek-chat",
  };

  // Add optional routing scenarios if providers available
  if (hasDeepSeek) {
    router.think = "deepseek,deepseek-reasoner";
  }

  if (hasOpenRouter) {
    router.longContext = "openrouter,google/gemini-2.5-pro-preview";
  }

  // CCR service configuration
  const config = {
    NON_INTERACTIVE_MODE: true, // MANDATORY for CI - prevents prompts/hangs
    LOG: true,
    LOG_LEVEL: "info",
    API_TIMEOUT_MS: 600000, // 10 minutes for long-running tasks
    Providers: providers,
    Router: router,
  };

  // Create ~/.claude-code-router directory if it doesn't exist
  const configDir = path.join(os.homedir(), ".claude-code-router");
  fs.mkdirSync(configDir, { recursive: true });

  // Write config.json
  const configPath = path.join(configDir, "config.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

  return configPath;
}
