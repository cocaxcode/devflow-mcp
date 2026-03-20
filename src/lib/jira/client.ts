import type { ProjectConfig, JiraIssue, JiraTransition } from '../types.js'
import type {
  JiraServerInfo,
  JiraIssueResponse,
  JiraSearchResponse,
  JiraTransitionsResponse,
  JiraMyselfResponse,
} from './types.js'

export class JiraClient {
  private readonly baseUrl: string
  private readonly apiVersion: '2' | '3'
  private readonly authHeader: string

  constructor(config: ProjectConfig) {
    this.baseUrl = config.jiraUrl.replace(/\/+$/, '')
    this.apiVersion = config.jiraApiVersion
    this.authHeader = this.buildAuthHeader(config)
  }

  private buildAuthHeader(config: ProjectConfig): string {
    if (config.jiraAuth.type === 'cloud') {
      const { email, apiToken } = config.jiraAuth
      const encoded = Buffer.from(`${email}:${apiToken}`).toString('base64')
      return `Basic ${encoded}`
    }
    return `Bearer ${config.jiraAuth.pat}`
  }

  // ── Public API ──

  async getServerInfo(): Promise<JiraServerInfo> {
    return this.request<JiraServerInfo>('GET', '/rest/api/2/serverInfo')
  }

  async searchIssues(jql: string, maxResults = 50): Promise<JiraIssue[]> {
    let response: JiraSearchResponse

    if (this.apiVersion === '3') {
      // Jira Cloud — usa el nuevo endpoint /rest/api/3/search/jql
      const params = new URLSearchParams({
        jql,
        maxResults: String(maxResults),
        fields: 'summary,status,priority,assignee,reporter,labels,updated,created',
      })
      response = await this.request<JiraSearchResponse>(
        'GET',
        `/rest/api/3/search/jql?${params}`,
      )
    } else {
      // Jira Server — usa /rest/api/2/search (POST)
      response = await this.request<JiraSearchResponse>('POST', '/rest/api/2/search', {
        jql,
        maxResults,
        fields: [
          'summary',
          'status',
          'priority',
          'assignee',
          'reporter',
          'labels',
          'updated',
          'created',
        ],
      })
    }

    return response.issues.map((issue) => this.mapIssue(issue))
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    const response = await this.request<JiraIssueResponse>(
      'GET',
      `/rest/api/${this.apiVersion}/issue/${issueKey}`,
    )
    return this.mapIssue(response)
  }

  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    const response = await this.request<JiraTransitionsResponse>(
      'GET',
      `/rest/api/${this.apiVersion}/issue/${issueKey}/transitions`,
    )
    return response.transitions.map((t) => ({
      id: t.id,
      name: t.name,
      to: { name: t.to.name, id: t.to.id },
    }))
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await this.request(
      'POST',
      `/rest/api/${this.apiVersion}/issue/${issueKey}/transitions`,
      { transition: { id: transitionId } },
    )
  }

  async addComment(issueKey: string, body: string): Promise<{ id: string; body: string }> {
    // Cloud v3 usa ADF, Server v2 usa string plano
    const commentBody = this.apiVersion === '3'
      ? { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }] }
      : body

    const response = await this.request<{ id: string; body: unknown }>(
      'POST',
      `/rest/api/${this.apiVersion}/issue/${issueKey}/comment`,
      { body: commentBody },
    )

    return { id: response.id, body }
  }

  async assignIssue(issueKey: string, accountId: string): Promise<void> {
    // Cloud usa accountId, Server usa name
    const body = this.apiVersion === '3'
      ? { accountId }
      : { name: accountId }
    await this.request(
      'PUT',
      `/rest/api/${this.apiVersion}/issue/${issueKey}/assignee`,
      body,
    )
  }

  async getCurrentUser(): Promise<{ accountId: string; displayName: string }> {
    const response = await this.request<JiraMyselfResponse>(
      'GET',
      `/rest/api/${this.apiVersion}/myself`,
    )
    // Cloud usa accountId, Server usa name
    return {
      accountId: response.accountId ?? response.name ?? response.displayName,
      displayName: response.displayName,
    }
  }

  // ── Static: detect Jira type from serverInfo ──

  static async detect(
    jiraUrl: string,
    authHeader: string,
  ): Promise<{ jiraType: 'cloud' | 'server'; jiraApiVersion: '2' | '3' }> {
    const url = `${jiraUrl.replace(/\/+$/, '')}/rest/api/2/serverInfo`
    const res = await fetch(url, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error('Credenciales de Jira invalidas o sin permisos')
      }
      throw new Error(`Jira no accesible: HTTP ${res.status}`)
    }

    const info = (await res.json()) as JiraServerInfo

    // Cloud tiene deploymentType 'Cloud', Server tiene 'Server' o 'DataCenter'
    const isCloud = info.deploymentType === 'Cloud'
    return {
      jiraType: isCloud ? 'cloud' : 'server',
      jiraApiVersion: isCloud ? '3' : '2',
    }
  }

  // ── Private ──

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      Accept: 'application/json',
    }

    const init: RequestInit = { method, headers }

    if (body) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }

    let res: Response
    try {
      res = await fetch(url, init)
    } catch (err) {
      throw new Error(`Jira no accesible: ${err instanceof Error ? err.message : String(err)}`)
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error('Credenciales de Jira invalidas o sin permisos. Usa df_project_update para actualizar.')
      }
      if (res.status === 404) {
        throw new Error(`Recurso no encontrado en Jira: ${path}`)
      }
      const text = await res.text().catch(() => '')
      throw new Error(`Error de Jira: HTTP ${res.status} — ${text}`)
    }

    // Algunas respuestas (como transition POST) no tienen body
    const text = await res.text()
    if (!text) return undefined as T
    return JSON.parse(text) as T
  }

  private mapIssue(raw: JiraIssueResponse): JiraIssue {
    const f = raw.fields
    if (!f) {
      return {
        key: raw.key,
        summary: '(sin datos)',
        description: null,
        status: { name: 'Unknown', id: '0' },
        priority: { name: 'None', id: '0' },
        assignee: null,
        reporter: { displayName: 'Unknown' },
        labels: [],
        components: [],
        subtasks: [],
        comments: [],
        created: '',
        updated: '',
      }
    }
    return {
      key: raw.key,
      summary: f.summary ?? '(sin titulo)',
      description: this.extractDescription(f.description),
      status: { name: f.status?.name ?? 'Unknown', id: f.status?.id ?? '0' },
      priority: { name: f.priority?.name ?? 'None', id: f.priority?.id ?? '0' },
      assignee: f.assignee
        ? { displayName: f.assignee.displayName, emailAddress: f.assignee.emailAddress }
        : null,
      reporter: f.reporter
        ? { displayName: f.reporter.displayName, emailAddress: f.reporter.emailAddress }
        : { displayName: 'Unknown' },
      labels: f.labels ?? [],
      components: (f.components ?? []).map((c) => ({ name: c.name })),
      subtasks: (f.subtasks ?? []).map((s) => ({
        key: s.key,
        summary: s.fields?.summary ?? '',
        status: s.fields?.status?.name ?? 'Unknown',
      })),
      comments: (f.comment?.comments ?? []).map((c) => ({
        author: c.author?.displayName ?? 'Unknown',
        body: this.extractDescription(c.body) ?? '',
        created: c.created,
      })),
      created: f.created ?? '',
      updated: f.updated ?? '',
    }
  }

  private extractDescription(desc: unknown): string | null {
    if (!desc) return null
    if (typeof desc === 'string') return desc

    // Jira Cloud v3 usa ADF (Atlassian Document Format)
    // Extraer texto plano recursivamente
    if (typeof desc === 'object' && desc !== null && 'content' in desc) {
      return this.extractAdfText(desc)
    }

    return String(desc)
  }

  private extractAdfText(node: unknown): string {
    if (!node || typeof node !== 'object') return ''

    const n = node as Record<string, unknown>

    if (n.type === 'text' && typeof n.text === 'string') {
      return n.text
    }

    if (n.type === 'hardBreak') return '\n'

    if (Array.isArray(n.content)) {
      const inner = n.content.map((child: unknown) => this.extractAdfText(child)).join('')
      // Separar bloques (paragraph, heading, etc.) con newlines
      const blockTypes = ['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'listItem']
      if (blockTypes.includes(n.type as string)) {
        return inner + '\n'
      }
      return inner
    }

    return ''
  }
}
