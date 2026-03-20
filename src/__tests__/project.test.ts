import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestClient, callTool, type TestContext } from './helpers.js'

describe('Project Tools (integration)', () => {
  let ctx: TestContext

  beforeEach(async () => {
    ctx = await createTestClient()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('df_project_list returns empty when no projects', async () => {
    const result = await callTool(ctx.client, 'df_project_list')
    expect(result.isError).toBeFalsy()
    expect(result.text).toContain('No hay proyectos configurados')
  })

  it('df_project_switch non-existent project returns error', async () => {
    const result = await callTool(ctx.client, 'df_project_switch', { name: 'ghost' })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('no encontrado')
  })

  it('df_project_delete non-existent project returns error', async () => {
    const result = await callTool(ctx.client, 'df_project_delete', { name: 'ghost' })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('no encontrado')
  })

  it('df_project_update non-existent project returns error', async () => {
    const result = await callTool(ctx.client, 'df_project_update', { name: 'ghost' })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('no encontrado')
  })

  it('df_project_setup requires auth params', async () => {
    const result = await callTool(ctx.client, 'df_project_setup', {
      name: 'test',
      jiraUrl: 'https://test.atlassian.net',
      jiraProjectKey: 'TEST',
      gitToken: 'token',
    })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('jiraEmail + jiraToken')
  })
})
