import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './server.js'

async function main() {
  // Limpiar active de sesión al arrancar — cada sesión empieza con el default por scope
  const { clearSessionActive } = await import('./lib/storage.js')
  await clearSessionActive()

  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('devflow-mcp server running on stdio')

  const shutdown = async () => {
    console.error('devflow-mcp: shutting down...')
    try {
      await server.close()
    } catch {
      // Ignorar errores de cierre
    }
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
