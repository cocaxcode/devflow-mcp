import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Storage } from '../lib/storage.js'
import { JiraClient } from '../lib/jira/client.js'

/** Escapa caracteres especiales en valores JQL para prevenir inyección */
function escapeJql(value: string): string {
  // JQL reserved chars: + - & | ! ( ) { } [ ] ^ ~ * ? \ : "
  return value.replace(/([+\-&|!(){}[\]^~*?\\:"])/g, '\\$1')
}

/** Valida formato de issue key (PROJECT-123) */
function isValidIssueKey(key: string): boolean {
  return /^[A-Z][A-Z0-9_]+-\d+$/.test(key)
}

async function checkOwnIssueRule(
  storage: Storage,
  client: JiraClient,
  issueKey: string,
  projectName?: string,
): Promise<string | null> {
  const rules = await storage.getActiveRules('jira', projectName)
  const rule = rules.find((r) => r.name === 'only-own-issues')
  if (!rule) return null

  const issue = await client.getIssue(issueKey)
  const currentUser = await client.getCurrentUser()

  // Comparar por accountId (unico) en vez de displayName (puede repetirse)
  const isOwner = issue.assignee?.accountId === currentUser.accountId

  if (!isOwner) {
    const msg = `Regla '${rule.name}': No puedes modificar el issue ${issueKey} porque esta asignado a ${issue.assignee?.displayName ?? 'nadie'}. Solo puedes consultar o comentar issues ajenos.`
    return rule.action === 'block' ? msg : null
  }

  return null
}

export function registerJiraTools(server: McpServer, storage: Storage): void {
  // ── df_issues ──
  server.tool(
    'df_issues',
    'Listar mis issues asignados en Jira. Soporta filtros opcionales por proyecto y estado.',
    {
      project: z.string().optional().describe('Filtrar por clave de proyecto (ej: PROJ)'),
      status: z.string().optional().describe('Filtrar por estado (ej: "To Do", "In Progress")'),
    },
    async (params) => {
      try {
        const config = await storage.resolveProject(process.cwd())
        const client = new JiraClient(config)

        const projectKey = params.project ?? config.jiraProjectKey
        let jql = 'assignee = currentUser() AND status != Done ORDER BY updated DESC'

        if (projectKey) {
          const safeKey = escapeJql(projectKey)
          jql = `project = "${safeKey}" AND ${jql}`
        }
        if (params.status) {
          const safeStatus = escapeJql(params.status)
          jql = jql.replace(
            'AND status != Done',
            `AND status = "${safeStatus}"`,
          )
        }

        const issues = await client.searchIssues(jql)

        const list = issues.map((i) => ({
          key: i.key,
          summary: i.summary,
          status: i.status.name,
          priority: i.priority.name,
          updated: i.updated,
        }))

        return {
          content: [{
            type: 'text' as const,
            text: list.length > 0
              ? JSON.stringify(list, null, 2)
              : 'No se encontraron issues asignados.',
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

  // ── df_issue ──
  server.tool(
    'df_issue',
    'Obtener el detalle completo de un issue de Jira. Solo lectura, sin efectos secundarios.',
    {
      issueKey: z.string().describe('Clave del issue (ej: PROJ-123)'),
    },
    async (params) => {
      try {
        if (!isValidIssueKey(params.issueKey)) {
          return { isError: true, content: [{ type: 'text' as const, text: `Error: Formato de issue key invalido '${params.issueKey}'. Formato esperado: PROJ-123` }] }
        }
        const config = await storage.resolveProject(process.cwd())
        const client = new JiraClient(config)
        const issue = await client.getIssue(params.issueKey)

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(issue, null, 2) }],
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        }
      }
    },
  )

  // ── df_statuses ──
  server.tool(
    'df_statuses',
    'Listar las transiciones disponibles para un issue (los estados a los que se puede mover desde su estado actual).',
    {
      issueKey: z.string().describe('Clave del issue (ej: PROJ-123)'),
    },
    async (params) => {
      try {
        if (!isValidIssueKey(params.issueKey)) {
          return { isError: true, content: [{ type: 'text' as const, text: `Error: Formato de issue key invalido '${params.issueKey}'. Formato esperado: PROJ-123` }] }
        }
        const config = await storage.resolveProject(process.cwd())
        const client = new JiraClient(config)
        const transitions = await client.getTransitions(params.issueKey)

        const list = transitions.map((t) => ({
          id: t.id,
          name: t.name,
          targetStatus: t.to.name,
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

  // ── df_transition ──
  server.tool(
    'df_transition',
    'Mover un issue a un nuevo estado. Requiere confirm: true para ejecutar. Sin confirm devuelve preview.',
    {
      issueKey: z.string().describe('Clave del issue (ej: PROJ-123)'),
      transitionId: z.string().describe('ID de la transicion (obtenido de df_statuses)'),
      confirm: z.boolean().optional().describe('true para ejecutar la transicion'),
    },
    async (params) => {
      try {
        if (!isValidIssueKey(params.issueKey)) {
          return { isError: true, content: [{ type: 'text' as const, text: `Error: Formato de issue key invalido '${params.issueKey}'. Formato esperado: PROJ-123` }] }
        }
        const config = await storage.resolveProject(process.cwd())
        const client = new JiraClient(config)

        // Verificar regla only-own-issues
        const ruleError = await checkOwnIssueRule(storage, client, params.issueKey, config.name)
        if (ruleError) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Bloqueado: ${ruleError}` }],
          }
        }

        // Obtener transiciones disponibles para validar
        const transitions = await client.getTransitions(params.issueKey)
        const target = transitions.find((t) => t.id === params.transitionId)

        if (!target) {
          const available = transitions.map((t) => `  ${t.id}: ${t.name} → ${t.to.name}`).join('\n')
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: `Error: Transicion '${params.transitionId}' no disponible.\n\nTransiciones disponibles:\n${available}`,
            }],
          }
        }

        // Verificar regla no-close-issues
        const closeRules = await storage.getActiveRules('jira', config.name)
        const noCloseRule = closeRules.find((r) => r.name === 'no-close-issues')
        if (noCloseRule) {
          const closedStatuses = ['done', 'closed', 'resolved', 'finalizado', 'cerrado', 'completado', 'terminado', 'hecho']
          const targetName = target.to.name.toLowerCase()
          if (closedStatuses.includes(targetName)) {
            return {
              isError: true,
              content: [{
                type: 'text' as const,
                text: `Bloqueado por regla '${noCloseRule.name}': No se puede mover ${params.issueKey} a '${target.to.name}'. Los issues solo deben cerrarse desde Jira directamente.`,
              }],
            }
          }
        }

        // Sin confirm → preview
        if (!params.confirm) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                preview: true,
                issueKey: params.issueKey,
                transition: target.name,
                targetStatus: target.to.name,
                message: 'Usa confirm: true para ejecutar esta transicion.',
              }, null, 2),
            }],
          }
        }

        // Con confirm → ejecutar
        await client.transitionIssue(params.issueKey, params.transitionId)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              issueKey: params.issueKey,
              newStatus: target.to.name,
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

  // ── df_assign ──
  server.tool(
    'df_assign',
    'Asignar un issue al usuario actual. Si el issue ya tiene asignado, no hace nada.',
    {
      issueKey: z.string().describe('Clave del issue (ej: PROJ-123)'),
    },
    async (params) => {
      try {
        if (!isValidIssueKey(params.issueKey)) {
          return { isError: true, content: [{ type: 'text' as const, text: `Error: Formato de issue key invalido '${params.issueKey}'. Formato esperado: PROJ-123` }] }
        }
        const config = await storage.resolveProject(process.cwd())
        const client = new JiraClient(config)

        // Verificar si ya tiene asignado
        const issue = await client.getIssue(params.issueKey)
        const currentUser = await client.getCurrentUser()

        if (issue.assignee) {
          // Si ya es mío, todo bien (comparar por accountId, unico)
          if (issue.assignee.accountId === currentUser.accountId) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  skipped: true,
                  issueKey: params.issueKey,
                  assignee: issue.assignee.displayName,
                  message: 'El issue ya esta asignado a ti.',
                }, null, 2),
              }],
            }
          }
          // Si es de otra persona, bloquear
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: `Bloqueado: El issue ${params.issueKey} esta asignado a ${issue.assignee.displayName}. No se puede reasignar.`,
            }],
          }
        }

        // Sin asignar → asignar al usuario actual
        await client.assignIssue(params.issueKey, currentUser.accountId)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              issueKey: params.issueKey,
              assignedTo: currentUser.displayName,
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

  // ── df_comment ──
  server.tool(
    'df_comment',
    'Añadir un comentario a un issue de Jira. Requiere confirm: true para ejecutar.',
    {
      issueKey: z.string().describe('Clave del issue (ej: PROJ-123)'),
      body: z.string().describe('Texto del comentario'),
      confirm: z.boolean().optional().describe('true para publicar el comentario'),
    },
    async (params) => {
      try {
        if (!isValidIssueKey(params.issueKey)) {
          return { isError: true, content: [{ type: 'text' as const, text: `Error: Formato de issue key invalido '${params.issueKey}'. Formato esperado: PROJ-123` }] }
        }
        const config = await storage.resolveProject(process.cwd())
        const client = new JiraClient(config)

        // Sin confirm → preview
        if (!params.confirm) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                preview: true,
                issueKey: params.issueKey,
                comment: params.body,
                message: 'Usa confirm: true para publicar este comentario.',
              }, null, 2),
            }],
          }
        }

        const result = await client.addComment(params.issueKey, params.body)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              issueKey: params.issueKey,
              commentId: result.id,
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
