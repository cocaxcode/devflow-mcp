import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestClient, callTool, type TestContext } from './helpers.js'

describe('Flow Tools (integration)', () => {
  let ctx: TestContext

  beforeEach(async () => {
    ctx = await createTestClient()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('df_flow_list includes default start-task flow', async () => {
    const result = await callTool(ctx.client, 'df_flow_list')
    expect(result.isError).toBeFalsy()
    const flows = JSON.parse(result.text)
    expect(flows.some((f: { name: string }) => f.name === 'start-task')).toBe(true)
  })

  it('df_flow_get returns start-task detail', async () => {
    // Trigger ensureDefaultFlow first
    await callTool(ctx.client, 'df_flow_list')

    const result = await callTool(ctx.client, 'df_flow_get', { name: 'start-task' })
    expect(result.isError).toBeFalsy()
    const flow = JSON.parse(result.text)
    expect(flow.name).toBe('start-task')
    expect(flow.steps.length).toBeGreaterThan(0)
  })

  it('df_flow_get non-existent flow returns error', async () => {
    const result = await callTool(ctx.client, 'df_flow_get', { name: 'ghost' })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('no encontrado')
  })

  it('df_flow_create with valid tools', async () => {
    const result = await callTool(ctx.client, 'df_flow_create', {
      name: 'pr-ready',
      trigger: 'when user says PR listo',
      steps: [
        { tool: 'df_pr' },
        { tool: 'df_transition', target: 'Code Review', confirm: true },
      ],
    })
    expect(result.isError).toBeFalsy()
    const parsed = JSON.parse(result.text)
    expect(parsed.flow.name).toBe('pr-ready')
  })

  it('df_flow_create with invalid tool name returns error', async () => {
    const result = await callTool(ctx.client, 'df_flow_create', {
      name: 'bad-flow',
      trigger: 'test',
      steps: [{ tool: 'invalid_tool' }],
    })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('Tools invalidos')
  })

  it('df_flow_create with duplicate name returns error', async () => {
    // Trigger default flow creation
    await callTool(ctx.client, 'df_flow_list')

    const result = await callTool(ctx.client, 'df_flow_create', {
      name: 'start-task',
      trigger: 'duplicate',
      steps: [{ tool: 'df_issue' }],
    })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('ya existe')
  })

  it('df_flow_update modifies trigger', async () => {
    // Create a flow first
    await callTool(ctx.client, 'df_flow_create', {
      name: 'test-flow',
      trigger: 'original trigger',
      steps: [{ tool: 'df_issue' }],
    })

    const result = await callTool(ctx.client, 'df_flow_update', {
      name: 'test-flow',
      trigger: 'updated trigger',
    })
    expect(result.isError).toBeFalsy()

    // Verify
    const get = await callTool(ctx.client, 'df_flow_get', { name: 'test-flow' })
    const flow = JSON.parse(get.text)
    expect(flow.trigger).toBe('updated trigger')
    expect(flow.steps).toHaveLength(1) // steps preserved
  })

  it('df_flow_update non-existent returns error', async () => {
    const result = await callTool(ctx.client, 'df_flow_update', {
      name: 'ghost',
      trigger: 'test',
    })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('no encontrado')
  })

  it('df_flow_delete custom flow', async () => {
    await callTool(ctx.client, 'df_flow_create', {
      name: 'temp-flow',
      trigger: 'test',
      steps: [{ tool: 'df_pull' }],
    })

    const result = await callTool(ctx.client, 'df_flow_delete', { name: 'temp-flow' })
    expect(result.isError).toBeFalsy()
    expect(result.text).toContain('eliminado')
  })

  it('df_flow_delete start-task without confirm shows warning', async () => {
    // Trigger default flow creation
    await callTool(ctx.client, 'df_flow_list')

    const result = await callTool(ctx.client, 'df_flow_delete', { name: 'start-task' })
    expect(result.isError).toBeFalsy()
    const parsed = JSON.parse(result.text)
    expect(parsed.warning).toBeTruthy()
  })

  it('df_flow_delete start-task with confirm deletes it', async () => {
    // Trigger default flow creation
    await callTool(ctx.client, 'df_flow_list')

    const result = await callTool(ctx.client, 'df_flow_delete', {
      name: 'start-task',
      confirm: true,
    })
    expect(result.isError).toBeFalsy()
    expect(result.text).toContain('eliminado')
  })
})
