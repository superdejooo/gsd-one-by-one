import fs from 'fs';
import path from 'path';
import os from 'os';

export function generateCCRConfig() {
  const configDir = path.join(os.homedir(), '.claude-code-router');
  const configPath = path.join(configDir, 'config.json');

  // Create directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Read environment variables for configuration
  const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';
  const defaultModel = process.env.CCR_DEFAULT_MODEL || 'z-ai/glm-4.7';

  // Full CCR configuration structure
  const config = {
    "NON_INTERACTIVE_MODE": true,
    "LOG": false,
    "LOG_LEVEL": "debug",
    "CLAUDE_PATH": "",
    "HOST": "127.0.0.1",
    "PORT": 3456,
    "APIKEY": "",
    "API_TIMEOUT_MS": "60000",
    "PROXY_URL": "",
    "transformers": [],
    "Providers": [
      {
        "name": "openrouter",
        "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
        "api_key": openrouterApiKey,
        "models": [
          "openai/gpt-5.2-codex",
          "openai/gpt-5.1-codex-max",
          "openai/gpt-5.1-codex-mini",
          "openai/gpt-4o",
          "xiaomi/mimo-v2-flash",
          "x-ai/grok-code-fast-1",
          "z-ai/glm-4.7-flash",
          "z-ai/glm-4.7",
          "xiaomi/mimo-v2-flash:free",
          "qwen/qwen3-coder:free",
          "openai/gpt-oss-20b:free",
          "anthropic/claude-sonnet-4.5"
        ]
      }
    ],
    "StatusLine": {
      "enabled": true,
      "currentStyle": "default",
      "default": {
        "modules": [
          {
            "type": "model",
            "icon": "🤖",
            "text": "{{model}}",
            "color": "bright_yellow"
          },
          {
            "type": "usage",
            "icon": "",
            "text": "{{inputTokens}} → {{outputTokens}}",
            "color": "#94db91"
          }
        ]
      },
      "fontFamily": "Hack Nerd Font Mono"
    },
    "Router": {
      "default": `openrouter,${defaultModel}`,
      "background": `openrouter,${defaultModel}`,
      "think": `openrouter,${defaultModel}`,
      "longContext": `openrouter,${defaultModel}`,
      "longContextThreshold": 60000,
      "webSearch": `openrouter,${defaultModel}`,
      "image": `openrouter,${defaultModel}`
    },
    "CUSTOM_ROUTER_PATH": ""
  };

  // Validate at least one API key is present
  if (!openrouterApiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is required');
  }

  // Write config file
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  console.log(`CCR config generated at: ${configPath}`);
}
