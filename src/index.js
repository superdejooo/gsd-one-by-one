import * as core from "@actions/core";
import * as github from "@actions/github";
import { parseComment, parseArguments } from "./lib/parser.js";

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

    // Set outputs
    core.setOutput("command-found", "true");
    core.setOutput("response-posted", "true");
    core.setOutput("command", parsed.command);

    // TODO: Validate command and load config in Phase 2 (plans 02-03)
    // TODO: Execute command logic in later phases
  }

  // Clean exit - no explicit return needed
} catch (error) {
  // Set failed exit code
  core.setFailed(`Action failed: ${error.message}`);
}
