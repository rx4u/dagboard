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

const HISTORY_LIMIT = 200
const SEPARATOR = '='.repeat(50)

export async function buildPageSummary(
  config: ConductorConfig,
  api: AgenthubClient,
  anthropic: Anthropic,
  state: SidecarState,
): Promise<string> {
  const allPosts = await Promise.all(
    config.agents.map(a => api.listPosts(a.id, HISTORY_LIMIT))
  )
  const recentActivity = allPosts.flat()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-HISTORY_LIMIT)
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

  const response = await (anthropic as unknown as Anthropic).messages.create({
    model: 'claude-haiku-3',
    max_tokens: 512,
    system: 'Summarize agent activity in 2-4 concise sentences covering what happened, key decisions made, and any issues. Be factual and brief.',
    messages: [{ role: 'user', content: `Recent activity:\n${recentActivity || '(none)'}` }],
  })

  const narrative = (response.content as Array<{ type: string; text?: string }>).find(b => b.type === 'text')?.text?.trim() ?? '(no activity)'

  const nextAction = state.pendingCheckpoints.size > 0
    ? `Run: conductor approve ${[...state.pendingCheckpoints][0]}\nOr open dagboard ${config.checkpoints.channel} channel to review first.`
    : 'No pending actions. All tasks running or complete.'

  return [
    SEPARATOR,
    `CONDUCTOR PAGE — ${new Date().toLocaleString()}`,
    SEPARATOR,
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
    SEPARATOR,
  ].join('\n')
}
