/**
 * Tempo REST API v4 client.
 * Docs: https://apidocs.tempo.io/
 */
export interface TempoConfig {
    apiToken: string;
}
export interface TempoWorklog {
    issueId: number;
    timeSpentSeconds: number;
    description: string;
    startDate: string;
    startTime?: string;
    authorAccountId: string;
}
export interface TempoWorklogEntry {
    tempoWorklogId: number;
    issueKey: string;
    timeSpentSeconds: number;
    description: string;
    startDate: string;
    startTime: string;
}
export declare class TempoClient {
    private config;
    private baseUrl;
    private authHeader;
    constructor(config: TempoConfig);
    private request;
    /**
     * Log time on an issue.
     */
    logTime(worklog: TempoWorklog): Promise<TempoWorklogEntry>;
    /**
     * Get worklogs for a specific user on a specific date.
     */
    getWorklogsForDate(accountId: string, date: string): Promise<{
        entries: TempoWorklogEntry[];
        totalSeconds: number;
    }>;
    /**
     * Delete a worklog by its Tempo ID.
     */
    deleteWorklog(worklogId: number): Promise<void>;
    /**
     * Calculate the next available start time based on existing worklogs.
     * Work day starts at 09:00 and ends at 17:00.
     */
    static calculateNextStartTime(entries: TempoWorklogEntry[], workdayStart?: string): string;
}
