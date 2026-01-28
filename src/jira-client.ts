/**
 * JIRA Cloud REST API v3 client.
 * Docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
 */

export interface JiraConfig {
  baseUrl: string; // e.g. "markenmehrwert.atlassian.net"
  email: string;
  apiToken: string;
}

export interface JiraIssue {
  id: number; // Numeric issue ID (needed for Tempo)
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
  issueType: string;
  priority: string;
  description: string | null;
}

export interface JiraTransition {
  id: string;
  name: string;
}

export interface JiraIssueListItem {
  id: number;
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
  issueType: string;
  priority: string;
}

export interface JiraSearchResult {
  total: number;
  issues: JiraIssueListItem[];
}

export interface CreateIssueParams {
  project: string;
  summary: string;
  issueType: string;
  description?: string;
  priority?: string;
  assigneeAccountId?: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
  startDate: string | null;
  endDate: string | null;
  goal: string | null;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
}

export class JiraClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(private config: JiraConfig) {
    this.baseUrl = `https://${config.baseUrl}/rest/api/3`;
    this.authHeader = `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString("base64")}`;
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`JIRA API error ${res.status}: ${body}`);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    const data = await this.request(`/issue/${issueKey}?fields=summary,status,assignee,issuetype,priority,description`);
    return {
      id: parseInt(data.id, 10),
      key: data.key,
      summary: data.fields.summary,
      status: data.fields.status?.name ?? "Unknown",
      assignee: data.fields.assignee?.displayName ?? null,
      issueType: data.fields.issuetype?.name ?? "Unknown",
      priority: data.fields.priority?.name ?? "Unknown",
      description: data.fields.description
        ? this.extractTextFromAdf(data.fields.description)
        : null,
    };
  }

  async getIssueId(issueKey: string): Promise<number> {
    const data = await this.request(`/issue/${issueKey}?fields=`);
    return parseInt(data.id, 10);
  }

  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    const data = await this.request(`/issue/${issueKey}/transitions`);
    return data.transitions.map((t: any) => ({
      id: t.id,
      name: t.name,
    }));
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await this.request(`/issue/${issueKey}/transitions`, {
      method: "POST",
      body: JSON.stringify({
        transition: { id: transitionId },
      }),
    });
  }

  async addComment(issueKey: string, commentBody: string): Promise<void> {
    await this.request(`/issue/${issueKey}/comment`, {
      method: "POST",
      body: JSON.stringify({
        body: {
          version: 1,
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: commentBody,
                },
              ],
            },
          ],
        },
      }),
    });
  }

  async assignIssue(issueKey: string, accountId: string): Promise<void> {
    await this.request(`/issue/${issueKey}/assignee`, {
      method: "PUT",
      body: JSON.stringify({ accountId }),
    });
  }

  async getMyself(): Promise<{ accountId: string; displayName: string; emailAddress: string }> {
    const data = await this.request("/myself");
    return {
      accountId: data.accountId,
      displayName: data.displayName,
      emailAddress: data.emailAddress,
    };
  }

  /**
   * Extract plain text from Atlassian Document Format (ADF).
   */
  private extractTextFromAdf(adf: any): string {
    if (!adf || !adf.content) return "";
    const texts: string[] = [];
    const walk = (node: any) => {
      if (node.type === "text" && node.text) {
        texts.push(node.text);
      }
      if (node.content) {
        for (const child of node.content) {
          walk(child);
        }
      }
    };
    walk(adf);
    return texts.join(" ");
  }

  /**
   * Make request to JIRA Agile API (different base path).
   */
  private async agileRequest(path: string, options: RequestInit = {}): Promise<any> {
    const url = `https://${this.config.baseUrl}/rest/agile/1.0${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`JIRA Agile API error ${res.status}: ${body}`);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  /**
   * Search issues using JQL.
   * Uses the new /search/jql endpoint (the old /search was deprecated).
   */
  async searchIssues(jql: string, maxResults: number = 20): Promise<JiraSearchResult> {
    const data = await this.request("/search/jql", {
      method: "POST",
      body: JSON.stringify({
        jql,
        maxResults,
        fields: ["summary", "status", "assignee", "issuetype", "priority"],
      }),
    });
    return {
      total: data.total,
      issues: data.issues.map((issue: any) => ({
        id: parseInt(issue.id, 10),
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name ?? "Unknown",
        assignee: issue.fields.assignee?.displayName ?? null,
        issueType: issue.fields.issuetype?.name ?? "Unknown",
        priority: issue.fields.priority?.name ?? "Unknown",
      })),
    };
  }

  /**
   * Create a new issue.
   */
  async createIssue(params: CreateIssueParams): Promise<{ id: number; key: string; url: string }> {
    const body: any = {
      fields: {
        project: { key: params.project },
        summary: params.summary,
        issuetype: { name: params.issueType },
      },
    };

    if (params.description) {
      body.fields.description = {
        version: 1,
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: params.description }],
          },
        ],
      };
    }

    if (params.priority) {
      body.fields.priority = { name: params.priority };
    }

    if (params.assigneeAccountId) {
      body.fields.assignee = { accountId: params.assigneeAccountId };
    }

    const data = await this.request("/issue", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      id: parseInt(data.id, 10),
      key: data.key,
      url: `https://${this.config.baseUrl}/browse/${data.key}`,
    };
  }

  /**
   * Get boards for a project.
   */
  async getBoards(projectKey?: string): Promise<JiraBoard[]> {
    const params = projectKey ? `?projectKeyOrId=${projectKey}` : "";
    const data = await this.agileRequest(`/board${params}`);
    return (data.values ?? []).map((b: any) => ({
      id: b.id,
      name: b.name,
      type: b.type,
    }));
  }

  /**
   * Get the active sprint for a board.
   */
  async getActiveSprint(boardId: number): Promise<JiraSprint | null> {
    const data = await this.agileRequest(`/board/${boardId}/sprint?state=active`);
    const sprints = data.values ?? [];
    if (sprints.length === 0) return null;
    const s = sprints[0];
    return {
      id: s.id,
      name: s.name,
      state: s.state,
      startDate: s.startDate ?? null,
      endDate: s.endDate ?? null,
      goal: s.goal ?? null,
    };
  }

  /**
   * Get issues in a sprint.
   */
  async getSprintIssues(sprintId: number): Promise<JiraIssueListItem[]> {
    const data = await this.agileRequest(`/sprint/${sprintId}/issue?fields=summary,status,assignee,issuetype,priority`);
    return (data.issues ?? []).map((issue: any) => ({
      id: parseInt(issue.id, 10),
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name ?? "Unknown",
      assignee: issue.fields.assignee?.displayName ?? null,
      issueType: issue.fields.issuetype?.name ?? "Unknown",
      priority: issue.fields.priority?.name ?? "Unknown",
    }));
  }

  /**
   * Get child issues of an epic.
   */
  async getEpicChildren(epicKey: string): Promise<JiraIssueListItem[]> {
    // First try using Agile API
    try {
      const data = await this.agileRequest(`/epic/${epicKey}/issue?fields=summary,status,assignee,issuetype,priority`);
      return (data.issues ?? []).map((issue: any) => ({
        id: parseInt(issue.id, 10),
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name ?? "Unknown",
        assignee: issue.fields.assignee?.displayName ?? null,
        issueType: issue.fields.issuetype?.name ?? "Unknown",
        priority: issue.fields.priority?.name ?? "Unknown",
      }));
    } catch {
      // Fallback: use JQL search with "Epic Link" field
      const result = await this.searchIssues(`"Epic Link" = ${epicKey}`, 100);
      return result.issues;
    }
  }
}
