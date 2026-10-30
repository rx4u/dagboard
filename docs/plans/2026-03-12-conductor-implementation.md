# Conductor CLI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI + sidecar process that orchestrates agenthub agents at scale, with overnight checkpoint management, observer suggestions, and context paging.

**Architecture:** TypeScript Node.js CLI (`conductor/` package inside the monorepo). Sidecar runs three loops (dispatch, checkpoint, observer) all talking to the agenthub REST API. In-memory state only, reconstructed from channel history on restart.

**Tech Stack:** TypeScript, commander (CLI), js-yaml (config parsing), zod (validation), @anthropic-ai/sdk (LLM calls), vitest (tests), node-fetch (HTTP)

---

### Task 1: Project Scaffold

**Files:**
- Create: `conductor/package.json`
- Create: `conductor/tsconfig.json`
- Create: `conductor/src/index.ts`
- Create: `conductor/src/types.ts`

**Step 1: Create `conductor/package.json`**

```json
{
  "name": "@agenthub/conductor",
  "version": "0.1.0",
  "description": "CLI orchestrator for agenthub agent swarms",
  "type": "module",
  "bin": {
    "conductor": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "commander": "^12.0.0",
    "js-yaml": "^4.1.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create `conductor/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create `conductor/src/types.ts`**

```typescript
export type CheckpointValue = 'none' | 'before_start' | 'after_complete'

export interface AgentConfig {
  id: string
  model: string
}

export interface TaskConfig {
  id: string
  description: string
  channel: string
  checkpoint: CheckpointValue
  depends_on?: string
  timeout_hours?: number
}

export interface ObserverConfig {
  enabled: boolean
  model: string
  interval_minutes: number
  channel: string
}

export interface CheckpointConfig {
  channel: string
  timeout_hours: number
}

export interface StallConfig {
  threshold_minutes: number
}

export interface ConductorConfig {
  dagboard: { url: string; api_key: string }
  agents: AgentConfig[]
  tasks: TaskConfig[]
  observer: ObserverConfig
  checkpoints: CheckpointConfig
  context: { channel: string }
  stall: StallConfig
}

export type TaskStatus = 'pending' | 'checkpoint_waiting' | 'dispatched' | 'complete' | 'rejected'

export interface TaskState {
  id: string
  status: TaskStatus
  dispatched_at?: string
  completed_at?: string
}

export interface SidecarState {
  tasks: Map<string, TaskState>
  pendingCheckpoints: Set<string>
}

export interface Post {
  id: string
  agent_id: string
  content: string
  created_at: string
  channel: string
}
```

**Step 4: Create `conductor/src/index.ts`** (empty entry for now)

```typescript
// Conductor CLI entry point — wired in Task 8
console.log('conductor v0.1.0')
```

**Step 5: Install dependencies**

Run from `conductor/`:
```bash
cd conductor && npm install
```

Expected: `node_modules/` created, no errors.

**Step 6: Verify TypeScript compiles**

```bash
cd conductor && npm run build
```

Expected: `dist/index.js` created.

**Step 7: Commit**

```bash
git add conductor/
git commit -m "feat(conductor): project scaffold"
```

---

### Task 2: Config Parser + Validator

**Files:**
- Create: `conductor/src/config.ts`
- Create: `conductor/src/config.test.ts`

**Step 1: Write the failing tests**

Create `conductor/src/config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseConfig, ConfigError } from './config.js'

const VALID_YAML = `
dagboard:
  url: http://localhost:8080
  api_key: test-key
agents:
  - id: agent-alpha
    model: claude-opus-4
tasks:
  - id: task-1
    description: Implement auth
    channel: agent-alpha
    checkpoint: before_start
  - id: task-2
    description: Write tests
    channel: agent-alpha
    depends_on: task-1
    checkpoint: none
observer:
  enabled: true
  model: claude-haiku-3
  interval_minutes: 15
  channel: conductor-observer
checkpoints:
  channel: conductor-checkpoints
  timeout_hours: 8
context:
  channel: conductor-log
stall:
  threshold_minutes: 30
`

describe('parseConfig', () => {
  it('parses valid YAML', () => {
    const cfg = parseConfig(VALID_YAML)
    expect(cfg.dagboard.url).toBe('http://localhost:8080')
    expect(cfg.tasks).toHaveLength(2)
    expect(cfg.tasks[0].checkpoint).toBe('before_start')
  })

  it('throws on missing dagboard.url', () => {
    const bad = VALID_YAML.replace('url: http://localhost:8080', '')
    expect(() => parseConfig(bad)).toThrow(ConfigError)
  })

  it('throws on invalid checkpoint value', () => {
    const bad = VALID_YAML.replace('checkpoint: before_start', 'checkpoint: invalid')
    expect(() => parseConfig(bad)).toThrow(ConfigError)
  })

  it('throws on circular depends_on', () => {
    const circular = VALID_YAML.replace(
      'depends_on: task-1',
      'depends_on: task-2\n  - id: task-3\n    description: Task 3\n    channel: agent-alpha\n    depends_on: task-2\n    checkpoint: none'
    )
    // Simpler circular: task-1 depends on task-2, task-2 depends on task-1
    const circularYaml = `
dagboard:
  url: http://localhost:8080
  api_key: test-key
agents:
  - id: agent-alpha
    model: claude-opus-4
tasks:
  - id: task-1
    description: Implement auth
    channel: agent-alpha
    checkpoint: none
    depends_on: task-2
  - id: task-2
    description: Write tests
    channel: agent-alpha
    checkpoint: none
    depends_on: task-1
observer:
  enabled: false
  model: claude-haiku-3
  interval_minutes: 15
  channel: conductor-observer
checkpoints:
  channel: conductor-checkpoints
  timeout_hours: 8
context:
  channel: conductor-log
stall:
  threshold_minutes: 30
`
    expect(() => parseConfig(circularYaml)).toThrow(/circular/i)
  })

  it('throws on depends_on referencing unknown task', () => {
    const bad = VALID_YAML.replace('depends_on: task-1', 'depends_on: task-999')
    expect(() => parseConfig(bad)).toThrow(/unknown/i)
  })
})
```

**Step 2: Run tests — verify they fail**

```bash
cd conductor && npm test
```

Expected: FAIL — `config.js` not found.

**Step 3: Implement `conductor/src/config.ts`**

```typescript
import yaml from 'js-yaml'
import { z } from 'zod'
import type { ConductorConfig } from './types.js'

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

const CheckpointSchema = z.enum(['none', 'before_start', 'after_complete'])

const Schema = z.object({
  dagboard: z.object({ url: z.string().min(1), api_key: z.string().min(1) }),
  agents: z.array(z.object({ id: z.string(), model: z.string() })),
  tasks: z.array(z.object({
    id: z.string(),
    description: z.string(),
    channel: z.string(),
    checkpoint: CheckpointSchema,
    depends_on: z.string().optional(),
    timeout_hours: z.number().optional(),
  })),
  observer: z.object({
    enabled: z.boolean(),
    model: z.string(),
    interval_minutes: z.number(),
    channel: z.string(),
  }),
  checkpoints: z.object({ channel: z.string(), timeout_hours: z.number() }),
  context: z.object({ channel: z.string() }),
  stall: z.object({ threshold_minutes: z.number() }),
})

function detectCircular(tasks: ConductorConfig['tasks']): void {
  const ids = new Set(tasks.map(t => t.id))
  for (const t of tasks) {
    if (t.depends_on && !ids.has(t.depends_on)) {
      throw new ConfigError(`Unknown depends_on: "${t.depends_on}" in task "${t.id}"`)
    }
  }

  const visited = new Set<string>()
  const inStack = new Set<string>()
  const depMap = new Map(tasks.map(t => [t.id, t.depends_on]))

  function dfs(id: string): void {
    if (inStack.has(id)) throw new ConfigError(`Circular depends_on detected involving "${id}"`)
    if (visited.has(id)) return
    visited.add(id)
    inStack.add(id)
    const dep = depMap.get(id)
    if (dep) dfs(dep)
    inStack.delete(id)
  }

  for (const t of tasks) dfs(t.id)
}

export function parseConfig(raw: string): ConductorConfig {
  let parsed: unknown
  try {
    parsed = yaml.load(raw)
  } catch (e) {
    throw new ConfigError(`YAML parse error: ${(e as Error).message}`)
  }

  const result = Schema.safeParse(parsed)
  if (!result.success) {
    const msg = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    throw new ConfigError(`Invalid config: ${msg}`)
  }

  const cfg = result.data as ConductorConfig
  detectCircular(cfg.tasks)
  return cfg
}
```

**Step 4: Run tests — verify they pass**

```bash
cd conductor && npm test
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add conductor/src/config.ts conductor/src/config.test.ts
git commit -m "feat(conductor): config parser with Zod validation and circular dep detection"
```

---

### Task 3: API Client

**Files:**
- Create: `conductor/src/api.ts`
- Create: `conductor/src/api.test.ts`

**Step 1: Write the failing tests**

Create `conductor/src/api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgenthubClient } from './api.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function ok(body: unknown) {
  return { ok: true, json: async () => body, text: async () => JSON.stringify(body) } as Response
}
function fail(status: number) {
  return { ok: false, status, json: async () => ({}), text: async () => '' } as unknown as Response
}

describe('AgenthubClient', () => {
  let client: AgenthubClient

  beforeEach(() => {
    client = new AgenthubClient('http://localhost:8080', 'test-key')
    mockFetch.mockReset()
  })

  it('listPosts sends correct headers', async () => {
    mockFetch.mockResolvedValueOnce(ok([{ id: '1', agent_id: 'a', content: 'hi', created_at: '2026-01-01T00:00:00Z', channel: 'ch' }]))
    const posts = await client.listPosts('ch', 100)
    expect(posts).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/channels/ch/posts?limit=100',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-key' }) })
    )
  })

  it('createPost posts to correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(ok({ id: '2', agent_id: 'conductor', content: 'TASK: t1', created_at: '2026-01-01T00:00:00Z', channel: 'ch' }))
    const post = await client.createPost('ch', 'TASK: t1')
    expect(post.id).toBe('2')
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(fail(401))
    await expect(client.listPosts('ch', 10)).rejects.toThrow('401')
  })

  it('listPosts defaults limit to 500', async () => {
    mockFetch.mockResolvedValueOnce(ok([]))
    await client.listPosts('ch')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/channels/ch/posts?limit=500',
      expect.anything()
    )
  })
})
```

**Step 2: Run tests — verify they fail**

```bash
cd conductor && npm test
```

Expected: FAIL — `api.js` not found.

**Step 3: Implement `conductor/src/api.ts`**

```typescript
import type { Post } from './types.js'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export class AgenthubClient {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  private get headers() {
    return { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers: { ...this.headers, ...init?.headers } })
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}: ${path}`)
    return res.json() as Promise<T>
  }

  async listPosts(channel: string, limit = 500): Promise<Post[]> {
    return this.request<Post[]>(`/api/channels/${channel}/posts?limit=${limit}`)
  }

  async createPost(channel: string, content: string, agentId = 'conductor'): Promise<Post> {
    return this.request<Post>(`/api/channels/${channel}/posts`, {
      method: 'POST',
      body: JSON.stringify({ agent_id: agentId, content, parent_id: null }),
    })
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`)
      return res.ok
    } catch {
      return false
    }
  }
}
```

**Step 4: Run tests — verify they pass**

```bash
cd conductor && npm test
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add conductor/src/api.ts conductor/src/api.test.ts
git commit -m "feat(conductor): agenthub API client"
```

---

### Task 4: State Manager

**Files:**
- Create: `conductor/src/state.ts`
- Create: `conductor/src/state.test.ts`

**Step 1: Write the failing tests**

Create `conductor/src/state.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildStateFromHistory } from './state.js'
import type { Post, TaskConfig } from './types.js'

function post(content: string, id = '1'): Post {
  return { id, agent_id: 'conductor', content, created_at: '2026-01-01T00:00:00Z', channel: 'ch' }
}

const tasks: TaskConfig[] = [
  { id: 'task-1', description: 'T1', channel: 'agent-alpha', checkpoint: 'none' },
  { id: 'task-2', description: 'T2', channel: 'agent-alpha', checkpoint: 'none', depends_on: 'task-1' },
]

describe('buildStateFromHistory', () => {
  it('starts all tasks as pending with no history', () => {
    const state = buildStateFromHistory(tasks, [])
    expect(state.tasks.get('task-1')?.status).toBe('pending')
    expect(state.tasks.get('task-2')?.status).toBe('pending')
  })

  it('marks task complete when COMPLETE marker seen', () => {
    const state = buildStateFromHistory(tasks, [post('COMPLETE: task-1')])
    expect(state.tasks.get('task-1')?.status).toBe('complete')
    expect(state.tasks.get('task-2')?.status).toBe('pending')
  })

  it('marks task dispatched when TASK: marker seen', () => {
    const state = buildStateFromHistory(tasks, [post('TASK: task-1\nImplement auth')])
    expect(state.tasks.get('task-1')?.status).toBe('dispatched')
  })

  it('marks task rejected when REJECT: marker seen', () => {
    const state = buildStateFromHistory(tasks, [post('REJECT: task-1')])
    expect(state.tasks.get('task-1')?.status).toBe('rejected')
  })

  it('dispatched is overridden by complete', () => {
    const posts = [post('TASK: task-1\nImpl', '1'), post('COMPLETE: task-1', '2')]
    const state = buildStateFromHistory(tasks, posts)
    expect(state.tasks.get('task-1')?.status).toBe('complete')
  })

  it('tracks pending checkpoints from CHECKPOINT: markers', () => {
    const posts = [post('CHECKPOINT: task-1\n---\nApproval needed', '1')]
    const state = buildStateFromHistory(tasks, posts)
    expect(state.pendingCheckpoints.has('task-1')).toBe(true)
  })

  it('clears checkpoint from pending when APPROVE: seen', () => {
    const posts = [
      post('CHECKPOINT: task-1\n---\nApproval needed', '1'),
      post('APPROVE: task-1', '2'),
    ]
    const state = buildStateFromHistory(tasks, posts)
    expect(state.pendingCheckpoints.has('task-1')).toBe(false)
  })
})
```

**Step 2: Run tests — verify they fail**

```bash
cd conductor && npm test
```

Expected: FAIL — `state.js` not found.

**Step 3: Implement `conductor/src/state.ts`**

```typescript
import type { Post, SidecarState, TaskConfig, TaskStatus } from './types.js'

const STATUS_PRIORITY: Record<TaskStatus, number> = {
  pending: 0,
  checkpoint_waiting: 1,
  dispatched: 2,
  complete: 3,
  rejected: 3,
}

function higherPriority(a: TaskStatus, b: TaskStatus): TaskStatus {
  return STATUS_PRIORITY[a] >= STATUS_PRIORITY[b] ? a : b
}

export function buildStateFromHistory(tasks: TaskConfig[], posts: Post[]): SidecarState {
  const state: SidecarState = {
    tasks: new Map(tasks.map(t => [t.id, { id: t.id, status: 'pending' }])),
    pendingCheckpoints: new Set(),
  }

  for (const post of posts) {
    const content = post.content.trim()

    const taskMatch = content.match(/^TASK:\s+(\S+)/)
    if (taskMatch) {
      const id = taskMatch[1]
      const current = state.tasks.get(id)
      if (current) current.status = higherPriority(current.status, 'dispatched')
    }

    const completeMatch = content.match(/^COMPLETE:\s+(\S+)/)
    if (completeMatch) {
      const id = completeMatch[1]
      const current = state.tasks.get(id)
      if (current) { current.status = 'complete'; current.completed_at = post.created_at }
    }

    const rejectMatch = content.match(/^REJECT:\s+(\S+)/)
    if (rejectMatch) {
      const id = rejectMatch[1]
      const current = state.tasks.get(id)
      if (current) current.status = 'rejected'
    }

    const checkpointMatch = content.match(/^CHECKPOINT:\s+(\S+)/)
    if (checkpointMatch) {
      state.pendingCheckpoints.add(checkpointMatch[1])
    }

    const approveMatch = content.match(/^APPROVE:\s+(\S+)/)
    if (approveMatch) state.pendingCheckpoints.delete(approveMatch[1])

    const deferMatch = content.match(/^DEFER:\s+(\S+)/)
    if (deferMatch) state.pendingCheckpoints.delete(deferMatch[1])
  }

  return state
}
```

**Step 4: Run tests — verify they pass**

```bash
cd conductor && npm test
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add conductor/src/state.ts conductor/src/state.test.ts
git commit -m "feat(conductor): state manager with history replay"
```

---

### Task 5: Dispatch Loop

**Files:**
- Create: `conductor/src/loops/dispatch.ts`
- Create: `conductor/src/loops/dispatch.test.ts`

**Step 1: Write the failing tests**

Create `conductor/src/loops/dispatch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DispatchLoop } from './dispatch.js'
import type { ConductorConfig, SidecarState } from '../types.js'

const mockApi = {
  listPosts: vi.fn(),
  createPost: vi.fn(),
}

const config: ConductorConfig = {
  dagboard: { url: 'http://localhost:8080', api_key: 'key' },
  agents: [{ id: 'agent-alpha', model: 'claude-opus-4' }],
  tasks: [
    { id: 'task-1', description: 'Do thing A', channel: 'agent-alpha', checkpoint: 'none' },
    { id: 'task-2', description: 'Do thing B', channel: 'agent-alpha', checkpoint: 'none', depends_on: 'task-1' },
    { id: 'task-3', description: 'Do thing C', channel: 'agent-alpha', checkpoint: 'before_start' },
  ],
  observer: { enabled: false, model: '', interval_minutes: 15, channel: 'co' },
  checkpoints: { channel: 'conductor-checkpoints', timeout_hours: 8 },
  context: { channel: 'conductor-log' },
  stall: { threshold_minutes: 30 },
}

function makeState(overrides: Record<string, string> = {}): SidecarState {
  const defaults: Record<string, string> = { 'task-1': 'pending', 'task-2': 'pending', 'task-3': 'pending' }
  const merged = { ...defaults, ...overrides }
  return {
    tasks: new Map(Object.entries(merged).map(([id, status]) => [id, { id, status: status as any }])),
    pendingCheckpoints: new Set(),
  }
}

describe('DispatchLoop', () => {
  beforeEach(() => {
    mockApi.listPosts.mockReset()
    mockApi.createPost.mockReset()
    mockApi.createPost.mockResolvedValue({ id: 'p1', agent_id: 'conductor', content: '', created_at: '', channel: '' })
  })

  it('dispatches pending task with no dependencies', async () => {
    const state = makeState()
    const loop = new DispatchLoop(config, mockApi as any, state)
    await loop.tick()
    expect(mockApi.createPost).toHaveBeenCalledWith('agent-alpha', expect.stringContaining('TASK: task-1'))
    expect(state.tasks.get('task-1')?.status).toBe('dispatched')
  })

  it('does not dispatch task-2 while task-1 pending', async () => {
    const state = makeState()
    const loop = new DispatchLoop(config, mockApi as any, state)
    await loop.tick()
    // Only task-1 dispatched, task-2 still blocked
    expect(state.tasks.get('task-2')?.status).toBe('pending')
  })

  it('dispatches task-2 when task-1 is complete', async () => {
    const state = makeState({ 'task-1': 'complete', 'task-2': 'pending', 'task-3': 'pending' })
    const loop = new DispatchLoop(config, mockApi as any, state)
    await loop.tick()
    expect(mockApi.createPost).toHaveBeenCalledWith('agent-alpha', expect.stringContaining('TASK: task-2'))
  })

  it('posts checkpoint for task-3 instead of dispatching', async () => {
    const state = makeState({ 'task-1': 'complete', 'task-2': 'complete', 'task-3': 'pending' })
    const loop = new DispatchLoop(config, mockApi as any, state)
    await loop.tick()
    expect(mockApi.createPost).toHaveBeenCalledWith(
      'conductor-checkpoints',
      expect.stringContaining('CHECKPOINT: task-3')
    )
    expect(state.tasks.get('task-3')?.status).toBe('checkpoint_waiting')
    expect(state.pendingCheckpoints.has('task-3')).toBe(true)
  })

  it('does not re-dispatch already dispatched task', async () => {
    const state = makeState({ 'task-1': 'dispatched' })
    const loop = new DispatchLoop(config, mockApi as any, state)
    await loop.tick()
    expect(mockApi.createPost).not.toHaveBeenCalled()
  })
})
```

**Step 2: Run tests — verify they fail**

```bash
cd conductor && npm test
```

Expected: FAIL — `loops/dispatch.js` not found.

**Step 3: Create `conductor/src/loops/` directory and implement `dispatch.ts`**

```typescript
import type { AgenthubClient } from '../api.js'
import type { ConductorConfig, SidecarState } from '../types.js'

export class DispatchLoop {
  constructor(
    private readonly config: ConductorConfig,
    private readonly api: AgenthubClient,
    private readonly state: SidecarState,
  ) {}

  async tick(): Promise<void> {
    for (const task of this.config.tasks) {
      const taskState = this.state.tasks.get(task.id)
      if (!taskState) continue

      // Skip if already beyond pending
      if (taskState.status !== 'pending') continue

      // Skip if dependency not complete
      if (task.depends_on) {
        const depState = this.state.tasks.get(task.depends_on)
        if (depState?.status !== 'complete') continue
      }

      // Checkpoint gate
      if (task.checkpoint === 'before_start') {
        const checkpointMsg = [
          `CHECKPOINT: ${task.id}`,
          '---',
          `Agent ${task.channel} is ready to start "${task.description}"`,
          task.depends_on ? `Depends on: ${task.depends_on} ✓ complete` : '',
          '',
          'Reply with:',
          `  APPROVE: ${task.id}`,
          `  REJECT: ${task.id}`,
          `  DEFER: ${task.id} (ask again in 1 hour)`,
        ].filter(Boolean).join('\n')

        await this.api.createPost(this.config.checkpoints.channel, checkpointMsg)
        taskState.status = 'checkpoint_waiting'
        this.state.pendingCheckpoints.add(task.id)
        continue
      }

      // Dispatch
      const dispatchMsg = [
        `TASK: ${task.id}`,
        task.description,
        '---',
        `Conductor dispatched at ${new Date().toISOString()}`,
      ].join('\n')

      await this.api.createPost(task.channel, dispatchMsg)
      taskState.status = 'dispatched'
      taskState.dispatched_at = new Date().toISOString()
    }
  }
}
```

**Step 4: Run tests — verify they pass**

```bash
cd conductor && npm test
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add conductor/src/loops/dispatch.ts conductor/src/loops/dispatch.test.ts
git commit -m "feat(conductor): dispatch loop with checkpoint gate and dependency ordering"
```

---

### Task 6: Checkpoint Loop

**Files:**
- Create: `conductor/src/loops/checkpoint.ts`
- Create: `conductor/src/loops/checkpoint.test.ts`

**Step 1: Write the failing tests**

Create `conductor/src/loops/checkpoint.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CheckpointLoop } from './checkpoint.js'
import type { ConductorConfig, SidecarState, Post } from '../types.js'

const mockApi = {
  listPosts: vi.fn(),
  createPost: vi.fn(),
}

const config: ConductorConfig = {
  dagboard: { url: '', api_key: '' },
  agents: [],
  tasks: [
    { id: 'task-2', description: 'Write tests', channel: 'agent-alpha', checkpoint: 'before_start' },
  ],
  observer: { enabled: false, model: '', interval_minutes: 15, channel: 'co' },
  checkpoints: { channel: 'conductor-checkpoints', timeout_hours: 8 },
  context: { channel: 'conductor-log' },
  stall: { threshold_minutes: 30 },
}

function makeState(): SidecarState {
  return {
    tasks: new Map([['task-2', { id: 'task-2', status: 'checkpoint_waiting' }]]),
    pendingCheckpoints: new Set(['task-2']),
  }
}

function post(content: string): Post {
  return { id: '1', agent_id: 'user', content, created_at: new Date().toISOString(), channel: 'conductor-checkpoints' }
}

describe('CheckpointLoop', () => {
  beforeEach(() => {
    mockApi.listPosts.mockReset()
    mockApi.createPost.mockReset()
    mockApi.createPost.mockResolvedValue(post(''))
  })

  it('clears checkpoint and sets task to pending on APPROVE', async () => {
    mockApi.listPosts.mockResolvedValueOnce([post('APPROVE: task-2')])
    const state = makeState()
    const loop = new CheckpointLoop(config, mockApi as any, state)
    await loop.tick()
    expect(state.pendingCheckpoints.has('task-2')).toBe(false)
    expect(state.tasks.get('task-2')?.status).toBe('pending')
  })

  it('sets task to rejected on REJECT', async () => {
    mockApi.listPosts.mockResolvedValueOnce([post('REJECT: task-2')])
    const state = makeState()
    const loop = new CheckpointLoop(config, mockApi as any, state)
    await loop.tick()
    expect(state.tasks.get('task-2')?.status).toBe('rejected')
    expect(state.pendingCheckpoints.has('task-2')).toBe(false)
  })

  it('does nothing on unrelated post', async () => {
    mockApi.listPosts.mockResolvedValueOnce([post('Hello from agent')])
    const state = makeState()
    const loop = new CheckpointLoop(config, mockApi as any, state)
    await loop.tick()
    expect(state.pendingCheckpoints.has('task-2')).toBe(true)
    expect(state.tasks.get('task-2')?.status).toBe('checkpoint_waiting')
  })

  it('posts DEFER after timeout and removes from pending', async () => {
    mockApi.listPosts.mockResolvedValueOnce([])
    const state = makeState()
    // Simulate task dispatched 9 hours ago (past 8h timeout)
    state.tasks.get('task-2')!.dispatched_at = new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString()
    const loop = new CheckpointLoop(config, mockApi as any, state)
    await loop.tick()
    expect(mockApi.createPost).toHaveBeenCalledWith(
      'conductor-checkpoints',
      expect.stringContaining('DEFER: task-2')
    )
    expect(state.pendingCheckpoints.has('task-2')).toBe(false)
  })
})
```

**Step 2: Run tests — verify they fail**

```bash
cd conductor && npm test
```

Expected: FAIL.

**Step 3: Implement `conductor/src/loops/checkpoint.ts`**

```typescript
import type { AgenthubClient } from '../api.js'
import type { ConductorConfig, SidecarState } from '../types.js'

export class CheckpointLoop {
  constructor(
    private readonly config: ConductorConfig,
    private readonly api: AgenthubClient,
    private readonly state: SidecarState,
  ) {}

  async tick(): Promise<void> {
    if (this.state.pendingCheckpoints.size === 0) return

    const posts = await this.api.listPosts(this.config.checkpoints.channel, 200)

    for (const post of posts) {
      const content = post.content.trim()

      const approveMatch = content.match(/^APPROVE:\s+(\S+)/)
      if (approveMatch) {
        const id = approveMatch[1]
        const taskState = this.state.tasks.get(id)
        if (taskState) { taskState.status = 'pending'; taskState.dispatched_at = undefined }
        this.state.pendingCheckpoints.delete(id)
      }

      const rejectMatch = content.match(/^REJECT:\s+(\S+)/)
      if (rejectMatch) {
        const id = rejectMatch[1]
        const taskState = this.state.tasks.get(id)
        if (taskState) taskState.status = 'rejected'
        this.state.pendingCheckpoints.delete(id)
      }

      const deferMatch = content.match(/^DEFER:\s+(\S+)/)
      if (deferMatch) this.state.pendingCheckpoints.delete(deferMatch[1])
    }

    // Check timeouts
    const timeoutMs = this.config.checkpoints.timeout_hours * 60 * 60 * 1000
    const now = Date.now()

    for (const taskId of [...this.state.pendingCheckpoints]) {
      const taskState = this.state.tasks.get(taskId)
      if (!taskState?.dispatched_at) continue
      const age = now - new Date(taskState.dispatched_at).getTime()
      if (age > timeoutMs) {
        await this.api.createPost(
          this.config.checkpoints.channel,
          `DEFER: ${taskId}\n---\nCheckpoint timed out after ${this.config.checkpoints.timeout_hours}h. Task paused.`
        )
        this.state.pendingCheckpoints.delete(taskId)
      }
    }
  }
}
```

**Step 4: Run tests — verify they pass**

```bash
cd conductor && npm test
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add conductor/src/loops/checkpoint.ts conductor/src/loops/checkpoint.test.ts
git commit -m "feat(conductor): checkpoint loop with approve/reject/defer and timeout"
```

---

### Task 7: Observer Loop + Context Paging

**Files:**
- Create: `conductor/src/loops/observer.ts`
- Create: `conductor/src/loops/observer.test.ts`
- Create: `conductor/src/page.ts`
- Create: `conductor/src/page.test.ts`

**Step 1: Write the failing tests**

Create `conductor/src/loops/observer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ObserverLoop } from './observer.js'
import type { ConductorConfig, SidecarState } from '../types.js'

const mockApi = { listPosts: vi.fn(), createPost: vi.fn() }
const mockAnthropic = {
  messages: {
    create: vi.fn(),
  },
}

const config: ConductorConfig = {
  dagboard: { url: '', api_key: '' },
  agents: [{ id: 'agent-alpha', model: 'claude-opus-4' }],
  tasks: [{ id: 'task-1', description: 'Do thing', channel: 'agent-alpha', checkpoint: 'none' }],
  observer: { enabled: true, model: 'claude-haiku-3', interval_minutes: 15, channel: 'conductor-observer' },
  checkpoints: { channel: 'cc', timeout_hours: 8 },
  context: { channel: 'conductor-log' },
  stall: { threshold_minutes: 30 },
}

function makeState(): SidecarState {
  return {
    tasks: new Map([['task-1', { id: 'task-1', status: 'dispatched' }]]),
    pendingCheckpoints: new Set(),
  }
}

describe('ObserverLoop', () => {
  beforeEach(() => {
    mockApi.listPosts.mockReset()
    mockApi.createPost.mockReset()
    mockAnthropic.messages.create.mockReset()
    mockApi.createPost.mockResolvedValue({ id: '1', agent_id: 'conductor', content: '', created_at: '', channel: '' })
  })

  it('posts suggestion when LLM returns non-NOTHING response', async () => {
    mockApi.listPosts.mockResolvedValue([
      { id: '1', agent_id: 'agent-alpha', content: 'Working on task', created_at: '2026-01-01T00:00:00Z', channel: 'agent-alpha' }
    ])
    mockAnthropic.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Suggest forking a sub-agent for faster results.' }]
    })
    const loop = new ObserverLoop(config, mockApi as any, mockAnthropic as any, makeState())
    await loop.tick()
    expect(mockApi.createPost).toHaveBeenCalledWith(
      'conductor-observer',
      expect.stringContaining('Suggest forking a sub-agent')
    )
  })

  it('does not post when LLM returns NOTHING', async () => {
    mockApi.listPosts.mockResolvedValue([])
    mockAnthropic.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'NOTHING' }]
    })
    const loop = new ObserverLoop(config, mockApi as any, mockAnthropic as any, makeState())
    await loop.tick()
    expect(mockApi.createPost).not.toHaveBeenCalled()
  })

  it('skips when observer is disabled', async () => {
    const disabledConfig = { ...config, observer: { ...config.observer, enabled: false } }
    const loop = new ObserverLoop(disabledConfig, mockApi as any, mockAnthropic as any, makeState())
    await loop.tick()
    expect(mockApi.listPosts).not.toHaveBeenCalled()
  })
})
```

Create `conductor/src/page.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildPageSummary } from './page.js'
import type { ConductorConfig, SidecarState } from './types.js'

const mockApi = { listPosts: vi.fn(), createPost: vi.fn() }
const mockAnthropic = { messages: { create: vi.fn() } }

const config: ConductorConfig = {
  dagboard: { url: '', api_key: '' },
  agents: [{ id: 'agent-alpha', model: 'claude-opus-4' }],
  tasks: [
    { id: 'task-1', description: 'Implement auth', channel: 'agent-alpha', checkpoint: 'none' },
    { id: 'task-2', description: 'Write tests', channel: 'agent-alpha', checkpoint: 'none', depends_on: 'task-1' },
  ],
  observer: { enabled: false, model: '', interval_minutes: 15, channel: 'co' },
  checkpoints: { channel: 'cc', timeout_hours: 8 },
  context: { channel: 'conductor-log' },
  stall: { threshold_minutes: 30 },
}

function makeState(): SidecarState {
  return {
    tasks: new Map([
      ['task-1', { id: 'task-1', status: 'complete', completed_at: '2026-03-12T03:22:00Z' }],
      ['task-2', { id: 'task-2', status: 'checkpoint_waiting', dispatched_at: '2026-03-12T05:01:00Z' }],
    ]),
    pendingCheckpoints: new Set(['task-2']),
  }
}

describe('buildPageSummary', () => {
  beforeEach(() => {
    mockApi.listPosts.mockReset()
    mockAnthropic.messages.create.mockReset()
    mockApi.listPosts.mockResolvedValue([])
    mockAnthropic.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'agent-alpha completed auth at 03:22. Tests ready.' }]
    })
  })

  it('returns a string containing task states', async () => {
    const summary = await buildPageSummary(config, mockApi as any, mockAnthropic as any, makeState())
    expect(summary).toContain('task-1')
    expect(summary).toContain('complete')
    expect(summary).toContain('task-2')
    expect(summary).toContain('checkpoint')
  })

  it('includes LLM narrative', async () => {
    const summary = await buildPageSummary(config, mockApi as any, mockAnthropic as any, makeState())
    expect(summary).toContain('completed auth')
  })
})
```

**Step 2: Run tests — verify they fail**

```bash
cd conductor && npm test
```

Expected: FAIL.

**Step 3: Implement `conductor/src/loops/observer.ts`**

```typescript
import type Anthropic from '@anthropic-ai/sdk'
import type { AgenthubClient } from '../api.js'
import type { ConductorConfig, SidecarState } from '../types.js'

const SYSTEM_PROMPT = `You are a passive observer watching a multi-agent software development session.
You have read-only access to agent activity. Your job is to surface non-obvious suggestions:
when to fork a sub-agent, when to try a different approach, when an agent appears stuck in a loop,
when an assumption seems wrong.

Only post if you have a concrete, actionable suggestion. If nothing is notable, respond with exactly: NOTHING`

export class ObserverLoop {
  constructor(
    private readonly config: ConductorConfig,
    private readonly api: AgenthubClient,
    private readonly anthropic: Anthropic,
    private readonly state: SidecarState,
  ) {}

  async tick(): Promise<void> {
    if (!this.config.observer.enabled) return

    const allPosts = await Promise.all(
      this.config.agents.map(a => this.api.listPosts(a.id, 50))
    )
    const recentActivity = allPosts.flat()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-100)
      .map(p => `[${p.agent_id}] ${p.content}`)
      .join('\n')

    const taskSummary = [...this.state.tasks.values()]
      .map(t => `${t.id}: ${t.status}`)
      .join(', ')

    const userPrompt = `Current task states: ${taskSummary}\n\nRecent agent activity:\n${recentActivity || '(none)'}`

    const response = await this.anthropic.messages.create({
      model: this.config.observer.model,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content.find(b => b.type === 'text')?.text?.trim() ?? 'NOTHING'
    if (text === 'NOTHING') return

    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
    await this.api.createPost(this.config.observer.channel, `OBSERVER [${timestamp}]:\n${text}`)
  }
}
```

**Step 4: Implement `conductor/src/page.ts`**

```typescript
import type Anthropic from '@anthropic-ai/sdk'
import type { AgenthubClient } from './api.js'
import type { ConductorConfig, SidecarState, TaskStatus } from './types.js'

const STATUS_SYMBOL: Record<TaskStatus, string> = {
  pending: '—',
  checkpoint_waiting: '⏸',
  dispatched: '→',
  complete: '✓',
  rejected: '✗',
}

export async function buildPageSummary(
  config: ConductorConfig,
  api: AgenthubClient,
  anthropic: Anthropic,
  state: SidecarState,
): Promise<string> {
  const allPosts = await Promise.all(
    config.agents.map(a => api.listPosts(a.id, 200))
  )
  const recentActivity = allPosts.flat()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-200)
    .map(p => `[${p.agent_id}] ${p.content}`)
    .join('\n')

  const taskLines = config.tasks.map(t => {
    const ts = state.tasks.get(t.id)
    const symbol = STATUS_SYMBOL[ts?.status ?? 'pending']
    const detail = ts?.completed_at
      ? `  (${t.channel}, ${new Date(ts.completed_at).toLocaleTimeString()})`
      : ts?.dispatched_at
        ? `  (since ${new Date(ts.dispatched_at).toLocaleTimeString()})`
        : ''
    return `  ${t.id}  ${symbol} ${ts?.status ?? 'pending'}${detail}`
  })

  const openQuestions: string[] = []
  for (const taskId of state.pendingCheckpoints) {
    const ts = state.tasks.get(taskId)
    openQuestions.push(`  • ${taskId} checkpoint waiting since ${ts?.dispatched_at ? new Date(ts.dispatched_at).toLocaleTimeString() : 'unknown'}`)
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-3',
    max_tokens: 512,
    system: 'Summarize agent activity in 2-4 concise sentences covering what happened, key decisions made, and any issues. Be factual and brief.',
    messages: [{ role: 'user', content: `Recent activity:\n${recentActivity || '(none)'}` }],
  })

  const narrative = response.content.find(b => b.type === 'text')?.text?.trim() ?? '(no activity)'

  const nextAction = state.pendingCheckpoints.size > 0
    ? `Run: conductor approve ${[...state.pendingCheckpoints][0]}\nOr open dagboard ${config.checkpoints.channel} channel to review first.`
    : 'No pending actions. All tasks running or complete.'

  const sep = '='.repeat(50)
  return [
    `${sep}`,
    `CONDUCTOR PAGE — ${new Date().toLocaleString()}`,
    `${sep}`,
    '',
    'CURRENT STATE',
    ...taskLines,
    '',
    'WHAT HAPPENED',
    `  ${narrative}`,
    '',
    ...(openQuestions.length ? ['OPEN QUESTIONS', ...openQuestions, ''] : []),
    'SUGGESTED NEXT ACTION',
    `  ${nextAction}`,
    '',
    `${sep}`,
  ].join('\n')
}
```

**Step 5: Run tests — verify they pass**

```bash
cd conductor && npm test
```

Expected: All tests PASS.

**Step 6: Commit**

```bash
git add conductor/src/loops/observer.ts conductor/src/loops/observer.test.ts conductor/src/page.ts conductor/src/page.test.ts
git commit -m "feat(conductor): observer loop and context paging"
```

---

### Task 8: CLI Entry Point + Sidecar

**Files:**
- Create: `conductor/src/sidecar.ts`
- Create: `conductor/src/cli.ts`
- Modify: `conductor/src/index.ts`

**Step 1: Implement `conductor/src/sidecar.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'node:fs'
import { AgenthubClient } from './api.js'
import { parseConfig } from './config.js'
import { buildStateFromHistory } from './state.js'
import { DispatchLoop } from './loops/dispatch.js'
import { CheckpointLoop } from './loops/checkpoint.js'
import { ObserverLoop } from './loops/observer.js'
import type { ConductorConfig, SidecarState } from './types.js'

async function reconstructState(config: ConductorConfig, api: AgenthubClient): Promise<SidecarState> {
  const channels = [
    config.checkpoints.channel,
    config.context.channel,
    config.observer.channel,
    ...config.agents.map(a => a.id),
  ]
  const allPosts = await Promise.all(channels.map(ch =>
    api.listPosts(ch, 500).catch(() => [])
  ))
  return buildStateFromHistory(config.tasks, allPosts.flat().sort((a, b) => a.created_at.localeCompare(b.created_at)))
}

export async function runSidecar(configPath: string): Promise<void> {
  const raw = readFileSync(configPath, 'utf-8')
  const config = parseConfig(raw)
  const api = new AgenthubClient(config.dagboard.url, config.dagboard.api_key)
  const anthropic = new Anthropic()

  console.log(`[conductor] Starting sidecar — ${config.tasks.length} tasks, ${config.agents.length} agents`)

  const state = await reconstructState(config, api)
  console.log(`[conductor] State reconstructed from history`)

  const dispatch = new DispatchLoop(config, api, state)
  const checkpoint = new CheckpointLoop(config, api, state)
  const observer = new ObserverLoop(config, api, anthropic, state)

  // Dispatch + checkpoint: 30s tick
  setInterval(async () => {
    try { await checkpoint.tick() } catch (e) { console.error('[checkpoint]', e) }
    try { await dispatch.tick() } catch (e) { console.error('[dispatch]', e) }
  }, 30_000)

  // Observer: configurable interval
  setInterval(async () => {
    try { await observer.tick() } catch (e) { console.error('[observer]', e) }
  }, config.observer.interval_minutes * 60 * 1000)

  // Run immediately on start
  await checkpoint.tick()
  await dispatch.tick()

  console.log(`[conductor] Loops running. Ctrl+C to stop.`)
}
```

**Step 2: Implement `conductor/src/cli.ts`**

```typescript
import { Command } from 'commander'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { parseConfig } from './config.js'
import { AgenthubClient } from './api.js'
import { buildStateFromHistory } from './state.js'
import { buildPageSummary } from './page.js'
import { runSidecar } from './sidecar.js'

function loadConfig(configPath: string) {
  const raw = readFileSync(resolve(configPath), 'utf-8')
  return parseConfig(raw)
}

export function buildCli(): Command {
  const program = new Command()
    .name('conductor')
    .description('Orchestrate agenthub agent swarms')
    .version('0.1.0')

  program
    .command('start')
    .description('Start the conductor sidecar process')
    .option('-c, --config <path>', 'Path to conductor.yaml', 'conductor.yaml')
    .action(async (opts) => {
      await runSidecar(opts.config)
    })

  program
    .command('page')
    .description('Print context summary for the current session')
    .option('-c, --config <path>', 'Path to conductor.yaml', 'conductor.yaml')
    .action(async (opts) => {
      const config = loadConfig(opts.config)
      const api = new AgenthubClient(config.dagboard.url, config.dagboard.api_key)
      const anthropic = new Anthropic()
      const channels = [config.checkpoints.channel, ...config.agents.map(a => a.id)]
      const allPosts = await Promise.all(channels.map(ch => api.listPosts(ch, 200).catch(() => [])))
      const state = buildStateFromHistory(config.tasks, allPosts.flat().sort((a, b) => a.created_at.localeCompare(b.created_at)))
      const summary = await buildPageSummary(config, api, anthropic, state)
      console.log(summary)
    })

  program
    .command('approve <task-id>')
    .description('Approve a checkpoint')
    .option('-c, --config <path>', 'Path to conductor.yaml', 'conductor.yaml')
    .action(async (taskId, opts) => {
      const config = loadConfig(opts.config)
      const api = new AgenthubClient(config.dagboard.url, config.dagboard.api_key)
      await api.createPost(config.checkpoints.channel, `APPROVE: ${taskId}`)
      console.log(`Approved: ${taskId}`)
    })

  program
    .command('reject <task-id>')
    .description('Reject a checkpoint')
    .option('-c, --config <path>', 'Path to conductor.yaml', 'conductor.yaml')
    .action(async (taskId, opts) => {
      const config = loadConfig(opts.config)
      const api = new AgenthubClient(config.dagboard.url, config.dagboard.api_key)
      await api.createPost(config.checkpoints.channel, `REJECT: ${taskId}`)
      console.log(`Rejected: ${taskId}`)
    })

  program
    .command('status')
    .description('Show current task status')
    .option('-c, --config <path>', 'Path to conductor.yaml', 'conductor.yaml')
    .action(async (opts) => {
      const config = loadConfig(opts.config)
      const api = new AgenthubClient(config.dagboard.url, config.dagboard.api_key)
      const channels = [config.checkpoints.channel, ...config.agents.map(a => a.id)]
      const allPosts = await Promise.all(channels.map(ch => api.listPosts(ch, 200).catch(() => [])))
      const state = buildStateFromHistory(config.tasks, allPosts.flat().sort((a, b) => a.created_at.localeCompare(b.created_at)))
      for (const [id, ts] of state.tasks) {
        console.log(`${id}: ${ts.status}`)
      }
    })

  return program
}
```

**Step 3: Update `conductor/src/index.ts`**

```typescript
#!/usr/bin/env node
import { buildCli } from './cli.js'
buildCli().parse(process.argv)
```

**Step 4: Run all tests — verify everything passes**

```bash
cd conductor && npm test
```

Expected: All tests PASS.

**Step 5: Build**

```bash
cd conductor && npm run build
```

Expected: `dist/` populated, no TypeScript errors.

**Step 6: Smoke test**

```bash
cd conductor && node dist/index.js --help
```

Expected:
```
Usage: conductor [options] [command]

Orchestrate agenthub agent swarms

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  start [options]         Start the conductor sidecar process
  page [options]          Print context summary for the current session
  approve [options] <task-id>  Approve a checkpoint
  reject [options] <task-id>   Reject a checkpoint
  status [options]        Show current task status
  help [command]          display help for command
```

**Step 7: Commit**

```bash
git add conductor/src/sidecar.ts conductor/src/cli.ts conductor/src/index.ts
git commit -m "feat(conductor): CLI entry point with start, page, approve, reject, status commands"
```
