/**
 * Parsers for GSD planning artifact files
 * Each file type (PROJECT.md, REQUIREMENTS.md, ROADMAP.md, PLAN.md, STATE.md)
 * has a specific format and requires its own parser.
 */
import fs from "fs/promises";
import * as core from "@actions/core";

/**
 * Parse PROJECT.md to extract project metadata
 * Format:
 *   # {Project Title}
 *   ## What This Is
 *   ## Core Value
 *   ## Current State (vX.X ...)
 *
 * @param {string} [path=".planning/PROJECT.md"] - Path to PROJECT.md
 * @returns {Promise<{title: string, coreValue: string, currentState: string} | null>}
 */
export async function parseProject(path = ".planning/PROJECT.md") {
  try {
    const content = await fs.readFile(path, "utf-8");

    // Extract title from first H1: # {title}
    const titleMatch = content.match(/^#\s+(.+?)$/m);
    const title = titleMatch ? titleMatch[1].trim() : null;

    // Extract Core Value section content
    const coreValueMatch = content.match(
      /##\s+Core Value\s*\n+([\s\S]*?)(?=\n##|\n---|\n$)/,
    );
    const coreValue = coreValueMatch ? coreValueMatch[1].trim() : null;

    // Extract Current State header: ## Current State (vX.X ...)
    const stateMatch = content.match(
      /##\s+Current State[^\n]*\((v[\d.]+)[^\)]*\)/,
    );
    const currentVersion = stateMatch ? stateMatch[1] : null;

    if (!title) {
      core.warning("Could not parse title from PROJECT.md");
      return null;
    }

    return {
      title,
      coreValue,
      currentVersion,
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      core.info("PROJECT.md not found");
      return null;
    }
    throw error;
  }
}

/**
 * Parse REQUIREMENTS.md to extract milestone metadata
 * Format variations:
 *   # Requirements: {title} v{version}
 *   # Requirements Archive: v{version} MVP — {title}
 *   **Milestone:** v{version} — {title}
 *   **Status:** ✅ SHIPPED
 *   **Core Value:** {description}
 *
 * @param {string} [path=".planning/REQUIREMENTS.md"] - Path to REQUIREMENTS.md
 * @returns {Promise<{title: string, version: string, coreValue: string, status: string} | null>}
 */
export async function parseRequirements(path = ".planning/REQUIREMENTS.md") {
  try {
    const content = await fs.readFile(path, "utf-8");

    let title = null;
    let version = null;

    // Pattern 1: # Requirements: {title} v{version}
    let match = content.match(/^#\s+Requirements:\s+(.+?)\s+v(\d+\.\d+)/m);
    if (match) {
      title = match[1].trim();
      version = `v${match[2]}`;
    }

    // Pattern 2: # Requirements Archive: v{version} {title} (title comes after version)
    // e.g. "# Requirements Archive: v1.0 MVP — GitHub-native GSD via Reusable Action"
    if (!title) {
      match = content.match(
        /^#\s+Requirements Archive:\s+v(\d+\.\d+)\s+(.+)/m,
      );
      if (match) {
        version = `v${match[1]}`;
        title = match[2].trim();
      }
    }

    // Pattern 3: **Milestone:** v{version} — {title}
    if (!title) {
      match = content.match(/\*\*Milestone:\*\*\s+v(\d+\.\d+)\s*[—–-]\s*(.+)/m);
      if (match) {
        version = `v${match[1]}`;
        title = match[2].trim();
      }
    }

    // Pattern 4: # {title} v{version} (any H1 with version)
    if (!title) {
      match = content.match(/^#\s+(.+?)\s+v(\d+\.\d+)/m);
      if (match) {
        title = match[1].trim();
        version = `v${match[2]}`;
      }
    }

    // Pattern 5: Just find any version number as fallback
    if (!version) {
      match = content.match(/v(\d+\.\d+)/);
      if (match) {
        version = `v${match[1]}`;
      }
    }

    // Extract status: **Status:** ✅ SHIPPED or **Status:** In Progress
    const statusMatch = content.match(/\*\*Status:\*\*\s*([^\n]+)/);
    const status = statusMatch ? statusMatch[1].trim() : null;

    // Extract Core Value: **Core Value:** {text} (may span multiple lines until ## or ---)
    // or ## Core Value section
    let coreValue = null;
    // Try multiline bold format first: **Core Value:** followed by text until next section
    const coreValueBoldMatch = content.match(
      /\*\*Core Value:\*\*\s*([\s\S]*?)(?=\n\n##|\n\n---|\n\n\*\*[A-Z]|\n\n$|$)/,
    );
    if (coreValueBoldMatch) {
      coreValue = coreValueBoldMatch[1].trim().replace(/\n/g, " ");
    } else {
      // Try section format: ## Core Value
      const coreValueSectionMatch = content.match(
        /##\s+Core Value\s*\n+([\s\S]*?)(?=\n##|\n---|\n$)/,
      );
      if (coreValueSectionMatch) {
        coreValue = coreValueSectionMatch[1].trim();
      }
    }

    if (!title && !version) {
      core.warning("Could not parse title/version from REQUIREMENTS.md");
      return null;
    }

    return {
      title: title || "Untitled Milestone",
      version: version || "v0.0",
      coreValue,
      status,
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
 * Parse ROADMAP.md to extract milestone and phase information
 * Format:
 *   # Milestone v{version}: {Title}
 *   **Status:** ✅ SHIPPED {date}
 *   **Phases:** {range}
 *   **Total Plans:** {count}
 *   ## Phases
 *   ### Phase N: Phase Name
 *   **Goal**: {goal}
 *   **Depends on**: {dependency}
 *   **Status:** Complete ({date})
 *
 * @param {string} [path=".planning/ROADMAP.md"] - Path to ROADMAP.md
 * @returns {Promise<{title: string, version: string, status: string, totalPlans: number, phases: Array<{number: string, name: string, goal: string, dependsOn: string, status: string}>}>}
 */
export async function parseRoadmap(path = ".planning/ROADMAP.md") {
  try {
    const content = await fs.readFile(path, "utf-8");

    // Extract milestone title and version from H1: # Milestone v{version}: {title}
    let title = null;
    let version = null;
    const h1Match = content.match(
      /^#\s+Milestone\s+v(\d+\.\d+):?\s*(.+?)$/m,
    );
    if (h1Match) {
      version = `v${h1Match[1]}`;
      title = h1Match[2].trim();
    }

    // Extract overall status
    const statusMatch = content.match(/^\*\*Status:\*\*\s*([^\n]+)/m);
    const status = statusMatch ? statusMatch[1].trim() : null;

    // Extract total plans count
    const plansMatch = content.match(/\*\*Total Plans:\*\*\s*(\d+)/);
    const totalPlans = plansMatch ? parseInt(plansMatch[1], 10) : 0;

    // Parse phases
    const phases = [];
    const phasePattern = /###\s+Phase\s+(\d+(?:\.\d+)?):?\s+(.+?)(?:\n|$)/g;
    let match;

    while ((match = phasePattern.exec(content)) !== null) {
      const phaseNumber = match[1];
      const phaseName = match[2].trim();

      // Get content until next phase header or end
      const nextPhaseIndex = content.indexOf("### Phase", match.index + 1);
      const phaseContent =
        nextPhaseIndex !== -1
          ? content.slice(match.index, nextPhaseIndex)
          : content.slice(match.index);

      // Extract goal
      const goalMatch = phaseContent.match(/\*\*Goal\*?\*?:?\s*([^\n]+)/);
      const goal = goalMatch ? goalMatch[1].trim() : null;

      // Extract depends on
      const dependsMatch = phaseContent.match(
        /\*\*Depends on\*?\*?:?\s*([^\n]+)/,
      );
      const dependsOn = dependsMatch ? dependsMatch[1].trim() : null;

      // Extract phase status - try multiple patterns
      let phaseStatus = "not-started";

      // Pattern 1: **Status:** Complete/In progress/Not started
      const phaseStatusMatch = phaseContent.match(
        /\*\*Status:\*\*\s*(Complete|Not started|In progress|Pending)[^\n]*/i,
      );
      if (phaseStatusMatch) {
        phaseStatus = phaseStatusMatch[1].toLowerCase();
      } else {
        // Pattern 2: Check if all plan checkboxes are checked [x]
        // If there are plans and all are [x], phase is complete
        const planChecks = phaseContent.match(/- \[(x| )\]/g);
        if (planChecks && planChecks.length > 0) {
          const allComplete = planChecks.every((c) => c.includes("[x]"));
          const anyComplete = planChecks.some((c) => c.includes("[x]"));
          if (allComplete) {
            phaseStatus = "complete";
          } else if (anyComplete) {
            phaseStatus = "in-progress";
          }
        }
      }
      phaseStatus = phaseStatus.replace(/\s+/g, "-"); // "not started" -> "not-started"

      phases.push({
        number: phaseNumber,
        name: phaseName,
        goal,
        dependsOn,
        status: phaseStatus,
      });
    }

    return { title, version, status, totalPlans, phases };
  } catch (error) {
    if (error.code === "ENOENT") {
      core.info("ROADMAP.md not found");
      return { title: null, version: null, status: null, totalPlans: 0, phases: [] };
    }
    throw error;
  }
}

/**
 * Parse STATE.md to extract current project position
 * Format:
 *   ## Current Position
 *   Milestone: v{version} — {status}
 *   Phase: {phase info}
 *   Plan: {plan info}
 *   Status: {status}
 *
 * @param {string} [path=".planning/STATE.md"] - Path to STATE.md
 * @returns {Promise<{milestone: string, phase: string, plan: string, status: string, lastActivity: string} | null>}
 */
export async function parseState(path = ".planning/STATE.md") {
  try {
    const content = await fs.readFile(path, "utf-8");

    // Find Current Position section
    const positionMatch = content.match(
      /##\s+Current Position\s*\n+([\s\S]*?)(?=\n##|\n---|\n$)/,
    );
    if (!positionMatch) {
      core.warning("Could not find Current Position section in STATE.md");
      return null;
    }

    const positionContent = positionMatch[1];

    // Extract milestone
    const milestoneMatch = positionContent.match(/Milestone:\s*([^\n]+)/);
    const milestone = milestoneMatch ? milestoneMatch[1].trim() : null;

    // Extract phase
    const phaseMatch = positionContent.match(/Phase:\s*([^\n]+)/);
    const phase = phaseMatch ? phaseMatch[1].trim() : null;

    // Extract plan
    const planMatch = positionContent.match(/Plan:\s*([^\n]+)/);
    const plan = planMatch ? planMatch[1].trim() : null;

    // Extract status
    const statusMatch = positionContent.match(/Status:\s*([^\n]+)/);
    const status = statusMatch ? statusMatch[1].trim() : null;

    // Extract last activity
    const activityMatch = positionContent.match(/Last activity:\s*([^\n]+)/);
    const lastActivity = activityMatch ? activityMatch[1].trim() : null;

    return {
      milestone,
      phase,
      plan,
      status,
      lastActivity,
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      core.info("STATE.md not found");
      return null;
    }
    throw error;
  }
}

/**
 * Parse a PLAN.md file to extract plan metadata and tasks
 * Format:
 *   ---
 *   phase: "07-phase-planning-command"
 *   plan: "01"
 *   type: "execute"
 *   wave: 1
 *   depends_on: []
 *   files_modified: [...]
 *   autonomous: true
 *   must_haves: {...}
 *   ---
 *   <objective>...</objective>
 *   <tasks>
 *     <task type="auto">
 *       <name>...</name>
 *       <files>...</files>
 *       <action>...</action>
 *       <verify>...</verify>
 *       <done>...</done>
 *     </task>
 *   </tasks>
 *
 * @param {string} path - Path to PLAN.md file
 * @returns {Promise<{phase: string, plan: string, type: string, wave: number, autonomous: boolean, objective: string, tasks: Array} | null>}
 */
export async function parsePlan(path) {
  try {
    const content = await fs.readFile(path, "utf-8");

    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      core.warning(`No frontmatter found in ${path}`);
      return null;
    }

    const frontmatter = frontmatterMatch[1];

    // Parse frontmatter fields
    const phaseMatch = frontmatter.match(/phase:\s*["']?([^"'\n]+)["']?/);
    const planMatch = frontmatter.match(/plan:\s*["']?([^"'\n]+)["']?/);
    const typeMatch = frontmatter.match(/type:\s*["']?([^"'\n]+)["']?/);
    const waveMatch = frontmatter.match(/wave:\s*(\d+)/);
    const autonomousMatch = frontmatter.match(/autonomous:\s*(true|false)/);

    // Extract objective
    const objectiveMatch = content.match(
      /<objective>([\s\S]*?)<\/objective>/,
    );
    const objective = objectiveMatch ? objectiveMatch[1].trim() : null;

    // Extract tasks
    const tasks = [];
    const taskPattern = /<task[^>]*>([\s\S]*?)<\/task>/g;
    let taskMatch;

    while ((taskMatch = taskPattern.exec(content)) !== null) {
      const taskContent = taskMatch[1];

      const nameMatch = taskContent.match(/<name>([\s\S]*?)<\/name>/);
      const filesMatch = taskContent.match(/<files>([\s\S]*?)<\/files>/);
      const actionMatch = taskContent.match(/<action>([\s\S]*?)<\/action>/);
      const verifyMatch = taskContent.match(/<verify>([\s\S]*?)<\/verify>/);
      const doneMatch = taskContent.match(/<done>([\s\S]*?)<\/done>/);

      // Extract task type attribute
      const typeAttrMatch = taskMatch[0].match(/<task[^>]*type=["']([^"']+)["']/);

      tasks.push({
        type: typeAttrMatch ? typeAttrMatch[1] : "auto",
        name: nameMatch ? nameMatch[1].trim() : null,
        files: filesMatch ? filesMatch[1].trim() : null,
        action: actionMatch ? actionMatch[1].trim() : null,
        verify: verifyMatch ? verifyMatch[1].trim() : null,
        done: doneMatch ? doneMatch[1].trim() : null,
      });
    }

    return {
      phase: phaseMatch ? phaseMatch[1] : null,
      plan: planMatch ? planMatch[1] : null,
      type: typeMatch ? typeMatch[1] : null,
      wave: waveMatch ? parseInt(waveMatch[1], 10) : 1,
      autonomous: autonomousMatch ? autonomousMatch[1] === "true" : true,
      objective,
      tasks,
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      core.info(`Plan file not found: ${path}`);
      return null;
    }
    throw error;
  }
}

/**
 * Parse REQUIREMENTS.md and ROADMAP.md to return combined milestone metadata
 * Used by label-trigger workflow to update issue with milestone info
 *
 * @returns {Promise<{title: string, version: string, coreValue: string, status: string, phases: Array}>}
 */
export async function parseMilestoneMetadata() {
  const [requirements, roadmap] = await Promise.all([
    parseRequirements(),
    parseRoadmap(),
  ]);

  // Use requirements data primarily, fall back to roadmap for title/version
  return {
    title: requirements?.title || roadmap?.title || "Untitled Milestone",
    version: requirements?.version || roadmap?.version || "v0.0",
    coreValue: requirements?.coreValue || null,
    status: requirements?.status || roadmap?.status || null,
    phases: roadmap?.phases || [],
  };
}
