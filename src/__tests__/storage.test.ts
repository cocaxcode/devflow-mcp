import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Storage } from '../lib/storage.js'
import type { ProjectConfig } from '../lib/types.js'

function makeProject(name: string, paths: string[] = []): ProjectConfig {
  return {
    name,
    jiraUrl: 'https://test.atlassian.net',
    jiraType: 'cloud',
    jiraApiVersion: '3',
    jiraProjectKey: 'TEST',
    jiraAuth: { type: 'cloud', email: 'test@test.com', apiToken: 'token' },
    gitProvider: 'github',
    gitAuth: { token: 'gh-token' },
    baseBranch: 'main',
    paths,
    repoOwner: 'owner',
    repoName: 'repo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('Storage', () => {
  let storage: Storage
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'devflow-storage-'))
    storage = new Storage(tempDir)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  // ── Projects ──

  describe('projects', () => {
    it('save and get project', async () => {
      const project = makeProject('my-project')
      await storage.saveProject(project)
      const retrieved = await storage.getProject('my-project')
      expect(retrieved).not.toBeNull()
      expect(retrieved!.name).toBe('my-project')
      expect(retrieved!.jiraType).toBe('cloud')
    })

    it('get non-existent project returns null', async () => {
      const result = await storage.getProject('ghost')
      expect(result).toBeNull()
    })

    it('list projects', async () => {
      await storage.saveProject(makeProject('project-a'))
      await storage.saveProject(makeProject('project-b'))
      const list = await storage.listProjects()
      expect(list).toHaveLength(2)
      const names = list.map((p) => p.name).sort()
      expect(names).toEqual(['project-a', 'project-b'])
    })

    it('list projects when empty', async () => {
      const list = await storage.listProjects()
      expect(list).toEqual([])
    })

    it('delete project', async () => {
      await storage.saveProject(makeProject('to-delete'))
      await storage.deleteProject('to-delete')
      const result = await storage.getProject('to-delete')
      expect(result).toBeNull()
    })

    it('delete non-existent project throws', async () => {
      await expect(storage.deleteProject('ghost')).rejects.toThrow('no encontrado')
    })

    it('delete active project clears active', async () => {
      await storage.saveProject(makeProject('active-one'))
      await storage.setActiveProject('active-one')
      await storage.deleteProject('active-one')
      const active = await storage.getActiveProject()
      expect(active).toBeNull()
    })
  })

  // ── Active Project ──

  describe('active project', () => {
    it('set and get active project', async () => {
      await storage.saveProject(makeProject('my-project'))
      await storage.setActiveProject('my-project')
      const active = await storage.getActiveProject()
      expect(active).toBe('my-project')
    })

    it('get active when none set returns null', async () => {
      const active = await storage.getActiveProject()
      expect(active).toBeNull()
    })

    it('set active for non-existent project throws', async () => {
      await expect(storage.setActiveProject('ghost')).rejects.toThrow('no encontrado')
    })

    it('clear active project', async () => {
      await storage.saveProject(makeProject('my-project'))
      await storage.setActiveProject('my-project')
      await storage.clearActiveProject()
      const active = await storage.getActiveProject()
      expect(active).toBeNull()
    })
  })

  // ── Resolve Project ──

  describe('resolveProject', () => {
    it('resolve by cwd match', async () => {
      const project = makeProject('cwd-project', ['/code/my-app'])
      await storage.saveProject(project)
      const resolved = await storage.resolveProject('/code/my-app')
      expect(resolved.name).toBe('cwd-project')
    })

    it('resolve by cwd subdirectory match', async () => {
      const project = makeProject('cwd-project', ['/code/my-app'])
      await storage.saveProject(project)
      const resolved = await storage.resolveProject('/code/my-app/src/components')
      expect(resolved.name).toBe('cwd-project')
    })

    it('resolve active session project even when cwd does not match paths', async () => {
      await storage.saveProject(makeProject('fallback-project'))
      await storage.setActiveProject('fallback-project')
      const resolved = await storage.resolveProject('/some/other/path')
      expect(resolved.name).toBe('fallback-project')
    })

    it('throw when no project resolvable', async () => {
      await expect(storage.resolveProject('/nowhere')).rejects.toThrow('no coincide con ningún proyecto configurado')
    })
  })

  // ── Flows ──

  describe('flows', () => {
    it('ensure default flow creates start-task', async () => {
      await storage.ensureDefaultFlow()
      const flow = await storage.getFlow('start-task')
      expect(flow).not.toBeNull()
      expect(flow!.name).toBe('start-task')
      expect(flow!.steps.length).toBeGreaterThan(0)
    })

    it('save and get custom flow', async () => {
      await storage.saveFlow({
        name: 'pr-ready',
        trigger: 'when user says PR listo',
        steps: [{ tool: 'df_pr' }, { tool: 'df_transition', target: 'Code Review', confirm: true }],
      })
      const flow = await storage.getFlow('pr-ready')
      expect(flow).not.toBeNull()
      expect(flow!.name).toBe('pr-ready')
      expect(flow!.steps).toHaveLength(2)
    })

    it('list flows includes default', async () => {
      const flows = await storage.listFlows()
      expect(flows.length).toBeGreaterThanOrEqual(1)
      expect(flows.some((f) => f.name === 'start-task')).toBe(true)
    })

    it('delete flow', async () => {
      await storage.saveFlow({ name: 'temp-flow', trigger: 'test', steps: [] })
      await storage.deleteFlow('temp-flow')
      const flow = await storage.getFlow('temp-flow')
      expect(flow).toBeNull()
    })

    it('delete non-existent flow throws', async () => {
      await expect(storage.deleteFlow('ghost')).rejects.toThrow('no encontrado')
    })

    it('get non-existent flow returns null', async () => {
      const flow = await storage.getFlow('ghost')
      expect(flow).toBeNull()
    })
  })

  // ── Config ──

  describe('config', () => {
    it('get config when empty returns {}', async () => {
      const config = await storage.getConfig()
      expect(config).toEqual({})
    })

    it('set and get config value', async () => {
      await storage.setConfig('theme', 'dark')
      const config = await storage.getConfig()
      expect(config.theme).toBe('dark')
    })

    it('set multiple config values', async () => {
      await storage.setConfig('key1', 'value1')
      await storage.setConfig('key2', 42)
      const config = await storage.getConfig()
      expect(config.key1).toBe('value1')
      expect(config.key2).toBe(42)
    })
  })
})
