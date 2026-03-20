// ── Auth Types ──

export interface JiraCloudAuth {
  type: 'cloud'
  email: string
  apiToken: string
}

export interface JiraServerAuth {
  type: 'server'
  pat: string
}

// ── Project Config ──

export interface ProjectConfig {
  name: string
  jiraUrl: string
  jiraType: 'cloud' | 'server'
  jiraApiVersion: '2' | '3'
  jiraProjectKey: string
  jiraAuth: JiraCloudAuth | JiraServerAuth
  gitProvider: 'github' | 'gitlab'
  gitProviderUrl?: string
  gitAuth: { token: string }
  baseBranch: string
  paths: string[]
  repoOwner: string
  repoName: string
  repoId?: number
  ruleOverrides?: Record<string, boolean>
  projectRules?: Rule[]
  createdAt: string
  updatedAt: string
}

// ── Flow System ──

export interface FlowStep {
  tool: string
  confirm?: boolean
  target?: string
  note?: string
}

export interface FlowDefinition {
  name: string
  trigger: string
  steps: FlowStep[]
}

// ── Jira Types ──

export interface JiraIssue {
  key: string
  summary: string
  description: string | null
  status: { name: string; id: string }
  priority: { name: string; id: string }
  assignee: { displayName: string; emailAddress?: string } | null
  reporter: { displayName: string; emailAddress?: string }
  labels: string[]
  components: { name: string }[]
  subtasks: { key: string; summary: string; status: string }[]
  comments: { author: string; body: string; created: string }[]
  created: string
  updated: string
}

export interface JiraTransition {
  id: string
  name: string
  to: { name: string; id: string }
}

// ── Git Types ──

export type BranchType = 'feat' | 'fix'

export interface GitRemoteInfo {
  provider: 'github' | 'gitlab'
  owner: string
  repo: string
  url: string
}

export interface WorkingDirStatus {
  clean: boolean
  uncommittedFiles: string[]
  unpushedCommits: string[]
}

export interface PullRequestResult {
  provider: 'github' | 'gitlab'
  url: string
  number?: number
  iid?: number
  title: string
  state: string
}

// ── Rules ──

export type RuleScope = 'git' | 'jira' | 'all'
export type RuleAction = 'block' | 'warn'

export interface Rule {
  name: string
  description: string
  enabled: boolean
  scope: RuleScope
  action: RuleAction
  createdAt: string
  updatedAt: string
}

export const DEFAULT_RULES: Rule[] = [
  {
    name: 'no-merge-to-base',
    description: 'No permitir merge directo a la rama base (main/master). Usar siempre PR/MR.',
    enabled: true,
    scope: 'git',
    action: 'block',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'no-close-issues',
    description: 'No permitir mover issues a estados finales o de cierre (Done, Closed, Resolved, Finalizado, Cerrado, etc.). Solo un humano desde Jira deberia cerrar tareas.',
    enabled: true,
    scope: 'jira',
    action: 'block',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'no-merge-from-dev',
    description: 'No permitir mergear ramas de desarrollo (int, integration, dev, develop, development) hacia otras ramas. Estas ramas solo reciben merges, no se sacan de ellas.',
    enabled: true,
    scope: 'git',
    action: 'block',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'only-own-issues',
    description: 'No permitir transicionar, asignar ni editar issues que no esten asignados al usuario actual. Solo se permite consultar y comentar.',
    enabled: true,
    scope: 'jira',
    action: 'block',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

// ── Server Config ──

export interface ServerConfig {
  [key: string]: unknown
}

// ── Default Flow ──

export const DEFAULT_FLOW: FlowDefinition = {
  name: 'start-task',
  trigger: "cuando el usuario dice 'vamos con', 'empezar tarea', 'nueva tarea' + issue ID",
  steps: [
    {
      tool: 'df_issue',
      note: 'AI lee el detalle, resume brevemente la tarea',
    },
    {
      tool: 'df_find_branch',
      note: 'Si found=true: df_checkout a esa rama y saltar df_branch. Si found=false: continuar',
    },
    {
      tool: 'df_branch',
      confirm: true,
      note: 'Solo si df_find_branch no encontro rama. Internamente: checkout main/master, pull, crear rama',
    },
    {
      tool: 'df_statuses',
      note: 'Obtener transiciones disponibles para saber el ID de "In Progress" o equivalente',
    },
    {
      tool: 'df_transition',
      target: 'In Progress',
      confirm: true,
    },
    {
      tool: 'df_assign',
      note: 'Si el issue no tiene asignado, asignarlo al usuario actual',
    },
  ],
}

// ── Valid Tool Names (for flow validation) ──

export const VALID_TOOL_NAMES = [
  'df_project_setup',
  'df_project_update',
  'df_project_list',
  'df_project_switch',
  'df_project_delete',
  'df_issues',
  'df_issue',
  'df_statuses',
  'df_transition',
  'df_assign',
  'df_comment',
  'df_branch',
  'df_find_branch',
  'df_checkout',
  'df_pull',
  'df_push',
  'df_merge',
  'df_pr',
  'df_rule_create',
  'df_rule_list',
  'df_rule_get',
  'df_rule_update',
  'df_rule_toggle',
  'df_rule_delete',
  'df_flow_create',
  'df_flow_list',
  'df_flow_get',
  'df_flow_update',
  'df_flow_delete',
  'df_rule_project_override',
  'df_rule_project_add',
  'df_rule_project_remove',
] as const
