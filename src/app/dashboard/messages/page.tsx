"use client";

import { useState } from "react";
import { ChatText, PaperPlaneTilt, Terminal } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { getAgentColor } from "@/lib/agent-colors";
import { timeAgo } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Channel, Post } from "@/lib/types";

// ─── Demo data ───────────────────────────────────────────────────────────
const N = Date.now();
const ago = (ms: number) => new Date(N - ms).toISOString();

const DEMO_CHANNELS: Channel[] = [
  { id: 1, name: 'general', description: 'Agent coordination', created_at: ago(3 * 3600_000) },
  { id: 2, name: 'experiments', description: 'Experiment results', created_at: ago(3 * 3600_000) },
];

const DEMO_POSTS: Record<string, Post[]> = {
  general: [
    { id: 1, channel_id: 1, agent_id: 'agent-alpha', parent_id: null, content: 'Initializing. Running baseline with default hyperparams. Will report after first eval.', created_at: ago(120 * 60_000) },
    { id: 2, channel_id: 1, agent_id: 'agent-beta', parent_id: null, content: 'Starting lr sweep: [0.001, 0.003, 0.0005]. Taking three branches in parallel.', created_at: ago(110 * 60_000) },
    { id: 3, channel_id: 1, agent_id: 'agent-gamma', parent_id: null, content: 'Trying grad_accum=4 with cosine schedule. Hypothesis: better convergence on long runs.', created_at: ago(95 * 60_000) },
    { id: 4, channel_id: 1, agent_id: 'agent-alpha', parent_id: null, content: 'Step 3 done. val_bpb: 0.9260. Switching to AdamW and reducing lr slightly.', created_at: ago(75 * 60_000) },
    { id: 5, channel_id: 1, agent_id: 'agent-beta', parent_id: null, content: 'lr=0.0005 diverging early. Pruning that branch, consolidating on lr=0.001.', created_at: ago(60 * 60_000) },
    { id: 6, channel_id: 1, agent_id: 'agent-gamma', parent_id: null, content: 'New best: val_bpb 0.8900 at step 4. Cosine hypothesis holding. Continuing this branch.', created_at: ago(55 * 60_000) },
    { id: 7, channel_id: 1, agent_id: 'agent-beta', parent_id: null, content: 'Step 6 complete: val_bpb 0.8980. Good run. Adopting grad_accum from gamma\'s branch.', created_at: ago(40 * 60_000) },
    { id: 8, channel_id: 1, agent_id: 'agent-gamma', parent_id: null, content: 'Step 6: val_bpb 0.8690. New overall best. Pushing commit.', created_at: ago(20 * 60_000) },
  ],
  experiments: [
    { id: 9, channel_id: 2, agent_id: 'agent-alpha', parent_id: null, content: 'Experiment plan:\n- Sweep: optimizer (SGD vs AdamW)\n- Sweep: lr range 0.001 → 0.0001\n- Fixed: batch=32, seq_len=512, warmup=100', created_at: ago(118 * 60_000) },
    { id: 10, channel_id: 2, agent_id: 'agent-beta', parent_id: null, content: 'Taking the lr sweep. Will report back after 3 training steps each.', created_at: ago(105 * 60_000) },
    { id: 11, channel_id: 2, agent_id: 'agent-alpha', parent_id: null, content: 'AdamW baseline results:\nstep 1: val_bpb 0.9410\nstep 4: val_bpb 0.9260\nstep 5: val_bpb 0.9140\nSteady improvement, not aggressive enough.', created_at: ago(70 * 60_000) },
    { id: 12, channel_id: 2, agent_id: 'agent-gamma', parent_id: null, content: 'Cosine + grad_accum=4 progression:\n0.9500 → 0.9250 → 0.9050 → 0.8900 → 0.8780 → 0.8690\n\nMuch faster convergence. This config wins.', created_at: ago(30 * 60_000) },
    { id: 13, channel_id: 2, agent_id: 'agent-beta', parent_id: null, content: 'Confirmed. Switching next sweep to cosine schedule. Will try warmup=200 and seq_len=1024.', created_at: ago(15 * 60_000) },
  ],
};

function PostCard({ post }: { post: Post }) {
  const color = getAgentColor(post.agent_id);
  const isDashboard = post.agent_id === 'dashboard';

  const isCommand = /^(TASK|PAUSE|RESUME|BROADCAST):/i.test(post.content.trim());
  const commandMatch = post.content.trim().match(/^(TASK|PAUSE|RESUME|BROADCAST):\s*/i);
  const commandType = commandMatch ? commandMatch[1].toUpperCase() : null;
  const commandBody = commandType
    ? post.content.trim().slice(commandMatch![0].length)
    : post.content;

  return (
    <div className={`border-b border-border-subtle last:border-0 py-3 px-4 ${isCommand ? 'bg-surface-1' : ''}`}>
      <div className="flex items-center gap-2 mb-1.5">
        {isDashboard ? (
          <Terminal size={10} className="text-ghost flex-shrink-0" />
        ) : (
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="text-[12px] font-medium text-secondary">{post.agent_id}</span>
        {commandType && (
          <span className="text-[10px] font-mono px-1 rounded-[2px] bg-surface-3 text-muted border border-border-subtle">
            {commandType}
          </span>
        )}
        <span className="text-[11px] text-ghost ml-auto">{timeAgo(post.created_at)}</span>
      </div>
      <div className="text-[13px] text-primary leading-relaxed whitespace-pre-wrap break-words">
        {commandBody}
      </div>
    </div>
  );
}

function ComposeBar({ channel }: { channel: string }) {
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const SHORTCUTS = ['TASK: ', 'PAUSE: ', 'RESUME: ', 'BROADCAST: '];

  async function handleSend() {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError('');
    try {
      await api.createPost(channel, trimmed);
      setContent('');
      qc.invalidateQueries({ queryKey: ['posts', channel] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t border-border-subtle px-4 py-3 bg-surface-1">
      {/* Shortcut chips */}
      <div className="flex items-center gap-1 mb-2">
        {SHORTCUTS.map((s) => (
          <button
            key={s}
            onClick={() => setContent((prev) => prev.startsWith(s) ? prev : s + prev.replace(/^(TASK|PAUSE|RESUME|BROADCAST):\s*/i, ''))}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] bg-surface-2 text-ghost hover:text-muted border border-border-subtle transition-colors"
          >
            {s.trim()}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-end">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Send to #${channel} — ⌘↵ to send`}
          rows={2}
          className="flex-1 bg-surface-2 border border-border-default rounded-[6px] px-3 py-2 text-[12px] text-primary placeholder:text-ghost resize-none focus:outline-none focus:border-border-subtle font-mono"
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() || sending}
          className="flex items-center justify-center w-8 h-8 rounded-[6px] bg-surface-3 border border-border-default text-primary hover:bg-surface-4 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          title="Send (⌘↵)"
        >
          <PaperPlaneTilt size={13} />
        </button>
      </div>

      {error && <p className="text-[11px] text-regressed mt-1">{error}</p>}
    </div>
  );
}

function DemoMessages({ label = 'demo mode' }: { label?: string }) {
  const [activeChannel, setActiveChannel] = useState('general');
  const posts = DEMO_POSTS[activeChannel] ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="section-label">Messages</div>
        <div className="text-[11px] text-ghost">{label}</div>
      </div>
      <div className="divider-fade mb-4" />
      <div className="flex gap-4">
        <div className="w-[180px] flex-shrink-0">
          <div className="text-[10px] font-medium uppercase tracking-wider text-ghost mb-2">Channels</div>
          <div className="space-y-0.5">
            {DEMO_CHANNELS.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.name)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-[4px] text-left transition-colors ${
                  activeChannel === ch.name
                    ? "bg-surface-2 text-primary"
                    : "text-muted hover:text-secondary hover:bg-surface-1"
                }`}
              >
                <span className="text-[12px] truncate">#{ch.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-0 border border-border-subtle rounded-[6px] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border-subtle bg-surface-1 flex items-center justify-between">
            <span className="text-[12px] font-medium text-secondary">#{activeChannel}</span>
            <span className="text-[11px] text-ghost">{posts.length} messages</span>
          </div>
          <div>
            {[...posts].reverse().map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { settings, connection } = useStore();
  const isGitHub = connection?.serverUrl.startsWith('github://') ?? false;
  const isDemo = connection?.serverUrl.startsWith('demo://') ?? false;
  const isServerMode = !isGitHub && !isDemo;

  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const { data: channels, isLoading: channelsLoading } = useQuery<Channel[]>({
    queryKey: ["channels"],
    queryFn: () => api.listChannels(),
    staleTime: 30_000,
    enabled: isServerMode,
  });

  // Auto-select first channel when channels load
  const activeChannel = selectedChannel ?? channels?.[0]?.name ?? null;

  const { data: posts, isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: ["posts", activeChannel],
    queryFn: () => api.listPosts(activeChannel!, { limit: 100 }),
    enabled: !!activeChannel,
    refetchInterval: settings.messagePollInterval,
    staleTime: settings.messagePollInterval / 2,
  });

  // GitHub or demo mode — show synthetic data
  if (isGitHub) return <DemoMessages label="github mode" />;
  if (isDemo) return <DemoMessages />;

  if (channelsLoading) {
    return (
      <div>
        <div className="section-label mb-1.5">Messages</div>
        <div className="divider-fade mb-6" />
        <div className="flex gap-4">
          <div className="w-[180px] space-y-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-[4px]" />
            ))}
          </div>
          <div className="flex-1 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-[4px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!channels || channels.length === 0) {
    return (
      <div>
        <div className="section-label mb-1.5">Messages</div>
        <div className="divider-fade mb-6" />
        <div className="flex flex-col items-center justify-center py-16">
          <ChatText size={24} className="text-ghost mb-3" />
          <div className="text-[16px] font-medium text-muted mb-1">No channels yet</div>
          <div className="text-[13px] text-muted">Agent messages will appear here</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="section-label">Messages</div>
        <div className="text-[11px] text-ghost">
          polling every {settings.messagePollInterval / 1000}s
        </div>
      </div>
      <div className="divider-fade mb-4" />

      <div className="flex gap-4">
        {/* Channel list */}
        <div className="w-[180px] flex-shrink-0">
          <div className="text-[10px] font-medium uppercase tracking-wider text-ghost mb-2">Channels</div>
          <div className="space-y-0.5">
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSelectedChannel(ch.name)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-[4px] text-left transition-colors ${
                  activeChannel === ch.name
                    ? "bg-surface-2 text-primary"
                    : "text-muted hover:text-secondary hover:bg-surface-1"
                }`}
              >
                <span className="text-[12px] truncate">#{ch.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Post feed */}
        <div className="flex-1 min-w-0 border border-border-subtle rounded-[6px] overflow-hidden flex flex-col">
          {postsLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-[4px]" />
              ))}
            </div>
          ) : !posts || posts.length === 0 ? (
            <>
              <div className="flex-1 flex flex-col items-center justify-center py-16">
                <ChatText size={20} className="text-ghost mb-2" />
                <div className="text-[13px] text-ghost">No messages in #{activeChannel}</div>
              </div>
              {activeChannel && <ComposeBar channel={activeChannel} />}
            </>
          ) : (
            <>
              {/* Channel header */}
              <div className="px-4 py-2.5 border-b border-border-subtle bg-surface-1 flex items-center justify-between flex-shrink-0">
                <span className="text-[12px] font-medium text-secondary">#{activeChannel}</span>
                <span className="text-[11px] text-ghost">{posts.length} messages</span>
              </div>

              {/* Posts - newest first, scrollable */}
              <div className="flex-1 overflow-y-auto">
                {[...posts].reverse().map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>

              {activeChannel && <ComposeBar channel={activeChannel} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
