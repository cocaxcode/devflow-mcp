import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Storage } from '../lib/storage.js'
import { createTestClient, callTool, type TestContext } from './helpers.js'

let ctx: TestContext
beforeEach(async () => {
  ctx = await createTestClient()
  await new Storage(ctx.tempDir).saveProject({ name: 'test', paths: [ctx.tempDir], baseBranch: 'main', jiraUrl: 'https://example.test', jiraType: 'cloud', jiraApiVersion: '3', jiraProjectKey: 'T', jiraAuth: { type: 'cloud', email: 'a', apiToken: 'b' }, gitProvider: 'github', gitAuth: { token: 'x' }, repoOwner: 'a', repoName: 'b', createdAt: '', updatedAt: '', ruleOverrides: { 'only-own-issues': false } })
  await callTool(ctx.client, 'df_project_switch', { name: 'test' })
})
afterEach(async () => { vi.unstubAllGlobals(); await ctx.cleanup() })

it('blocks a custom final status using its Jira category', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ transitions: [{ id: '1', name: 'Release', to: { id: '2', name: 'Released', statusCategory: { key: 'done' } } }] }) })
  vi.stubGlobal('fetch', fetchMock)
  const result = await callTool(ctx.client, 'df_transition', { issueKey: 'TEST-1', transitionId: '1', confirm: true })
  expect(result.isError).toBe(true)
  expect(result.text).toContain('no-close-issues')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it.each([
  ['Finalizado', 'done', true],
  ['En cours', 'indeterminate', false],
  ['Unknown', undefined, true],
])('checks category for %s', async (name, key, blocked) => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ transitions: [{ id: '1', name, to: { id: '2', name, statusCategory: key ? { key } : undefined } }] }) })
  vi.stubGlobal('fetch', fetchMock)
  const result = await callTool(ctx.client, 'df_transition', { issueKey: 'TEST-1', transitionId: '1' })
  expect(Boolean(result.isError)).toBe(blocked)
  if (!blocked) expect(JSON.parse(result.text).preview).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
