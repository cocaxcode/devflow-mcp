<p align="center">
  <h1 align="center">@cocaxcode/devflow-mcp</h1>
  <p align="center">
    <strong>Your Jira + GitHub/GitLab workflow, handled by your AI assistant.</strong><br/>
    One MCP server. 32 tools. Say what you need, it gets done.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@cocaxcode/devflow-mcp">
    <img src="https://img.shields.io/npm/v/@cocaxcode/devflow-mcp.svg?style=flat-square&color=cb3837" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/@cocaxcode/devflow-mcp">
    <img src="https://img.shields.io/npm/dm/@cocaxcode/devflow-mcp.svg?style=flat-square" alt="downloads" />
  </a>
  <img src="https://img.shields.io/badge/tools-32-blueviolet?style=flat-square" alt="tools" />
  <img src="https://img.shields.io/badge/tests-51-brightgreen?style=flat-square" alt="tests" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white" alt="node" />
  <a href="https://github.com/cocaxcode/devflow-mcp/blob/master/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="license" />
  </a>
</p>

<p align="center">
  <a href="#overview">Overview</a> &middot;
  <a href="#just-talk-to-it">Just Talk to It</a> &middot;
  <a href="#installation">Installation</a> &middot;
  <a href="#tools">Tools</a> &middot;
  <a href="#flows">Flows</a> &middot;
  <a href="#rules">Rules</a> &middot;
  <a href="#storage">Storage</a> &middot;
  <a href="#compatibility">Compatibility</a> &middot;
  <a href="#architecture">Architecture</a>
</p>

---

## Overview

The most complete MCP server for developer workflow automation. 32 tools that connect Jira (Cloud + Server) with GitHub/GitLab (cloud + self-hosted) — so your AI assistant can manage issues, branches, PRs, and deployments without you ever opening a browser tab.

It auto-detects your Jira version and git provider, enforces configurable safety rules, and lets you define custom YAML flow playbooks for repeatable workflows. Projects are configured once and remembered — each with its own Jira instance, git provider, branch conventions, and credentials. Switch between projects mid-conversation. **All credentials stay local in `~/.dfm/` — nothing is synced, nothing is tracked, nothing leaves your machine.**

---

## Just Talk to It

You don't memorize tool names. You talk naturally and the assistant picks the right tools.

**"Let's work on PROJ-123"**

```
> Reading PROJ-123...
  Title: Add OAuth login
  Status: To Do | Priority: High

> Branch feat/PROJ-123 not found. Creating...
  branch: feat/PROJ-123-add-oauth-login
  base: main
  Confirm? (confirm: true to execute)

> Moved PROJ-123 → In Progress
> Assigned to you
```

**"Show me my tasks for the ACME project"**

```
ACME-45  Fix OAuth login             In Progress  High
ACME-52  Dashboard refactor          To Do        Medium
ACME-61  Update dependencies         To Do        Low
```

**"Push my changes"**

```
Preview:
  branch: feat/PROJ-123-add-oauth-login
  pending commits:
    - a1b2c3d feat: add login component
    - d4e5f6g feat: add auth service

Confirm? (confirm: true to execute)
```

**"Merge main into my current branch"**

```
Conflict detected:
  - src/auth/login.ts
  - src/config/routes.ts

Resolve the files and commit to complete the merge.
```

**"Create a PR titled 'feat: add OAuth login'"**

```
PR created:
  url: https://github.com/org/repo/pull/42
  title: feat: add OAuth login
  provider: github
```

**"Comment on PROJ-123 that the PR is ready for review"**

```
Preview:
  issue: PROJ-123
  comment: "PR ready for review: https://github.com/org/repo/pull/42"

Confirm? (confirm: true to publish)
```

**"Create a fix branch for PROJ-456 with description fix-oauth-redirect"**

```
Preview:
  branch: fix/PROJ-456-fix-oauth-redirect
  base: main
  actions: checkout main → pull → create branch

Confirm? (confirm: true to execute)
```

---

## Installation

### Claude Code (recommended)

```bash
# Global — available across all your projects
claude mcp add --scope user devflow -- npx -y @cocaxcode/devflow-mcp

# Per-project
claude mcp add devflow -- npx -y @cocaxcode/devflow-mcp
```

### Claude Desktop

<details>
<summary>macOS: ~/Library/Application Support/Claude/claude_desktop_config.json</summary>

```json
{
  "mcpServers": {
    "devflow": {
      "command": "npx",
      "args": ["-y", "@cocaxcode/devflow-mcp"]
    }
  }
}
```
</details>

<details>
<summary>Windows: %APPDATA%\Claude\claude_desktop_config.json</summary>

```json
{
  "mcpServers": {
    "devflow": {
      "command": "npx",
      "args": ["-y", "@cocaxcode/devflow-mcp"]
    }
  }
}
```
</details>

### Cursor / Windsurf

```json
// .cursor/mcp.json or .windsurf/mcp.json
{
  "mcpServers": {
    "devflow": {
      "command": "npx",
      "args": ["-y", "@cocaxcode/devflow-mcp"]
    }
  }
}
```

### VS Code / Codex / Gemini CLI

```json
{
  "mcpServers": {
    "devflow": {
      "command": "npx",
      "args": ["-y", "@cocaxcode/devflow-mcp"]
    }
  }
}
```

---

## Tools

32 tools organized in 5 categories.

### Projects (5)

| Tool | Description |
|------|-------------|
| `df_project_setup` | Configure a new project (Jira + Git, auto-detects everything) |
| `df_project_update` | Modify project configuration |
| `df_project_list` | List all configured projects |
| `df_project_switch` | Switch the active project |
| `df_project_delete` | Delete a project |

<details>
<summary>Example: setting up a project</summary>

```
df_project_setup with:
  name: "my-project"
  jiraUrl: "https://my-company.atlassian.net"
  jiraEmail: "dev@company.com"
  jiraToken: "ATATT3x..."
  jiraProjectKey: "PROJ"
  gitToken: "ghp_..."
  paths: ["C:/repos/my-project"]

Auto-detects:
  - Jira Cloud (API v3)
  - GitHub (org/my-project)
  - Base branch: main
```
</details>

### Jira (6)

| Tool | Description | Confirmation |
|------|-------------|:---:|
| `df_issues` | List my assigned issues (filters by project) | -- |
| `df_issue` | Full issue detail | -- |
| `df_statuses` | Available transitions for an issue | -- |
| `df_transition` | Move issue to another status | Yes |
| `df_assign` | Assign issue to current user | -- |
| `df_comment` | Comment on an issue | Yes |

### Git (7)

| Tool | Description | Confirmation |
|------|-------------|:---:|
| `df_branch` | Create branch (`feat/` or `fix/`) from base | Yes |
| `df_find_branch` | Search branch by issue key | -- |
| `df_checkout` | Switch branch (with safety guard) | -- |
| `df_pull` | Pull current branch from remote | -- |
| `df_push` | Push current branch to remote | Yes |
| `df_merge` | Merge a branch into the current one | Yes |
| `df_pr` | Create PR (GitHub) or MR (GitLab) | -- |

> **Important:** `df_branch`, `df_checkout`, and `df_push` verify the working directory before executing. They **block if there are uncommitted files or unpushed commits**, listing exactly what needs attention. This prevents accidental work loss.

### Flows (5)

| Tool | Description |
|------|-------------|
| `df_flow_create` | Create a custom flow |
| `df_flow_list` | List all flows |
| `df_flow_get` | View flow details |
| `df_flow_update` | Modify an existing flow |
| `df_flow_delete` | Delete a flow (protects `start-task`) |

### Rules (9)

| Tool | Description | Level |
|------|-------------|-------|
| `df_rule_create` | Create a global rule | Global |
| `df_rule_list` | List all rules | Global |
| `df_rule_get` | View rule details | Global |
| `df_rule_update` | Modify a rule | Global |
| `df_rule_toggle` | Enable/disable a rule | Global |
| `df_rule_delete` | Delete a rule | Global |
| `df_rule_project_override` | Enable/disable a global rule for a project | Project |
| `df_rule_project_add` | Create a project-only rule | Project |
| `df_rule_project_remove` | Remove a project rule or override | Project |

---

## Flows

Flows are YAML playbooks that define step sequences. They don't run automatically -- you tell the assistant when to use them.

### Default: `start-task`

Triggered when you say something like _"let's work on PROJ-123"_:

```yaml
name: start-task
trigger: "when the user says 'let's work on', 'start task', 'new task' + issue ID"
steps:
  - tool: df_issue
    note: "Read issue detail and summarize the task"
  - tool: df_find_branch
    note: "Check if a branch already exists for this issue"
  - tool: df_branch
    confirm: true
    note: "Only if no existing branch was found"
  - tool: df_statuses
    note: "Get transitions to find the 'In Progress' transition ID"
  - tool: df_transition
    target: "In Progress"
    confirm: true
  - tool: df_assign
    note: "Assign the issue if it has no assignee"
```

### Custom flows

Create your own by asking naturally:

> _"Create a flow called 'finish-task' that pushes, creates a PR, and comments on Jira"_

```yaml
name: finish-task
trigger: "when the user says 'finish task', 'wrap up' + issue ID"
steps:
  - tool: df_push
    confirm: true
    note: "Push pending commits"
  - tool: df_pr
    note: "Create PR/MR to base branch"
  - tool: df_comment
    confirm: true
    note: "Comment on the issue with the PR link"
```

The `start-task` flow can be modified but not deleted. Use `df_flow_update` to change any flow's steps, trigger, or name.

---

## Rules

Rules are configurable guards that block or warn about actions. Two levels: global and per-project.

### Default rules

| Rule | Scope | Action | What it does |
|------|-------|--------|-------------|
| `no-merge-to-base` | git | block | Prevent direct push/merge to main/master |
| `no-merge-from-dev` | git | block | Prevent merging dev/develop/int branches out |
| `no-close-issues` | jira | block | Prevent closing issues (Done, Closed, Resolved...) |
| `only-own-issues` | jira | block | Prevent modifying issues assigned to others |

### Project overrides

Each project can override global rules or define its own:

```
# Disable a global rule for one project
df_rule_project_override: name="no-close-issues", enabled=false

# Add a project-only rule
df_rule_project_add: name="no-push-friday", scope="git", action="warn"

# Remove an override or project rule
df_rule_project_remove: name="no-close-issues"
```

### Custom rules

```
df_rule_create:
  name: "no-push-friday"
  description: "Warn when pushing on Fridays"
  scope: "git"       # git | jira | all
  action: "warn"     # block | warn
```

> **Note:** **Rule resolution order:** Global rules load first, then project overrides are applied (project wins), then project-specific rules are added. Rules are filtered by scope and enabled state before evaluation.

---

## Storage

Everything lives in `~/.dfm/` — your home directory, never inside any git repository. Jira tokens, GitHub PATs, GitLab tokens — all stored locally with `600` permissions (owner-only read/write). Nothing gets committed, nothing gets pushed, nothing leaves your machine.

```
~/.dfm/
├── projects/              # Project configs (.json) — credentials included
│   ├── my-project.json    # Jira URL, token, GitHub PAT, branch rules
│   └── other-project.json
├── flows/                 # Flow definitions (.yaml)
│   └── start-task.yaml
├── rules/                 # Global rules (.json)
│   ├── no-merge-to-base.json
│   ├── no-merge-from-dev.json
│   ├── no-close-issues.json
│   └── only-own-issues.json
├── active-project         # Current active project (plain text)
└── config.json            # Server configuration
```

**Project resolution works automatically:** devflow-mcp matches your current working directory against each project's `paths`. If no match, it falls back to the project set via `df_project_switch`. If neither works, it prompts you to configure with `df_project_setup`. This means you can work across multiple projects with different Jira instances and git providers — the right credentials are always selected based on where you are.

---

## Compatibility

### Jira

| Type | API | Authentication |
|------|-----|----------------|
| Jira Cloud | REST API v3 | Email + API Token (Basic) |
| Jira Server / Data Center | REST API v2 | Personal Access Token (Bearer) |

Auto-detection via `/rest/api/2/serverInfo` -- no manual configuration needed.

### Git providers

| Provider | API |
|----------|-----|
| GitHub (cloud) | REST API v3 |
| GitHub Enterprise | REST API v3 (custom URL) |
| GitLab (cloud) | REST API v4 |
| GitLab self-hosted | REST API v4 (custom URL) |

Auto-detection by parsing the repository's remote URL.

---

## Architecture

```
src/
├── index.ts              # Entry point (stdio transport)
├── server.ts             # Factory: createServer() + instructions
├── lib/
│   ├── types.ts          # Interfaces, defaults, valid tool names
│   ├── storage.ts        # CRUD: projects, flows, rules, config
│   ├── git-exec.ts       # Git CLI wrapper (execFile)
│   ├── jira/
│   │   ├── client.ts     # JiraClient (Cloud v3 + Server v2)
│   │   └── types.ts      # Raw Jira API response shapes
│   └── git/
│       ├── detect.ts     # parseRemoteUrl (SSH/HTTPS, GitHub/GitLab)
│       ├── github.ts     # GitHubClient (REST API v3)
│       ├── gitlab.ts     # GitLabClient (REST API v4)
│       ├── factory.ts    # createGitProviderClient()
│       └── types.ts      # Git provider interfaces
└── tools/
    ├── project.ts        # 5 tools: setup, update, list, switch, delete
    ├── jira.ts           # 6 tools: issues, issue, statuses, transition, assign, comment
    ├── git.ts            # 7 tools: branch, find_branch, checkout, pull, push, merge, pr
    ├── flow.ts           # 5 tools: create, list, get, update, delete
    └── rule.ts           # 9 tools: CRUD global + 3 project-level
```

**Stack:** TypeScript &middot; MCP SDK &middot; Zod &middot; YAML &middot; tsup

**Tests:** 4 suites &middot; 51 tests (Vitest + InMemoryTransport)

---

[MIT](./LICENSE) &middot; Built by [cocaxcode](https://github.com/cocaxcode)
