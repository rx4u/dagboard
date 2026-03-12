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
    state.tasks.get('task-2')!.dispatched_at = '2026-03-12T01:00:00Z'
    const loop = new CheckpointLoop(config, mockApi as any, state)
    await loop.tick()
    expect(state.pendingCheckpoints.has('task-2')).toBe(false)
    expect(state.tasks.get('task-2')?.status).toBe('pending')
    expect(state.tasks.get('task-2')?.dispatched_at).toBeUndefined()
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

  it('removes task from pendingCheckpoints on human-posted DEFER with no status change', async () => {
    mockApi.listPosts.mockResolvedValueOnce([post('DEFER: task-2')])
    const state = makeState()
    const loop = new CheckpointLoop(config, mockApi as any, state)
    await loop.tick()
    expect(state.pendingCheckpoints.has('task-2')).toBe(false)
    // Status unchanged — still checkpoint_waiting
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
