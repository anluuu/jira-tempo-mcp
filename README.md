# jira-tempo-mcp

MCP (Model Context Protocol) server for JIRA + Tempo workflow automation with multi-instance support.

## Features

- **Multi-instance JIRA support** - Work across multiple JIRA instances based on your working directory
- **Tempo time logging** - Log time with smart sequential scheduling (no overlaps)
- **Git integration** - Create branches, get commit info, detect issue keys from branch names
- **Cross-instance queries** - See all your issues across all JIRA instances at once

## Installation

```bash
npx jira-tempo-mcp
```

Or install globally:

```bash
npm install -g jira-tempo-mcp
```

## Configuration

Add to your Claude Code config (`~/.claude.json`):

```json
{
  "mcpServers": {
    "jira-tempo": {
      "command": "npx",
      "args": ["-y", "jira-tempo-mcp"],
      "env": {
        "JIRA_INSTANCES": "[{\"name\":\"myinstance\",\"baseUrl\":\"https://myinstance.atlassian.net\",\"email\":\"you@email.com\",\"apiToken\":\"YOUR_JIRA_TOKEN\",\"tempoToken\":\"YOUR_TEMPO_TOKEN\",\"pathPatterns\":[\"projects/myinstance/\"]}]"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `jira_get_issue` | Fetch issue details |
| `jira_get_transitions` | List available status transitions |
| `jira_transition_issue` | Move issue to new status |
| `jira_add_comment` | Add comment to issue |
| `jira_assign_to_me` | Assign issue to yourself |
| `jira_search_issues` | Search with JQL or filters |
| `jira_my_issues` | View all your issues across all instances |
| `jira_create_issue` | Create new issue |
| `jira_get_sprint` | Get active sprint info |
| `jira_get_epic` | Get epic with child issues |
| `tempo_log_time` | Log time on issue |
| `tempo_get_today_worklogs` | Get today's logged time |
| `git_branch_info` | Get branch info and commits |
| `git_create_branch` | Create new branch |
| `detect_instance` | Show which instance is resolved |

## License

MIT
