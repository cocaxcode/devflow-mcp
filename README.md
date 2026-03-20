<p align="center">
  <h1 align="center">@cocaxcode/devflow-mcp</h1>
  <p align="center">
    <strong>Conecta Jira con GitHub/GitLab desde tu AI assistant.</strong><br/>
    32 tools · Jira Cloud + Server · GitHub + GitLab · Flows personalizables · Reglas configurables
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@cocaxcode/devflow-mcp">
    <img src="https://img.shields.io/npm/v/@cocaxcode/devflow-mcp.svg?style=flat-square&color=cb3837" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/@cocaxcode/devflow-mcp">
    <img src="https://img.shields.io/npm/dm/@cocaxcode/devflow-mcp.svg?style=flat-square" alt="downloads" />
  </a>
  <img src="https://img.shields.io/badge/tools-32-blueviolet?style=flat-square" alt="tools" />
  <img src="https://img.shields.io/badge/tests-51-brightgreen?style=flat-square" alt="tests" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white" alt="node" />
  <a href="https://github.com/cocaxcode/devflow-mcp/blob/master/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="license" />
  </a>
</p>

<p align="center">
  <a href="#el-problema">El Problema</a> ·
  <a href="#instalacion">Instalacion</a> ·
  <a href="#just-talk-to-it">Just Talk to It</a> ·
  <a href="#tools">Tools</a> ·
  <a href="#flows">Flows</a> ·
  <a href="#reglas">Reglas</a> ·
  <a href="#almacenamiento">Almacenamiento</a> ·
  <a href="#arquitectura">Arquitectura</a> ·
  <a href="#contribuir">Contribuir</a>
</p>

---

## El Problema

Trabajas con Jira, GitHub/GitLab y la terminal. Cada vez que empiezas una tarea:

1. Abres Jira, buscas el issue, lees el detalle
2. Vas a la terminal, haces checkout a main, pull, creas la branch
3. Vuelves a Jira, mueves el issue a "In Progress"
4. Cuando terminas, push, crear PR, volver a Jira...

**devflow-mcp** te da todo esto como herramientas MCP que tu AI assistant (Claude Code, Cursor, Windsurf, etc.) puede usar directamente. Cada herramienta funciona de forma independiente — la IA orquesta, el MCP ejecuta.

**Lo que lo diferencia:**

| Feature | devflow-mcp |
|---------|------------|
| Jira Cloud + Server | Auto-detecta version (v2/v3) |
| GitHub + GitLab | Cloud y self-hosted |
| Flows personalizables | Playbooks YAML editables |
| Reglas configurables | Global + override por proyecto |
| Multi-proyecto | Cada proyecto con su conexion |
| Guard de seguridad | Bloquea si hay cambios sin pushear |
| Confirmacion explicita | Push, merge, branch, transiciones |

---

## Instalacion

### Claude Code (recomendado)

```bash
# Instalacion global (disponible en todos tus proyectos)
claude mcp add devflow --scope user -- npx -y @cocaxcode/devflow-mcp

# O instalacion por proyecto
claude mcp add devflow -- npx -y @cocaxcode/devflow-mcp
```

### Claude Desktop

<details>
<summary>macOS: ~/Library/Application Support/Claude/claude_desktop_config.json</summary>

```json
{
  "mcpServers": {
    "devflow": {
      "command": "npx",
      "args": ["-y", "@cocaxcode/devflow-mcp"]
    }
  }
}
```
</details>

<details>
<summary>Windows: %APPDATA%\Claude\claude_desktop_config.json</summary>

```json
{
  "mcpServers": {
    "devflow": {
      "command": "npx",
      "args": ["-y", "@cocaxcode/devflow-mcp"]
    }
  }
}
```
</details>

### Cursor / Windsurf

```json
// .cursor/mcp.json o .windsurf/mcp.json
{
  "mcpServers": {
    "devflow": {
      "command": "npx",
      "args": ["-y", "@cocaxcode/devflow-mcp"]
    }
  }
}
```

### VS Code / Codex / Gemini CLI

```json
{
  "mcpServers": {
    "devflow": {
      "command": "npx",
      "args": ["-y", "@cocaxcode/devflow-mcp"]
    }
  }
}
```

---

## Just Talk to It

No necesitas memorizar nombres de herramientas. Habla con tu AI assistant de forma natural:

### Empezar una tarea

> "Vamos con PROJ-123"

La IA lee el issue, resume la tarea, busca si ya hay branch, crea una nueva si no, mueve a "In Progress" y asigna el issue — todo siguiendo el flow `start-task`.

### Consultar issues

> "Dame mis tareas del proyecto ACME"

```
ACME-45  Corregir login OAuth       In Progress  High
ACME-52  Refactor del dashboard     To Do        Medium
ACME-61  Actualizar dependencias    To Do        Low
```

### Crear branch y cambiar de estado

> "Crea una branch fix para PROJ-456 con descripcion fix-oauth-redirect"

```
Preview:
  branch: fix/PROJ-456-fix-oauth-redirect
  base: main
  actions: checkout main → pull → create branch

¿Confirmas? (confirm: true para ejecutar)
```

### Push con seguridad

> "Pushea los cambios"

```
Preview:
  branch: feat/PROJ-123-add-login
  commits pendientes:
    - a1b2c3d feat: add login component
    - d4e5f6g feat: add auth service

¿Confirmas? (confirm: true para ejecutar)
```

### Merge con deteccion de conflictos

> "Mergea la rama main en mi branch actual"

Si hay conflictos, te dice exactamente en que archivos:

```
Conflicto detectado:
  - src/auth/login.ts
  - src/config/routes.ts

Resuelve los archivos y haz commit para completar el merge.
```

### Crear un PR

> "Crea un PR con titulo 'feat: add OAuth login'"

```
PR creado:
  url: https://github.com/org/repo/pull/42
  title: feat: add OAuth login
  provider: github
```

### Comentar en Jira

> "Comenta en PROJ-123 que el PR ya esta listo para review"

```
Preview:
  issue: PROJ-123
  comentario: "PR listo para review: https://github.com/org/repo/pull/42"

¿Confirmas? (confirm: true para publicar)
```

---

## Tools

32 herramientas organizadas en 5 categorias:

### Proyectos (5 tools)

| Tool | Descripcion |
|------|------------|
| `df_project_setup` | Configurar un nuevo proyecto (Jira + Git, auto-detecta todo) |
| `df_project_update` | Modificar configuracion de un proyecto |
| `df_project_list` | Listar todos los proyectos configurados |
| `df_project_switch` | Cambiar el proyecto activo |
| `df_project_delete` | Eliminar un proyecto |

<details>
<summary>Ejemplo: configurar un proyecto</summary>

```
Usa df_project_setup con:
  name: "mi-proyecto"
  jiraUrl: "https://mi-empresa.atlassian.net"
  jiraEmail: "dev@empresa.com"
  jiraToken: "ATATT3x..."
  jiraProjectKey: "PROJ"
  gitToken: "ghp_..."
  paths: ["C:/repos/mi-proyecto"]

Auto-detecta:
  ✓ Jira Cloud (API v3)
  ✓ GitHub (cocaxcode/mi-proyecto)
  ✓ Base branch: main
```
</details>

### Jira (6 tools)

| Tool | Descripcion | Confirmacion |
|------|------------|:---:|
| `df_issues` | Listar mis issues asignados (filtra por proyecto) | — |
| `df_issue` | Detalle completo de un issue | — |
| `df_statuses` | Transiciones disponibles para un issue | — |
| `df_transition` | Mover issue a otro estado | Si |
| `df_assign` | Asignar issue al usuario actual | — |
| `df_comment` | Comentar en un issue | Si |

<details>
<summary>Reglas que aplican a Jira</summary>

- **no-close-issues** (activa por defecto): Bloquea mover issues a estados finales (Done, Closed, Resolved, Finalizado, Cerrado...). Solo un humano deberia cerrar tareas desde Jira.
- **only-own-issues** (activa por defecto): No permite transicionar, asignar ni editar issues de otros usuarios. Solo consultar y comentar.
</details>

### Git (7 tools)

| Tool | Descripcion | Confirmacion |
|------|------------|:---:|
| `df_branch` | Crear branch (`feat/` o `fix/`) desde la base | Si |
| `df_find_branch` | Buscar branch por issue key | — |
| `df_checkout` | Cambiar de rama (con guard) | — |
| `df_pull` | Pull de la rama actual | — |
| `df_push` | Push de la rama actual | Si |
| `df_merge` | Merge de una rama en la actual | Si |
| `df_pr` | Crear PR (GitHub) o MR (GitLab) | — |

<details>
<summary>Guards de seguridad</summary>

`df_branch`, `df_checkout` y `df_push` verifican el estado del working directory:

- **Archivos sin commitear** → Bloquea y lista los archivos
- **Commits sin pushear** → Bloquea y lista los commits

El usuario debe resolver pendientes antes de continuar. Esto previene perdida de trabajo.
</details>

<details>
<summary>Reglas que aplican a Git</summary>

- **no-merge-to-base** (activa por defecto): Bloquea push y merge directo a la rama base (main/master). Obliga a usar PR/MR.
- **no-merge-from-dev** (activa por defecto): Bloquea mergear ramas de desarrollo (dev, develop, int, integration, development) hacia otras ramas. Estas ramas solo reciben merges.
</details>

### Flows (5 tools)

| Tool | Descripcion |
|------|------------|
| `df_flow_create` | Crear un flow personalizado |
| `df_flow_list` | Listar todos los flows |
| `df_flow_get` | Ver detalle de un flow |
| `df_flow_update` | Modificar un flow existente |
| `df_flow_delete` | Eliminar un flow (protege `start-task`) |

### Reglas (9 tools)

| Tool | Descripcion | Nivel |
|------|------------|-------|
| `df_rule_create` | Crear regla global | Global |
| `df_rule_list` | Listar todas las reglas | Global |
| `df_rule_get` | Detalle de una regla | Global |
| `df_rule_update` | Modificar una regla | Global |
| `df_rule_toggle` | Activar/desactivar regla | Global |
| `df_rule_delete` | Eliminar una regla | Global |
| `df_rule_project_override` | Activar/desactivar regla global para un proyecto | Proyecto |
| `df_rule_project_add` | Crear regla exclusiva del proyecto | Proyecto |
| `df_rule_project_remove` | Eliminar regla o override del proyecto | Proyecto |

---

## Flows

Los flows son playbooks que definen secuencias de pasos. No se ejecutan automaticamente — tu le dices a la IA cuando usarlos.

### Flow por defecto: `start-task`

Se activa cuando dices algo como *"vamos con PROJ-123"*:

```yaml
name: start-task
trigger: "cuando el usuario dice 'vamos con', 'empezar tarea', 'nueva tarea' + issue ID"
steps:
  - tool: df_issue
    note: "Lee el detalle del issue y resume la tarea"
  - tool: df_find_branch
    note: "Busca si ya existe branch para este issue"
  - tool: df_branch
    confirm: true
    note: "Solo si no se encontro branch existente"
  - tool: df_statuses
    note: "Obtiene transiciones para saber el ID de 'In Progress'"
  - tool: df_transition
    target: "In Progress"
    confirm: true
  - tool: df_assign
    note: "Asigna el issue si no tiene asignado"
```

### Crear un flow personalizado

> "Crea un flow llamado 'finish-task' que haga push, cree PR y comente en Jira"

```yaml
name: finish-task
trigger: "cuando el usuario dice 'terminar tarea', 'finalizar' + issue ID"
steps:
  - tool: df_push
    confirm: true
    note: "Push de los commits pendientes"
  - tool: df_pr
    note: "Crear PR/MR hacia la rama base"
  - tool: df_comment
    confirm: true
    note: "Comentar en el issue con el link del PR"
```

### Editar un flow

> "Modifica el flow 'start-task' para que no haga assign"

Usa `df_flow_update` para cambiar pasos, trigger o nombre. El flow `start-task` se puede modificar pero no eliminar.

---

## Reglas

Las reglas son guardas configurables que bloquean o advierten sobre acciones. Hay dos niveles:

### Reglas globales

Aplican a todos los proyectos. Se crean con `df_rule_create`.

**Reglas por defecto (activas):**

| Regla | Ambito | Accion | Descripcion |
|-------|--------|--------|-------------|
| `no-merge-to-base` | git | block | No permitir push/merge directo a main/master |
| `no-merge-from-dev` | git | block | No mergear ramas dev/int/develop hacia otras ramas |
| `no-close-issues` | jira | block | No cerrar issues (Done, Closed, Resolved...) |
| `only-own-issues` | jira | block | No modificar issues asignados a otros |

### Reglas por proyecto

Cada proyecto puede:

1. **Sobreescribir una regla global** — activarla o desactivarla solo para ese proyecto:
   > "Desactiva la regla no-close-issues para el proyecto staging"

   Usa `df_rule_project_override` con `enabled: false`.

2. **Crear reglas propias** — solo aplican a ese proyecto:
   > "Crea una regla en este proyecto que advierta al hacer push los viernes"

   Usa `df_rule_project_add`.

3. **Eliminar overrides o reglas propias**:
   > "Elimina el override de no-close-issues en este proyecto"

   Usa `df_rule_project_remove`.

### Crear una regla personalizada

```
df_rule_create:
  name: "no-push-friday"
  description: "Advertir al hacer push en viernes"
  scope: "git"
  action: "warn"
```

Opciones:
- **scope**: `git`, `jira` o `all`
- **action**: `block` (impide la accion) o `warn` (solo avisa)

### Resolucion de reglas

Cuando una herramienta consulta reglas activas:

1. Se cargan las **reglas globales**
2. Se aplican los **overrides del proyecto** (proyecto gana)
3. Se agregan las **reglas propias del proyecto**
4. Se filtran por **scope** y **estado** (enabled)

---

## Almacenamiento

Todos los datos se guardan en `~/.dfm/`:

```
~/.dfm/
├── projects/          # Configuraciones de proyecto (.json)
│   ├── mi-proyecto.json
│   └── otro-proyecto.json
├── flows/             # Definiciones de flows (.yaml)
│   └── start-task.yaml
├── rules/             # Reglas globales (.json)
│   ├── no-merge-to-base.json
│   ├── no-merge-from-dev.json
│   ├── no-close-issues.json
│   └── only-own-issues.json
├── active-project     # Proyecto activo (texto plano)
└── config.json        # Configuracion del servidor
```

- **Proyectos**: JSON con credenciales, paths, overrides de reglas y reglas propias
- **Flows**: YAML editables con pasos y triggers
- **Reglas**: JSON con nombre, scope, accion y estado
- **Permisos**: Los archivos de proyecto se crean con permisos `600` (solo tu usuario)

### Resolucion de proyecto

Cuando ejecutas una herramienta, devflow-mcp determina el proyecto activo:

1. **Por directorio**: Compara tu `cwd` con los `paths` de cada proyecto
2. **Fallback**: Usa el proyecto marcado como activo con `df_project_switch`
3. **Error**: Si no hay match, pide configurar con `df_project_setup`

---

## Arquitectura

```
src/
├── index.ts              # Entry point (stdio transport)
├── server.ts             # Factory: createServer() + instructions
├── lib/
│   ├── types.ts          # Interfaces, defaults, valid tool names
│   ├── storage.ts        # CRUD: projects, flows, rules, config
│   ├── git-exec.ts       # Git CLI wrapper (execFile)
│   ├── jira/
│   │   ├── client.ts     # JiraClient (Cloud v3 + Server v2)
│   │   └── types.ts      # Raw Jira API response shapes
│   └── git/
│       ├── detect.ts     # parseRemoteUrl (SSH/HTTPS, GitHub/GitLab)
│       ├── github.ts     # GitHubClient (REST API v3)
│       ├── gitlab.ts     # GitLabClient (REST API v4)
│       ├── factory.ts    # createGitProviderClient()
│       └── types.ts      # Git provider interfaces
└── tools/
    ├── project.ts        # 5 tools: setup, update, list, switch, delete
    ├── jira.ts           # 6 tools: issues, issue, statuses, transition, assign, comment
    ├── git.ts            # 7 tools: branch, find_branch, checkout, pull, push, merge, pr
    ├── flow.ts           # 5 tools: create, list, get, update, delete
    └── rule.ts           # 9 tools: CRUD global + 3 project-level
```

**Stack**: TypeScript · MCP SDK · Zod · YAML · tsup

**Tests**: 4 suites · 51 tests (Vitest + InMemoryTransport)

---

## Compatibilidad

### Jira

| Tipo | API | Autenticacion |
|------|-----|---------------|
| Jira Cloud | REST API v3 | Email + API Token (Basic) |
| Jira Server / Data Center | REST API v2 | Personal Access Token (Bearer) |

Auto-deteccion via `/rest/api/2/serverInfo` — no necesitas saber que version usas.

### Git

| Proveedor | Soporte |
|-----------|---------|
| GitHub (cloud) | REST API v3 |
| GitHub Enterprise | REST API v3 (custom URL) |
| GitLab (cloud) | REST API v4 |
| GitLab self-hosted | REST API v4 (custom URL) |

Auto-deteccion del proveedor al parsear el remote URL del repositorio.

---

## Contribuir

```bash
git clone https://github.com/cocaxcode/devflow-mcp.git
cd devflow-mcp
npm install
npm run build
npm test
```

| Comando | Descripcion |
|---------|------------|
| `npm run build` | Compilar con tsup |
| `npm run dev` | Build en modo watch |
| `npm test` | Ejecutar tests (Vitest) |
| `npm run test:watch` | Tests en modo watch |
| `npm run typecheck` | Verificar tipos |
| `npm run format` | Formatear con Prettier |
| `npm run inspector` | MCP Inspector |

---

## Licencia

[MIT](./LICENSE) — hecho por [cocaxcode](https://github.com/cocaxcode)
