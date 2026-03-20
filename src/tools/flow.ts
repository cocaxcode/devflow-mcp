import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Storage } from '../lib/storage.js'
import { VALID_TOOL_NAMES } from '../lib/types.js'
import type { FlowStep } from '../lib/types.js'

const flowStepSchema = z.object({
  tool: z.string(),
  confirm: z.boolean().optional(),
  target: z.string().optional(),
  note: z.string().optional(),
})

function validateToolNames(steps: FlowStep[]): string | null {
  const validSet = new Set<string>(VALID_TOOL_NAMES)
  const invalid = steps.filter((s) => !validSet.has(s.tool))
  if (invalid.length > 0) {
    return `Tools invalidos: ${invalid.map((s) => s.tool).join(', ')}. Tools validos: ${VALID_TOOL_NAMES.join(', ')}`
  }
  return null
}

export function registerFlowTools(server: McpServer, storage: Storage): void {
  // ── df_flow_create ──
  server.tool(
    'df_flow_create',
    'Crear un nuevo flow (playbook) con nombre, disparador y pasos. El AI lo ejecuta cuando el usuario dice algo que matchea el trigger.',
    {
      name: z.string().describe('Nombre del flow (ej: pr-ready)'),
      trigger: z.string().describe('Descripcion del disparador (ej: cuando el usuario dice "PR listo")'),
      steps: z.array(flowStepSchema).describe('Pasos del flow: [{tool, confirm?, target?, note?}]'),
    },
    async (params) => {
      try {
        // Validar tool names
        const error = validateToolNames(params.steps)
        if (error) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Error: ${error}` }],
          }
        }

        // Verificar que no exista
        const existing = await storage.getFlow(params.name)
        if (existing) {
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: `Error: Flow '${params.name}' ya existe. Usa df_flow_update para modificarlo.`,
            }],
          }
        }

        const flow = {
          name: params.name,
          trigger: params.trigger,
          steps: params.steps,
        }

        await storage.saveFlow(flow)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ message: `Flow '${params.name}' creado`, flow }, null, 2),
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

  // ── df_flow_list ──
  server.tool(
    'df_flow_list',
    'Listar todos los flows configurados con nombre, disparador y numero de pasos.',
    {},
    async () => {
      try {
        const flows = await storage.listFlows()

        const list = flows.map((f) => ({
          name: f.name,
          trigger: f.trigger,
          stepCount: f.steps.length,
        }))

        return {
          content: [{
            type: 'text' as const,
            text: list.length > 0
              ? JSON.stringify(list, null, 2)
              : 'No hay flows configurados.',
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

  // ── df_flow_get ──
  server.tool(
    'df_flow_get',
    'Ver el detalle completo de un flow (nombre, disparador y todos los pasos).',
    {
      name: z.string().describe('Nombre del flow'),
    },
    async (params) => {
      try {
        const flow = await storage.getFlow(params.name)
        if (!flow) {
          const flows = await storage.listFlows()
          const available = flows.map((f) => f.name).join(', ')
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: `Error: Flow '${params.name}' no encontrado. Disponibles: ${available || 'ninguno'}`,
            }],
          }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(flow, null, 2) }],
        }
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        }
      }
    },
  )

  // ── df_flow_update ──
  server.tool(
    'df_flow_update',
    'Modificar un flow existente: cambiar disparador y/o pasos.',
    {
      name: z.string().describe('Nombre del flow a modificar'),
      trigger: z.string().optional().describe('Nuevo disparador'),
      steps: z.array(flowStepSchema).optional().describe('Nuevos pasos'),
    },
    async (params) => {
      try {
        const flow = await storage.getFlow(params.name)
        if (!flow) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Error: Flow '${params.name}' no encontrado` }],
          }
        }

        if (params.steps) {
          const error = validateToolNames(params.steps)
          if (error) {
            return {
              isError: true,
              content: [{ type: 'text' as const, text: `Error: ${error}` }],
            }
          }
          flow.steps = params.steps
        }

        if (params.trigger) {
          flow.trigger = params.trigger
        }

        await storage.saveFlow(flow)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ message: `Flow '${params.name}' actualizado`, flow }, null, 2),
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

  // ── df_flow_delete ──
  server.tool(
    'df_flow_delete',
    'Eliminar un flow. El flow "start-task" requiere confirm: true.',
    {
      name: z.string().describe('Nombre del flow a eliminar'),
      confirm: z.boolean().optional().describe('true para confirmar eliminacion del flow default'),
    },
    async (params) => {
      try {
        // Proteger flow default
        if (params.name === 'start-task' && !params.confirm) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                warning: "'start-task' es el flow por defecto. Usa confirm: true para eliminarlo.",
                name: params.name,
              }, null, 2),
            }],
          }
        }

        await storage.deleteFlow(params.name)

        return {
          content: [{ type: 'text' as const, text: `Flow '${params.name}' eliminado` }],
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
