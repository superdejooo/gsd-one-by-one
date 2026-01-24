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

    let title = null;
    let version = null;

    // Try multiple patterns for title/version extraction

    // Pattern 1: # Requirements: {title} v{version}
    let match = content.match(/^#\s+Requirements:\s+(.+?)\s+v(\d+\.\d+)/m);
    if (match) {
      title = match[1].trim();
      version = `v${match[2]}`;
    }

    // Pattern 2: **Milestone:** v{version} — {title}
    if (!title) {
      match = content.match(/\*\*Milestone:\*\*\s+v(\d+\.\d+)\s*[—–-]\s*(.+)/m);
      if (match) {
        version = `v${match[1]}`;
        title = match[2].trim();
      }
    }

    // Pattern 3: # {title} v{version} (any H1 with version)
    if (!title) {
      match = content.match(/^#\s+(.+?)\s+v(\d+\.\d+)/m);
      if (match) {
        title = match[1].trim();
        version = `v${match[2]}`;
      }
    }

    // Pattern 4: Just find any version number as fallback
    if (!version) {
      match = content.match(/v(\d+\.\d+)/);
      if (match) {
        version = `v${match[1]}`;
      }
    }

    // Extract Core Value paragraph
    const coreValueMatch = content.match(
      /\*\*Core Value:\*\*\s+(.+?)(?:\n\n|\n##)/s,
    );

    if (!title && !version) {
      core.warning("Could not parse title/version from REQUIREMENTS.md");
      return null;
    }

    return {
      title: title || "Untitled Milestone",
      version: version || "v0.0",
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
