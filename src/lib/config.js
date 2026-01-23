import * as github from "@actions/github";
import * as core from "@actions/core";

/**
 * Load configuration from .github/gsd-config.json or use defaults
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {object} - Configuration object
 */
export async function loadConfig(owner, repo) {
  const token =
    core.getInput("token", { required: false }) || process.env.GITHUB_TOKEN;
  const octokit = github.getOctokit(token);

  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: ".github/gsd-config.json",
    });

    // Decode base64 content (GitHub API returns base64 for files)
    const content = Buffer.from(response.data.content, "base64").toString(
      "utf-8",
    );
    const config = JSON.parse(content);

    core.info("Loaded config from .github/gsd-config.json");
    return config;
  } catch (error) {
    if (error.status === 404) {
      core.info("Config file not found, using defaults");
      return getDefaultConfig();
    }
    throw new Error(`Failed to load config: ${error.message}`);
  }
}

/**
 * Get default configuration
 * @returns {object} - Default config object
 */
function getDefaultConfig() {
  return {
    labels: {
      phases: {
        "01-github-action-foundation": "Phase 1: Foundation",
        "02-command-parsing-config": "Phase 2: Command Parsing & Config",
        "03-claude-code-router": "Phase 3: CCR Integration",
        "04-communication-layer": "Phase 4: Communication",
        "05-milestone-creation": "Phase 5: Milestone Creation",
        "06-authorization-check": "Phase 6: Authorization",
      },
      status: {
        todo: "To Do",
        "in-progress": "In Progress",
        done: "Done",
        blocked: "Blocked",
      },
    },
    paths: {
      planning: ".github/planning/",
      milestones: ".github/planning/milestones/",
      phases: ".github/planning/phases/",
    },
  };
}
