import type { Commit } from './types';

interface GhCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  parents: { sha: string }[];
  author: { login: string } | null;
}

export function parseGitHubRepo(input: string): { owner: string; repo: string } | null {
  const urlMatch = input.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, '') };
  const shortMatch = input.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2] };
  return null;
}

export async function fetchGitHubCommits(owner: string, repo: string): Promise<Commit[]> {
  const all: Commit[] = [];
  let page = 1;

  while (page <= 5) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100&page=${page}`,
      { headers: { Accept: 'application/vnd.github.v3+json' } },
    );
    if (!res.ok) {
      const msg = res.status === 404
        ? `Repo not found: ${owner}/${repo}`
        : res.status === 403
          ? 'GitHub rate limit exceeded. Try again in a minute.'
          : `GitHub API error: ${res.status}`;
      throw new Error(msg);
    }

    const items: GhCommit[] = await res.json();
    if (items.length === 0) break;

    for (const item of items) {
      all.push({
        hash: item.sha,
        parent_hash: item.parents[0]?.sha ?? '',
        agent_id: item.author?.login ?? item.commit.author.name,
        message: item.commit.message,
        created_at: item.commit.author.date,
      });
    }

    if (items.length < 100) break;
    page++;
  }

  return all;
}
