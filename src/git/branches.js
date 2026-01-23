import { createAndSwitchBranch, switchBranch, runGitCommand } from "./git.js";
import * as core from "@actions/core";

/**
 * Slugify phase name for branch naming
 * @param {string} text - Text to slugify
 * @returns {string} Slugified text
 */
export function slugify(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
}

/**
 * Create milestone branch
 * @param {number} milestoneNumber - Milestone number
 */
export async function createMilestoneBranch(milestoneNumber) {
  const branchName = `gsd/${milestoneNumber}`;
  await createAndSwitchBranch(branchName);
  core.info(`Created milestone branch: ${branchName}`);
}

/**
 * Create phase branch with naming convention
 * Pattern: gsd/{milestone}-{phase}-{slugified-phase-name}
 * @param {number} milestoneNumber - Milestone number
 * @param {number} phaseNumber - Phase number within milestone
 * @param {string} phaseName - Phase name to slugify
 * @param {string} [startPoint] - Optional start point (default: current HEAD)
 */
export async function createPhaseBranch(
  milestoneNumber,
  phaseNumber,
  phaseName,
  startPoint = null,
) {
  const slug = slugify(phaseName);
  const branchName = `gsd/${milestoneNumber}-${phaseNumber}-${slug}`;
  await createAndSwitchBranch(branchName, startPoint);
  core.info(`Created phase branch: ${branchName} (from "${phaseName}")`);
}

/**
 * Check if branch exists
 * @param {string} branchName - Name of branch to check
 * @returns {Promise<boolean>} True if branch exists
 */
export async function branchExists(branchName) {
  try {
    await runGitCommand(`git rev-parse --verify ${branchName}`);
    return true;
  } catch {
    return false;
  }
}
