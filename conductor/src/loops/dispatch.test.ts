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

  it('dispatches task with no depends_on even when previous array task is not complete', async () => {
    // task-3 has checkpoint: before_start and no depends_on
    // task-1 and task-2 are still pending
    // task-3 should still fire its checkpoint (not be blocked by task-1/task-2)
    const state = makeState({ 'task-1': 'pending', 'task-2': 'pending', 'task-3': 'pending' })
    const loop = new DispatchLoop(config, mockApi as any, state)
    await loop.tick()
    // task-1 gets dispatched (no depends_on, no checkpoint)
    expect(state.tasks.get('task-1')?.status).toBe('dispatched')
    // task-3 should have its checkpoint posted (no depends_on blocks it)
    expect(state.pendingCheckpoints.has('task-3')).toBe(true)
    expect(state.tasks.get('task-3')?.status).toBe('checkpoint_waiting')
  })

  it('does not re-dispatch already dispatched task', async () => {
    const state = makeState({ 'task-1': 'dispatched', 'task-2': 'dispatched', 'task-3': 'dispatched' })
    const loop = new DispatchLoop(config, mockApi as any, state)
    await loop.tick()
    expect(mockApi.createPost).not.toHaveBeenCalled()
  })
})
