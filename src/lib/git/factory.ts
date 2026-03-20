import type { ProjectConfig } from '../types.js'
import type { GitProviderClient } from './types.js'
import { GitHubClient } from './github.js'
import { GitLabClient } from './gitlab.js'

export function createGitProviderClient(config: ProjectConfig): GitProviderClient {
  if (config.gitProvider === 'github') {
    return new GitHubClient(config.gitAuth.token, config.repoOwner, config.repoName)
  }

  if (!config.repoId) {
    throw new Error('GitLab project ID no configurado. Ejecuta df_project_setup de nuevo.')
  }

  const baseUrl = config.gitProviderUrl ?? 'https://gitlab.com'
  return new GitLabClient(config.gitAuth.token, baseUrl, config.repoId)
}
