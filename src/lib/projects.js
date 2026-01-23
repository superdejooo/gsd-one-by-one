/**
 * GitHub Projects v2 GraphQL Queries Module
 *
 * Read-only queries for GitHub Projects v2 API.
 * IMPORTANT: No mutations - iteration creation causes data loss.
 * See 08.1-RESEARCH.md for details on API limitations.
 */

import * as core from "@actions/core";
import { octokit } from "./github.js";

/**
 * Get project by number
 *
 * @param {string} owner - Organization or user login
 * @param {number} projectNumber - Project number from URL
 * @param {boolean} isOrg - True for organization projects, false for user projects
 * @returns {Promise<{id: string, title: string, url: string}|null>} Project details or null if not found
 */
export async function getProject(owner, projectNumber, isOrg = true) {
  try {
    const query = isOrg
      ? `
        query($owner: String!, $number: Int!) {
          organization(login: $owner) {
            projectV2(number: $number) {
              id
              title
              url
            }
          }
        }
      `
      : `
        query($owner: String!, $number: Int!) {
          user(login: $owner) {
            projectV2(number: $number) {
              id
              title
              url
            }
          }
        }
      `;

    const result = await octokit.graphql(query, {
      owner,
      number: projectNumber,
    });

    const project = isOrg
      ? result.organization?.projectV2
      : result.user?.projectV2;

    if (!project) {
      core.warning(`Project #${projectNumber} not found for ${owner}`);
      return null;
    }

    core.info(`Found project: ${project.title} (${project.url})`);
    return project;
  } catch (error) {
    if (error.status === 404 || error.status === 403) {
      core.warning(
        `Project #${projectNumber} not found or no permission. Error: ${error.message}`,
      );
      return null;
    }
    core.error(`GraphQL error fetching project: ${error.message}`);
    return null;
  }
}

/**
 * Get iterations for a project
 *
 * @param {string} projectId - Project node ID
 * @returns {Promise<Array<{id: string, title: string, startDate: string}>>} Array of iterations or empty array
 */
export async function getIterations(projectId) {
  try {
    const query = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 20) {
              nodes {
                ... on ProjectV2IterationField {
                  id
                  name
                  configuration {
                    iterations {
                      id
                      title
                      startDate
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result = await octokit.graphql(query, { projectId });

    const fields = result.node?.fields?.nodes || [];
    const iterationField = fields.find((f) => f.configuration?.iterations);

    if (!iterationField) {
      core.warning("No iteration field found in project");
      return [];
    }

    const iterations = iterationField.configuration.iterations || [];
    core.info(`Found ${iterations.length} iterations in project`);

    return iterations;
  } catch (error) {
    core.error(`GraphQL error fetching iterations: ${error.message}`);
    return [];
  }
}

/**
 * Find iteration by title
 *
 * @param {string} owner - Organization or user login
 * @param {number} projectNumber - Project number from URL
 * @param {string} iterationTitle - Iteration title to find (case-insensitive)
 * @param {boolean} isOrg - True for organization projects, false for user projects
 * @returns {Promise<{id: string, title: string, startDate: string}|null>} Iteration if found, null otherwise
 */
export async function findIteration(
  owner,
  projectNumber,
  iterationTitle,
  isOrg = true,
) {
  // Get project
  const project = await getProject(owner, projectNumber, isOrg);
  if (!project) {
    return null;
  }

  // Get iterations
  const iterations = await getIterations(project.id);
  if (iterations.length === 0) {
    return null;
  }

  // Find by title (case-insensitive)
  const iteration = iterations.find(
    (i) => i.title.toLowerCase() === iterationTitle.toLowerCase(),
  );

  if (iteration) {
    core.info(`Found iteration: ${iteration.title}`);
  } else {
    core.warning(
      `Iteration "${iterationTitle}" not found in project #${projectNumber}`,
    );
  }

  return iteration || null;
}
