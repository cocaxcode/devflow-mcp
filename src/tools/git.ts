import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Storage } from '../lib/storage.js'
import { gitExec, gitExecRaw, getWorkingDirStatus, getCurrentBranch } from '../lib/git-exec.js'
import { createGitProviderClient } from '../lib/git/factory.js'

/** Resuelve el directorio de trabajo del proyecto */
function getProjectCwd(config: { paths: string[] }): string {
  return config.paths[0] ?? process.cwd()
}

async function validateBranchRef(ref: string, cwd: string): Promise<string> {
  if (!ref || ref.startsWith('-') || ref.includes('@{') || (ref.startsWith('refs/') && !/^refs\/(heads|remotes)\//.test(ref))) {
    throw new Error('Referencia de rama invalida')
  }
  const shortRef = ref.replace(/^refs\/(heads|remotes)\//, '')
  const result = await gitExecRaw(['check-ref-format', '--branch', shortRef], cwd)
  if (result.code !== 0) throw new Error('Referencia de rama invalida')
  if (ref.startsWith('refs/heads/')) return shortRef
  const remotes = (await gitExec(['remote'], cwd)).split('\n').filter(Boolean)
  const remoteRef = shortRef.replace(/^remotes\//, '')
  const remote = remotes.find((name) => remoteRef.startsWith(`${name}/`))
  if (remote) return remoteRef.slice(remote.length + 1)
  if (ref.startsWith('refs/remotes/') || ref.startsWith('remotes/')) return remoteRef.replace(/^[^/]+\//, '')
  // Origin is the default remote even before it has been configured.
  return remoteRef.replace(/^origin\//, '')
}

async function resolveMergeRef(ref: string, cwd: string): Promise<{ ref: string; branch: string }> {
  await validateBranchRef(ref, cwd)
  const candidates = new Set([ref, `refs/${ref}`, `refs/tags/${ref}`, `refs/heads/${ref}`, `refs/remotes/${ref}`, `refs/remotes/${ref}/HEAD`])
  const refs = (await gitExec(['for-each-ref', '--format=%(refname)'], cwd)).split('\n').filter((name) => candidates.has(name))
  if (refs.length !== 1) throw new Error('Referencia de rama ambigua o inexistente')
  const symbolic = await gitExecRaw(['symbolic-ref', '-q', refs[0]], cwd)
  const resolved = symbolic.code === 0 ? symbolic.stdout : refs[0]
  let branch: string
  if (resolved.startsWith('refs/heads/')) {
    branch = resolved.slice('refs/heads/'.length)
  } else if (resolved.startsWith('refs/remotes/')) {
    const remoteBranch = resolved.slice('refs/remotes/'.length)
    const remotes = (await gitExec(['remote'], cwd)).split('\n').filter(Boolean)
    const remote = remotes.sort((a, b) => b.length - a.length).find((name) => remoteBranch.startsWith(`${name}/`))
    if (!remote) throw new Error('Referencia remota invalida')
    branch = remoteBranch.slice(remote.length + 1)
  } else {
    throw new Error('La referencia no corresponde a una rama local o remota')
  }
  return { ref: resolved, branch }
}

export function registerGitTools(server: McpServer, storage: Storage): void {
  // ── df_branch ──
  server.tool(
    'df_branch',
    'Crear una nueva branch desde la rama base con formato feat/PROJ-123-desc o fix/PROJ-123-desc. Requiere confirm: true. Verifica que no haya cambios sin pushear.',
    {
      issueKey: z.string().describe('Clave del issue de Jira (ej: PROJ-123)'),
      type: z.enum(['feat', 'fix']).describe('Tipo de branch: feat o fix'),
      description: z.string().describe('Descripcion corta en kebab-case (ej: add-login)'),
      confirm: z.boolean().optional().describe('true para crear la branch'),
    },
    async (params) => {
      try {
        const config = await storage.resolveProject(process.cwd())
        const cwd = getProjectCwd(config)

        // Guard: verificar working directory limpio
        const status = await getWorkingDirStatus(cwd)
        if (!status.clean) {
          const parts: string[] = []
          if (status.uncommittedFiles.length > 0) {
            parts.push(`Archivos sin commitear:\n${status.uncommittedFiles.join('\n')}`)
          }
          if (!status.hasUpstream) parts.push('La rama actual no tiene upstream configurado.')
          if (status.unpushedCommits.length > 0) {
            parts.push(`Commits sin pushear:\n${status.unpushedCommits.join('\n')}`)
          }
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: `Error: Hay cambios pendientes. Resuelve antes de crear la branch.\n\n${parts.join('\n\n')}`,
            }],
          }
        }

        const branchName = `${params.type}/${params.issueKey}-${params.description}`
        await validateBranchRef(branchName, cwd)
        await validateBranchRef(config.baseBranch, cwd)

        // Sin confirm → preview
        if (!params.confirm) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                preview: true,
                branch: branchName,
                baseBranch: config.baseBranch,
                actions: [
                  `git checkout ${config.baseBranch}`,
                  `git pull origin ${config.baseBranch}`,
                  `git checkout -b ${branchName}`,
                ],
                message: 'Usa confirm: true para crear la branch.',
              }, null, 2),
            }],
          }
        }

        // Verificar que la branch no exista
        try {
          await gitExec(['rev-parse', '--verify', branchName], cwd)
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Error: La branch '${branchName}' ya existe.` }],
          }
        } catch {
          // Branch no existe — OK
        }

        // Ejecutar: checkout base → pull → create branch
        await gitExec(['checkout', config.baseBranch], cwd)
        await gitExec(['pull', 'origin', config.baseBranch], cwd)
        await gitExec(['checkout', '-b', branchName], cwd)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              branch: branchName,
              baseBranch: config.baseBranch,
            }, null, 2),
          }],
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        }
      }
    },
  )

  // ── df_find_branch ──
  server.tool(
    'df_find_branch',
    'Buscar si existe una rama local o remota que contenga un issue key (ej: PROJ-123). Devuelve la rama si existe o null.',
    {
      issueKey: z.string().describe('Clave del issue (ej: PROJ-123)'),
    },
    async (params) => {
      try {
        const config = await storage.resolveProject(process.cwd())
        const cwd = getProjectCwd(config)
        // Buscar en ramas locales y remotas
        const allBranches = await gitExec(['branch', '-a', '--list', `*${params.issueKey}*`], cwd)
        const branches = allBranches
          .split('\n')
          .map((b) => b.trim().replace(/^\* /, '').replace(/^remotes\/origin\//, ''))
          .filter(Boolean)
          // Eliminar duplicados (local y remote pueden tener la misma)
          .filter((b, i, arr) => arr.indexOf(b) === i)

        if (branches.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ found: false, issueKey: params.issueKey }, null, 2),
            }],
          }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ found: true, issueKey: params.issueKey, branches }, null, 2),
          }],
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        }
      }
    },
  )

  // ── df_checkout ──
  server.tool(
    'df_checkout',
    'Cambiar a una rama existente. Verifica que no haya cambios sin pushear antes.',
    {
      branch: z.string().describe('Nombre de la rama'),
    },
    async (params) => {
      try {
        const config = await storage.resolveProject(process.cwd())
        const cwd = getProjectCwd(config)

        await validateBranchRef(params.branch, cwd)

        // Guard: verificar working directory limpio
        const status = await getWorkingDirStatus(cwd)
        if (!status.clean) {
          const parts: string[] = []
          if (status.uncommittedFiles.length > 0) {
            parts.push(`Archivos sin commitear:\n${status.uncommittedFiles.join('\n')}`)
          }
          if (!status.hasUpstream) parts.push('La rama actual no tiene upstream configurado.')
          if (status.unpushedCommits.length > 0) {
            parts.push(`Commits sin pushear:\n${status.unpushedCommits.join('\n')}`)
          }
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: `Error: Hay cambios pendientes. Resuelve antes de cambiar de rama.\n\n${parts.join('\n\n')}`,
            }],
          }
        }

        const resolution = await gitExecRaw(
          ['rev-parse', '--symbolic-full-name', '--verify', '--end-of-options', params.branch],
          cwd,
        )
        let resolvedRef = resolution.stdout
        if (resolution.code !== 0) {
          const remotes = (await gitExec(['remote'], cwd)).split('\n').filter(Boolean)
          const refs = (await gitExec(['for-each-ref', '--format=%(refname)', 'refs/remotes/'], cwd)).split('\n')
          const matches = remotes.map((remote) => `refs/remotes/${remote}/${params.branch}`).filter((ref) => refs.includes(ref))
          if (matches.length !== 1) throw new Error('Referencia remota ambigua o inexistente')
          resolvedRef = matches[0]
        }
        if (resolvedRef.startsWith('refs/remotes/')) {
          // Create an attached local tracking branch rather than checking out a remote in detached HEAD.
          await gitExec(['switch', '--track', '--', resolvedRef], cwd)
        } else if (resolvedRef.startsWith('refs/heads/')) {
          await gitExec(['switch', '--', resolvedRef.slice('refs/heads/'.length)], cwd)
        } else {
          throw new Error('La referencia no corresponde a una rama local o remota')
        }
        const current = await getCurrentBranch(cwd)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: true, branch: current }, null, 2),
          }],
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        }
      }
    },
  )

  // ── df_pull ──
  server.tool(
    'df_pull',
    'Hacer pull de la rama actual desde el remote.',
    {},
    async () => {
      try {
        const config = await storage.resolveProject(process.cwd())
        const cwd = getProjectCwd(config)
        const branch = await getCurrentBranch(cwd)
        const output = await gitExec(['pull', 'origin', branch], cwd)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              branch,
              output: output || 'Already up to date.',
            }, null, 2),
          }],
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        }
      }
    },
  )

  // ── df_merge ──
  server.tool(
    'df_merge',
    'Mergear una rama en la rama actual. Requiere confirm: true. Si hay conflictos, los reporta sin abortar.',
    {
      branch: z.string().describe('Nombre de la rama a mergear en la rama actual'),
      confirm: z.boolean().optional().describe('true para ejecutar el merge'),
    },
    async (params) => {
      try {
        const config = await storage.resolveProject(process.cwd())
        const cwd = getProjectCwd(config)
        const source = await resolveMergeRef(params.branch, cwd)
        const currentBranch = await getCurrentBranch(cwd)

        // Verificar regla no-merge-to-base
        const rules = await storage.getActiveRules('git', config.name)
        const noMergeRule = rules.find((r) => r.name === 'no-merge-to-base')
        if (noMergeRule && currentBranch === await validateBranchRef(config.baseBranch, cwd)) {
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: `Bloqueado por regla '${noMergeRule.name}': No se puede mergear directamente a '${config.baseBranch}'. Usa un PR/MR.`,
            }],
          }
        }

        // Verificar regla no-merge-from-dev
        const devBranches = ['int', 'integration', 'dev', 'develop', 'development']
        const noMergeFromDevRule = rules.find((r) => r.name === 'no-merge-from-dev')
        if (noMergeFromDevRule && devBranches.includes(source.branch)) {
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: `Bloqueado por regla '${noMergeFromDevRule.name}': No se puede mergear '${params.branch}' hacia '${currentBranch}'. Las ramas de desarrollo solo reciben merges, no se sacan de ellas.`,
            }],
          }
        }

        // Sin confirm → preview
        if (!params.confirm) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                preview: true,
                action: `git merge ${params.branch}`,
                into: currentBranch,
                from: params.branch,
                message: 'Usa confirm: true para ejecutar el merge.',
              }, null, 2),
            }],
          }
        }

        // Ejecutar merge
        const result = await gitExecRaw(['merge', '--', source.ref], cwd)

        // Merge limpio
        if (result.code === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                into: currentBranch,
                from: params.branch,
                output: result.stdout || 'Merge completado.',
              }, null, 2),
            }],
          }
        }

        // Posible conflicto — listar archivos en conflicto
        const conflictResult = await gitExecRaw(['diff', '--name-only', '--diff-filter=U'], cwd)
        const conflictedFiles = conflictResult.stdout
          .split('\n')
          .filter(Boolean)

        if (conflictedFiles.length > 0) {
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                conflict: true,
                into: currentBranch,
                from: params.branch,
                conflictedFiles,
                message: 'Hay conflictos en el merge. Resuelve los archivos listados, haz git add y git commit para completar.',
              }, null, 2),
            }],
          }
        }

        // Otro error de merge
        return {
          isError: true,
          content: [{
            type: 'text' as const,
            text: `Error en merge: ${result.stderr || result.stdout}`,
          }],
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        }
      }
    },
  )

  // ── df_push ──
  server.tool(
    'df_push',
    'Hacer push de la rama actual al remote. Requiere confirm: true para ejecutar. Sin confirm devuelve preview.',
    {
      confirm: z.boolean().optional().describe('true para ejecutar el push'),
    },
    async (params) => {
      try {
        const config = await storage.resolveProject(process.cwd())
        const cwd = getProjectCwd(config)
        const branch = await getCurrentBranch(cwd)

        const status = await getWorkingDirStatus(cwd)
        let remote = 'origin'
        let destination = `refs/heads/${branch}`
        if (status.hasUpstream) {
          const remoteConfig = await gitExec(['config', '--get-all', `branch.${branch}.remote`], cwd)
          const mergeConfig = await gitExec(['config', '--get-all', `branch.${branch}.merge`], cwd)
          if (remoteConfig.includes('\n') || mergeConfig.includes('\n') || !mergeConfig.startsWith('refs/heads/')) {
            throw new Error('Upstream ambiguo o invalido')
          }
          remote = remoteConfig
          destination = mergeConfig
        }
        if (!branch || remote.startsWith('-') || !remote || destination !== `refs/heads/${await validateBranchRef(destination, cwd)}`) {
          throw new Error('Destino de push invalido')
        }

        // Verificar regla no-merge-to-base
        const rules = await storage.getActiveRules('git', config.name)
        const noMergeRule = rules.find((r) => r.name === 'no-merge-to-base')
        const baseBranch = await validateBranchRef(config.baseBranch, cwd)
        if (noMergeRule && (branch === baseBranch || destination === `refs/heads/${baseBranch}`)) {
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: `Bloqueado por regla '${noMergeRule.name}': No se puede pushear directamente a '${config.baseBranch}'. Usa una branch y crea un PR/MR.`,
            }],
          }
        }

        // Verificar que hay algo que pushear
        if (status.uncommittedFiles.length > 0) {
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: `Error: Hay archivos sin commitear. Haz commit antes de push.\n\n${status.uncommittedFiles.join('\n')}`,
            }],
          }
        }

        if (status.unpushedCommits.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                skipped: true,
                branch,
                message: 'No hay commits pendientes de push.',
              }, null, 2),
            }],
          }
        }

        // Sin confirm → preview
        if (!params.confirm) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                preview: true,
                branch,
                commits: status.unpushedCommits,
                action: `git push --no-follow-tags --recurse-submodules=no ${status.hasUpstream ? '' : '--set-upstream '}${remote} refs/heads/${branch}:${destination}`,
                message: 'Usa confirm: true para ejecutar el push.',
              }, null, 2),
            }],
          }
        }

        // Con confirm → ejecutar
        const output = await gitExec(['push', '--no-follow-tags', '--recurse-submodules=no', ...(status.hasUpstream ? [] : ['--set-upstream']), '--', remote, `refs/heads/${branch}:${destination}`], cwd)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              branch,
              pushedCommits: status.unpushedCommits.length,
              output: output || 'Push completado.',
            }, null, 2),
          }],
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        }
      }
    },
  )

  // ── df_pr ──
  server.tool(
    'df_pr',
    'Crear un Pull Request (GitHub) o Merge Request (GitLab) para la rama actual.',
    {
      title: z.string().describe('Titulo del PR/MR'),
      body: z.string().optional().describe('Descripcion del PR/MR'),
    },
    async (params) => {
      try {
        const config = await storage.resolveProject(process.cwd())
        const cwd = getProjectCwd(config)
        const currentBranch = await getCurrentBranch(cwd)

        // Validar que no estemos en la rama base
        if (currentBranch === await validateBranchRef(config.baseBranch, cwd)) {
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: `Error: No se puede crear un PR/MR desde la rama base '${config.baseBranch}'.`,
            }],
          }
        }

        const gitClient = createGitProviderClient(config)

        // Verificar si ya existe un PR/MR
        const existing = await gitClient.findPullRequest(currentBranch)
        if (existing) {
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: 'Ya existe un PR/MR para esta rama',
                url: existing.url,
                title: existing.title,
                state: existing.state,
              }, null, 2),
            }],
          }
        }

        const result = await gitClient.createPullRequest({
          title: params.title,
          body: params.body,
          head: currentBranch,
          base: config.baseBranch,
        })

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              provider: result.provider,
              url: result.url,
              number: result.number ?? result.iid,
              title: result.title,
            }, null, 2),
          }],
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        }
      }
    },
  )
}
