/**
 * JIRA Cloud REST API v3 client.
 * Docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
 */
export interface JiraConfig {
    baseUrl: string;
    email: string;
    apiToken: string;
}
export interface JiraIssue {
    id: number;
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
export interface JiraComment {
    id: string;
    author: string;
    body: string;
    created: string;
    updated: string;
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
export declare class JiraClient {
    private config;
    private baseUrl;
    private authHeader;
    constructor(config: JiraConfig);
    private request;
    getIssue(issueKey: string): Promise<JiraIssue>;
    getIssueId(issueKey: string): Promise<number>;
    getTransitions(issueKey: string): Promise<JiraTransition[]>;
    transitionIssue(issueKey: string, transitionId: string): Promise<void>;
    addComment(issueKey: string, commentBody: string): Promise<void>;
    getComments(issueKey: string): Promise<JiraComment[]>;
    assignIssue(issueKey: string, accountId: string): Promise<void>;
    getMyself(): Promise<{
        accountId: string;
        displayName: string;
        emailAddress: string;
    }>;
    /**
     * Extract plain text from Atlassian Document Format (ADF).
     */
    private extractTextFromAdf;
    /**
     * Make request to JIRA Agile API (different base path).
     */
    private agileRequest;
    /**
     * Search issues using JQL.
     * Uses the new /search/jql endpoint (the old /search was deprecated).
     */
    searchIssues(jql: string, maxResults?: number): Promise<JiraSearchResult>;
    /**
     * Create a new issue.
     */
    createIssue(params: CreateIssueParams): Promise<{
        id: number;
        key: string;
        url: string;
    }>;
    /**
     * Get boards for a project.
     */
    getBoards(projectKey?: string): Promise<JiraBoard[]>;
    /**
     * Get the active sprint for a board.
     */
    getActiveSprint(boardId: number): Promise<JiraSprint | null>;
    /**
     * Get issues in a sprint.
     */
    getSprintIssues(sprintId: number): Promise<JiraIssueListItem[]>;
    /**
     * Get child issues of an epic.
     */
    getEpicChildren(epicKey: string): Promise<JiraIssueListItem[]>;
}
