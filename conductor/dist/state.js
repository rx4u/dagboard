const STATUS_PRIORITY = {
    pending: 0,
    checkpoint_waiting: 1,
    dispatched: 2,
    complete: 3,
    rejected: 3,
};
function higherPriority(a, b) {
    return STATUS_PRIORITY[a] >= STATUS_PRIORITY[b] ? a : b;
}
export function buildStateFromHistory(tasks, posts) {
    const state = {
        tasks: new Map(tasks.map(t => [t.id, { id: t.id, status: 'pending' }])),
        pendingCheckpoints: new Set(),
    };
    for (const post of posts) {
        const content = post.content.trim();
        const taskMatch = content.match(/^TASK:\s+(\S+)/);
        if (taskMatch) {
            const id = taskMatch[1];
            const current = state.tasks.get(id);
            if (current)
                current.status = higherPriority(current.status, 'dispatched');
        }
        const completeMatch = content.match(/^COMPLETE:\s+(\S+)/);
        if (completeMatch) {
            const id = completeMatch[1];
            const current = state.tasks.get(id);
            if (current) {
                current.status = 'complete';
                current.completed_at = post.created_at;
            }
        }
        const rejectMatch = content.match(/^REJECT:\s+(\S+)/);
        if (rejectMatch) {
            const id = rejectMatch[1];
            const current = state.tasks.get(id);
            if (current)
                current.status = 'rejected';
        }
        const checkpointMatch = content.match(/^CHECKPOINT:\s+(\S+)/);
        if (checkpointMatch) {
            state.pendingCheckpoints.add(checkpointMatch[1]);
        }
        const approveMatch = content.match(/^APPROVE:\s+(\S+)/);
        if (approveMatch)
            state.pendingCheckpoints.delete(approveMatch[1]);
        const deferMatch = content.match(/^DEFER:\s+(\S+)/);
        if (deferMatch)
            state.pendingCheckpoints.delete(deferMatch[1]);
    }
    return state;
}
