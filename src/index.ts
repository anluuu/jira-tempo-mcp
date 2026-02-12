#!/usr/bin/env node

/**
 * JIRA + Tempo MCP Server
 *
 * Provides tools for automating JIRA issue management and Tempo time logging.
 * Supports multiple JIRA instances, resolved by the current working directory.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { JiraClient } from "./jira-client.js";
import { TempoClient } from "./tempo-client.js";
import { resolveInstance, listInstances, getAllInstances } from "./config.js";
import {
  getIssueKeyFromBranch,
  getCurrentBranch,
  getCommitsOnBranch,
  getPrUrl,
  createBranch,
  getDiffSummary,
} from "./git-utils.js";

const server = new McpServer({
  name: "jira-tempo",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Helper: resolve clients from cwd
// ---------------------------------------------------------------------------

function getClients(cwd: string) {
  const config = resolveInstance(cwd);
  return {
    jira: new JiraClient(config.instance.jira),
    tempo: new TempoClient(config.instance.tempo),
    instanceName: config.instance.name,
    baseBranch: config.baseBranch,
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Tool: jira_get_issue
// ---------------------------------------------------------------------------

server.registerTool(
  "jira_get_issue",
  {
    title: "Get JIRA Issue",
    description:
      "Fetch details of a JIRA issue (summary, status, assignee, type, priority, description). " +
      "Automatically detects the JIRA instance from the working directory.",
    inputSchema: {
      issueKey: z
        .string()
        .describe("JIRA issue key, e.g. MRP-404. If omitted, extracted from the current git branch.")
        .optional(),
      cwd: z
        .string()
        .describe("Working directory of the repo (used to detect the JIRA instance)")
        .optional(),
    },
  },
  async ({ issueKey, cwd: cwdArg }) => {
    const cwd = cwdArg ?? process.cwd();
    const key = issueKey ?? getIssueKeyFromBranch(cwd);
    if (!key) {
      return { content: [{ type: "text", text: "Could not determine issue key. Provide it explicitly or ensure you are on a branch named with an issue key." }] };
    }
    const { jira, instanceName } = getClients(cwd);
    const issue = await jira.getIssue(key);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ ...issue, instance: instanceName }, null, 2),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: jira_get_transitions
// ---------------------------------------------------------------------------

server.registerTool(
  "jira_get_transitions",
  {
    title: "Get Available Transitions",
    description: "List the available status transitions for a JIRA issue.",
    inputSchema: {
      issueKey: z.string().describe("JIRA issue key"),
      cwd: z.string().optional(),
    },
  },
  async ({ issueKey, cwd: cwdArg }) => {
    const cwd = cwdArg ?? process.cwd();
    const { jira } = getClients(cwd);
    const transitions = await jira.getTransitions(issueKey);
    return {
      content: [{ type: "text", text: JSON.stringify(transitions, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: jira_transition_issue
// ---------------------------------------------------------------------------

server.registerTool(
  "jira_transition_issue",
  {
    title: "Transition JIRA Issue",
    description:
      "Move a JIRA issue to a new status. Use jira_get_transitions first to get valid transition IDs.",
    inputSchema: {
      issueKey: z.string().describe("JIRA issue key"),
      transitionId: z.string().describe("Transition ID (from jira_get_transitions)"),
      cwd: z.string().optional(),
    },
  },
  async ({ issueKey, transitionId, cwd: cwdArg }) => {
    const cwd = cwdArg ?? process.cwd();
    const { jira } = getClients(cwd);
    await jira.transitionIssue(issueKey, transitionId);
    return {
      content: [{ type: "text", text: `Issue ${issueKey} transitioned successfully.` }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: jira_add_comment
// ---------------------------------------------------------------------------

server.registerTool(
  "jira_add_comment",
  {
    title: "Add JIRA Comment",
    description: "Add a comment to a JIRA issue. Supports markdown formatting (headings, bold, italic, lists, tables, code blocks).",
    inputSchema: {
      issueKey: z.string().describe("JIRA issue key"),
      comment: z.string().describe("Comment text (supports markdown)"),
      cwd: z.string().optional(),
    },
  },
  async ({ issueKey, comment, cwd: cwdArg }) => {
    const cwd = cwdArg ?? process.cwd();
    const { jira } = getClients(cwd);
    await jira.addComment(issueKey, comment);
    return {
      content: [{ type: "text", text: `Comment added to ${issueKey}.` }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: jira_assign_to_me
// ---------------------------------------------------------------------------

server.registerTool(
  "jira_assign_to_me",
  {
    title: "Assign JIRA Issue To Me",
    description: "Assign a JIRA issue to the authenticated user.",
    inputSchema: {
      issueKey: z.string().describe("JIRA issue key"),
      cwd: z.string().optional(),
    },
  },
  async ({ issueKey, cwd: cwdArg }) => {
    const cwd = cwdArg ?? process.cwd();
    const { jira } = getClients(cwd);
    const me = await jira.getMyself();
    await jira.assignIssue(issueKey, me.accountId);
    return {
      content: [
        { type: "text", text: `Assigned ${issueKey} to ${me.displayName} (${me.accountId}).` },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: tempo_log_time
// ---------------------------------------------------------------------------

server.registerTool(
  "tempo_log_time",
  {
    title: "Log Time in Tempo",
    description:
      "Log worked time on a JIRA issue via Tempo. Time is specified in hours (supports decimals like 1.5).",
    inputSchema: {
      issueKey: z.string().describe("JIRA issue key"),
      hours: z.number().positive().describe("Hours to log (e.g. 2, 1.5, 0.5)"),
      description: z.string().describe("Description of the work done").default(""),
      date: z
        .string()
        .describe("Date for the worklog in YYYY-MM-DD format. Defaults to today.")
        .optional(),
      cwd: z.string().optional(),
    },
  },
  async ({ issueKey, hours, description, date, cwd: cwdArg }) => {
    const cwd = cwdArg ?? process.cwd();
    const { jira, tempo } = getClients(cwd);
    const targetDate = date ?? today();

    // Fetch user info, issue ID, and existing worklogs in parallel
    const [me, issueId] = await Promise.all([
      jira.getMyself(),
      jira.getIssueId(issueKey),
    ]);

    // Get existing worklogs for the date to calculate next start time
    const existingWorklogs = await tempo.getWorklogsForDate(me.accountId, targetDate);
    const startTime = TempoClient.calculateNextStartTime(existingWorklogs.entries);

    const worklog = await tempo.logTime({
      issueId,
      timeSpentSeconds: Math.round(hours * 3600),
      description,
      startDate: targetDate,
      startTime,
      authorAccountId: me.accountId,
    });
    const loggedHours = (worklog.timeSpentSeconds / 3600).toFixed(2);
    return {
      content: [
        {
          type: "text",
          text: `Logged ${loggedHours}h on ${issueKey} (${worklog.startDate} at ${startTime}). Tempo worklog ID: ${worklog.tempoWorklogId}`,
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: tempo_get_today_worklogs
// ---------------------------------------------------------------------------

server.registerTool(
  "tempo_get_today_worklogs",
  {
    title: "Get Today's Worklogs",
    description:
      "Get all time logged today via Tempo. Shows total hours and remaining to reach 8h. " +
      "Useful for the 'smart distribute' workflow.",
    inputSchema: {
      date: z
        .string()
        .describe("Date in YYYY-MM-DD format. Defaults to today.")
        .optional(),
      cwd: z.string().optional(),
    },
  },
  async ({ date, cwd: cwdArg }) => {
    const cwd = cwdArg ?? process.cwd();
    const { jira, tempo } = getClients(cwd);
    const me = await jira.getMyself();
    const targetDate = date ?? today();
    const worklogs = await tempo.getWorklogsForDate(me.accountId, targetDate);
    const totalHours = worklogs.totalSeconds / 3600;
    const remaining = Math.max(0, 8 - totalHours);

    const summary = {
      date: targetDate,
      totalHoursLogged: Number(totalHours.toFixed(2)),
      remainingToReach8h: Number(remaining.toFixed(2)),
      entries: worklogs.entries.map((e) => ({
        issue: e.issueKey,
        hours: Number((e.timeSpentSeconds / 3600).toFixed(2)),
        description: e.description,
      })),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: git_branch_info
// ---------------------------------------------------------------------------

server.registerTool(
  "git_branch_info",
  {
    title: "Get Git Branch Info",
    description:
      "Get current branch name, detected JIRA issue key, commits on branch (vs base), " +
      "diff summary, and PR URL if available.",
    inputSchema: {
      baseBranch: z
        .string()
        .describe("Base branch to compare against (default: main)")
        .optional(),
      cwd: z.string().describe("Working directory of the repo").optional(),
    },
  },
  async ({ baseBranch, cwd: cwdArg }) => {
    const cwd = cwdArg ?? process.cwd();
    const { baseBranch: defaultBase } = resolveInstance(cwd);
    const base = baseBranch ?? defaultBase;

    const branch = getCurrentBranch(cwd);
    const issueKey = getIssueKeyFromBranch(cwd);
    const commits = getCommitsOnBranch(base, cwd);
    const prUrl = getPrUrl(cwd);
    const diffSummary = getDiffSummary(base, cwd);

    const info = {
      branch,
      issueKey,
      baseBranch: base,
      prUrl,
      commitCount: commits.length,
      commits: commits.map((c) => ({
        hash: c.hash.substring(0, 8),
        message: c.message,
        date: c.date,
        author: c.author,
      })),
      diffSummary,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: git_create_branch
// ---------------------------------------------------------------------------

server.registerTool(
  "git_create_branch",
  {
    title: "Create Git Branch",
    description:
      "Create a new git branch from the base branch. Pulls latest changes first. " +
      "Typically used with a JIRA issue key as part of the branch name.",
    inputSchema: {
      branchName: z.string().describe("Name for the new branch (e.g. MRP-404-implement-feature)"),
      baseBranch: z.string().describe("Base branch to branch from").optional(),
      cwd: z.string().optional(),
    },
  },
  async ({ branchName, baseBranch, cwd: cwdArg }) => {
    const cwd = cwdArg ?? process.cwd();
    const { baseBranch: defaultBase } = resolveInstance(cwd);
    const base = baseBranch ?? defaultBase;

    try {
      createBranch(branchName, base, cwd);
      return {
        content: [
          { type: "text", text: `Branch '${branchName}' created from '${base}' and checked out.` },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Failed to create branch: ${err.message}` }],
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: detect_instance
// ---------------------------------------------------------------------------

server.registerTool(
  "detect_instance",
  {
    title: "Detect JIRA Instance",
    description:
      "Show which JIRA/Tempo instance is resolved for the given working directory. " +
      "Also lists all configured instances.",
    inputSchema: {
      cwd: z.string().describe("Working directory to check").optional(),
    },
  },
  async ({ cwd: cwdArg }) => {
    const cwd = cwdArg ?? process.cwd();
    const resolved = resolveInstance(cwd);
    const allInstances = listInstances();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              cwd,
              resolvedInstance: resolved.instance.name,
              jiraUrl: resolved.instance.jira.baseUrl,
              baseBranch: resolved.baseBranch,
              allConfiguredInstances: allInstances,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: jira_search_issues
// ---------------------------------------------------------------------------

server.registerTool(
  "jira_search_issues",
  {
    title: "Search JIRA Issues",
    description:
      "Search for JIRA issues using JQL or simple filters. " +
      "Returns a list of matching issues with key, summary, status, assignee, and priority.",
    inputSchema: {
      jql: z.string().describe("Raw JQL query (e.g. 'project = MRP AND status = \"In Progress\"')").optional(),
      project: z.string().describe("Filter by project key (e.g. 'MRP')").optional(),
      status: z.string().describe("Filter by status (e.g. 'In Progress', 'Open')").optional(),
      assignee: z.string().describe("Filter by assignee ('currentUser' for yourself, or account ID)").optional(),
      maxResults: z.number().describe("Maximum results to return (default: 20)").optional(),
      cwd: z.string().optional(),
    },
  },
  async ({ jql, project, status, assignee, maxResults, cwd: cwdArg }) => {
    const cwd = cwdArg ?? process.cwd();
    const { jira, instanceName } = getClients(cwd);

    // Build JQL from filters if no raw JQL provided
    let query = jql;
    if (!query) {
      const conditions: string[] = [];
      if (project) conditions.push(`project = "${project}"`);
      if (status) conditions.push(`status = "${status}"`);
      if (assignee === "currentUser") {
        conditions.push("assignee = currentUser()");
      } else if (assignee) {
        conditions.push(`assignee = "${assignee}"`);
      }
      query = conditions.length > 0 ? conditions.join(" AND ") : "ORDER BY updated DESC";
    }

    const result = await jira.searchIssues(query, maxResults ?? 20);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ instance: instanceName, total: result.total, issues: result.issues }, null, 2),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: jira_my_issues
// ---------------------------------------------------------------------------

// Statuses that indicate an issue is resolved/closed
const RESOLVED_STATUSES = [
  "resolved", "resolvido", "closed", "fechada", "fechado",
  "done", "pronto", "concluído", "concluido", "complete", "completed"
];

function isResolvedStatus(status: string): boolean {
  return RESOLVED_STATUSES.some(s => status.toLowerCase().includes(s));
}

server.registerTool(
  "jira_my_issues",
  {
    title: "Get My Issues (All Instances)",
    description:
      "Get all JIRA issues assigned to you across ALL configured JIRA instances (mmw, pares, lagoasoft). " +
      "Useful for seeing your full workload at a glance. By default excludes resolved/closed issues.",
    inputSchema: {
      status: z.string().describe("Filter by status (optional)").optional(),
      includeResolved: z.boolean().describe("Include resolved/closed issues (default: false)").optional(),
      maxResults: z.number().describe("Max results per instance (default: 20)").optional(),
    },
  },
  async ({ status, includeResolved, maxResults }) => {
    const instances = getAllInstances();
    const limit = maxResults ?? 20;
    const showResolved = includeResolved ?? false;

    const results: Record<string, any> = {};

    // Query all instances in parallel
    const queries = instances.map(async (inst) => {
      const jira = new JiraClient(inst.jira);
      let jql = "assignee = currentUser()";
      if (status) {
        jql += ` AND status = "${status}"`;
      }
      jql += " ORDER BY updated DESC";

      try {
        const result = await jira.searchIssues(jql, limit);
        return { name: inst.name, result };
      } catch (err: any) {
        return { name: inst.name, error: err.message };
      }
    });

    const responses = await Promise.all(queries);

    let totalIssues = 0;
    for (const resp of responses) {
      if ("error" in resp) {
        results[resp.name] = { error: resp.error };
      } else {
        // Filter out resolved issues unless explicitly requested
        const filteredIssues = showResolved
          ? resp.result.issues
          : resp.result.issues.filter((issue: any) => !isResolvedStatus(issue.status));

        results[resp.name] = {
          issues: filteredIssues,
        };
        totalIssues += filteredIssues.length;
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ totalAcrossAllInstances: totalIssues, byInstance: results }, null, 2),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: jira_create_issue
// ---------------------------------------------------------------------------

server.registerTool(
  "jira_create_issue",
  {
    title: "Create JIRA Issue",
    description: "Create a new JIRA issue in the specified project.",
    inputSchema: {
      project: z.string().describe("Project key (e.g. 'MRP')"),
      summary: z.string().describe("Issue title/summary"),
      issueType: z.string().describe("Issue type (e.g. 'Task', 'Bug', 'Story')"),
      description: z.string().describe("Issue description (supports markdown formatting)").optional(),
      priority: z.string().describe("Priority (e.g. 'High', 'Medium', 'Low')").optional(),
      assignToMe: z.boolean().describe("Assign the issue to yourself").optional(),
      cwd: z.string().optional(),
    },
  },
  async ({ project, summary, issueType, description, priority, assignToMe, cwd: cwdArg }) => {
    const cwd = cwdArg ?? process.cwd();
    const { jira, instanceName } = getClients(cwd);

    let assigneeAccountId: string | undefined;
    if (assignToMe) {
      const me = await jira.getMyself();
      assigneeAccountId = me.accountId;
    }

    const created = await jira.createIssue({
      project,
      summary,
      issueType,
      description,
      priority,
      assigneeAccountId,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              instance: instanceName,
              key: created.key,
              url: created.url,
              message: `Issue ${created.key} created successfully.`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: jira_get_sprint
// ---------------------------------------------------------------------------

server.registerTool(
  "jira_get_sprint",
  {
    title: "Get Current Sprint",
    description:
      "Get the current active sprint for a project board, including all issues and progress stats.",
    inputSchema: {
      project: z.string().describe("Project key to find board for (e.g. 'MRP')").optional(),
      boardId: z.number().describe("Board ID (if known, skips board lookup)").optional(),
      cwd: z.string().optional(),
    },
  },
  async ({ project, boardId, cwd: cwdArg }) => {
    const cwd = cwdArg ?? process.cwd();
    const { jira, instanceName } = getClients(cwd);

    // Get board ID if not provided
    let targetBoardId = boardId;
    if (!targetBoardId) {
      if (!project) {
        return {
          content: [{ type: "text", text: "Please provide either a project key or board ID." }],
        };
      }
      const boards = await jira.getBoards(project);
      if (boards.length === 0) {
        return {
          content: [{ type: "text", text: `No boards found for project ${project}.` }],
        };
      }
      targetBoardId = boards[0].id;
    }

    // Get active sprint
    const sprint = await jira.getActiveSprint(targetBoardId);
    if (!sprint) {
      return {
        content: [{ type: "text", text: "No active sprint found." }],
      };
    }

    // Get sprint issues
    const issues = await jira.getSprintIssues(sprint.id);

    // Group by status
    const byStatus: Record<string, typeof issues> = {};
    for (const issue of issues) {
      if (!byStatus[issue.status]) {
        byStatus[issue.status] = [];
      }
      byStatus[issue.status].push(issue);
    }

    const result = {
      instance: instanceName,
      sprint: {
        name: sprint.name,
        state: sprint.state,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        goal: sprint.goal,
      },
      totalIssues: issues.length,
      byStatus,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: jira_get_epic
// ---------------------------------------------------------------------------

server.registerTool(
  "jira_get_epic",
  {
    title: "Get Epic Details",
    description: "Get an epic's details and all its child issues, grouped by status with completion stats.",
    inputSchema: {
      epicKey: z.string().describe("Epic issue key (e.g. 'MRP-100')"),
      cwd: z.string().optional(),
    },
  },
  async ({ epicKey, cwd: cwdArg }) => {
    const cwd = cwdArg ?? process.cwd();
    const { jira, instanceName } = getClients(cwd);

    // Get epic details
    const epic = await jira.getIssue(epicKey);

    // Get child issues
    const children = await jira.getEpicChildren(epicKey);

    // Group by status
    const byStatus: Record<string, typeof children> = {};
    let doneCount = 0;
    for (const issue of children) {
      if (!byStatus[issue.status]) {
        byStatus[issue.status] = [];
      }
      byStatus[issue.status].push(issue);
      // Count "done" statuses (common variations)
      const statusLower = issue.status.toLowerCase();
      if (statusLower.includes("done") || statusLower.includes("closed") || statusLower.includes("resolved")) {
        doneCount++;
      }
    }

    const completionPercent = children.length > 0 ? Math.round((doneCount / children.length) * 100) : 0;

    const result = {
      instance: instanceName,
      epic: {
        key: epic.key,
        summary: epic.summary,
        status: epic.status,
        assignee: epic.assignee,
      },
      totalChildren: children.length,
      completedChildren: doneCount,
      completionPercent: `${completionPercent}%`,
      byStatus,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
