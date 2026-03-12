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

      if (taskState.status !== 'pending') continue

      // Explicit dependency
      if (task.depends_on) {
        const depState = this.state.tasks.get(task.depends_on)
        if (depState?.status !== 'complete') continue
      }

      if (task.checkpoint === 'before_start') {
        if (this.state.pendingCheckpoints.has(task.id)) continue

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

        taskState.status = 'checkpoint_waiting'
        taskState.dispatched_at = new Date().toISOString()
        this.state.pendingCheckpoints.add(task.id)
        await this.api.createPost(this.config.checkpoints.channel, checkpointMsg)
        continue
      }

      const dispatchMsg = [
        `TASK: ${task.id}`,
        task.description,
        '---',
        `Conductor dispatched at ${new Date().toISOString()}`,
      ].join('\n')

      taskState.status = 'dispatched'
      taskState.dispatched_at = new Date().toISOString()
      await this.api.createPost(task.channel, dispatchMsg)
    }
  }
}
