// ── Raw Jira API response shapes ──

export interface JiraServerInfo {
  version: string
  versionNumbers: number[]
  deploymentType: string // 'Cloud' | 'Server' | 'DataCenter'
  buildNumber: number
  baseUrl?: string
}

export interface JiraFieldsResponse {
  summary: string
  description: unknown // string (Server v2) | ADF object (Cloud v3) | null
  status: { name: string; id: string }
  priority: { name: string; id: string }
  assignee: { displayName: string; emailAddress?: string; name?: string } | null
  reporter: { displayName: string; emailAddress?: string; name?: string }
  labels: string[]
  components: { name: string }[]
  subtasks: Array<{
    key: string
    fields: { summary: string; status: { name: string } }
  }>
  comment?: {
    comments: Array<{
      author: { displayName: string; name?: string }
      body: unknown
      created: string
    }>
  }
  created: string
  updated: string
}

export interface JiraIssueResponse {
  key: string
  fields: JiraFieldsResponse
}

export interface JiraSearchResponse {
  issues: JiraIssueResponse[]
  total: number
  maxResults: number
  startAt: number
}

// Cloud v3 search uses different shape
export interface JiraSearchV3Response {
  issues: JiraIssueResponse[]
  total: number
  maxResults: number
  startAt: number
}

export interface JiraTransitionResponse {
  id: string
  name: string
  to: { name: string; id: string; statusCategory: { name: string } }
}

export interface JiraTransitionsResponse {
  transitions: JiraTransitionResponse[]
}

export interface JiraMyselfResponse {
  accountId?: string // Cloud
  name?: string // Server
  displayName: string
  emailAddress?: string
}
