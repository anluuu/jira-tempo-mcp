/**
 * Tempo REST API v4 client.
 * Docs: https://apidocs.tempo.io/
 */
export class TempoClient {
    config;
    baseUrl = "https://api.tempo.io/4";
    authHeader;
    constructor(config) {
        this.config = config;
        this.authHeader = `Bearer ${config.apiToken}`;
    }
    async request(path, options = {}) {
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
            throw new Error(`Tempo API error ${res.status}: ${body}`);
        }
        if (res.status === 204)
            return null;
        return res.json();
    }
    /**
     * Log time on an issue.
     */
    async logTime(worklog) {
        const data = await this.request("/worklogs", {
            method: "POST",
            body: JSON.stringify({
                issueId: worklog.issueId,
                timeSpentSeconds: worklog.timeSpentSeconds,
                startDate: worklog.startDate,
                startTime: worklog.startTime ?? "09:00:00",
                description: worklog.description,
                authorAccountId: worklog.authorAccountId,
            }),
        });
        return {
            tempoWorklogId: data.tempoWorklogId,
            issueKey: data.issue?.key ?? "UNKNOWN",
            timeSpentSeconds: data.timeSpentSeconds,
            description: data.description,
            startDate: data.startDate,
            startTime: data.startTime ?? "09:00:00",
        };
    }
    /**
     * Get worklogs for a specific user on a specific date.
     */
    async getWorklogsForDate(accountId, date) {
        const data = await this.request(`/worklogs/user/${accountId}?from=${date}&to=${date}`);
        const entries = (data.results ?? []).map((w) => ({
            tempoWorklogId: w.tempoWorklogId,
            issueKey: w.issue?.key ?? "UNKNOWN",
            timeSpentSeconds: w.timeSpentSeconds,
            description: w.description ?? "",
            startDate: w.startDate,
            startTime: w.startTime ?? "09:00:00",
        }));
        const totalSeconds = entries.reduce((sum, e) => sum + e.timeSpentSeconds, 0);
        return { entries, totalSeconds };
    }
    /**
     * Delete a worklog by its Tempo ID.
     */
    async deleteWorklog(worklogId) {
        await this.request(`/worklogs/${worklogId}`, { method: "DELETE" });
    }
    /**
     * Calculate the next available start time based on existing worklogs.
     * Work day starts at 09:00 and ends at 17:00.
     */
    static calculateNextStartTime(entries, workdayStart = "09:00:00") {
        if (entries.length === 0) {
            return workdayStart;
        }
        // Find the latest end time among all entries
        let latestEndSeconds = 0;
        for (const entry of entries) {
            const [h, m, s] = entry.startTime.split(":").map(Number);
            const startSeconds = h * 3600 + m * 60 + s;
            const endSeconds = startSeconds + entry.timeSpentSeconds;
            if (endSeconds > latestEndSeconds) {
                latestEndSeconds = endSeconds;
            }
        }
        // Convert back to HH:MM:SS
        const hours = Math.floor(latestEndSeconds / 3600);
        const minutes = Math.floor((latestEndSeconds % 3600) / 60);
        const seconds = latestEndSeconds % 60;
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
}
