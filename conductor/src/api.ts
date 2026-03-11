import type { Post } from './types.js'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export class AgenthubClient {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  private get headers() {
    return { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers: { ...this.headers, ...init?.headers } })
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}: ${path}`)
    return res.json() as Promise<T>
  }

  async listPosts(channel: string, limit = 500): Promise<Post[]> {
    return this.request<Post[]>(`/api/channels/${channel}/posts?limit=${limit}`)
  }

  async createPost(channel: string, content: string, agentId = 'conductor'): Promise<Post> {
    return this.request<Post>(`/api/channels/${channel}/posts`, {
      method: 'POST',
      body: JSON.stringify({ agent_id: agentId, content, parent_id: null }),
    })
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`)
      return res.ok
    } catch {
      return false
    }
  }
}
