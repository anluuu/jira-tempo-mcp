# jira-tempo-mcp

MCP (Model Context Protocol) server for JIRA + Tempo workflow automation with multi-instance support.

## Features

- **Multi-instance JIRA support** - Work across multiple JIRA instances based on your working directory
- **Tempo time logging** - Log time with smart sequential scheduling (no overlaps)
- **Git integration** - Create branches, get commit info, detect issue keys from branch names
- **Cross-instance queries** - See all your issues across all JIRA instances at once

## Installation

```bash
npx github:anluuu/jira-tempo-mcp
```

## Configuration

Create a config file at `~/.config/jira-tempo-mcp/config.json`:

```json
{
  "email": "your-email@example.com",
  "baseBranch": "main",
  "instances": [
    {
      "name": "mycompany",
      "baseUrl": "mycompany.atlassian.net",
      "jiraToken": "YOUR_JIRA_API_TOKEN",
      "tempoToken": "YOUR_TEMPO_API_TOKEN",
      "pathPatterns": ["projects/mycompany/", "mycompany-"]
    },
    {
      "name": "client",
      "baseUrl": "client.atlassian.net",
      "jiraToken": "ANOTHER_JIRA_TOKEN",
      "tempoToken": "ANOTHER_TEMPO_TOKEN",
      "pathPatterns": ["projects/client/"]
    }
  ]
}
```

### Getting API Tokens

1. **JIRA API Token**: https://id.atlassian.com/manage-profile/security/api-tokens
2. **Tempo API Token**: Tempo → Settings → API Integration → New Token

### Claude Code Setup

Add to your `~/.claude.json`:

```json
{
  "mcpServers": {
    "jira-tempo": {
      "command": "npx",
      "args": ["-y", "github:anluuu/jira-tempo-mcp"]
    }
  }
}
```

## Path Patterns

The `pathPatterns` array determines which JIRA instance to use based on your current directory.
When you run Claude Code in `/home/user/projects/mycompany/frontend`, it matches `projects/mycompany/` and uses that instance's credentials.

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
