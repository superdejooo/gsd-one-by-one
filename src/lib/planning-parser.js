/**
 * Parsers for GSD planning artifact files (REQUIREMENTS.md, ROADMAP.md)
 * Used to extract milestone metadata after new-milestone workflow completes
 */
import fs from "fs/promises";
import * as core from "@actions/core";

/**
 * Parse REQUIREMENTS.md to extract milestone metadata
 * @returns {Promise<{title: string, version: string, coreValue: string} | null>}
 */
export async function parseRequirements() {
  try {
    const content = await fs.readFile(".planning/REQUIREMENTS.md", "utf-8");

    // Extract title from first H1: # Requirements: GSD for GitHub v1.1
    // Pattern: # Requirements: {title} v{version}
    const titleMatch = content.match(
      /^#\s+Requirements:\s+(.+?)\s+v(\d+\.\d+)/m,
    );

    // Extract Core Value paragraph
    const coreValueMatch = content.match(
      /\*\*Core Value:\*\*\s+(.+?)(?:\n\n|\n##)/s,
    );

    if (!titleMatch) {
      core.warning("Could not parse title from REQUIREMENTS.md");
      return null;
    }

    return {
      title: titleMatch[1].trim(),
      version: `v${titleMatch[2]}`,
      coreValue: coreValueMatch ? coreValueMatch[1].trim() : null,
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      core.info("REQUIREMENTS.md not found (no active milestone)");
      return null;
    }
    throw error;
  }
}

/**
 * Parse ROADMAP.md to extract phase information
 * @returns {Promise<{phases: Array<{number: string, name: string, status: string}>}>}
 */
export async function parseRoadmap() {
  try {
    const content = await fs.readFile(".planning/ROADMAP.md", "utf-8");

    const phases = [];

    // Match phase headers: ### Phase N: Phase Name
    // Also match status: **Status:** Complete or **Status:** Not started
    const phasePattern = /###\s+Phase\s+(\d+(?:\.\d+)?):?\s+(.+?)(?:\n|$)/g;
    let match;

    while ((match = phasePattern.exec(content)) !== null) {
      const phaseNumber = match[1];
      const phaseName = match[2].trim();

      // Find status for this phase (appears after the header)
      const afterPhase = content.slice(match.index);
      const statusMatch = afterPhase.match(
        /\*\*Status:\*\*\s+(Complete|Not started|In progress)/i,
      );
      const status = statusMatch ? statusMatch[1].toLowerCase() : "not started";

      phases.push({
        number: phaseNumber,
        name: phaseName,
        status: status.replace(" ", "-"), // "not started" -> "not-started"
      });
    }

    return { phases };
  } catch (error) {
    if (error.code === "ENOENT") {
      core.info("ROADMAP.md not found");
      return { phases: [] };
    }
    throw error;
  }
}

/**
 * Parse both files and return combined milestone metadata
 * @returns {Promise<{title: string, version: string, coreValue: string, phases: Array}>}
 */
export async function parseMilestoneMetadata() {
  const [requirements, roadmap] = await Promise.all([
    parseRequirements(),
    parseRoadmap(),
  ]);

  return {
    ...requirements,
    phases: roadmap.phases,
  };
}
