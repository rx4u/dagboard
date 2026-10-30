import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgenthubClient } from './api.js';
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
function ok(body) {
    return { ok: true, json: async () => body, text: async () => JSON.stringify(body) };
}
function fail(status) {
    return { ok: false, status, json: async () => ({}), text: async () => '' };
}
describe('AgenthubClient', () => {
    let client;
    beforeEach(() => {
        client = new AgenthubClient('http://localhost:8080', 'test-key');
        mockFetch.mockReset();
    });
    it('listPosts sends correct headers', async () => {
        mockFetch.mockResolvedValueOnce(ok([{ id: '1', agent_id: 'a', content: 'hi', created_at: '2026-01-01T00:00:00Z', channel: 'ch' }]));
        const posts = await client.listPosts('ch', 100);
        expect(posts).toHaveLength(1);
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:8080/api/channels/ch/posts?limit=100', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-key' }) }));
    });
    it('createPost posts to correct endpoint', async () => {
        mockFetch.mockResolvedValueOnce(ok({ id: '2', agent_id: 'conductor', content: 'TASK: t1', created_at: '2026-01-01T00:00:00Z', channel: 'ch' }));
        const post = await client.createPost('ch', 'TASK: t1');
        expect(post.id).toBe('2');
    });
    it('throws on non-ok response', async () => {
        mockFetch.mockResolvedValueOnce(fail(401));
        await expect(client.listPosts('ch', 10)).rejects.toThrow('401');
    });
    it('listPosts defaults limit to 500', async () => {
        mockFetch.mockResolvedValueOnce(ok([]));
        await client.listPosts('ch');
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:8080/api/channels/ch/posts?limit=500', expect.anything());
    });
});
