import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { AgenthubClient } from './api.js';
import { parseConfig } from './config.js';
import { buildStateFromHistory } from './state.js';
import { DispatchLoop } from './loops/dispatch.js';
import { CheckpointLoop } from './loops/checkpoint.js';
import { ObserverLoop } from './loops/observer.js';
async function reconstructState(config, api) {
    const channels = [
        config.checkpoints.channel,
        config.context.channel,
        config.observer.channel,
        ...config.agents.map(a => a.id),
    ];
    const allPosts = await Promise.all(channels.map(ch => api.listPosts(ch, 500).catch(() => [])));
    return buildStateFromHistory(config.tasks, allPosts.flat().sort((a, b) => a.created_at.localeCompare(b.created_at)));
}
export async function runSidecar(configPath) {
    const raw = readFileSync(configPath, 'utf-8');
    const config = parseConfig(raw);
    const api = new AgenthubClient(config.dagboard.url, config.dagboard.api_key);
    const anthropic = new Anthropic();
    process.stdout.write(`[conductor] Starting — ${config.tasks.length} tasks, ${config.agents.length} agents\n`);
    const state = await reconstructState(config, api);
    process.stdout.write(`[conductor] State reconstructed from history\n`);
    const dispatch = new DispatchLoop(config, api, state);
    const checkpoint = new CheckpointLoop(config, api, state);
    const observer = new ObserverLoop(config, api, anthropic, state);
    // Dispatch + checkpoint: 30s tick
    setInterval(async () => {
        try {
            await checkpoint.tick();
        }
        catch (e) {
            process.stderr.write(`[checkpoint] ${e.message}\n`);
        }
        try {
            await dispatch.tick();
        }
        catch (e) {
            process.stderr.write(`[dispatch] ${e.message}\n`);
        }
    }, 30_000);
    // Observer: configurable interval
    setInterval(async () => {
        try {
            await observer.tick();
        }
        catch (e) {
            process.stderr.write(`[observer] ${e.message}\n`);
        }
    }, config.observer.interval_minutes * 60 * 1000);
    // Run immediately on start
    await checkpoint.tick();
    await dispatch.tick();
    process.stdout.write(`[conductor] Loops running. Ctrl+C to stop.\n`);
}
