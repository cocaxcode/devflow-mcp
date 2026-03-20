import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Storage } from '../lib/storage.js'
import { gitExec, gitExecRaw, getWorkingDirStatus, getCurrentBranch } from '../lib/git-exec.js'
import { createGitProviderClient } from '../lib/git/factory.js'

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

        // Guard: verificar working directory limpio
        const status = await getWorkingDirStatus()
        if (!status.clean) {
          const parts: string[] = []
          if (status.uncommittedFiles.length > 0) {
            parts.push(`Archivos sin commitear:\n${status.uncommittedFiles.join('\n')}`)
          }
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
          await gitExec(['rev-parse', '--verify', branchName])
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Error: La branch '${branchName}' ya existe.` }],
          }
        } catch {
          // Branch no existe — OK
        }

        // Ejecutar: checkout base → pull → create branch
        await gitExec(['checkout', config.baseBranch])
        await gitExec(['pull', 'origin', config.baseBranch])
        await gitExec(['checkout', '-b', branchName])

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
        // Buscar en ramas locales y remotas
        const allBranches = await gitExec(['branch', '-a', '--list', `*${params.issueKey}*`])
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
        // Guard: verificar working directory limpio
        const status = await getWorkingDirStatus()
        if (!status.clean) {
          const parts: string[] = []
          if (status.uncommittedFiles.length > 0) {
            parts.push(`Archivos sin commitear:\n${status.uncommittedFiles.join('\n')}`)
          }
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

        await gitExec(['checkout', params.branch])
        const current = await getCurrentBranch()

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
        const branch = await getCurrentBranch()
        const output = await gitExec(['pull', 'origin', branch])

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
        const currentBranch = await getCurrentBranch()

        // Verificar regla no-merge-to-base
        const rules = await storage.getActiveRules('git', config.name)
        const noMergeRule = rules.find((r) => r.name === 'no-merge-to-base')
        if (noMergeRule && currentBranch === config.baseBranch) {
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
        if (noMergeFromDevRule && devBranches.includes(params.branch)) {
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
        const result = await gitExecRaw(['merge', params.branch])

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
        const conflictResult = await gitExecRaw(['diff', '--name-only', '--diff-filter=U'])
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
        const branch = await getCurrentBranch()

        // Verificar regla no-merge-to-base
        const config = await storage.resolveProject(process.cwd())
        const rules = await storage.getActiveRules('git', config.name)
        const noMergeRule = rules.find((r) => r.name === 'no-merge-to-base')
        if (noMergeRule && branch === config.baseBranch) {
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: `Bloqueado por regla '${noMergeRule.name}': No se puede pushear directamente a '${config.baseBranch}'. Usa una branch y crea un PR/MR.`,
            }],
          }
        }

        // Verificar que hay algo que pushear
        const status = await getWorkingDirStatus()
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
                action: `git push origin ${branch}`,
                message: 'Usa confirm: true para ejecutar el push.',
              }, null, 2),
            }],
          }
        }

        // Con confirm → ejecutar
        const output = await gitExec(['push', 'origin', branch])

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
        const currentBranch = await getCurrentBranch()

        // Validar que no estemos en la rama base
        if (currentBranch === config.baseBranch) {
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
