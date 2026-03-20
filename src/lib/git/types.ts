import type { PullRequestResult } from '../types.js'

export interface CreatePullRequestParams {
  title: string
  body?: string
  head: string
  base: string
}

export interface CreateMergeRequestParams {
  title: string
  description?: string
  sourceBranch: string
  targetBranch: string
}

export interface GitProviderClient {
  createPullRequest(params: CreatePullRequestParams): Promise<PullRequestResult>
  findPullRequest(head: string): Promise<PullRequestResult | null>
}
