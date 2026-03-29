import type { PullRequestResult } from '../types.js'
import type { GitProviderClient, CreatePullRequestParams } from './types.js'

interface GitLabMRResponse {
  web_url: string
  iid: number
  title: string
  state: string
}

interface GitLabProjectResponse {
  id: number
  path_with_namespace: string
}

export class GitLabClient implements GitProviderClient {
  private readonly token: string
  private readonly baseUrl: string
  private readonly projectId: number

  constructor(token: string, baseUrl: string, projectId: number) {
    const url = baseUrl.replace(/\/+$/, '')
    if (!/^https:\/\//i.test(url)) {
      throw new Error('La URL de GitLab debe usar HTTPS para proteger las credenciales.')
    }
    this.token = token
    this.baseUrl = url
    this.projectId = projectId
  }

  async createPullRequest(params: CreatePullRequestParams): Promise<PullRequestResult> {
    const res = await this.request<GitLabMRResponse>(
      'POST',
      `/api/v4/projects/${this.projectId}/merge_requests`,
      {
        title: params.title,
        description: params.body ?? '',
        source_branch: params.head,
        target_branch: params.base,
      },
    )

    return {
      provider: 'gitlab',
      url: res.web_url,
      iid: res.iid,
      title: res.title,
      state: res.state,
    }
  }

  async findPullRequest(head: string): Promise<PullRequestResult | null> {
    const params = new URLSearchParams({
      source_branch: head,
      state: 'opened',
    })

    const results = await this.request<GitLabMRResponse[]>(
      'GET',
      `/api/v4/projects/${this.projectId}/merge_requests?${params}`,
    )

    if (!results || results.length === 0) return null

    const mr = results[0]
    return {
      provider: 'gitlab',
      url: mr.web_url,
      iid: mr.iid,
      title: mr.title,
      state: mr.state,
    }
  }

  /**
   * Obtener el project ID de GitLab a partir de owner/repo.
   * Se usa durante df_project_setup.
   */
  static async getProjectId(
    token: string,
    baseUrl: string,
    owner: string,
    repo: string,
  ): Promise<number> {
    const encodedPath = encodeURIComponent(`${owner}/${repo}`)
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v4/projects/${encodedPath}`

    const res = await fetch(url, {
      headers: {
        'PRIVATE-TOKEN': token,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Token de GitLab invalido. Verifica tus credenciales.')
      }
      if (res.status === 404) {
        throw new Error(`Proyecto GitLab no encontrado: ${owner}/${repo}`)
      }
      throw new Error(`GitLab: HTTP ${res.status}`)
    }

    const project = (await res.json()) as GitLabProjectResponse
    return project.id
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'PRIVATE-TOKEN': this.token,
      Accept: 'application/json',
    }

    const init: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(30_000),
    }

    if (body) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }

    let res: Response
    try {
      res = await fetch(url, init)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new Error('GitLab no responde (timeout 30s)')
      }
      throw new Error(`GitLab no accesible: ${err instanceof Error ? err.message : String(err)}`)
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Token de GitLab invalido. Usa df_project_update para actualizar.')
      }
      if (res.status === 404) {
        throw new Error(`Recurso no encontrado en GitLab: ${path}`)
      }
      if (res.status === 409) {
        throw new Error('GitLab: ya existe un merge request para esta rama')
      }
      throw new Error(`GitLab: HTTP ${res.status}`)
    }

    return (await res.json()) as T
  }
}
