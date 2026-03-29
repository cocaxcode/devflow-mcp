import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Storage } from '../lib/storage.js'
import type { Rule } from '../lib/types.js'

export function registerRuleTools(server: McpServer, storage: Storage): void {
  // ── df_rule_create ──
  server.tool(
    'df_rule_create',
    'Crear una regla configurable. Las reglas pueden bloquear o advertir sobre acciones.',
    {
      name: z.string().describe('Nombre de la regla (ej: no-merge-to-main)'),
      description: z.string().describe('Descripcion de lo que hace la regla'),
      scope: z.enum(['git', 'jira', 'all']).describe('Ambito: git, jira, o all'),
      action: z.enum(['block', 'warn']).describe('Accion: block (bloquea) o warn (solo avisa)'),
    },
    async (params) => {
      try {
        const existing = await storage.getRule(params.name)
        if (existing) {
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: `Error: La regla '${params.name}' ya existe. Usa df_rule_update para modificarla.`,
            }],
          }
        }

        const now = new Date().toISOString()
        const rule: Rule = {
          name: params.name,
          description: params.description,
          enabled: true,
          scope: params.scope,
          action: params.action,
          createdAt: now,
          updatedAt: now,
        }

        await storage.saveRule(rule)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ message: `Regla '${params.name}' creada y activada`, rule }, null, 2),
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

  // ── df_rule_list ──
  server.tool(
    'df_rule_list',
    'Listar todas las reglas configuradas con su estado (activada/desactivada).',
    {},
    async () => {
      try {
        const rules = await storage.listRules()

        if (rules.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No hay reglas configuradas.' }],
          }
        }

        const list = rules.map((r) => ({
          name: r.name,
          description: r.description,
          enabled: r.enabled,
          scope: r.scope,
          action: r.action,
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

  // ── df_rule_get ──
  server.tool(
    'df_rule_get',
    'Ver el detalle completo de una regla.',
    {
      name: z.string().describe('Nombre de la regla'),
    },
    async (params) => {
      try {
        const rule = await storage.getRule(params.name)
        if (!rule) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Error: Regla '${params.name}' no encontrada` }],
          }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(rule, null, 2) }],
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        }
      }
    },
  )

  // ── df_rule_update ──
  server.tool(
    'df_rule_update',
    'Modificar una regla existente.',
    {
      name: z.string().describe('Nombre de la regla a modificar'),
      description: z.string().optional().describe('Nueva descripcion'),
      scope: z.enum(['git', 'jira', 'all']).optional().describe('Nuevo ambito'),
      action: z.enum(['block', 'warn']).optional().describe('Nueva accion'),
    },
    async (params) => {
      try {
        const rule = await storage.getRule(params.name)
        if (!rule) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Error: Regla '${params.name}' no encontrada` }],
          }
        }

        if (params.description) rule.description = params.description
        if (params.scope) rule.scope = params.scope
        if (params.action) rule.action = params.action
        rule.updatedAt = new Date().toISOString()

        await storage.saveRule(rule)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ message: `Regla '${params.name}' actualizada`, rule }, null, 2),
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

  // ── df_rule_toggle ──
  server.tool(
    'df_rule_toggle',
    'Activar o desactivar una regla.',
    {
      name: z.string().describe('Nombre de la regla'),
      enabled: z.boolean().describe('true para activar, false para desactivar'),
    },
    async (params) => {
      try {
        const rule = await storage.getRule(params.name)
        if (!rule) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Error: Regla '${params.name}' no encontrada` }],
          }
        }

        rule.enabled = params.enabled
        rule.updatedAt = new Date().toISOString()
        await storage.saveRule(rule)

        const status = params.enabled ? 'activada' : 'desactivada'
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ message: `Regla '${params.name}' ${status}`, rule }, null, 2),
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

  // ── df_rule_delete ──
  server.tool(
    'df_rule_delete',
    'Eliminar una regla.',
    {
      name: z.string().describe('Nombre de la regla a eliminar'),
    },
    async (params) => {
      try {
        await storage.deleteRule(params.name)
        return {
          content: [{ type: 'text' as const, text: `Regla '${params.name}' eliminada` }],
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        }
      }
    },
  )

  // ── df_rule_project_override ──
  server.tool(
    'df_rule_project_override',
    'Activar o desactivar una regla global para el proyecto actual. El override solo aplica a este proyecto.',
    {
      ruleName: z.string().describe('Nombre de la regla global a sobreescribir'),
      enabled: z.boolean().describe('true para activar, false para desactivar en este proyecto'),
    },
    async (params) => {
      try {
        const config = await storage.resolveProject(process.cwd())

        // Verificar que la regla global existe
        const globalRule = await storage.getRule(params.ruleName)
        if (!globalRule) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Error: Regla global '${params.ruleName}' no encontrada` }],
          }
        }

        if (!config.ruleOverrides) config.ruleOverrides = {}
        config.ruleOverrides[params.ruleName] = params.enabled
        config.updatedAt = new Date().toISOString()
        await storage.saveProject(config)

        const status = params.enabled ? 'activada' : 'desactivada'
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              message: `Regla '${params.ruleName}' ${status} para proyecto '${config.name}'`,
              project: config.name,
              rule: params.ruleName,
              enabled: params.enabled,
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

  // ── df_rule_project_add ──
  server.tool(
    'df_rule_project_add',
    'Añadir una regla propia que solo aplica al proyecto actual.',
    {
      name: z.string().describe('Nombre de la regla'),
      description: z.string().describe('Descripcion de la regla'),
      scope: z.enum(['git', 'jira', 'all']).describe('Ambito'),
      action: z.enum(['block', 'warn']).describe('Accion'),
    },
    async (params) => {
      try {
        const config = await storage.resolveProject(process.cwd())

        if (!config.projectRules) config.projectRules = []

        // Verificar que no exista
        if (config.projectRules.some((r) => r.name === params.name)) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Error: Regla '${params.name}' ya existe en este proyecto` }],
          }
        }

        const now = new Date().toISOString()
        const rule: Rule = {
          name: params.name,
          description: params.description,
          enabled: true,
          scope: params.scope,
          action: params.action,
          createdAt: now,
          updatedAt: now,
        }

        config.projectRules.push(rule)
        config.updatedAt = new Date().toISOString()
        await storage.saveProject(config)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              message: `Regla '${params.name}' añadida al proyecto '${config.name}'`,
              rule,
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

  // ── df_rule_project_remove ──
  server.tool(
    'df_rule_project_remove',
    'Eliminar una regla propia del proyecto actual o quitar un override de regla global.',
    {
      name: z.string().describe('Nombre de la regla a eliminar'),
    },
    async (params) => {
      try {
        const config = await storage.resolveProject(process.cwd())
        let removed = false

        // Quitar de projectRules
        if (config.projectRules) {
          const idx = config.projectRules.findIndex((r) => r.name === params.name)
          if (idx !== -1) {
            config.projectRules.splice(idx, 1)
            removed = true
          }
        }

        // Quitar de overrides
        if (config.ruleOverrides && params.name in config.ruleOverrides) {
          delete config.ruleOverrides[params.name]
          removed = true
        }

        if (!removed) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Error: Regla '${params.name}' no encontrada en el proyecto '${config.name}'` }],
          }
        }

        config.updatedAt = new Date().toISOString()
        await storage.saveProject(config)

        return {
          content: [{ type: 'text' as const, text: `Regla '${params.name}' eliminada del proyecto '${config.name}'` }],
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
