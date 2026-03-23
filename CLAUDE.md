# CLAUDE.md — @cocaxcode/devflow-mcp

## Project Overview

MCP server that connects Jira (Cloud + Server) with GitHub/GitLab to automate dev workflows. Branch creation, issue transitions, PR/MR generation, custom flow playbooks, and configurable rules. 32 tools.

## Stack

- TypeScript 5.x (strict mode, ESM)
- @modelcontextprotocol/sdk 1.27.x (unified package)
- Zod 3.25+ for schema validation
- yaml 2.7+ for YAML parsing
- Vitest for testing
- tsup for building (ESM output with shebang, `__PKG_VERSION__` define)

## Architecture

```
src/
├── index.ts          # Entry point (shebang + StdioServerTransport)
├── server.ts         # createServer(storageDir?) factory + INSTRUCTIONS
├── tools/            # MCP tool registration (one file per group)
│   ├── project.ts    # df_project_setup/update/list/switch/delete (5)
│   ├── jira.ts       # df_issues/issue/statuses/transition/assign/comment (6)
│   ├── git.ts        # df_branch/find_branch/checkout/pull/merge/push/pr (7)
│   ├── flow.ts       # df_flow_create/list/get/update/delete (5)
│   └── rule.ts       # df_rule_create/list/get/update/toggle/delete/project_override/project_add/project_remove (9)
├── lib/
│   ├── types.ts      # Shared TypeScript interfaces
│   ├── storage.ts    # JSON file storage in ~/.devflow-mcp/
│   ├── git-exec.ts   # Shell git command execution
│   ├── git/
│   │   ├── factory.ts   # createGitProvider() factory
│   │   ├── detect.ts    # Auto-detect Git provider from remote
│   │   ├── github.ts    # GitHub REST API client
│   │   └── gitlab.ts    # GitLab REST API client
│   └── jira/
│       └── client.ts    # Jira REST API client (Cloud + Server)
```

## Key Patterns

- **Factory function**: `createServer(storageDir?)` for testability
- **SDK imports**: Deep paths — `@modelcontextprotocol/sdk/server/mcp.js`
- **Tool API**: `.tool(name, description, schema, handler)` with raw Zod shapes (NOT z.object)
- **Error handling**: Return `{ isError: true }`, never throw from tool handlers
- **Logging**: ONLY `console.error()` — stdout is reserved for JSON-RPC
- **Storage**: JSON files in `~/.devflow-mcp/`, configurable via env
- **Confirm pattern**: Destructive tools (df_transition, df_branch, df_push, df_merge) require `confirm: true`
- **Git provider factory**: Auto-detects GitHub vs GitLab from remote URL
- **Instructions field**: Server provides behavioral guidance to AI clients

## Storage Layout

```
~/.devflow-mcp/                     # Global (configurable via DEVFLOW_DIR)
├── projects/
│   └── {name}.json                 # Project configs (Jira + Git credentials)
├── active-project                  # Currently active project
├── flows/
│   └── {name}.json                 # Flow playbook definitions
└── rules/
    ├── global/
    │   └── {name}.json             # Global rules
    └── projects/
        └── {project}/
            └── {name}.json         # Per-project rule overrides
```

## 32 MCP Tools

| Group | Tools | Count |
|-------|-------|-------|
| Project | df_project_setup/update/list/switch/delete | 5 |
| Jira | df_issues/issue/statuses/transition/assign/comment | 6 |
| Git | df_branch/find_branch/checkout/pull/merge/push/pr | 7 |
| Flow | df_flow_create/list/get/update/delete | 5 |
| Rule | df_rule_create/list/get/update/toggle/delete/project_override/project_add/project_remove | 9 |

## Commands

```bash
npm test          # Run all tests
npm run build     # Build with tsup
npm run typecheck # TypeScript check
npm run format    # Prettier
npm run inspector # Test with MCP Inspector
```

## Conventions

- Spanish for user-facing strings (tool descriptions, error messages)
- English for code (variable names, comments)
- No semi, single quotes, trailing commas (Prettier)
- All tool handlers follow try/catch → isError pattern
