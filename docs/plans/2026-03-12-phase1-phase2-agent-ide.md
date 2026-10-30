# Phase 1 + 2: Agent IDE — Legibility & Bidirectional Control

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evolve dagboard from a passive experiment tracker into a legible, steerable agent command center — without any backend changes.

**Architecture:** Phase 1 adds agent health computation (pure client-side, derived from graph timestamps), per-agent visibility toggles (persisted in settings), and a wired-up DAG filter. Phase 2 adds a `createPost` API call and a compose bar in the messages page, establishing the bidirectional control convention.

**Tech Stack:** Next.js 15, Zustand v5, TanStack Query v5, @xyflow/react, Phosphor icons (no new deps)

---

## Context (read before starting)

- Project root: `src/` inside `/Users/Rajaraman.A/Claude Code/agenthub-dashboard/agenthub-dashboard/`
- Design: dark-only, monochrome, Phosphor icons (NOT Lucide), no colored buttons, no box shadows
- Agent colors: 6px dots only — `getAgentColor(agentId)` from `src/lib/agent-colors.ts`
- Status colors (from globals.css): `text-improved` = green, `text-regressed` = red, `text-ghost` = grey
- `AppSettings` lives in `src/lib/types.ts` and is persisted in Zustand store
- `DagViewState` also in `types.ts` — `filterByAgent` field already exists but is NOT wired in the DAG canvas
- No tests exist in this project — skip test steps, just build and verify in browser
- Run dev server: `cd` into project root, `npm run dev`

---

## Task 1: Agent health utility

**Files:**
- Create: `src/lib/agent-health.ts`
- Modify: `src/lib/types.ts` (add `AgentHealth` type)

### Step 1: Add `AgentHealth` type to `src/lib/types.ts`

Open `src/lib/types.ts`. After the `ExtractedMetric` interface (line 39), add:

```ts
export type AgentHealthStatus = 'active' | 'idle' | 'stalled' | 'offline';

export interface AgentHealth {
  status: AgentHealthStatus;
  lastCommitAt: string | null;
  minutesSince: number | null;
  commitCount: number;
  bestMetricValue: number | null;
}
```

### Step 2: Create `src/lib/agent-health.ts`

```ts
import type { DagGraph, AgentHealth, AgentHealthStatus } from './types';

export function computeAgentHealth(
  graph: DagGraph,
  idleThresholdMinutes = 15,
  activeThresholdMinutes = 5,
): Map<string, AgentHealth> {
  const now = Date.now();
  const result = new Map<string, AgentHealth>();

  for (const agentId of graph.agents) {
    const agentNodes = Array.from(graph.nodes.values()).filter(
      (n) => n.agentId === agentId
    );

    if (agentNodes.length === 0) {
      result.set(agentId, { status: 'offline', lastCommitAt: null, minutesSince: null, commitCount: 0, bestMetricValue: null });
      continue;
    }

    const sorted = agentNodes.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latest = sorted[0];
    const minutesSince = (now - new Date(latest.createdAt).getTime()) / 60_000;

    let status: AgentHealthStatus;
    if (minutesSince < activeThresholdMinutes) {
      status = 'active';
    } else if (minutesSince < idleThresholdMinutes) {
      status = 'idle';
    } else {
      status = 'stalled';
    }

    const metricNodes = agentNodes.filter((n) => n.metric !== undefined);
    const bestMetricValue = metricNodes.length > 0
      ? metricNodes.reduce((best, n) => {
          const v = n.metric!.value;
          return best === null ? v : v < best ? v : best;
        }, null as number | null)
      : null;

    result.set(agentId, {
      status,
      lastCommitAt: latest.createdAt,
      minutesSince,
      commitCount: agentNodes.length,
      bestMetricValue,
    });
  }

  return result;
}

export function healthStatusColor(status: AgentHealthStatus): string {
  switch (status) {
    case 'active': return 'var(--color-improved)';
    case 'idle': return 'var(--color-warning, #f59e0b)';
    case 'stalled': return 'var(--color-regressed)';
    case 'offline': return 'var(--text-ghost)';
  }
}

export function healthStatusLabel(status: AgentHealthStatus): string {
  switch (status) {
    case 'active': return 'active';
    case 'idle': return 'idle';
    case 'stalled': return 'stalled';
    case 'offline': return 'offline';
  }
}
```

### Step 3: Verify it compiles

```bash
cd "/Users/Rajaraman.A/Claude Code/agenthub-dashboard/agenthub-dashboard"
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `agent-health.ts`

### Step 4: Commit

```bash
git add src/lib/agent-health.ts src/lib/types.ts
git commit -m "feat: add agent health utility (status, last commit, best metric)"
```

---

## Task 2: Store — agent visibility + idle threshold

**Files:**
- Modify: `src/lib/types.ts` (extend `AppSettings`)
- Modify: `src/lib/store.ts` (add `hiddenAgents`, `toggleAgentVisibility`, `idleThresholdMinutes`)

### Step 1: Extend `AppSettings` in `src/lib/types.ts`

Find `AppSettings` interface (around line 97). Add two fields:

```ts
export interface AppSettings {
  dagPollInterval: number;
  messagePollInterval: number;
  density: 'dense' | 'comfortable';
  sidebarExpanded: boolean;
  theme: 'dark' | 'light';
  hiddenAgents: string[];        // agent IDs hidden from DAG
  idleThresholdMinutes: number;  // minutes before agent is considered stalled
}
```

### Step 2: Update store defaults in `src/lib/store.ts`

Find the `settings:` object in the store (around line 180). Add defaults:

```ts
settings: {
  dagPollInterval: 5000,
  messagePollInterval: 10000,
  density: 'dense',
  sidebarExpanded: false,
  theme: 'dark',
  hiddenAgents: [],
  idleThresholdMinutes: 15,
},
```

### Step 3: Add `toggleAgentVisibility` action to `AppStore` interface

Find the `AppStore` interface (around line 30). Add after `updateSettings`:

```ts
toggleAgentVisibility: (agentId: string) => void;
```

### Step 4: Implement `toggleAgentVisibility` in store

In the store implementation, after `updateSettings:`:

```ts
toggleAgentVisibility: (agentId) =>
  set((s) => {
    const hidden = s.settings.hiddenAgents;
    const next = hidden.includes(agentId)
      ? hidden.filter((id) => id !== agentId)
      : [...hidden, agentId];
    return { settings: { ...s.settings, hiddenAgents: next } };
  }),
```

### Step 5: Verify

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

### Step 6: Commit

```bash
git add src/lib/types.ts src/lib/store.ts
git commit -m "feat: add agent visibility toggle and idle threshold to store"
```

---

## Task 3: Agents page — health status + visibility toggle

**Files:**
- Modify: `src/app/dashboard/agents/page.tsx`

This replaces the simple agent list with a richer table showing health status, last active time, commit count, best metric, and a hide/show toggle.

### Step 1: Replace `src/app/dashboard/agents/page.tsx` content

The new file keeps all existing create-agent functionality and adds the health + visibility column:

```tsx
"use client";

import { useState } from "react";
import { Robot, Plus, Copy, Check, Eye, EyeSlash, Warning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { getAgentColor } from "@/lib/agent-colors";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { computeAgentHealth, healthStatusColor, healthStatusLabel } from "@/lib/agent-health";

export default function AgentsPage() {
  const { connection, graph, settings, toggleAgentVisibility } = useStore();
  const hasAdminKey = !!connection?.adminKey;
  const isGitHub = connection?.serverUrl.startsWith('github://') ?? false;

  const agents = graph?.agents ?? [];
  const health = graph ? computeAgentHealth(graph, settings.idleThresholdMinutes) : new Map();
  const stalledCount = Array.from(health.values()).filter((h) => h.status === 'stalled').length;

  const [showCreate, setShowCreate] = useState(false);
  const [newAgentId, setNewAgentId] = useState("");
  const [createdKey, setCreatedKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function handleCreate() {
    if (!newAgentId.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const agent = await api.createAgent(newAgentId.trim());
      setCreatedKey(agent.api_key ?? "");
      setNewAgentId("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="section-label">Agents</div>
          {stalledCount > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-regressed">
              <Warning size={12} />
              <span>{stalledCount} stalled</span>
            </div>
          )}
        </div>
        {hasAdminKey && (
          <Button
            onClick={() => { setShowCreate(true); setCreatedKey(""); setCreateError(""); }}
            className="bg-surface-3 border border-border-default text-primary hover:bg-surface-4 rounded-[4px] h-7 px-2 text-[11px] font-medium gap-1"
          >
            <Plus size={14} />
            Create Agent
          </Button>
        )}
      </div>
      <div className="divider-fade mb-6" />

      {/* Create agent form */}
      {showCreate && hasAdminKey && (
        <div className="border border-border-default rounded-[6px] p-4 mb-6 max-w-[400px]">
          <div className="section-label mb-3">Create Agent</div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-wider text-muted">
                Agent ID
              </Label>
              <Input
                value={newAgentId}
                onChange={(e) => setNewAgentId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="bg-surface-1 border-border-default text-primary placeholder:text-ghost rounded-[6px] h-9 text-[13px]"
                placeholder="agent-4"
                disabled={creating}
              />
            </div>

            {createdKey && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium uppercase tracking-wider text-muted">
                  API Key
                  <span className="text-ghost ml-1 normal-case tracking-normal">(copy now — shown once)</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={createdKey}
                    className="bg-surface-1 border-border-default text-primary rounded-[6px] h-9 text-[11px] flex-1 font-mono"
                  />
                  <Button
                    onClick={handleCopy}
                    className="bg-surface-3 border border-border-default text-primary hover:bg-surface-4 rounded-[4px] h-9 w-9 p-0"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </Button>
                </div>
                <p className="text-[11px] text-ghost">
                  Agent created. Run <span className="font-mono bg-surface-2 px-1 rounded-[2px]">ah join --key &lt;api_key&gt;</span> to connect.
                </p>
              </div>
            )}

            {createError && (
              <p className="text-[11px] text-regressed">{createError}</p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={!newAgentId.trim() || creating}
                className="bg-surface-3 border border-border-default text-primary hover:bg-surface-4 rounded-[6px] h-8 px-3 text-[12px] font-medium"
              >
                {creating ? "Creating..." : "Create"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setShowCreate(false); setCreatedKey(""); setNewAgentId(""); setCreateError(""); }}
                className="text-muted hover:text-secondary hover:bg-surface-2 rounded-[6px] h-8 px-3 text-[12px]"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {!hasAdminKey && !isGitHub && (
        <p className="text-[11px] text-muted mb-6">
          Admin key required to create agents. Reconnect with an admin key via Settings.
        </p>
      )}

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Robot size={24} className="text-ghost mb-3" />
          <div className="text-[16px] font-medium text-muted mb-1">No agents detected</div>
          <div className="text-[13px] text-muted">
            {isGitHub ? "No contributors found in this repository" : "Agents appear here once commits are pushed to the server"}
          </div>
        </div>
      ) : (
        <div className="border border-border-subtle rounded-[6px] overflow-hidden max-w-[640px]">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px_80px_32px] gap-0 px-4 py-2 border-b border-border-subtle bg-surface-1">
            <div className="text-[10px] font-medium uppercase tracking-wider text-ghost">Agent</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-ghost text-right">Status</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-ghost text-right">Commits</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-ghost text-right">Last active</div>
            <div />
          </div>

          {/* Rows */}
          {agents.map((agentId) => {
            const color = getAgentColor(agentId);
            const h = health.get(agentId);
            const isHidden = settings.hiddenAgents.includes(agentId);

            return (
              <div
                key={agentId}
                className={`grid grid-cols-[1fr_80px_80px_80px_32px] gap-0 px-4 py-3 border-b border-border-subtle last:border-0 transition-opacity ${isHidden ? 'opacity-40' : ''}`}
              >
                {/* Agent name */}
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[13px] text-secondary">{agentId}</span>
                </div>

                {/* Status */}
                <div className="flex items-center justify-end">
                  {h ? (
                    <div className="flex items-center gap-1">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: healthStatusColor(h.status) }}
                      />
                      <span className="text-[11px] text-ghost">{healthStatusLabel(h.status)}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-ghost">—</span>
                  )}
                </div>

                {/* Commit count */}
                <div className="flex items-center justify-end">
                  <span className="text-[12px] text-ghost font-mono">{h?.commitCount ?? 0}</span>
                </div>

                {/* Last active */}
                <div className="flex items-center justify-end">
                  <span className="text-[11px] text-ghost">
                    {h?.lastCommitAt ? timeAgo(h.lastCommitAt) : '—'}
                  </span>
                </div>

                {/* Visibility toggle */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => toggleAgentVisibility(agentId)}
                    className="p-1 rounded-[2px] text-ghost hover:text-muted hover:bg-surface-2 transition-colors"
                    title={isHidden ? 'Show in DAG' : 'Hide from DAG'}
                  >
                    {isHidden ? <EyeSlash size={12} /> : <Eye size={12} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

### Step 2: Verify

```bash
npx tsc --noEmit 2>&1 | head -30
```

Check that `Eye`, `EyeSlash`, `Warning` exist in Phosphor:

```bash
node -e "const p = require('@phosphor-icons/react'); console.log(!!p.Eye, !!p.EyeSlash, !!p.Warning)"
```

Expected: `true true true`

### Step 3: Commit

```bash
git add src/app/dashboard/agents/page.tsx
git commit -m "feat: agents page — health status, last active, visibility toggle"
```

---

## Task 4: DAG — filter hidden agents + wire filterByAgent zoom

**Files:**
- Modify: `src/components/dag/dag-canvas.tsx`

Two changes:
1. Filter nodes/edges for `hiddenAgents` before rendering
2. When `dag.filterByAgent` is set, call `fitView` scoped to that agent's nodes

### Step 1: Update `DagCanvas` to filter hidden agents

In `dag-canvas.tsx`, change the `useStore` destructure on line 41:

```ts
const { graph, dag, selectNode, setCompareNode, hoverNode, settings } = useStore();
```

Then update the "Rebuild layout" `useEffect` (line 52) to filter hidden nodes/edges before setting state:

```ts
useEffect(() => {
  if (!graph || graph.nodes.size === 0) return;
  const { nodes: newNodes, edges: newEdges } = layoutDagGraph(graph);

  const hidden = new Set(settings.hiddenAgents);

  const filteredNodes = newNodes.filter((n) => {
    const agentId = (n.data as DagNodeData).node?.agentId;
    return !agentId || !hidden.has(agentId);
  });
  const visibleIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = newEdges.filter(
    (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
  );

  setNodes(
    filteredNodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        isSelected: n.id === dag.selectedNodeId,
        isCompare: n.id === dag.compareNodeId,
      },
    }))
  );
  setEdges(filteredEdges);
  setTimeout(() => {
    rfInstance.current?.fitView({ padding: 0.1, duration: 400 });
  }, 80);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [graph, settings.hiddenAgents]);
```

### Step 2: Wire `filterByAgent` zoom

Add a new `useEffect` after the selection effect (after line 86):

```ts
// Zoom to a single agent when filterByAgent changes
useEffect(() => {
  if (!dag.filterByAgent || !rfInstance.current) return;
  setTimeout(() => {
    const agentNodes = nodes.filter(
      (n) => (n.data as DagNodeData).node?.agentId === dag.filterByAgent
    );
    if (agentNodes.length === 0) return;
    rfInstance.current?.fitView({
      nodes: agentNodes,
      padding: 0.15,
      duration: 400,
    });
  }, 80);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [dag.filterByAgent]);
```

### Step 3: Verify

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

### Step 4: Commit

```bash
git add src/components/dag/dag-canvas.tsx
git commit -m "feat: DAG filters hidden agents, zooms to filterByAgent"
```

---

## Task 5: Topbar idle alert

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

Add a stalled-agent warning in the topbar that shows count + links to agents page.

### Step 1: Add imports to `layout.tsx`

At the top, add to the existing Phosphor import:
```ts
import {
  GitBranch, Trophy, ChatText, GitDiff, GearSix, Robot,
  CaretLineLeft, CaretLineRight, Sun, Moon, Plus, X, Plug, GithubLogo, Warning,
} from "@phosphor-icons/react";
```

Add new imports after existing imports:
```ts
import { computeAgentHealth } from "@/lib/agent-health";
```

### Step 2: Compute stalled count inside `DashboardLayout`

After the `const [showAddWorkspace, setShowAddWorkspace] = useState(false);` line (around line 187), add:

```ts
const { graph: currentGraph, settings: currentSettings } = useStore();
const stalledAgents = (() => {
  if (!currentGraph) return [];
  const health = computeAgentHealth(currentGraph, currentSettings.idleThresholdMinutes);
  return Array.from(health.entries())
    .filter(([, h]) => h.status === 'stalled')
    .map(([id]) => id);
})();
```

**Note:** `graph` and `settings` are already destructured earlier in the component. Rename these to avoid re-destructuring — instead just use `graph` and `settings` already in scope. Update the stalled computation:

```ts
const stalledAgents = (() => {
  if (!graph) return [];
  const health = computeAgentHealth(graph, settings.idleThresholdMinutes);
  return Array.from(health.entries())
    .filter(([, h]) => h.status === 'stalled')
    .map(([id]) => id);
})();
```

### Step 3: Add idle alert to topbar right side

Find the right-side `div` in the header (around line 325). Add the warning before the connected dot:

```tsx
{/* Stalled agent alert */}
{stalledAgents.length > 0 && (
  <Link
    href="/dashboard/agents"
    className="flex items-center gap-1 text-[11px] text-regressed hover:text-regressed/80 transition-colors"
    title={`${stalledAgents.length} agent${stalledAgents.length > 1 ? 's' : ''} stalled: ${stalledAgents.join(', ')}`}
  >
    <Warning size={13} />
    <span>{stalledAgents.length} stalled</span>
  </Link>
)}
```

### Step 4: Verify + visual check

```bash
npx tsc --noEmit 2>&1 | head -20
```

Start dev server and confirm the warning appears/disappears correctly:

```bash
npm run dev
```

### Step 5: Commit

```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat: topbar shows stalled agent count with link to agents page"
```

---

## Task 6: API — add `createPost`

**Files:**
- Modify: `src/lib/api.ts`

### Step 1: Add `createPost` method to `AgentHubClient`

After `getReplies` (line 75), add:

```ts
async createPost(channel: string, content: string, agentId = 'dashboard'): Promise<Post> {
  return this.request(`/api/channels/${channel}/posts`, {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId, content, parent_id: null }),
  });
}
```

### Step 2: Verify

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

### Step 3: Commit

```bash
git add src/lib/api.ts
git commit -m "feat: api client — add createPost for bidirectional message sending"
```

---

## Task 7: Messages page — compose bar + command display

**Files:**
- Modify: `src/app/dashboard/messages/page.tsx`

Two additions:
1. A compose bar at the bottom of the post feed (server mode only)
2. Command-prefixed messages (`TASK:`, `PAUSE:`, `RESUME:`) rendered with distinct styling

### Step 1: Update imports in `messages/page.tsx`

Add to existing imports:
```ts
import { useQueryClient } from "@tanstack/react-query";
import { PaperPlaneTilt, Terminal } from "@phosphor-icons/react";
```

### Step 2: Replace `PostCard` with command-aware version

Replace the existing `PostCard` component (lines 42–60) with:

```tsx
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
```

### Step 3: Add `ComposeBar` component

Add this new component before `DemoMessages`:

```tsx
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
```

### Step 4: Wire `ComposeBar` into the server-mode post feed

In `MessagesPage`, find the post feed section (the `div` that wraps `PostCard` items, around line 218). Update the outer feed container to use flex-col and add `ComposeBar` at the bottom:

Replace:
```tsx
<div className="flex-1 min-w-0 border border-border-subtle rounded-[6px] overflow-hidden">
  {postsLoading ? (
    ...
  ) : !posts || posts.length === 0 ? (
    ...
  ) : (
    <div>
      {/* Channel header */}
      <div className="px-4 py-2.5 border-b border-border-subtle bg-surface-1 flex items-center justify-between">
        <span className="text-[12px] font-medium text-secondary">#{activeChannel}</span>
        <span className="text-[11px] text-ghost">{posts.length} messages</span>
      </div>
      {/* Posts - newest first */}
      <div>
        {[...posts].reverse().map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  )}
</div>
```

With:
```tsx
<div className="flex-1 min-w-0 border border-border-subtle rounded-[6px] overflow-hidden flex flex-col">
  {postsLoading ? (
    <div className="p-4 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-[4px]" />
      ))}
    </div>
  ) : !posts || posts.length === 0 ? (
    <>
      <div className="flex flex-col items-center justify-center py-16 flex-1">
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
      {/* Compose bar */}
      {activeChannel && <ComposeBar channel={activeChannel} />}
    </>
  )}
</div>
```

### Step 5: Add `useQueryClient` to `MessagesPage`

At the top of `MessagesPage` function, add:
```ts
const qc = useQueryClient(); // used by ComposeBar via closure
```

Actually `ComposeBar` calls `useQueryClient()` itself, so no changes needed to `MessagesPage`. Just make sure `useQueryClient` is imported at the top of the file.

### Step 6: Verify + browser check

```bash
npx tsc --noEmit 2>&1 | head -30
npm run dev
```

In browser: navigate to Messages, verify:
- Compose bar appears at bottom of feed
- Command shortcut chips work (TASK:, PAUSE:, RESUME:, BROADCAST:)
- ⌘↵ sends the message
- Sent messages show `Terminal` icon instead of agent dot
- Messages starting with `TASK:` show the command badge

### Step 7: Commit

```bash
git add src/app/dashboard/messages/page.tsx
git commit -m "feat: messages — compose bar, command shortcuts, TASK/PAUSE/RESUME display"
```

---

## Task 8: Settings page — expose idle threshold

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`

Add an "Idle threshold" input so users can configure when agents are marked stalled.

### Step 1: Read the current settings page

```bash
cat -n src/app/dashboard/settings/page.tsx | head -80
```

Find the polling config section and add after it.

### Step 2: Add idle threshold input

Find the polling interval section in settings. After the last polling input, add:

```tsx
{/* Idle threshold */}
<div className="space-y-1.5">
  <label className="text-[11px] font-medium uppercase tracking-wider text-muted">
    Idle Threshold (minutes)
  </label>
  <div className="flex items-center gap-2">
    <Input
      type="number"
      min={1}
      max={120}
      value={settings.idleThresholdMinutes}
      onChange={(e) => updateSettings({ idleThresholdMinutes: Math.max(1, parseInt(e.target.value) || 15) })}
      className="bg-surface-1 border-border-default text-primary rounded-[6px] h-9 text-[13px] w-[80px]"
    />
    <span className="text-[11px] text-ghost">minutes before agent is marked stalled</span>
  </div>
</div>
```

### Step 3: Verify

```bash
npx tsc --noEmit 2>&1 | head -20
```

### Step 4: Commit

```bash
git add src/app/dashboard/settings/page.tsx
git commit -m "feat: settings — add idle threshold configuration"
```

---

## Task 9: Final verification pass

### Step 1: Full type check

```bash
npx tsc --noEmit
```

Expected: 0 errors

### Step 2: Build check

```bash
npm run build 2>&1 | tail -20
```

Expected: successful build, no type errors

### Step 3: Manual smoke test checklist

Start dev server: `npm run dev`

- [ ] Connect to demo mode
- [ ] Agents page shows health status dots (active/idle/stalled/offline)
- [ ] Agents page shows last active time
- [ ] Eye toggle hides an agent from the DAG (verify in DAG view)
- [ ] Hidden agent is dimmed (opacity-40) in agents list
- [ ] Stalled agent count appears in topbar (if any agents are stalled)
- [ ] Messages page shows compose bar at bottom
- [ ] Typing `TASK: do something` and sending shows command badge
- [ ] ⌘↵ sends the message
- [ ] Settings page shows idle threshold field

### Step 4: Push

```bash
git push
```

---

## Summary of commits

1. `feat: add agent health utility (status, last commit, best metric)`
2. `feat: add agent visibility toggle and idle threshold to store`
3. `feat: agents page — health status, last active, visibility toggle`
4. `feat: DAG filters hidden agents, zooms to filterByAgent`
5. `feat: topbar shows stalled agent count with link to agents page`
6. `feat: api client — add createPost for bidirectional message sending`
7. `feat: messages — compose bar, command shortcuts, TASK/PAUSE/RESUME display`
8. `feat: settings — add idle threshold configuration`
