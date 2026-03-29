import type { PullRequestResult } from '../types.js'
import type { GitProviderClient, CreatePullRequestParams } from './types.js'

interface GitHubPRResponse {
  html_url: string
  number: number
  title: string
  state: string
}

export class GitHubClient implements GitProviderClient {
  private readonly token: string
  private readonly owner: string
  private readonly repo: string

  constructor(token: string, owner: string, repo: string) {
    this.token = token
    this.owner = owner
    this.repo = repo
  }

  async createPullRequest(params: CreatePullRequestParams): Promise<PullRequestResult> {
    const res = await this.request<GitHubPRResponse>(
      'POST',
      `/repos/${this.owner}/${this.repo}/pulls`,
      {
        title: params.title,
        body: params.body ?? '',
        head: params.head,
        base: params.base,
      },
    )

    return {
      provider: 'github',
      url: res.html_url,
      number: res.number,
      title: res.title,
      state: res.state,
    }
  }

  async findPullRequest(head: string): Promise<PullRequestResult | null> {
    const params = new URLSearchParams({
      head: `${this.owner}:${head}`,
      state: 'open',
    })

    const results = await this.request<GitHubPRResponse[]>(
      'GET',
      `/repos/${this.owner}/${this.repo}/pulls?${params}`,
    )

    if (!results || results.length === 0) return null

    const pr = results[0]
    return {
      provider: 'github',
      url: pr.html_url,
      number: pr.number,
      title: pr.title,
      state: pr.state,
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `https://api.github.com${path}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'devflow-mcp',
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
        throw new Error('GitHub no responde (timeout 30s)')
      }
      throw new Error(`GitHub no accesible: ${err instanceof Error ? err.message : String(err)}`)
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Token de GitHub invalido. Usa df_project_update para actualizar.')
      }
      if (res.status === 404) {
        throw new Error(`Repositorio no encontrado: ${this.owner}/${this.repo}`)
      }
      if (res.status === 422) {
        const error = await res.json().catch(() => ({})) as Record<string, unknown>
        const msg = (error.errors as Array<{ message: string }>)?.[0]?.message ?? 'Validacion fallida'
        throw new Error(`GitHub: ${msg}`)
      }
      throw new Error(`GitHub: HTTP ${res.status}`)
    }

    return (await res.json()) as T
  }
}
