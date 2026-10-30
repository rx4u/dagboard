import yaml from 'js-yaml';
import { z } from 'zod';
export class ConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConfigError';
    }
}
const CheckpointSchema = z.enum(['none', 'before_start', 'after_complete']);
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
});
function detectCircular(tasks) {
    const ids = new Set(tasks.map(t => t.id));
    for (const t of tasks) {
        if (t.depends_on && !ids.has(t.depends_on)) {
            throw new ConfigError(`Unknown depends_on: "${t.depends_on}" in task "${t.id}"`);
        }
    }
    const visited = new Set();
    const inStack = new Set();
    const depMap = new Map(tasks.map(t => [t.id, t.depends_on]));
    function dfs(id) {
        if (inStack.has(id))
            throw new ConfigError(`Circular depends_on detected involving "${id}"`);
        if (visited.has(id))
            return;
        visited.add(id);
        inStack.add(id);
        const dep = depMap.get(id);
        if (dep)
            dfs(dep);
        inStack.delete(id);
    }
    for (const t of tasks)
        dfs(t.id);
}
export function parseConfig(raw) {
    let parsed;
    try {
        parsed = yaml.load(raw);
    }
    catch (e) {
        throw new ConfigError(`YAML parse error: ${e.message}`);
    }
    const result = Schema.safeParse(parsed);
    if (!result.success) {
        const msg = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new ConfigError(`Invalid config: ${msg}`);
    }
    const cfg = result.data;
    detectCircular(cfg.tasks);
    return cfg;
}
