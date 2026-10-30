import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPageSummary } from './page.js';
const mockApi = { listPosts: vi.fn(), createPost: vi.fn() };
const mockAnthropic = { messages: { create: vi.fn() } };
const config = {
    dagboard: { url: '', api_key: '' },
    agents: [{ id: 'agent-alpha', model: 'claude-opus-4' }],
    tasks: [
        { id: 'task-1', description: 'Implement auth', channel: 'agent-alpha', checkpoint: 'none' },
        { id: 'task-2', description: 'Write tests', channel: 'agent-alpha', checkpoint: 'none', depends_on: 'task-1' },
    ],
    observer: { enabled: false, model: '', interval_minutes: 15, channel: 'co' },
    checkpoints: { channel: 'cc', timeout_hours: 8 },
    context: { channel: 'conductor-log' },
    stall: { threshold_minutes: 30 },
};
function makeState() {
    return {
        tasks: new Map([
            ['task-1', { id: 'task-1', status: 'complete', completed_at: '2026-03-12T03:22:00Z' }],
            ['task-2', { id: 'task-2', status: 'checkpoint_waiting', dispatched_at: '2026-03-12T05:01:00Z' }],
        ]),
        pendingCheckpoints: new Set(['task-2']),
    };
}
describe('buildPageSummary', () => {
    beforeEach(() => {
        mockApi.listPosts.mockReset();
        mockAnthropic.messages.create.mockReset();
        mockApi.listPosts.mockResolvedValue([]);
        mockAnthropic.messages.create.mockResolvedValueOnce({
            content: [{ type: 'text', text: 'agent-alpha completed auth at 03:22. Tests ready.' }]
        });
    });
    it('returns a string containing task states', async () => {
        const summary = await buildPageSummary(config, mockApi, mockAnthropic, makeState());
        expect(summary).toContain('task-1');
        expect(summary).toContain('complete');
        expect(summary).toContain('task-2');
        expect(summary).toContain('checkpoint');
    });
    it('includes LLM narrative', async () => {
        const summary = await buildPageSummary(config, mockApi, mockAnthropic, makeState());
        expect(summary).toContain('completed auth');
    });
    it('includes OPEN QUESTIONS when pendingCheckpoints is non-empty', async () => {
        const summary = await buildPageSummary(config, mockApi, mockAnthropic, makeState());
        expect(summary).toContain('OPEN QUESTIONS');
        expect(summary).toContain('task-2');
    });
    it('suggests approve command when checkpoint is pending', async () => {
        const summary = await buildPageSummary(config, mockApi, mockAnthropic, makeState());
        expect(summary).toContain('conductor approve task-2');
    });
    it('shows no pending actions when no checkpoints', async () => {
        mockAnthropic.messages.create.mockResolvedValueOnce({
            content: [{ type: 'text', text: 'All done.' }]
        });
        const emptyState = {
            tasks: new Map([
                ['task-1', { id: 'task-1', status: 'complete' }],
                ['task-2', { id: 'task-2', status: 'complete' }],
            ]),
            pendingCheckpoints: new Set(),
        };
        const summary = await buildPageSummary(config, mockApi, mockAnthropic, emptyState);
        expect(summary).toContain('No pending actions');
        expect(summary).not.toContain('OPEN QUESTIONS');
    });
});
