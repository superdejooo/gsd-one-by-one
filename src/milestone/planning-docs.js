/**
 * Planning Documents Generator
 * Creates PROJECT.md, STATE.md, and ROADMAP.md files for milestone creation
 */

import fs from "node:fs/promises";
import * as core from "@actions/core";

/**
 * Create all planning documents for a milestone
 * @param {object} milestoneData - Milestone context
 * @param {string} milestoneData.owner - Repository owner
 * @param {string} milestoneData.repo - Repository name
 * @param {number} milestoneData.milestoneNumber - Milestone number
 * @param {string} milestoneData.title - Milestone title
 * @param {string} milestoneData.goal - Primary goal
 * @param {string} milestoneData.scope - Scope description
 * @param {Array<string>} milestoneData.features - Key features
 * @param {object} milestoneData.requirements - Requirements status
 * @param {Array} milestoneData.phases - Phase definitions
 * @param {string} milestoneData.status - Current status
 * @param {string} milestoneData.createdAt - Creation timestamp
 * @param {string} milestoneData.lastRunAt - Last run timestamp
 * @param {number} milestoneData.runCount - Number of workflow runs
 * @returns {Promise<object>} Files map with paths and purposes
 */
export async function createPlanningDocs(milestoneData) {
  const { owner, repo, milestoneNumber } = milestoneData;
  const planningDir = `.github/planning/milestones/${milestoneNumber}`;
  const files = {};

  // Create directory structure
  await fs.mkdir(planningDir, { recursive: true });
  await fs.mkdir(`${planningDir}/phases`, { recursive: true });
  core.info(`Created directory structure: ${planningDir}/`);

  // Create PROJECT.md
  const projectContent = generateProjectMarkdown(milestoneData);
  const projectPath = `${planningDir}/PROJECT.md`;
  await fs.writeFile(projectPath, projectContent);
  files.project = { path: projectPath, purpose: "Milestone context and goals" };
  core.info(`Created ${projectPath}`);

  // Create STATE.md
  const stateContent = generateStateMarkdown(milestoneData);
  const statePath = `${planningDir}/STATE.md`;
  await fs.writeFile(statePath, stateContent);
  files.state = { path: statePath, purpose: "Milestone number and status" };
  core.info(`Created ${statePath}`);

  // Create ROADMAP.md
  const roadmapContent = generateRoadmapMarkdown(milestoneData);
  const roadmapPath = `${planningDir}/ROADMAP.md`;
  await fs.writeFile(roadmapPath, roadmapContent);
  files.roadmap = { path: roadmapPath, purpose: "Phase structure" };
  core.info(`Created ${roadmapPath}`);

  return files;
}

/**
 * Generate PROJECT.md content
 * @param {object} data - Milestone data
 * @returns {string} Markdown content for PROJECT.md
 */
export function generateProjectMarkdown(data) {
  const {
    milestoneNumber,
    title,
    goal,
    scope,
    features,
    requirements,
    createdAt
  } = data;

  const featuresList = features && features.length > 0
    ? features.map(f => `- ${f}`).join('\n')
    : "- To be defined";

  const requirementsSummary = requirements?.answered && Object.keys(requirements.answered).length > 0
    ? Object.entries(requirements.answered)
      .map(([key, value]) => `| \`${key}\` | ${value || "(empty)"} |`)
      .join('\n')
    : "| |";

  return `# Milestone ${milestoneNumber}: ${title}

**Created:** ${createdAt || new Date().toISOString()}
**Status:** Planning

## Goal

${goal || "To be defined during requirements gathering."}

## Scope

${scope || "To be defined during requirements gathering."}

## Key Features

${featuresList}

## Requirements Summary

| Question | Answer |
|----------|--------|
${requirementsSummary}

---
*This file is part of the GSD milestone planning process.*
`;
}

/**
 * Generate STATE.md content
 * @param {object} data - Milestone data
 * @returns {string} Markdown content for STATE.md
 */
export function generateStateMarkdown(data) {
  const {
    milestoneNumber,
    status,
    phases,
    requirements,
    createdAt,
    lastRunAt,
    runCount
  } = data;

  const phaseRows = phases && phases.length > 0
    ? phases.map((p, i) => {
        const phaseNum = String(i + 1).padStart(2, '0');
        const phaseName = p.name || "Unnamed Phase";
        const phaseStatus = p.status || "pending";
        return `| ${phaseNum} | ${phaseName} | ${phaseStatus} |`;
      }).join('\n')
    : "|   | (none defined) | pending |";

  const reqStatus = requirements?.complete ? "Complete" : "In Progress";
  const answeredCount = Object.keys(requirements?.answered || {}).length;
  const pendingCount = requirements?.pending?.length || 0;

  return `# Milestone ${milestoneNumber} State

**Milestone:** ${milestoneNumber}
**Status:** ${status || "planning"}
**Last Updated:** ${new Date().toISOString()}

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
${phaseRows}

## Requirements Gathering

**Status:** ${reqStatus}
**Questions Answered:** ${answeredCount}
**Questions Pending:** ${pendingCount}

## Workflow

**Started:** ${createdAt || "N/A"}
**Last Run:** ${lastRunAt || "N/A"}
**Run Count:** ${runCount || 1}

---
*State file for GSD milestone tracking.*
`;
}

/**
 * Generate ROADMAP.md content
 * @param {object} data - Milestone data
 * @returns {string} Markdown content for ROADMAP.md
 */
export function generateRoadmapMarkdown(data) {
  const { milestoneNumber, phases, totalPhases } = data;

  const phaseCount = totalPhases || (phases?.length || 0);

  let phaseStructure = "";
  if (phases && phases.length > 0) {
    phaseStructure = phases.map((p, i) => {
      const phaseNum = i + 1;
      const phaseName = p.name || `Phase ${phaseNum}`;
      const phaseGoal = p.goal || "To be defined";
      const phaseDeps = p.dependencies || "None";
      const phaseStatus = p.status || "pending";

      return `### Phase ${phaseNum}: ${phaseName}

- **Status:** ${phaseStatus}
- **Goal:** ${phaseGoal}
- **Dependencies:** ${phaseDeps}
`;
    }).join('\n');
  } else {
    phaseStructure = "Phases will be defined during planning.";
  }

  return `# Milestone ${milestoneNumber} Roadmap

**Total Phases:** ${phaseCount}

## Phase Structure

${phaseStructure}

## Execution Order

${phases && phases.length > 0
  ? phases.map((p, i) => `${i + 1}. Phase ${i + 1}: ${p.name || `Phase ${i + 1}`}`).join('\n')
  : "1. Phase 1: Foundation Setup\n2. Phase 2: Core Implementation\n3. Phase 3: Integration\n4. Phase 4: Testing & Verification"}

## Notes

- Each phase is implemented in its own branch
- Planning documents are created before implementation
- Requirements are gathered before detailed planning

---
*This roadmap guides milestone execution.*
`;
}
