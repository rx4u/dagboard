import type { AgenthubClient } from '../api.js'
import type { ConductorConfig, SidecarState } from '../types.js'

export class DispatchLoop {
  constructor(
    private readonly config: ConductorConfig,
    private readonly api: AgenthubClient,
    private readonly state: SidecarState,
  ) {}

  async tick(): Promise<void> {
    for (let i = 0; i < this.config.tasks.length; i++) {
      const task = this.config.tasks[i]
      const taskState = this.state.tasks.get(task.id)
      if (!taskState) continue

      if (taskState.status !== 'pending') continue

      // Implicit sequential dependency: previous task must be complete
      if (i > 0) {
        const prevTask = this.config.tasks[i - 1]
        const prevState = this.state.tasks.get(prevTask.id)
        if (prevState?.status !== 'complete') continue
      }

      // Explicit dependency
      if (task.depends_on) {
        const depState = this.state.tasks.get(task.depends_on)
        if (depState?.status !== 'complete') continue
      }

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
