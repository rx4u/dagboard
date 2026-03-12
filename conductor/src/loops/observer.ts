import type Anthropic from '@anthropic-ai/sdk'
import type { AgenthubClient } from '../api.js'
import type { ConductorConfig, SidecarState } from '../types.js'

const SYSTEM_PROMPT = `You are a passive observer watching a multi-agent software development session.
You have read-only access to agent activity. Your job is to surface non-obvious suggestions:
when to fork a sub-agent, when to try a different approach, when an agent appears stuck in a loop,
when an assumption seems wrong.

Only post if you have a concrete, actionable suggestion. If nothing is notable, respond with exactly: NOTHING`

const RECENT_POSTS_LIMIT = 100
const CONTEXT_WINDOW = 100

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
      this.config.agents.map(a => this.api.listPosts(a.id, RECENT_POSTS_LIMIT))
    )
    const recentActivity = allPosts.flat()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-CONTEXT_WINDOW)
      .map(p => `[${p.agent_id}] ${p.content}`)
      .join('\n')

    const taskSummary = [...this.state.tasks.values()]
      .map(t => {
        const cfg = this.config.tasks.find(tc => tc.id === t.id)
        return `${t.id} (${cfg?.description ?? ''}): ${t.status}`
      })
      .join(', ')

    const userPrompt = `Current task states: ${taskSummary}\n\nRecent agent activity:\n${recentActivity || '(none)'}`

    try {
      const response = await this.anthropic.messages.create({
        model: this.config.observer.model,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const text = (response.content as Array<{ type: string; text?: string }>).find(b => b.type === 'text')?.text?.trim() ?? 'NOTHING'
      if (text === 'NOTHING') return

      const now = new Date()
      const h = String(now.getUTCHours()).padStart(2, '0')
      const m = String(now.getUTCMinutes()).padStart(2, '0')
      const timestamp = `${h}:${m}`
      await this.api.createPost(this.config.observer.channel, `OBSERVER [${timestamp}]:\n${text}`)
    } catch (e) {
      process.stderr.write(`[observer] tick failed: ${(e as Error).message}\n`)
    }
  }
}
