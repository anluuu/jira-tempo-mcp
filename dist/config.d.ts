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
/**
 * Resolve which instance to use based on the current working directory.
 * Falls back to the first configured instance if no path match is found.
 */
export declare function resolveInstance(cwd: string): ResolvedConfig;
/**
 * List all configured instances (for diagnostics).
 */
export declare function listInstances(): Array<{
    name: string;
    jiraUrl: string;
    patterns: string[];
}>;
/**
 * Get all configured instances (for cross-instance queries).
 */
export declare function getAllInstances(): InstanceConfig[];
/**
 * Get config file paths (for diagnostics).
 */
export declare function getConfigPaths(): string[];
