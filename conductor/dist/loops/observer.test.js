import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObserverLoop } from './observer.js';
const mockApi = { listPosts: vi.fn(), createPost: vi.fn() };
const mockAnthropic = {
    messages: {
        create: vi.fn(),
    },
};
const config = {
    dagboard: { url: '', api_key: '' },
    agents: [{ id: 'agent-alpha', model: 'claude-opus-4' }],
    tasks: [{ id: 'task-1', description: 'Do thing', channel: 'agent-alpha', checkpoint: 'none' }],
    observer: { enabled: true, model: 'claude-haiku-3', interval_minutes: 15, channel: 'conductor-observer' },
    checkpoints: { channel: 'cc', timeout_hours: 8 },
    context: { channel: 'conductor-log' },
    stall: { threshold_minutes: 30 },
};
function makeState() {
    return {
        tasks: new Map([['task-1', { id: 'task-1', status: 'dispatched' }]]),
        pendingCheckpoints: new Set(),
    };
}
describe('ObserverLoop', () => {
    beforeEach(() => {
        mockApi.listPosts.mockReset();
        mockApi.createPost.mockReset();
        mockAnthropic.messages.create.mockReset();
        mockApi.createPost.mockResolvedValue({ id: '1', agent_id: 'conductor', content: '', created_at: '', channel: '' });
    });
    it('posts suggestion when LLM returns non-NOTHING response', async () => {
        mockApi.listPosts.mockResolvedValue([
            { id: '1', agent_id: 'agent-alpha', content: 'Working on task', created_at: '2026-01-01T00:00:00Z', channel: 'agent-alpha' }
        ]);
        mockAnthropic.messages.create.mockResolvedValueOnce({
            content: [{ type: 'text', text: 'Suggest forking a sub-agent for faster results.' }]
        });
        const loop = new ObserverLoop(config, mockApi, mockAnthropic, makeState());
        await loop.tick();
        expect(mockApi.createPost).toHaveBeenCalledWith('conductor-observer', expect.stringContaining('Suggest forking a sub-agent'));
    });
    it('does not post when LLM returns NOTHING', async () => {
        mockApi.listPosts.mockResolvedValue([]);
        mockAnthropic.messages.create.mockResolvedValueOnce({
            content: [{ type: 'text', text: 'NOTHING' }]
        });
        const loop = new ObserverLoop(config, mockApi, mockAnthropic, makeState());
        await loop.tick();
        expect(mockApi.createPost).not.toHaveBeenCalled();
    });
    it('skips when observer is disabled', async () => {
        const disabledConfig = { ...config, observer: { ...config.observer, enabled: false } };
        const loop = new ObserverLoop(disabledConfig, mockApi, mockAnthropic, makeState());
        await loop.tick();
        expect(mockApi.listPosts).not.toHaveBeenCalled();
    });
    it('does not post when LLM returns NOTHING with surrounding whitespace', async () => {
        mockApi.listPosts.mockResolvedValue([]);
        mockAnthropic.messages.create.mockResolvedValueOnce({
            content: [{ type: 'text', text: '  NOTHING  ' }]
        });
        const loop = new ObserverLoop(config, mockApi, mockAnthropic, makeState());
        await loop.tick();
        expect(mockApi.createPost).not.toHaveBeenCalled();
    });
    it('post has correct OBSERVER [HH:MM]: prefix format', async () => {
        mockApi.listPosts.mockResolvedValue([]);
        mockAnthropic.messages.create.mockResolvedValueOnce({
            content: [{ type: 'text', text: 'A suggestion.' }]
        });
        const loop = new ObserverLoop(config, mockApi, mockAnthropic, makeState());
        await loop.tick();
        expect(mockApi.createPost).toHaveBeenCalledWith('conductor-observer', expect.stringMatching(/^OBSERVER \[\d{2}:\d{2}\]:/));
    });
});
