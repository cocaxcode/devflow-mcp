import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Storage } from './lib/storage.js'
import { registerProjectTools } from './tools/project.js'
import { registerJiraTools } from './tools/jira.js'
import { registerGitTools } from './tools/git.js'
import { registerFlowTools } from './tools/flow.js'
import { registerRuleTools } from './tools/rule.js'

declare const __PKG_VERSION__: string

const VERSION = typeof __PKG_VERSION__ !== 'undefined' ? __PKG_VERSION__ : '0.0.0'

const INSTRUCTIONS = `devflow-mcp conecta Jira con GitHub/GitLab para automatizar tu workflow de desarrollo.

Cada tool funciona de forma independiente. El usuario puede pedir flows guardados con df_flow_list y df_flow_get para ver secuencias de pasos predefinidas y pedirte que los ejecutes.

COMPORTAMIENTO:
- df_checkout y df_branch bloquean si hay cambios sin commitear/pushear. Si pasa, avisa al usuario.
- df_transition y df_branch requieren confirm:true.
- df_issue, df_find_branch y df_statuses solo leen datos, sin efectos secundarios.
- El usuario puede configurar reglas (df_rule_create/list/toggle/update/delete) que bloquean o advierten sobre acciones. Consulta las reglas activas con df_rule_list cuando sea relevante.`

export function createServer(storageDir?: string): McpServer {
  const server = new McpServer({
    name: 'devflow-mcp',
    version: VERSION,
    instructions: INSTRUCTIONS,
  })

  const storage = new Storage(storageDir)

  registerProjectTools(server, storage)
  registerJiraTools(server, storage)
  registerGitTools(server, storage)
  registerFlowTools(server, storage)
  registerRuleTools(server, storage)

  return server
}
