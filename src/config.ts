/**
 * Multi-instance configuration for JIRA + Tempo.
 *
 * Resolves which JIRA/Tempo instance to use based on the current
 * working directory (cwd). Maps folder paths to instance configs.
 *
 * Configuration priority:
 *   1. Config file: ~/.config/jira-tempo-mcp/config.json
 *   2. Config file: ~/.jira-tempo-mcp.json
 *   3. Environment variables (legacy)
 */

import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
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

/** Config file format */
interface ConfigFile {
  email: string;
  baseBranch?: string;
  instances: Array<{
    name: string;
    baseUrl: string;
    jiraToken: string;
    tempoToken: string;
    pathPatterns: string[];
  }>;
}

let cachedConfig: { instances: InstanceConfig[]; baseBranch: string } | null = null;

function getEnvOrNull(key: string): string | null {
  return process.env[key] ?? null;
}

/**
 * Try to load config from file
 */
function loadConfigFile(): ConfigFile | null {
  const configPaths = [
    join(homedir(), ".config", "jira-tempo-mcp", "config.json"),
    join(homedir(), ".jira-tempo-mcp.json"),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, "utf-8");
        return JSON.parse(content) as ConfigFile;
      } catch (err) {
        console.error(`Failed to parse config file ${configPath}:`, err);
      }
    }
  }

  return null;
}

/**
 * Build instances from config file
 */
function buildInstancesFromFile(config: ConfigFile): InstanceConfig[] {
  return config.instances.map((inst) => ({
    name: inst.name,
    jira: {
      baseUrl: inst.baseUrl,
      email: config.email,
      apiToken: inst.jiraToken,
    },
    tempo: {
      apiToken: inst.tempoToken,
    },
    pathPatterns: inst.pathPatterns,
  }));
}

/**
 * Build instances from environment variables (legacy)
 */
function buildInstancesFromEnv(): InstanceConfig[] {
  const email = process.env.JIRA_EMAIL;
  if (!email) return [];

  const instances: InstanceConfig[] = [];

  // Markenmehrwert (MMW)
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

  // Lagoasoft
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
 * Build all instance configs (cached)
 */
function buildInstances(): { instances: InstanceConfig[]; baseBranch: string } {
  if (cachedConfig) return cachedConfig;

  // Try config file first
  const configFile = loadConfigFile();
  if (configFile) {
    cachedConfig = {
      instances: buildInstancesFromFile(configFile),
      baseBranch: configFile.baseBranch ?? "main",
    };
    return cachedConfig;
  }

  // Fall back to environment variables
  cachedConfig = {
    instances: buildInstancesFromEnv(),
    baseBranch: process.env.DEFAULT_BASE_BRANCH ?? "main",
  };
  return cachedConfig;
}

/**
 * Resolve which instance to use based on the current working directory.
 * Falls back to the first configured instance if no path match is found.
 */
export function resolveInstance(cwd: string): ResolvedConfig {
  const config = buildInstances();

  if (config.instances.length === 0) {
    throw new Error(
      "No JIRA/Tempo instances configured. Create ~/.config/jira-tempo-mcp/config.json or set environment variables."
    );
  }

  const normalizedCwd = cwd.toLowerCase();

  for (const inst of config.instances) {
    for (const pattern of inst.pathPatterns) {
      if (normalizedCwd.includes(pattern)) {
        return {
          instance: inst,
          baseBranch: config.baseBranch,
        };
      }
    }
  }

  // Fallback: return first instance
  return {
    instance: config.instances[0],
    baseBranch: config.baseBranch,
  };
}

/**
 * List all configured instances (for diagnostics).
 */
export function listInstances(): Array<{ name: string; jiraUrl: string; patterns: string[] }> {
  const config = buildInstances();
  return config.instances.map((i) => ({
    name: i.name,
    jiraUrl: i.jira.baseUrl,
    patterns: i.pathPatterns,
  }));
}

/**
 * Get all configured instances (for cross-instance queries).
 */
export function getAllInstances(): InstanceConfig[] {
  return buildInstances().instances;
}

/**
 * Get config file paths (for diagnostics).
 */
export function getConfigPaths(): string[] {
  return [
    join(homedir(), ".config", "jira-tempo-mcp", "config.json"),
    join(homedir(), ".jira-tempo-mcp.json"),
  ];
}
