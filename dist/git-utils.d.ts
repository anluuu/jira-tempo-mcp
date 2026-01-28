/**
 * Git utility functions for extracting branch info, commits, and PR URLs.
 */
/**
 * Extract JIRA issue key from the current branch name.
 * Matches patterns like: MRP-404, feature/MRP-404, MRP-404-some-description
 */
export declare function getIssueKeyFromBranch(cwd?: string): string | null;
/**
 * Get current branch name.
 */
export declare function getCurrentBranch(cwd?: string): string | null;
/**
 * Get commits on current branch that are not on the base branch.
 */
export declare function getCommitsOnBranch(baseBranch?: string, cwd?: string): Array<{
    hash: string;
    message: string;
    date: string;
    author: string;
}>;
/**
 * Get the remote URL for the current repo to construct PR links.
 */
export declare function getRepoRemoteUrl(cwd?: string): string | null;
/**
 * Try to get the PR URL for the current branch using gh CLI.
 */
export declare function getPrUrl(cwd?: string): string | null;
/**
 * Create and checkout a new branch.
 */
export declare function createBranch(branchName: string, baseBranch?: string, cwd?: string): void;
/**
 * Get the diff summary (files changed) on current branch vs base.
 */
export declare function getDiffSummary(baseBranch?: string, cwd?: string): string;
