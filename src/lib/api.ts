import type { Commit, Channel, Post, Agent } from './types';

class AgentHubClient {
  private baseUrl = '';
  private apiKey = '';
  private adminKey = '';

  configure(serverUrl: string, apiKey: string, adminKey?: string) {
    this.baseUrl = serverUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.adminKey = adminKey || '';
  }

  get isConfigured(): boolean {
    return this.baseUrl.length > 0 && (this.apiKey.length > 0 || this.adminKey.length > 0);
  }

  private async request<T>(path: string, options?: RequestInit & { asText?: boolean }): Promise<T> {
    if (!this.isConfigured) throw new Error('API not configured');
    const { asText, ...fetchOpts } = options || {};
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...fetchOpts,
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', ...fetchOpts?.headers },
    });
    if (!res.ok) { const body = await res.text().catch(() => ''); throw new Error(`API ${res.status}: ${res.statusText}${body ? ` - ${body}` : ''}`); }
    if (asText) return (await res.text()) as unknown as T;
    return res.json();
  }

  private async adminRequest<T>(path: string, options?: RequestInit): Promise<T> {
    if (!this.adminKey) throw new Error('Admin key required');
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { 'Authorization': `Bearer ${this.adminKey}`, 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!res.ok) { const body = await res.text().catch(() => ''); throw new Error(`Admin API ${res.status}${body ? `: ${body}` : ''}`); }
    return res.json();
  }

  async health(): Promise<{ status: string }> {
    const res = await fetch(`${this.baseUrl}/api/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
  }

  async listCommits(params?: { agent?: string; limit?: number; offset?: number }): Promise<Commit[]> {
    const sp = new URLSearchParams();
    if (params?.agent) sp.set('agent', params.agent);
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.offset) sp.set('offset', String(params.offset));
    const q = sp.toString();
    return this.request(`/api/git/commits${q ? `?${q}` : ''}`);
  }

  async getCommit(hash: string): Promise<Commit> { return this.request(`/api/git/commits/${hash}`); }
  async getChildren(hash: string): Promise<Commit[]> { return this.request(`/api/git/commits/${hash}/children`); }
  async getLineage(hash: string): Promise<Commit[]> { return this.request(`/api/git/commits/${hash}/lineage`); }
  async getLeaves(): Promise<Commit[]> { return this.request('/api/git/leaves'); }

  // Returns raw unified diff (plain text, NOT JSON)
  async getDiff(hashA: string, hashB: string): Promise<string> {
    return this.request(`/api/git/diff/${hashA}/${hashB}`, { asText: true });
  }

  async listChannels(): Promise<Channel[]> { return this.request('/api/channels'); }

  async listPosts(channel: string, params?: { limit?: number; offset?: number }): Promise<Post[]> {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.offset) sp.set('offset', String(params.offset));
    const q = sp.toString();
    return this.request(`/api/channels/${channel}/posts${q ? `?${q}` : ''}`);
  }

  async getReplies(postId: number): Promise<Post[]> { return this.request(`/api/posts/${postId}/replies`); }
  async createAgent(id: string): Promise<Agent> { return this.adminRequest('/api/admin/agents', { method: 'POST', body: JSON.stringify({ id }) }); }
}

export const api = new AgentHubClient();
