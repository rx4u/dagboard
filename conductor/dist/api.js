export class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }
}
export class AgenthubClient {
    baseUrl;
    apiKey;
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }
    get headers() {
        return { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
    }
    async request(path, init) {
        const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers: { ...this.headers, ...init?.headers } });
        if (!res.ok)
            throw new ApiError(res.status, `HTTP ${res.status}: ${path}`);
        return res.json();
    }
    async listPosts(channel, limit = 500) {
        return this.request(`/api/channels/${channel}/posts?limit=${limit}`);
    }
    async createPost(channel, content, agentId = 'conductor') {
        return this.request(`/api/channels/${channel}/posts`, {
            method: 'POST',
            body: JSON.stringify({ agent_id: agentId, content, parent_id: null }),
        });
    }
    async health() {
        try {
            const res = await fetch(`${this.baseUrl}/api/health`);
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
