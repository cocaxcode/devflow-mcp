import { mkdir, readFile, writeFile, readdir, unlink, chmod, rename } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { homedir } from 'node:os'
import { join, dirname, normalize } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import type { ProjectConfig, FlowDefinition, ServerConfig, Rule } from './types.js'
import { DEFAULT_FLOW, DEFAULT_RULES } from './types.js'

function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export class Storage {
  private readonly baseDir: string
  private readonly projectsDir: string
  private readonly flowsDir: string
  private readonly rulesDir: string
  private readonly activeProjectFile: string
  private readonly configFile: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? process.env.DEVFLOW_MCP_DIR ?? join(homedir(), '.dfm')
    this.projectsDir = join(this.baseDir, 'projects')
    this.flowsDir = join(this.baseDir, 'flows')
    this.rulesDir = join(this.baseDir, 'rules')
    this.activeProjectFile = join(this.baseDir, 'active-project')
    this.configFile = join(this.baseDir, 'config.json')
  }

  // ── Projects ──

  async saveProject(config: ProjectConfig): Promise<void> {
    await this.ensureDir('projects')
    const filePath = join(this.projectsDir, `${sanitizeName(config.name)}.json`)
    await this.writeJson(filePath, config)
    await this.chmodSafe(filePath)
  }

  async getProject(name: string): Promise<ProjectConfig | null> {
    const filePath = join(this.projectsDir, `${sanitizeName(name)}.json`)
    return this.readJson<ProjectConfig>(filePath)
  }

  async listProjects(): Promise<ProjectConfig[]> {
    await this.ensureDir('projects')
    const files = await this.listJsonFiles(this.projectsDir)
    const projects = await Promise.all(
      files.map((file) => this.readJson<ProjectConfig>(join(this.projectsDir, file))),
    )
    return projects.filter((p): p is ProjectConfig => p !== null)
  }

  async deleteProject(name: string): Promise<void> {
    const project = await this.getProject(name)
    if (!project) {
      throw new Error(`Proyecto '${name}' no encontrado`)
    }

    await unlink(join(this.projectsDir, `${sanitizeName(name)}.json`))

    // Limpiar active-project si era el activo
    try {
      const active = await readFile(this.activeProjectFile, 'utf-8')
      if (active.trim() === name) {
        await unlink(this.activeProjectFile)
      }
    } catch {
      // No hay active-project
    }
  }

  // ── Active Project ──

  async getActiveProject(): Promise<string | null> {
    try {
      const content = await readFile(this.activeProjectFile, 'utf-8')
      return content.trim() || null
    } catch {
      return null
    }
  }

  async setActiveProject(name: string): Promise<void> {
    const project = await this.getProject(name)
    if (!project) {
      throw new Error(`Proyecto '${name}' no encontrado`)
    }
    await this.ensureDir()
    await writeFile(this.activeProjectFile, name, 'utf-8')
  }

  async clearActiveProject(): Promise<void> {
    try {
      await unlink(this.activeProjectFile)
    } catch {
      // Ya no existe
    }
  }

  async resolveProject(cwd: string): Promise<ProjectConfig> {
    const normalizedCwd = normalize(cwd).replace(/\\/g, '/')

    // Buscar SOLO por cwd en paths de todos los proyectos.
    // No hay fallback a active-project: si el directorio actual no es un proyecto configurado, se rechaza.
    const projects = await this.listProjects()
    for (const project of projects) {
      for (const path of project.paths) {
        const normalizedPath = normalize(path).replace(/\\/g, '/')
        if (normalizedCwd === normalizedPath || normalizedCwd.startsWith(normalizedPath + '/')) {
          return project
        }
      }
    }

    const projectNames = projects.map((p) => p.name).join(', ')
    throw new Error(
      `El directorio actual (${normalizedCwd}) no coincide con ningún proyecto configurado.` +
      (projectNames ? ` Proyectos disponibles: ${projectNames}.` : '') +
      ' Navega al directorio del proyecto o usa df_project_setup para configurar uno nuevo.',
    )
  }

  // ── Flows ──

  async saveFlow(flow: FlowDefinition): Promise<void> {
    await this.ensureDir('flows')
    const filePath = join(this.flowsDir, `${sanitizeName(flow.name)}.yaml`)
    await writeFile(filePath, stringifyYaml(flow), 'utf-8')
  }

  async getFlow(name: string): Promise<FlowDefinition | null> {
    try {
      const filePath = join(this.flowsDir, `${sanitizeName(name)}.yaml`)
      const content = await readFile(filePath, 'utf-8')
      return parseYaml(content) as FlowDefinition
    } catch {
      return null
    }
  }

  async listFlows(): Promise<FlowDefinition[]> {
    await this.ensureDefaultFlow()
    try {
      const files = await readdir(this.flowsDir)
      const yamlFiles = files.filter((f) => f.endsWith('.yaml'))
      const flows = await Promise.all(
        yamlFiles.map(async (file) => {
          try {
            const content = await readFile(join(this.flowsDir, file), 'utf-8')
            return parseYaml(content) as FlowDefinition
          } catch {
            return null
          }
        }),
      )
      return flows.filter((f): f is FlowDefinition => f !== null)
    } catch {
      return []
    }
  }

  async deleteFlow(name: string): Promise<void> {
    const flow = await this.getFlow(name)
    if (!flow) {
      throw new Error(`Flow '${name}' no encontrado`)
    }
    await unlink(join(this.flowsDir, `${sanitizeName(name)}.yaml`))
  }

  async ensureDefaultFlow(): Promise<void> {
    await this.ensureDir('flows')
    try {
      const files = await readdir(this.flowsDir)
      if (files.filter((f) => f.endsWith('.yaml')).length === 0) {
        await this.saveFlow(DEFAULT_FLOW)
      }
    } catch {
      await this.saveFlow(DEFAULT_FLOW)
    }
  }

  // ── Rules ──

  async saveRule(rule: Rule): Promise<void> {
    await this.ensureDir('rules')
    const filePath = join(this.rulesDir, `${sanitizeName(rule.name)}.json`)
    await this.writeJson(filePath, rule)
  }

  async getRule(name: string): Promise<Rule | null> {
    return this.readJson<Rule>(join(this.rulesDir, `${sanitizeName(name)}.json`))
  }

  async listRules(): Promise<Rule[]> {
    await this.ensureDefaultRules()
    const files = await this.listJsonFiles(this.rulesDir)
    const rules = await Promise.all(
      files.map((file) => this.readJson<Rule>(join(this.rulesDir, file))),
    )
    return rules.filter((r): r is Rule => r !== null)
  }

  async deleteRule(name: string): Promise<void> {
    const rule = await this.getRule(name)
    if (!rule) {
      throw new Error(`Regla '${name}' no encontrada`)
    }
    await unlink(join(this.rulesDir, `${sanitizeName(name)}.json`))
  }

  async ensureDefaultRules(): Promise<void> {
    await this.ensureDir('rules')
    try {
      const files = await readdir(this.rulesDir)
      if (files.filter((f) => f.endsWith('.json')).length === 0) {
        for (const rule of DEFAULT_RULES) {
          await this.saveRule(rule)
        }
      }
    } catch {
      for (const rule of DEFAULT_RULES) {
        await this.saveRule(rule)
      }
    }
  }

  async getActiveRules(scope?: 'git' | 'jira', projectName?: string): Promise<Rule[]> {
    // 1. Reglas globales
    const globalRules = await this.listRules()

    // 2. Merge con overrides del proyecto
    let project: ProjectConfig | null = null
    if (projectName) {
      project = await this.getProject(projectName)
    }

    const overrides = project?.ruleOverrides ?? {}
    const projectRules = project?.projectRules ?? []

    // Aplicar overrides: proyecto puede desactivar/activar reglas globales
    const mergedRules = globalRules.map((r) => {
      if (r.name in overrides) {
        return { ...r, enabled: overrides[r.name] }
      }
      return r
    })

    // Añadir reglas propias del proyecto
    const allRules = [...mergedRules, ...projectRules]

    return allRules.filter((r) => {
      if (!r.enabled) return false
      if (!scope) return true
      return r.scope === scope || r.scope === 'all'
    })
  }

  // ── Config ──

  async getConfig(): Promise<ServerConfig> {
    const config = await this.readJson<ServerConfig>(this.configFile)
    return config ?? {}
  }

  async setConfig(key: string, value: unknown): Promise<void> {
    const config = await this.getConfig()
    config[key] = value
    await this.ensureDir()
    await this.writeJson(this.configFile, config)
  }

  // ── Private Helpers ──

  private async ensureDir(subdir?: string): Promise<void> {
    const dir = subdir ? join(this.baseDir, subdir) : this.baseDir
    await mkdir(dir, { recursive: true })
  }

  private async readJson<T>(filePath: string): Promise<T | null> {
    try {
      const content = await readFile(filePath, 'utf-8')
      return JSON.parse(content) as T
    } catch {
      return null
    }
  }

  private async writeJson(filePath: string, data: unknown): Promise<void> {
    // Atomic write: write to temp file, then rename
    const tmpPath = join(dirname(filePath), `.tmp-${randomBytes(6).toString('hex')}`)
    await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
    try {
      await rename(tmpPath, filePath)
    } catch {
      // Windows: rename can fail if target exists, fallback to write
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      await unlink(tmpPath).catch(() => {})
    }
  }

  private async listJsonFiles(dir: string): Promise<string[]> {
    try {
      const files = await readdir(dir)
      return files.filter((f) => f.endsWith('.json'))
    } catch {
      return []
    }
  }

  private async chmodSafe(filePath: string): Promise<void> {
    try {
      await chmod(filePath, 0o600)
    } catch {
      // Windows: chmod no soportado, ignorar
    }
  }
}
