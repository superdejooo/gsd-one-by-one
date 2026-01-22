import * as core from "@actions/core";
import * as github from "@actions/github";
import { parseComment, parseArguments } from "./lib/parser.js";
import { loadConfig } from "./lib/config.js";
import { validateCommand, sanitizeArguments } from "./lib/validator.js";
import { postComment, getWorkflowRunUrl } from "./lib/github.js";
import { formatErrorComment, formatSuccessComment } from "./errors/formatter.js";
import { runGitCommand, createAndSwitchBranch, switchBranch, configureGitIdentity } from "./git/git.js";
import { createMilestoneBranch, createPhaseBranch, slugify, branchExists } from "./git/branches.js";
import { withErrorHandling } from "./errors/handler.js";
import { createPlanningDocs, generateProjectMarkdown, generateStateMarkdown, generateRoadmapMarkdown } from "./milestone/planning-docs.js";

// Trigger bundling of modules
const _githubModule = { postComment, getWorkflowRunUrl };
const _formatterModule = { formatErrorComment, formatSuccessComment };
const _gitModule = { runGitCommand, createAndSwitchBranch, switchBranch, configureGitIdentity };
const _branchModule = { createMilestoneBranch, createPhaseBranch, slugify, branchExists };
const _errorModule = { withErrorHandling };
const _planningModule = { createPlanningDocs, generateProjectMarkdown, generateStateMarkdown, generateRoadmapMarkdown };
console.log("Modules loaded:", !!_githubModule, !!_formatterModule, !!_gitModule, !!_branchModule, !!_errorModule, !!_planningModule);

try {
  // Get inputs from action.yml
  const issueNumber = core.getInput("issue-number");
  const repoOwner = core.getInput("repo-owner");
  const repoName = core.getInput("repo-name");
  const commentBody = core.getInput("comment-body");

  core.info(`Processing command for issue ${issueNumber} in ${repoOwner}/${repoName}`);
  core.info(`Comment body: ${commentBody}`);

  // Extract GitHub context for error handling
  const githubContext = {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issueNumber: github.context.issue?.number,
  };

  // Execute with error handling
  const result = await withErrorHandling(async () => {
    // Parse comment to extract command
    const parsed = parseComment(commentBody);

    if (!parsed) {
      core.info("No @gsd-bot command found in comment");
      core.setOutput("command-found", "false");
      core.setOutput("response-posted", "false");
      return { commandFound: false };
    }

    core.info(`Found command: ${parsed.command}`);
    core.info(`Arguments: ${parsed.args || '(none)'}`);

    // Parse arguments if present
    const args = parsed.args ? parseArguments(parsed.args) : {};
    core.info(`Parsed arguments: ${JSON.stringify(args)}`);

    // Validate command
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

    // Configure git identity for commits
    await configureGitIdentity(
      "github-actions[bot]",
      "41898282+github-actions[bot]@users.noreply.github.com"
    );

    // Execute GSD command via Claude Code Router stdin pipe
    // CCR wraps Claude Code CLI for non-interactive CI/CD execution
    const { exec } = require('child_process');

    // TODO: Execute command logic in later phases (Phase 5+)
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

    return { commandFound: true, command: parsed.command };
  }, githubContext);

  if (!result.success) {
    core.info("Command execution failed - error posted to issue");
  }

  // Clean exit - no explicit return needed
} catch (error) {
  // Set failed exit code
  core.setFailed(`Action failed: ${error.message}`);
}
