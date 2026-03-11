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
