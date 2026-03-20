import type { GitRemoteInfo } from '../types.js'
import { gitExec } from '../git-exec.js'

/**
 * Parsea una URL de remote git y detecta el provider.
 *
 * Soporta:
 * - SSH:   git@github.com:owner/repo.git
 * - HTTPS: https://github.com/owner/repo.git
 * - HTTPS: https://gitlab.company.com/group/repo.git
 * - SSH:   git@gitlab.company.com:group/repo.git
 */
export function parseRemoteString(remoteUrl: string): GitRemoteInfo {
  let owner: string
  let repo: string
  let host: string

  // SSH format: git@host:owner/repo.git
  const sshMatch = remoteUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/)
  if (sshMatch) {
    host = sshMatch[1]
    const path = sshMatch[2]
    const parts = path.split('/')
    repo = parts.pop()!
    owner = parts.join('/')
  } else {
    // HTTPS format: https://host/owner/repo.git
    const httpsMatch = remoteUrl.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/)
    if (!httpsMatch) {
      throw new Error(`No se pudo parsear la URL del remote: ${remoteUrl}`)
    }
    host = httpsMatch[1]
    const path = httpsMatch[2]
    const parts = path.split('/')
    repo = parts.pop()!
    owner = parts.join('/')
  }

  // Detectar provider por host
  let provider: 'github' | 'gitlab'
  if (host === 'github.com') {
    provider = 'github'
  } else {
    // gitlab.com o cualquier otro host → GitLab (self-hosted o cloud)
    provider = 'gitlab'
  }

  return { provider, owner, repo, url: remoteUrl }
}

/**
 * Detecta el remote origin del directorio actual y lo parsea.
 */
export async function parseRemoteUrl(cwd?: string): Promise<GitRemoteInfo> {
  const remoteUrl = await gitExec(['remote', 'get-url', 'origin'], cwd)
  if (!remoteUrl) {
    throw new Error('No hay remote "origin" configurado. Configura un remote primero.')
  }
  return parseRemoteString(remoteUrl)
}
