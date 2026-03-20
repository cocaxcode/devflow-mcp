<p align="center">
  <h1 align="center">@cocaxcode/devflow-mcp</h1>
  <p align="center">
    <strong>Connect Jira with GitHub/GitLab from your AI assistant.</strong><br/>
    32 tools &middot; Jira Cloud + Server &middot; GitHub + GitLab &middot; Custom flows &middot; Configurable rules
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
  <a href="#the-problem">The Problem</a> &middot;
  <a href="#installation">Installation</a> &middot;
  <a href="#just-talk-to-it">Just Talk to It</a> &middot;
  <a href="#tools">Tools</a> &middot;
  <a href="#flows">Flows</a> &middot;
  <a href="#rules">Rules</a> &middot;
  <a href="#storage">Storage</a> &middot;
  <a href="#compatibility">Compatibility</a> &middot;
  <a href="#architecture">Architecture</a>
</p>

---

## The Problem

You work with Jira, GitHub/GitLab, and the terminal. Every time you start a task:

1. Open Jira, find the issue, read the details
2. Go to the terminal, checkout main, pull, create a branch
3. Back to Jira, move the issue to "In Progress"
4. When done, push, create PR, back to Jira again...

**devflow-mcp** gives you all of this as MCP tools your AI assistant (Claude Code, Cursor, Windsurf, etc.) can use directly. Each tool works independently — the AI orchestrates, the MCP executes.

| Feature | devflow-mcp |
|---------|------------|
| Jira Cloud + Server | Auto-detects version (v2/v3) |
| GitHub + GitLab | Cloud and self-hosted |
| Custom flows | Editable YAML playbooks |
| Configurable rules | Global + per-project overrides |
| Multi-project | Each project with its own connection |
| Safety guards | Blocks if there are uncommitted/unpushed changes |
| Explicit confirmation | Push, merge, branch, transitions |

---

## Installation

### Claude Code (recommended)

```bash
# Global installation (available across all your projects)
claude mcp add devflow --scope user -- npx -y @cocaxcode/devflow-mcp

# Or per-project installation
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

## Just Talk to It

You don't need to memorize tool names. Talk to your AI assistant naturally:

### Start a task

> _"Let's work on PROJ-123"_

The AI reads the issue, summarizes the task, checks if a branch already exists, creates one if not, moves the issue to "In Progress", and assigns it — all following the `start-task` flow.

### List your issues

> _"Show me my tasks for the ACME project"_

```
ACME-45  Fix OAuth login             In Progress  High
ACME-52  Dashboard refactor          To Do        Medium
ACME-61  Update dependencies         To Do        Low
```

### Create a branch

> _"Create a fix branch for PROJ-456 with description fix-oauth-redirect"_

```
Preview:
  branch: fix/PROJ-456-fix-oauth-redirect
  base: main
  actions: checkout main → pull → create branch

Confirm? (confirm: true to execute)
```

### Push with safety

> _"Push my changes"_

```
Preview:
  branch: feat/PROJ-123-add-login
  pending commits:
    - a1b2c3d feat: add login component
    - d4e5f6g feat: add auth service

Confirm? (confirm: true to execute)
```

### Merge with conflict detection

> _"Merge main into my current branch"_

If there are conflicts, it tells you exactly which files:

```
Conflict detected:
  - src/auth/login.ts
  - src/config/routes.ts

Resolve the files and commit to complete the merge.
```

### Create a PR

> _"Create a PR titled 'feat: add OAuth login'"_

```
PR created:
  url: https://github.com/org/repo/pull/42
  title: feat: add OAuth login
  provider: github
```

### Comment on Jira

> _"Comment on PROJ-123 that the PR is ready for review"_

```
Preview:
  issue: PROJ-123
  comment: "PR ready for review: https://github.com/org/repo/pull/42"

Confirm? (confirm: true to publish)
```

---

## Tools

32 tools organized in 5 categories:

### Projects (5 tools)

| Tool | Description |
|------|------------|
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

### Jira (6 tools)

| Tool | Description | Confirmation |
|------|------------|:---:|
| `df_issues` | List my assigned issues (filters by project) | — |
| `df_issue` | Full issue detail | — |
| `df_statuses` | Available transitions for an issue | — |
| `df_transition` | Move issue to another status | Yes |
| `df_assign` | Assign issue to current user | — |
| `df_comment` | Comment on an issue | Yes |

<details>
<summary>Rules that apply to Jira</summary>

- **no-close-issues** (active by default): Blocks moving issues to final statuses (Done, Closed, Resolved, etc.). Only a human should close tasks from Jira directly.
- **only-own-issues** (active by default): Prevents transitioning, assigning, or editing issues assigned to other users. Only viewing and commenting are allowed.
</details>

### Git (7 tools)

| Tool | Description | Confirmation |
|------|------------|:---:|
| `df_branch` | Create branch (`feat/` or `fix/`) from base | Yes |
| `df_find_branch` | Search branch by issue key | — |
| `df_checkout` | Switch branch (with guard) | — |
| `df_pull` | Pull current branch from remote | — |
| `df_push` | Push current branch to remote | Yes |
| `df_merge` | Merge a branch into the current one | Yes |
| `df_pr` | Create PR (GitHub) or MR (GitLab) | — |

> [!IMPORTANT]
> `df_branch`, `df_checkout`, and `df_push` verify the working directory state before executing. They block if there are **uncommitted files** or **unpushed commits**, listing exactly what needs to be resolved. This prevents accidental work loss.

<details>
<summary>Rules that apply to Git</summary>

- **no-merge-to-base** (active by default): Blocks direct push and merge to the base branch (main/master). Forces using PR/MR.
- **no-merge-from-dev** (active by default): Blocks merging development branches (dev, develop, int, integration, development) into other branches. These branches only receive merges, they are never merged out.
</details>

### Flows (5 tools)

| Tool | Description |
|------|------------|
| `df_flow_create` | Create a custom flow |
| `df_flow_list` | List all flows |
| `df_flow_get` | View flow details |
| `df_flow_update` | Modify an existing flow |
| `df_flow_delete` | Delete a flow (protects `start-task`) |

### Rules (9 tools)

| Tool | Description | Level |
|------|------------|-------|
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

Flows are playbooks that define step sequences. They don't run automatically — you tell the AI when to use them.

### Default flow: `start-task`

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

### Create a custom flow

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

### Edit a flow

> _"Modify the 'start-task' flow to skip the assign step"_

Use `df_flow_update` to change steps, trigger, or name. The `start-task` flow can be modified but not deleted.

---

## Rules

Rules are configurable guards that block or warn about actions. There are two levels:

### Global rules

Apply to all projects. Created with `df_rule_create`.

**Default rules (active):**

| Rule | Scope | Action | Description |
|------|-------|--------|-------------|
| `no-merge-to-base` | git | block | Prevent direct push/merge to main/master |
| `no-merge-from-dev` | git | block | Prevent merging dev/int/develop branches into other branches |
| `no-close-issues` | jira | block | Prevent closing issues (Done, Closed, Resolved...) |
| `only-own-issues` | jira | block | Prevent modifying issues assigned to others |

### Project rules

Each project can:

1. **Override a global rule** — enable or disable it just for that project:
   > _"Disable the no-close-issues rule for the staging project"_

   Use `df_rule_project_override` with `enabled: false`.

2. **Create its own rules** — only apply to that project:
   > _"Create a rule in this project that warns when pushing on Fridays"_

   Use `df_rule_project_add`.

3. **Remove overrides or project rules**:
   > _"Remove the no-close-issues override in this project"_

   Use `df_rule_project_remove`.

### Create a custom rule

```
df_rule_create:
  name: "no-push-friday"
  description: "Warn when pushing on Fridays"
  scope: "git"
  action: "warn"
```

Options:
- **scope**: `git`, `jira`, or `all`
- **action**: `block` (prevents the action) or `warn` (advisory only)

> [!NOTE]
> **Rule resolution order:** Global rules are loaded first, then project overrides are applied (project wins), then project-specific rules are added. Finally, rules are filtered by scope and enabled state.

---

## Storage

All data is stored in `~/.dfm/`:

```
~/.dfm/
├── projects/          # Project configurations (.json)
│   ├── my-project.json
│   └── other-project.json
├── flows/             # Flow definitions (.yaml)
│   └── start-task.yaml
├── rules/             # Global rules (.json)
│   ├── no-merge-to-base.json
│   ├── no-merge-from-dev.json
│   ├── no-close-issues.json
│   └── only-own-issues.json
├── active-project     # Active project (plain text)
└── config.json        # Server configuration
```

- **Projects**: JSON with credentials, paths, rule overrides, and project-specific rules
- **Flows**: Editable YAML with steps and triggers
- **Rules**: JSON with name, scope, action, and state
- **Permissions**: Project files are created with `600` permissions (owner-only)

> [!TIP]
> **Project resolution:** When you run a tool, devflow-mcp matches your current working directory against each project's `paths`. If no match is found, it falls back to the project set via `df_project_switch`. If neither works, it asks you to configure with `df_project_setup`.

---

## Compatibility

### Jira

| Type | API | Authentication |
|------|-----|----------------|
| Jira Cloud | REST API v3 | Email + API Token (Basic) |
| Jira Server / Data Center | REST API v2 | Personal Access Token (Bearer) |

Auto-detection via `/rest/api/2/serverInfo` — you don't need to know which version you're using.

### Git

| Provider | Support |
|----------|---------|
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

**Stack**: TypeScript &middot; MCP SDK &middot; Zod &middot; YAML &middot; tsup

**Tests**: 4 suites &middot; 51 tests (Vitest + InMemoryTransport)

---

[MIT](./LICENSE) &middot; Built by [cocaxcode](https://github.com/cocaxcode)
