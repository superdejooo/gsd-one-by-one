import * as core from "@actions/core";
import * as github from "@actions/github";

try {
  // Get inputs from action.yml
  const issueNumber = core.getInput("issue-number");
  const repoOwner = core.getInput("repo-owner");
  const repoName = core.getInput("repo-name");
  const commentBody = core.getInput("comment-body");

  core.info(`Processing command for issue ${issueNumber} in ${repoOwner}/${repoName}`);
  core.info(`Comment body: ${commentBody}`);

  // TODO: Parse command and execute logic in later phases

  // Set output
  core.setOutput("response-posted", "true");

  // Clean exit - no explicit return needed
} catch (error) {
  // Set failed exit code
  core.setFailed(`Action failed: ${error.message}`);
}
