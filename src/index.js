import * as core from "@actions/core";
import * as github from "@actions/github";
import { parseComment, parseArguments } from "./lib/parser.js";
import { loadConfig } from "./lib/config.js";
import { validateCommand, sanitizeArguments } from "./lib/validator.js";

try {
  // Get inputs from action.yml
  const issueNumber = core.getInput("issue-number");
  const repoOwner = core.getInput("repo-owner");
  const repoName = core.getInput("repo-name");
  const commentBody = core.getInput("comment-body");

  core.info(`Processing command for issue ${issueNumber} in ${repoOwner}/${repoName}`);
  core.info(`Comment body: ${commentBody}`);

  // Parse comment to extract command
  const parsed = parseComment(commentBody);

  if (!parsed) {
    core.info("No @gsd-bot command found in comment");
    core.setOutput("command-found", "false");
    core.setOutput("response-posted", "false");
    // Clean exit - no further processing needed
  } else {
    core.info(`Found command: ${parsed.command}`);
    core.info(`Arguments: ${parsed.args || '(none)'}`);

    // Parse arguments if present
    const args = parsed.args ? parseArguments(parsed.args) : {};
    core.info(`Parsed arguments: ${JSON.stringify(args)}`);

    // Validate command
    try {
      validateCommand(parsed.command);

      // Sanitize arguments
      const sanitizedArgs = args ? sanitizeArguments(args) : {};

      // Load configuration
      const config = await loadConfig(repoOwner, repoName);

      core.info("Configuration loaded and validated");
      core.info(`Config paths: ${JSON.stringify(config.paths)}`);

      // Set outputs
      core.setOutput("command-found", "true");
      core.setOutput("response-posted", "true");
      core.setOutput("command", parsed.command);
      core.setOutput("config-loaded", "true");
      core.setOutput("arguments", JSON.stringify(sanitizedArgs));

      // Execute GSD command via Claude Code Router stdin pipe
      // CCR wraps Claude Code CLI for non-interactive CI/CD execution
      const { exec } = require('child_process');

      // TODO: Execute command logic in later phases (Phase 4+)
      // Example execution:
      // exec(`echo "/gsd:new-milestone" | ccr code`, (error, stdout, stderr) => {
      //   if (error) {
      //     console.error(`Error: ${error.message}`);
      //     return;
      //   }
      //   if (stderr) {
      //     console.error(`stderr: ${stderr}`);
      //   }
      //   console.log(`stdout: ${stdout}`);
      // });
    } catch (error) {
      core.setFailed(error.message);
      core.setOutput("command-found", "false");
      core.setOutput("config-loaded", "false");
    }
  }

  // Clean exit - no explicit return needed
} catch (error) {
  // Set failed exit code
  core.setFailed(`Action failed: ${error.message}`);
}
