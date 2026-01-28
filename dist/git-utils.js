/**
 * Git utility functions for extracting branch info, commits, and PR URLs.
 */
import { execSync } from "node:child_process";
function run(cmd, cwd) {
    return execSync(cmd, {
        cwd,
        encoding: "utf-8",
        timeout: 10_000,
    }).trim();
}
/**
 * Extract JIRA issue key from the current branch name.
 * Matches patterns like: MRP-404, feature/MRP-404, MRP-404-some-description
 */
export function getIssueKeyFromBranch(cwd) {
    try {
        const branch = run("git rev-parse --abbrev-ref HEAD", cwd);
        const match = branch.match(/([A-Z][A-Z0-9]+-\d+)/);
        return match ? match[1] : null;
    }
    catch {
        return null;
    }
}
/**
 * Get current branch name.
 */
export function getCurrentBranch(cwd) {
    try {
        return run("git rev-parse --abbrev-ref HEAD", cwd);
    }
    catch {
        return null;
    }
}
/**
 * Get commits on current branch that are not on the base branch.
 */
export function getCommitsOnBranch(baseBranch = "main", cwd) {
    try {
        // Ensure we have the base branch ref
        const log = run(`git log ${baseBranch}..HEAD --format="%H||%s||%ai||%an" --no-merges`, cwd);
        if (!log)
            return [];
        return log.split("\n").map((line) => {
            const [hash, message, date, author] = line.split("||");
            return { hash, message, date, author };
        });
    }
    catch {
        return [];
    }
}
/**
 * Get the remote URL for the current repo to construct PR links.
 */
export function getRepoRemoteUrl(cwd) {
    try {
        const remote = run("git remote get-url origin", cwd);
        // Convert SSH to HTTPS if needed
        if (remote.startsWith("git@")) {
            // git@github.com:org/repo.git -> https://github.com/org/repo
            return remote
                .replace(/^git@/, "https://")
                .replace(/:/, "/")
                .replace(/\.git$/, "");
        }
        return remote.replace(/\.git$/, "");
    }
    catch {
        return null;
    }
}
/**
 * Try to get the PR URL for the current branch using gh CLI.
 */
export function getPrUrl(cwd) {
    try {
        return run("gh pr view --json url --jq .url", cwd);
    }
    catch {
        return null;
    }
}
/**
 * Create and checkout a new branch.
 */
export function createBranch(branchName, baseBranch = "main", cwd) {
    run(`git checkout ${baseBranch}`, cwd);
    run(`git pull origin ${baseBranch}`, cwd);
    run(`git checkout -b ${branchName}`, cwd);
}
/**
 * Get the diff summary (files changed) on current branch vs base.
 */
export function getDiffSummary(baseBranch = "main", cwd) {
    try {
        return run(`git diff --stat ${baseBranch}..HEAD`, cwd);
    }
    catch {
        return "";
    }
}
