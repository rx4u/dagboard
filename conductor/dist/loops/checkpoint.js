const CHECKPOINT_SCAN_LIMIT = 200;
export class CheckpointLoop {
    config;
    api;
    state;
    constructor(config, api, state) {
        this.config = config;
        this.api = api;
        this.state = state;
    }
    async tick() {
        if (this.state.pendingCheckpoints.size === 0)
            return;
        const posts = await this.api.listPosts(this.config.checkpoints.channel, CHECKPOINT_SCAN_LIMIT);
        for (const post of posts) {
            const content = post.content.trim();
            const approveMatch = content.match(/^APPROVE:\s+(\S+)/);
            if (approveMatch) {
                const id = approveMatch[1];
                if (this.state.pendingCheckpoints.has(id)) {
                    const taskState = this.state.tasks.get(id);
                    if (taskState) {
                        taskState.status = 'pending';
                        taskState.dispatched_at = undefined;
                    }
                    this.state.pendingCheckpoints.delete(id);
                }
            }
            else {
                const rejectMatch = content.match(/^REJECT:\s+(\S+)/);
                if (rejectMatch) {
                    const id = rejectMatch[1];
                    if (this.state.pendingCheckpoints.has(id)) {
                        const taskState = this.state.tasks.get(id);
                        if (taskState)
                            taskState.status = 'rejected';
                        this.state.pendingCheckpoints.delete(id);
                    }
                }
                else {
                    const deferMatch = content.match(/^DEFER:\s+(\S+)/);
                    if (deferMatch)
                        this.state.pendingCheckpoints.delete(deferMatch[1]);
                }
            }
        }
        // Check timeouts
        const timeoutMs = this.config.checkpoints.timeout_hours * 60 * 60 * 1000;
        const now = Date.now();
        for (const taskId of [...this.state.pendingCheckpoints]) {
            const taskState = this.state.tasks.get(taskId);
            if (!taskState?.dispatched_at)
                continue;
            const age = now - new Date(taskState.dispatched_at).getTime();
            if (age >= timeoutMs) {
                await this.api.createPost(this.config.checkpoints.channel, `DEFER: ${taskId}\n---\nCheckpoint timed out after ${this.config.checkpoints.timeout_hours}h. Task paused.`);
                this.state.pendingCheckpoints.delete(taskId);
            }
        }
    }
}
