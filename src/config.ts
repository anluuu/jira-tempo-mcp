/**
 * Multi-instance configuration for JIRA + Tempo.
 *
 * Resolves which JIRA/Tempo instance to use based on the current
 * working directory (cwd). Maps folder paths to instance configs.
 *
 * Environment variables:
 *   JIRA_EMAIL              - Your Atlassian email (shared across instances)
 *
 *   JIRA_TOKEN_LAGOASOFT    - JIRA API token for lagoasoft.atlassian.net
 *   JIRA_TOKEN_MMW          - JIRA API token for markenmehrwert.atlassian.net
 *   JIRA_TOKEN_PARES        - JIRA API token for pares-it.atlassian.net
 *
 *   TEMPO_TOKEN_LAGOASOFT   - Tempo API token for lagoasoft
 *   TEMPO_TOKEN_MMW         - Tempo API token for markenmehrwert
 *   TEMPO_TOKEN_PARES       - Tempo API token for pares-it
 *
 *   DEFAULT_BASE_BRANCH     - Default base branch (default: "main")
 */

import { JiraConfig } from "./jira-client.js";
import { TempoConfig } from "./tempo-client.js";

export interface InstanceConfig {
  name: string;
  jira: JiraConfig;
  tempo: TempoConfig;
  /** Folder path patterns that map to this instance */
  pathPatterns: string[];
}

export interface ResolvedConfig {
  instance: InstanceConfig;
  baseBranch: string;
}

function getEnvOrThrow(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

function getEnvOrNull(key: string): string | null {
  return process.env[key] ?? null;
}

/**
 * Build all instance configs from environment variables.
 */
function buildInstances(): InstanceConfig[] {
  const email = getEnvOrThrow("JIRA_EMAIL");

  const instances: InstanceConfig[] = [];

  // Markenmehrwert (MMW) - check first since patterns are more specific
  const mmwJiraToken = getEnvOrNull("JIRA_TOKEN_MMW");
  const mmwTempoToken = getEnvOrNull("TEMPO_TOKEN_MMW");
  if (mmwJiraToken && mmwTempoToken) {
    instances.push({
      name: "mmw",
      jira: { baseUrl: "markenmehrwert.atlassian.net", email, apiToken: mmwJiraToken },
      tempo: { apiToken: mmwTempoToken },
      pathPatterns: ["projects/mmw/", "projects/mmw-", "/markenmehrwert/"],
    });
  }

  // Pares
  const paresJiraToken = getEnvOrNull("JIRA_TOKEN_PARES");
  const paresTempoToken = getEnvOrNull("TEMPO_TOKEN_PARES");
  if (paresJiraToken && paresTempoToken) {
    instances.push({
      name: "pares",
      jira: { baseUrl: "pares-it.atlassian.net", email, apiToken: paresJiraToken },
      tempo: { apiToken: paresTempoToken },
      pathPatterns: ["projects/pares/", "projects/pares-"],
    });
  }

  // Lagoasoft - last because "lagoasoft" appears in home dir path
  const lagoasoftJiraToken = getEnvOrNull("JIRA_TOKEN_LAGOASOFT");
  const lagoasoftTempoToken = getEnvOrNull("TEMPO_TOKEN_LAGOASOFT");
  if (lagoasoftJiraToken && lagoasoftTempoToken) {
    instances.push({
      name: "lagoasoft",
      jira: { baseUrl: "lagoasoft.atlassian.net", email, apiToken: lagoasoftJiraToken },
      tempo: { apiToken: lagoasoftTempoToken },
      pathPatterns: ["projects/lagoasoft/", "projects/lagoasoft-"],
    });
  }

  return instances;
}

/**
 * Resolve which instance to use based on the current working directory.
 * Falls back to the first configured instance if no path match is found.
 */
export function resolveInstance(cwd: string): ResolvedConfig {
  const instances = buildInstances();

  if (instances.length === 0) {
    throw new Error(
      "No JIRA/Tempo instances configured. Set environment variables (see config.ts)."
    );
  }

  const normalizedCwd = cwd.toLowerCase();

  for (const inst of instances) {
    for (const pattern of inst.pathPatterns) {
      if (normalizedCwd.includes(pattern)) {
        return {
          instance: inst,
          baseBranch: process.env.DEFAULT_BASE_BRANCH ?? "main",
        };
      }
    }
  }

  // Fallback: return first instance with a warning
  return {
    instance: instances[0],
    baseBranch: process.env.DEFAULT_BASE_BRANCH ?? "main",
  };
}

/**
 * List all configured instances (for diagnostics).
 */
export function listInstances(): Array<{ name: string; jiraUrl: string; patterns: string[] }> {
  const instances = buildInstances();
  return instances.map((i) => ({
    name: i.name,
    jiraUrl: i.jira.baseUrl,
    patterns: i.pathPatterns,
  }));
}

/**
 * Get all configured instances (for cross-instance queries).
 */
export function getAllInstances(): InstanceConfig[] {
  return buildInstances();
}
