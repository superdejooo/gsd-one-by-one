import { checkAuthorization, formatAuthorizationError } from "./auth/index.js";
import { octokit } from "./lib/github.js";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { parseComment, parseArguments, parseSkillArg } from "./lib/parser.js";
import { loadConfig } from "./lib/config.js";
import { validateCommand, sanitizeArguments, isValidSkillForCommand, getValidSkillsForCommand } from "./lib/validator.js";
import { postComment, getWorkflowRunUrl } from "./lib/github.js";
import { formatErrorComment, formatSuccessComment } from "./errors/formatter.js";
import { runGitCommand, createAndSwitchBranch, switchBranch, configureGitIdentity } from "./git/git.js";
import { createMilestoneBranch, createPhaseBranch, slugify, branchExists } from "./git/branches.js";
import { withErrorHandling } from "./errors/handler.js";
import { createPlanningDocs, generateProjectMarkdown, generateStateMarkdown, generateRoadmapMarkdown } from "./milestone/planning-docs.js";
import { executeMilestoneWorkflow, parseMilestoneNumber } from "./milestone/index.js";
import { executePhaseWorkflow } from "./milestone/phase-planner.js";
import { executePhaseExecutionWorkflow } from "./milestone/phase-executor.js";
import { executeMilestoneCompletionWorkflow } from "./milestone/milestone-completer.js";

// Trigger bundling of modules
const _githubModule = { postComment, getWorkflowRunUrl };
const _formatterModule = { formatErrorComment, formatSuccessComment };
const _gitModule = { runGitCommand, createAndSwitchBranch, switchBranch, configureGitIdentity };
const _branchModule = { createMilestoneBranch, createPhaseBranch, slugify, branchExists };
const _errorModule = { withErrorHandling };
const _planningModule = { createPlanningDocs, generateProjectMarkdown, generateStateMarkdown, generateRoadmapMarkdown };
const _milestoneModule = { executeMilestoneWorkflow, parseMilestoneNumber };
const _phasePlannerModule = { executePhaseWorkflow };
const _phaseExecutorModule = { executePhaseExecutionWorkflow };
const _milestoneCompleterModule = { executeMilestoneCompletionWorkflow };
const _authModule = { checkAuthorization, formatAuthorizationError };
console.log("Modules loaded:", !!_githubModule, !!_formatterModule, !!_gitModule, !!_branchModule, !!_errorModule, !!_planningModule, !!_milestoneModule, !!_phasePlannerModule, !!_phaseExecutorModule, !!_milestoneCompleterModule, !!_authModule);

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

    // CRITICAL: Authorization check BEFORE any git operations or state modifications
    core.info(`Checking authorization for user`);
    const authResult = await checkAuthorization(octokit);

    if (!authResult.authorized) {
      core.info(`User ${authResult.username} not authorized: ${authResult.reason}`);
      const workflowUrl = getWorkflowRunUrl();
      const errorComment = formatAuthorizationError(authResult.username, `${repoOwner}/${repoName}`, workflowUrl);
      await postComment(repoOwner, repoName, github.context.issue?.number, errorComment);
      core.setOutput("command-found", "true");
      core.setOutput("authorized", "false");
      return { commandFound: true, authorized: false, reason: authResult.reason };
    }

    core.info(`User ${authResult.username} authorized with ${authResult.permission} access`);

    core.info(`Found command: ${parsed.command}`);
    core.info(`Arguments: ${parsed.args || '(none)'}`);

    // Parse arguments if present
    const args = parsed.args ? parseArguments(parsed.args) : {};
    core.info(`Parsed arguments: ${JSON.stringify(args)}`);

    // Validate command
    validateCommand(parsed.command);

    // Sanitize arguments
    const sanitizedArgs = args ? sanitizeArguments(args) : {};

    // Parse skill from args (if provided)
    const skill = parseSkillArg(parsed.args || "");
    if (skill) {
      core.info(`Skill detected: ${skill}`);
      // Validate skill is allowed for this command
      if (!isValidSkillForCommand(skill, parsed.command)) {
        const validSkills = getValidSkillsForCommand(parsed.command);
        throw new Error(`Skill '${skill}' is not valid for command '${parsed.command}'. Valid skills: ${validSkills.join(', ')}`);
      }
    }

    // Command dispatch for milestone workflow
    if (parsed.command === "new-milestone") {
      core.info("Dispatching to milestone workflow");
      // Pass raw args string - parseMilestoneDescription expects the full text
      const result = await executeMilestoneWorkflow(
        { owner: repoOwner, repo: repoName, issueNumber: github.context.issue?.number },
        parsed.args || "",
        skill
      );
      core.info(`Milestone workflow result: ${JSON.stringify(result)}`);
      core.setOutput("milestone-complete", result.complete);
      core.setOutput("milestone-phase", result.phase || "unknown");
      return { commandFound: true, command: parsed.command, ...result };
    }

    // Command dispatch for phase planning workflow
    if (parsed.command === "plan-phase") {
      core.info("Dispatching to phase planning workflow");
      // Pass raw args string - parsePhaseNumber expects string for .match()
      const result = await executePhaseWorkflow(
        { owner: repoOwner, repo: repoName, issueNumber: github.context.issue?.number },
        parsed.args || "",
        skill
      );
      core.setOutput("phase-planned", result.complete);
      core.setOutput("phase-number", result.phaseNumber);
      return { commandFound: true, command: parsed.command, ...result };
    }

    // Command dispatch for phase execution workflow
    if (parsed.command === "execute-phase") {
      core.info("Dispatching to phase execution workflow");
      // Pass raw args string - parsePhaseNumber expects string for .match()
      const result = await executePhaseExecutionWorkflow(
        { owner: repoOwner, repo: repoName, issueNumber: github.context.issue?.number },
        parsed.args || "",
        skill
      );
      core.setOutput("phase-executed", result.complete);
      core.setOutput("phase-number", result.phaseNumber);
      core.setOutput("has-questions", result.hasQuestions);
      return { commandFound: true, command: parsed.command, ...result };
    }

    // Command dispatch for milestone completion workflow
    if (parsed.command === "complete-milestone") {
      core.info("Dispatching to milestone completion workflow");
      const result = await executeMilestoneCompletionWorkflow(
        { owner: repoOwner, repo: repoName, issueNumber: github.context.issue?.number },
        skill
      );
      core.setOutput("milestone-completed", result.complete);
      return { commandFound: true, command: parsed.command, ...result };
    }

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
