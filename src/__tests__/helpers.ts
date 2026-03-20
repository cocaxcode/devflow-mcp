import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createServer } from '../server.js'

export interface TestContext {
  client: Client
  tempDir: string
  cleanup: () => Promise<void>
}

export async function createTestClient(): Promise<TestContext> {
  const tempDir = await mkdtemp(join(tmpdir(), 'devflow-mcp-'))
  const server = createServer(tempDir)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  const client = new Client({ name: 'test-client', version: '1.0.0' })
  await client.connect(clientTransport)

  return {
    client,
    tempDir,
    cleanup: async () => {
      await client.close()
      await server.close()
      await rm(tempDir, { recursive: true, force: true })
    },
  }
}

export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ text: string; isError?: boolean }> {
  const result = await client.callTool({ name, arguments: args })
  const content = result.content as Array<{ type: string; text: string }>
  return {
    text: content[0]?.text ?? '',
    isError: result.isError as boolean | undefined,
  }
}
