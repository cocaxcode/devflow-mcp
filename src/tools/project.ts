import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Storage } from '../lib/storage.js'
import type { ProjectConfig, JiraCloudAuth, JiraServerAuth } from '../lib/types.js'
import { JiraClient } from '../lib/jira/client.js'
import { parseRemoteUrl } from '../lib/git/detect.js'
import { detectBaseBranch } from '../lib/git-exec.js'
import { GitLabClient } from '../lib/git/gitlab.js'

export function registerProjectTools(server: McpServer, storage: Storage): void {
  // ── df_project_setup ──
  server.tool(
    'df_project_setup',
    'Configurar un nuevo proyecto: vincula Jira + Git provider. Auto-detecta tipo de Jira, version API, provider Git y rama base.',
    {
      name: z.string().describe('Nombre del proyecto'),
      jiraUrl: z.string().describe('URL de Jira (ej: https://myteam.atlassian.net)'),
      jiraProjectKey: z.string().describe('Clave del proyecto en Jira (ej: PROJ, DEV, BACK)'),
      jiraEmail: z.string().optional().describe('Email para Jira Cloud'),
      jiraToken: z.string().optional().describe('API Token para Jira Cloud'),
      jiraPat: z.string().optional().describe('Personal Access Token para Jira Server'),
      gitToken: z.string().describe('Token de GitHub o GitLab'),
    },
    async (params) => {
      try {
        // Validar auth de Jira
        let jiraAuth: JiraCloudAuth | JiraServerAuth
        let authHeader: string

        if (params.jiraPat) {
          jiraAuth = { type: 'server', pat: params.jiraPat }
          authHeader = `Bearer ${params.jiraPat}`
        } else if (params.jiraEmail && params.jiraToken) {
          jiraAuth = { type: 'cloud', email: params.jiraEmail, apiToken: params.jiraToken }
          const encoded = Buffer.from(`${params.jiraEmail}:${params.jiraToken}`).toString('base64')
          authHeader = `Basic ${encoded}`
        } else {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: 'Error: Proporciona jiraEmail + jiraToken (Cloud) o jiraPat (Server)' }],
          }
        }

        // Detectar tipo y version de Jira
        const { jiraType, jiraApiVersion } = await JiraClient.detect(params.jiraUrl, authHeader)

        // Detectar git remote
        const remote = await parseRemoteUrl()

        // Detectar rama base
        const baseBranch = await detectBaseBranch()

        // Si es GitLab, obtener project ID
        let repoId: number | undefined
        let gitProviderUrl: string | undefined

        if (remote.provider === 'gitlab') {
          const glBaseUrl = remote.url.match(/^git@([^:]+):/)?.[1]
            ?? remote.url.match(/^https?:\/\/([^/]+)/)?.[1]
            ?? 'gitlab.com'
          gitProviderUrl = `https://${glBaseUrl}`
          repoId = await GitLabClient.getProjectId(params.gitToken, gitProviderUrl, remote.owner, remote.repo)
        }

        const now = new Date().toISOString()
        const config: ProjectConfig = {
          name: params.name,
          jiraUrl: params.jiraUrl.replace(/\/+$/, ''),
          jiraType,
          jiraApiVersion,
          jiraProjectKey: params.jiraProjectKey,
          jiraAuth,
          gitProvider: remote.provider,
          gitProviderUrl,
          gitAuth: { token: params.gitToken },
          baseBranch,
          paths: [process.cwd()],
          repoOwner: remote.owner,
          repoName: remote.repo,
          repoId,
          createdAt: now,
          updatedAt: now,
        }

        await storage.saveProject(config)
        await storage.setActiveProject(params.name)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              message: `Proyecto '${params.name}' configurado correctamente`,
              jiraType,
              jiraApiVersion,
              gitProvider: remote.provider,
              baseBranch,
              repoOwner: remote.owner,
              repoName: remote.repo,
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

  // ── df_project_update ──
  server.tool(
    'df_project_update',
    'Modificar la configuracion de un proyecto existente.',
    {
      name: z.string().describe('Nombre del proyecto a modificar'),
      jiraUrl: z.string().optional().describe('Nueva URL de Jira'),
      jiraProjectKey: z.string().optional().describe('Nueva clave del proyecto en Jira'),
      jiraEmail: z.string().optional().describe('Nuevo email para Jira Cloud'),
      jiraToken: z.string().optional().describe('Nuevo API Token para Jira Cloud'),
      jiraPat: z.string().optional().describe('Nuevo PAT para Jira Server'),
      gitToken: z.string().optional().describe('Nuevo token de Git provider'),
      baseBranch: z.string().optional().describe('Rama base (main/master)'),
    },
    async (params) => {
      try {
        const project = await storage.getProject(params.name)
        if (!project) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Error: Proyecto '${params.name}' no encontrado` }],
          }
        }

        // Actualizar campos proporcionados
        if (params.jiraPat) {
          project.jiraAuth = { type: 'server', pat: params.jiraPat }
        } else if (params.jiraEmail && params.jiraToken) {
          project.jiraAuth = { type: 'cloud', email: params.jiraEmail, apiToken: params.jiraToken }
        } else if (params.jiraToken && project.jiraAuth.type === 'cloud') {
          project.jiraAuth = { ...project.jiraAuth, apiToken: params.jiraToken }
        }

        if (params.jiraUrl) {
          project.jiraUrl = params.jiraUrl.replace(/\/+$/, '')
          // Re-detectar tipo y version
          let authHeader: string
          if (project.jiraAuth.type === 'cloud') {
            const encoded = Buffer.from(`${project.jiraAuth.email}:${project.jiraAuth.apiToken}`).toString('base64')
            authHeader = `Basic ${encoded}`
          } else {
            authHeader = `Bearer ${project.jiraAuth.pat}`
          }
          const { jiraType, jiraApiVersion } = await JiraClient.detect(project.jiraUrl, authHeader)
          project.jiraType = jiraType
          project.jiraApiVersion = jiraApiVersion
        }

        if (params.jiraProjectKey) {
          project.jiraProjectKey = params.jiraProjectKey
        }

        if (params.gitToken) {
          project.gitAuth = { token: params.gitToken }
        }

        if (params.baseBranch) {
          project.baseBranch = params.baseBranch
        }

        project.updatedAt = new Date().toISOString()
        await storage.saveProject(project)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ message: `Proyecto '${params.name}' actualizado`, project }, null, 2),
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

  // ── df_project_list ──
  server.tool(
    'df_project_list',
    'Listar todos los proyectos configurados.',
    {},
    async () => {
      try {
        const projects = await storage.listProjects()
        const activeName = await storage.getActiveProject()

        if (projects.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No hay proyectos configurados. Usa df_project_setup para crear uno.' }],
          }
        }

        const list = projects.map((p) => ({
          name: p.name,
          jiraUrl: p.jiraUrl,
          jiraType: p.jiraType,
          gitProvider: p.gitProvider,
          baseBranch: p.baseBranch,
          active: p.name === activeName,
        }))

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(list, null, 2) }],
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        }
      }
    },
  )

  // ── df_project_switch ──
  server.tool(
    'df_project_switch',
    'Cambiar el proyecto activo.',
    {
      name: z.string().describe('Nombre del proyecto'),
    },
    async (params) => {
      try {
        await storage.setActiveProject(params.name)
        return {
          content: [{ type: 'text' as const, text: `Proyecto activo: '${params.name}'` }],
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        }
      }
    },
  )

  // ── df_project_delete ──
  server.tool(
    'df_project_delete',
    'Eliminar un proyecto configurado.',
    {
      name: z.string().describe('Nombre del proyecto a eliminar'),
    },
    async (params) => {
      try {
        await storage.deleteProject(params.name)
        return {
          content: [{ type: 'text' as const, text: `Proyecto '${params.name}' eliminado` }],
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
