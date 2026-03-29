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
    'Configurar un nuevo proyecto: vincula Jira + Git provider. Auto-detecta tipo de Jira, version API, provider Git y rama base. IMPORTANTE: Pide al usuario TODOS los datos de credenciales (email, token, URL). NUNCA inventes ni asumas credenciales.',
    {
      name: z.string().describe('Nombre del proyecto'),
      jiraUrl: z.string().describe('URL de Jira — PREGUNTA AL USUARIO, no la inventes (ej: https://myteam.atlassian.net)'),
      jiraProjectKey: z.string().describe('Clave del proyecto en Jira — PREGUNTA AL USUARIO (ej: PROJ, DEV, BACK)'),
      jiraEmail: z.string().optional().describe('Email de Jira Cloud — PREGUNTA AL USUARIO, no uses emails de otros contextos'),
      jiraToken: z.string().optional().describe('API Token de Jira Cloud — PREGUNTA AL USUARIO, es un secreto que solo el tiene'),
      jiraPat: z.string().optional().describe('Personal Access Token para Jira Server — PREGUNTA AL USUARIO'),
      gitToken: z.string().describe('Token de GitHub o GitLab — PREGUNTA AL USUARIO, es un secreto'),
      gitUrl: z.string().optional().describe('URL base del GitLab self-hosted (ej: https://gitlab.empresa.com). Si no se pasa, se extrae del remote.'),
      gitProject: z.string().optional().describe('Path completo del proyecto en GitLab (ej: grupo/subgrupo/repo). Util cuando el remote es un fork pero se quiere vincular al proyecto principal.'),
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
          const missing: string[] = []
          if (!params.jiraEmail) missing.push('jiraEmail (email de la cuenta de Jira Cloud)')
          if (!params.jiraToken) missing.push('jiraToken (API Token de Jira Cloud, se genera en https://id.atlassian.net/manage-profile/security/api-tokens)')
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Error: Faltan datos de autenticacion. Pide al usuario los siguientes datos:\n${missing.map(m => `  - ${m}`).join('\n')}\n\nAlternativamente, para Jira Server/DC usa jiraPat (Personal Access Token).\n\nIMPORTANTE: Estos datos son secretos del usuario. NUNCA los inventes ni asumas.` }],
          }
        }

        // Detectar tipo y version de Jira (valida credenciales contra la API)
        const { jiraType, jiraApiVersion } = await JiraClient.detect(params.jiraUrl, authHeader)

        // Validar que las credenciales pueden acceder al proyecto
        const tempConfig = {
          jiraUrl: params.jiraUrl.replace(/\/+$/, ''),
          jiraApiVersion,
          jiraAuth,
        } as ProjectConfig
        const tempClient = new JiraClient(tempConfig)
        try {
          await tempClient.getCurrentUser()
        } catch {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: 'Error: Las credenciales de Jira no son validas. Verifica el email y el API token.' }],
          }
        }

        // Detectar git remote
        const remote = await parseRemoteUrl()

        // Detectar rama base
        const baseBranch = await detectBaseBranch()

        // Si es GitLab, obtener project ID
        let repoId: number | undefined
        let gitProviderUrl: string | undefined

        // Resolver owner/repo: gitProject override o auto-detectado del remote
        let resolvedOwner = remote.owner
        let resolvedRepo = remote.repo

        if (params.gitProject) {
          const parts = params.gitProject.split('/')
          resolvedRepo = parts.pop()!
          resolvedOwner = parts.join('/')
        }

        if (remote.provider === 'gitlab') {
          if (params.gitUrl) {
            gitProviderUrl = params.gitUrl.replace(/\/+$/, '')
          } else {
            const glBaseUrl = remote.url.match(/^git@([^:]+):/)?.[1]
              ?? remote.url.match(/^https?:\/\/([^/]+)/)?.[1]
              ?? 'gitlab.com'
            gitProviderUrl = `https://${glBaseUrl}`
          }
          repoId = await GitLabClient.getProjectId(params.gitToken, gitProviderUrl, resolvedOwner, resolvedRepo)
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
          repoOwner: resolvedOwner,
          repoName: resolvedRepo,
          repoId,
          createdAt: now,
          updatedAt: now,
        }

        await storage.saveProject(config)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              message: `Proyecto '${params.name}' configurado correctamente`,
              jiraType,
              jiraApiVersion,
              gitProvider: remote.provider,
              baseBranch,
              repoOwner: resolvedOwner,
              repoName: resolvedRepo,
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
      gitUrl: z.string().optional().describe('URL base del GitLab self-hosted (ej: https://gitlab.empresa.com)'),
      gitProject: z.string().optional().describe('Path completo del proyecto en GitLab (ej: grupo/subgrupo/repo)'),
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

        // Guardar auth original por si la validacion falla
        const originalAuth = { ...project.jiraAuth }

        // Actualizar campos proporcionados
        if (params.jiraPat) {
          project.jiraAuth = { type: 'server', pat: params.jiraPat }
        } else if (params.jiraEmail && params.jiraToken) {
          project.jiraAuth = { type: 'cloud', email: params.jiraEmail, apiToken: params.jiraToken }
        } else if (params.jiraToken && project.jiraAuth.type === 'cloud') {
          project.jiraAuth = { ...project.jiraAuth, apiToken: params.jiraToken }
        } else if (params.jiraEmail && project.jiraAuth.type === 'cloud') {
          project.jiraAuth = { ...project.jiraAuth, email: params.jiraEmail }
        }

        // Validar credenciales si se cambio algo de auth
        if (params.jiraPat || params.jiraEmail || params.jiraToken) {
          try {
            const testClient = new JiraClient(project)
            await testClient.getCurrentUser()
          } catch {
            // Restaurar auth original
            project.jiraAuth = originalAuth as typeof project.jiraAuth
            return {
              isError: true,
              content: [{ type: 'text' as const, text: 'Error: Las credenciales de Jira actualizadas no son validas. Verifica email y API token. El proyecto NO fue modificado.' }],
            }
          }
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

        if (params.gitUrl) {
          project.gitProviderUrl = params.gitUrl.replace(/\/+$/, '')
        }

        if (params.gitProject) {
          const parts = params.gitProject.split('/')
          project.repoName = parts.pop()!
          project.repoOwner = parts.join('/')
        }

        // Re-obtener project ID si cambio algo de GitLab
        if (project.gitProvider === 'gitlab' && (params.gitUrl || params.gitProject || params.gitToken)) {
          const baseUrl = project.gitProviderUrl ?? 'https://gitlab.com'
          project.repoId = await GitLabClient.getProjectId(
            project.gitAuth.token,
            baseUrl,
            project.repoOwner,
            project.repoName,
          )
        }

        if (params.baseBranch) {
          project.baseBranch = params.baseBranch
        }

        project.updatedAt = new Date().toISOString()
        await storage.saveProject(project)

        // Respuesta sin credenciales
        const { jiraAuth: _ja, gitAuth: _ga, ...safeProject } = project
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ message: `Proyecto '${params.name}' actualizado`, project: safeProject }, null, 2),
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

        if (projects.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No hay proyectos configurados. Usa df_project_setup para crear uno.' }],
          }
        }

        // Default = el que tiene el CWD en sus paths (scope)
        const defaultProject = await storage.resolveDefaultProject(process.cwd())
        const defaultName = defaultProject?.name ?? null

        // Active = el de sesión (active-project file), si no hay → default
        const sessionActive = await storage.getActiveProject()
        const activeName = sessionActive ?? defaultName

        const list = projects.map((p) => ({
          name: p.name,
          jiraUrl: p.jiraUrl,
          jiraType: p.jiraType,
          jiraProjectKey: p.jiraProjectKey,
          jiraEmail: p.jiraAuth.type === 'cloud' ? p.jiraAuth.email : undefined,
          gitProvider: p.gitProvider,
          baseBranch: p.baseBranch,
          paths: p.paths,
          default: p.name === defaultName,
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
    'Cambiar el proyecto activo (de sesion). Al reiniciar vuelve al default por scope.',
    {
      name: z.string().describe('Nombre del proyecto'),
    },
    async (params) => {
      try {
        await storage.setActiveProject(params.name)
        return {
          content: [{ type: 'text' as const, text: `Proyecto activo (sesion): '${params.name}'. Al reiniciar volvera al default por scope.` }],
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
