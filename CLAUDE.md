# AgentHub Dashboard

Mission control for autonomous AI agent swarms. A frontend for [karpathy/agenthub](https://github.com/karpathy/agenthub).

## Product Context

This is an open-source dashboard (Product A) that validates demand for a hosted service (Product B). Ship fast, get stars, see if people ask for a hosted version.

Product A (this repo): Free, open source, connect to any AgentHub server.
Product B (later, only if validated): Hosted AgentHub + dashboard, Clerk auth, Stripe billing.

We are building Product A only. But we architect it so Product B is a natural extension.

## What This Is

A dark-mode, mono-font, monochrome single-page dashboard that connects to any AgentHub server. Visualizes the experiment DAG, ranks results on a leaderboard, diffs between commits, shows agent coordination messages, and lets users manage agents and configure metric extraction.

## Tech Stack

- **Framework**: Next.js 15 (App Router, TypeScript)
- **Styling**: Tailwind CSS v4 + CSS custom properties
- **Components**: shadcn/ui (New York style, Zinc base, dark monochrome overrides)
- **Icons**: @phosphor-icons/react (size 16, weight "regular")
- **Scrolling**: shadcn ScrollArea everywhere. No native scrollbars.
- **DAG Visualization**: @xyflow/react (ReactFlow v12)
- **Diff Viewer**: react-diff-viewer-continued
- **State**: Zustand (client state, persisted to localStorage)
- **Server State**: TanStack Query (API cache, polling, deduplication)
- **Fonts**: Two typefaces — Geist Mono (`geist` npm package) for UI/code/data, Space Grotesk (`next/font/google`, variable `--font-display`) for hero text and display titles only.

## Architecture: Single Page App

The dashboard shell (sidebar + topbar) is persistent and never re-renders on navigation. Only the content area inside `<ScrollArea>` changes. Use Next.js `<Link>` for all internal navigation. Zustand and TanStack Query cache persist across route changes.

---

## Data Layer (Critical, Read This First)

These findings come from reading the actual AgentHub Go source code.

### The Commit Model (From Source)

The SQLite schema for commits is:
```sql
CREATE TABLE commits (
  hash TEXT PRIMARY KEY,
  parent_hash TEXT,          -- singular, nullable. NOT an array.
  agent_id TEXT,
  message TEXT,              -- unstructured. metrics live here.
  created_at TIMESTAMP
);
```

Key facts:
- `parent_hash` is a single string, not an array. No merge commits. The DAG is a forest of chains that branch but never merge.
- There is NO structured metric field. No `score`, no `metric_value`. The only place metrics exist is inside the `message` string.
- The default list limit is 50. Always pass `?limit=1000` (or higher) to get the full DAG.

### Building the DAG Client-Side

Do NOT call `/children` per node (N+1 queries). Instead:

1. Fetch ALL commits in one call: `GET /api/git/commits?limit=10000`
2. Build the full adjacency map in memory:
   ```typescript
   const parentToChildren = new Map<string, string[]>();
   commits.forEach(c => {
     if (c.parent_hash) {
       const siblings = parentToChildren.get(c.parent_hash) || [];
       siblings.push(c.hash);
       parentToChildren.set(c.parent_hash, siblings);
     }
   });
   ```
3. Find roots: commits where `parent_hash` is empty/null.
4. Find leaves: commits whose hash never appears as anyone's `parent_hash`.
5. Transform into ReactFlow nodes + edges.

### DAG Layout Strategy

Use time-based X axis with agent-grouped Y lanes:
- X position = generation depth (distance from root). Time flows left to right.
- Y position = grouped by agent_id. Each agent gets a horizontal lane.
- This reads naturally: "agent-1 tried A, then B, then C" is a horizontal chain.

Use `@dagrejs/dagre` for automatic layout if the manual approach gets too complex.

### Metric Extraction (The Hardest Product Problem)

Agents write metrics in commit messages. There is no standard format. Examples from autoresearch:
- `"val_bpb: 0.965"`
- `"loss improved to 0.971"`
- `"score=0.965, lr=0.001"`

Strategy: **Auto-detect with user-configurable override.**

1. On first load, scan all commit messages with common regex patterns.
2. If a pattern matches consistently (>50% of commits), auto-select it.
3. Show the detected pattern in settings. Let user edit/override.
4. Store the pattern in Zustand (persisted to localStorage).

```typescript
const DEFAULT_METRIC_PATTERNS = [
  { name: 'val_bpb', pattern: /val_bpb[:\s=]+([\d.]+)/i },
  { name: 'loss', pattern: /\bloss[:\s=]+([\d.]+)/i },
  { name: 'score', pattern: /\bscore[:\s=]+([\d.]+)/i },
  { name: 'accuracy', pattern: /\baccuracy[:\s=]+([\d.]+)/i },
  { name: 'bpb', pattern: /\bbpb[:\s=]+([\d.]+)/i },
];
```

Without this working, the leaderboard is useless. This is not optional.

### Efficient Polling Strategy

There are NO WebSockets or SSE. Polling only.

**Do not re-fetch all commits every 5 seconds.** Instead:

1. **Poll leaves** (`GET /api/git/leaves`) every 5 seconds. This is lightweight.
2. Compare the returned leaf hashes against our known leaves.
3. If new leaves appear, fetch their lineage (`GET /api/git/commits/{hash}/lineage`) to get new commits.
4. Merge new commits into the client-side DAG.
5. Most polls return no changes and are cheap (just the leaf set).

For messages: Poll `GET /api/channels/{name}/posts?limit=10` every 10 seconds. Compare against latest known post ID.

### Diff Returns Plain Text, Not JSON

`GET /api/git/diff/{hash_a}/{hash_b}` returns `Content-Type: text/plain` with a raw unified diff. The API client must handle this differently:

```typescript
async getDiff(hashA: string, hashB: string): Promise<string> {
  const res = await fetch(`${this.baseUrl}/api/git/diff/${hashA}/${hashB}`, {
    headers: { 'Authorization': `Bearer ${this.apiKey}` },
  });
  if (!res.ok) throw new Error(`Diff failed: ${res.status}`);
  return res.text(); // NOT res.json()
}
```

Diffs are rate-limited to 60/hour per agent. Cache aggressively via TanStack Query (diff between two hashes never changes).

### The Health Endpoint

`GET /api/health` is the ONLY endpoint that doesn't require auth. Returns `{"status":"ok"}`. Use this to test connectivity before storing credentials.

---

## Features

### 1. Connection Screen
- Enter server URL + API key
- Optional: admin key (needed for agent management)
- Test connection via `/api/health` before saving
- Store in Zustand (persisted to localStorage)
- Redirect to dashboard on success

### 2. DAG Visualization (Hero)
- Full experiment DAG rendered via ReactFlow
- Nodes: small rounded squares (4px radius), colored by agent at 70% opacity
- Edges: bezier curves, gray, subtle
- Interactions: pan, zoom, click to select, shift+click to compare
- Hover tooltip: commit hash, agent, metric value, timestamp
- Minimap in bottom-right
- Stat cards above: total experiments, best score, runtime, active agents (dashed border)

### 3. Leaderboard
- Table of all commits with extracted metrics, sorted by value
- Columns: rank, agent (color dot + name), metric value, delta from baseline, hash, timestamp
- Click row to highlight the corresponding DAG node
- "Best" row gets subtle left-border accent
- Sort direction configurable (lower-is-better for loss/bpb, higher-is-better for accuracy)

### 4. Diff View
- Side-by-side code diff between any two commits
- Triggered by: shift+click two DAG nodes, or click compare icon in leaderboard
- Uses react-diff-viewer-continued to render unified diff
- Cache diffs in TanStack Query (immutable, never refetch)

### 5. Message Board
- Channel list from `/api/channels`
- Post feed from `/api/channels/{name}/posts` in ScrollArea
- Threaded replies via `/api/posts/{id}/replies`
- 10-second polling for new messages
- Agent name colored with agent dot

### 6. Agent Management (NEW)
- Requires admin key (separate from regular API key)
- Create new agents from the dashboard (POST `/api/admin/agents`)
- List all agents with their creation date
- Copy agent API key to clipboard on creation
- This replaces the need for CLI `ah join` for basic setups

### 7. Metric Configuration (NEW)
- Settings panel to configure metric extraction
- Auto-detect: scan commit messages, suggest matching pattern
- Manual override: user types a regex with a capture group
- "Lower is better" / "Higher is better" toggle (affects leaderboard sort)
- Metric name label (shown in leaderboard header and stat cards)
- Stored in Zustand (localStorage)

### 8. Settings
- Connection info (server URL, reconnect, disconnect)
- Admin key (for agent management)
- Metric configuration (pattern, sort direction, name)
- Polling intervals (DAG: 5s default, Messages: 10s default)
- Density mode (dense/comfortable)

---

## Project Structure

```
src/
  app/
    layout.tsx                  Root layout (font, providers, QueryClient)
    page.tsx                    Connection screen
    dashboard/
      layout.tsx                SPA shell (sidebar + topbar + ScrollArea)
      page.tsx                  DAG view (hero)
      leaderboard/page.tsx      Ranked experiments
      messages/page.tsx         Message board
      diff/page.tsx             Side-by-side diff
      agents/page.tsx           Agent management (NEW)
      settings/page.tsx         Settings + metric config
  components/
    layout/
      sidebar.tsx               Icon sidebar nav
      topbar.tsx                Connection status + quick stats
      stat-card.tsx             Dashed-border metric card
    dag/
      dag-canvas.tsx            ReactFlow canvas
      dag-node.tsx              Custom node (agent-colored square)
      dag-edge.tsx              Custom edge (bezier, subtle)
      dag-minimap.tsx           Minimap overlay
      dag-controls.tsx          Zoom/filter bar
    leaderboard/
      leaderboard-table.tsx     Sortable ranking
      leaderboard-row.tsx       Row with agent dot
    board/
      channel-list.tsx          Channel nav
      post-feed.tsx             Message feed in ScrollArea
      post-card.tsx             Single message
    agents/
      agent-list.tsx            List of agents
      create-agent-dialog.tsx   shadcn Dialog to create agent
    settings/
      metric-config.tsx         Metric extraction pattern editor
      connection-config.tsx     Server URL / keys
      polling-config.tsx        Interval settings
    ui/                         shadcn/ui components
  lib/
    api.ts                      AgentHub API client
    store.ts                    Zustand store
    types.ts                    TypeScript types
    utils.ts                    Helpers
    agent-colors.ts             Color assignment
    metrics.ts                  Metric extraction engine (NEW)
    sync.ts                     Leaf-based incremental sync (NEW)
  styles/
    globals.css                 Tokens + shadcn overrides
```

## Implementation Order

### Phase 1: Shell + Connection (Day 1-2)
1. Scaffold Next.js, install deps, init shadcn (New York, Zinc, CSS vars)
2. Install shadcn components: button, input, label, scroll-area, separator, tooltip, badge, table, tabs, dialog, dropdown-menu, skeleton, command
3. Install @phosphor-icons/react, geist, @xyflow/react, @tanstack/react-query, zustand, react-diff-viewer-continued, @dagrejs/dagre
4. Create globals.css with all tokens + shadcn overrides
5. Build connection screen (server URL + API key + optional admin key)
6. Build SPA dashboard layout (sidebar + topbar + ScrollArea content)
7. Set up Zustand store with connection, settings, DAG state, metric config
8. Create API client (handle both JSON and text/plain responses)
9. Set up TanStack QueryClientProvider

### Phase 2: DAG + Sync (Day 3-5)
1. Build sync engine: initial full fetch, then leaf-based incremental polling
2. Build metric extraction engine with auto-detect
3. Transform commits into ReactFlow nodes/edges with layout algorithm
4. Custom node component (agent-colored, 4px radius)
5. Custom edge component (bezier, gray)
6. Click-to-select, hover tooltip, shift+click to compare
7. Minimap
8. Stat cards row (dashed border, Phosphor icons)

### Phase 3: Leaderboard + Diff (Day 6-8)
1. Leaderboard table using extracted metrics, shadcn Table
2. Sort direction from metric config (lower/higher is better)
3. Click row to highlight DAG node via Zustand
4. Diff view: fetch raw text diff, render with react-diff-viewer-continued
5. Cache diffs in TanStack Query with infinite staleTime

### Phase 4: Messages + Agents (Day 9-11)
1. Channel list from /api/channels
2. Post feed with 10s polling via TanStack Query refetchInterval
3. Threaded replies
4. Agent management page: list agents, create agent dialog, copy API key
5. Admin key input in settings (gates agent management features)

### Phase 5: Settings + Polish (Day 12-14)
1. Metric configuration UI: auto-detect display, regex editor, sort toggle
2. Polling interval config
3. shadcn Skeleton for all loading states
4. Empty states with Phosphor icons
5. shadcn Command (Cmd+K) for search/navigation
6. Error handling, rate limit display, reconnection
7. Responsive: sidebar collapse at 1024px

---

## Design Language (Summary)

Full spec in `docs/DESIGN.md`. Key rules:

- **Dark only.** No light theme.
- **Two typefaces only.** Geist Mono for all UI/data/code. Space Grotesk (`font-display`) for hero headings and display titles only. Never add a third.
- **Monochrome.** Colors only for agent dots and semantic indicators.
- **4px spacing grid.** Every spacing value is a multiple of 4px.
- **Moderate radius.** 2/4/6/8px scale. Never rounded-full on UI elements.
- **Dashed stat cards.** Solid borders elsewhere.
- **shadcn ScrollArea everywhere.** No native scrollbars.
- **Phosphor icons.** Not Lucide. Size 16 default, weight "regular".
- **Buttons are monochrome.** bg-surface-3 + border. No colored buttons.
- **Skeletons, not spinners.** shadcn Skeleton component.
- **No illustrations.** Empty states = Phosphor icon + text.

## Icon Mapping (Phosphor)

| Context         | Icon              | Size |
|-----------------|-------------------|------|
| DAG nav         | GitBranch         | 16   |
| Leaderboard     | Trophy            | 16   |
| Messages        | ChatText          | 16   |
| Diff            | GitDiff           | 16   |
| Agents          | Robot             | 16   |
| Settings        | GearSix           | 16   |
| Connect         | Plug              | 16   |
| Time            | Clock             | 16   |
| Search          | MagnifyingGlass   | 16   |
| Expand/collapse | CaretRight        | 14   |
| Close           | X                 | 14   |
| Improved        | TrendUp           | 14   |
| Regressed       | TrendDown         | 14   |
| Copy            | Copy              | 14   |
| Add/create      | Plus              | 14   |
| Empty states    | (context icon)    | 24   |

## Agent Colors

8 colors, assigned by first appearance. Used ONLY on DAG nodes (70% opacity), tiny 6px dots, edge strokes (30% opacity).

```typescript
const AGENT_COLORS = [
  '#818CF8', '#38BDF8', '#4ADE80', '#FB923C',
  '#F472B6', '#A78BFA', '#2DD4BF', '#FBBF24',
];
```

## Hard Rules

- Never add a third typeface. Geist Mono = UI/data/code. Space Grotesk = hero/display only.
- Never use Lucide icons. Phosphor only.
- Never use colored buttons. Monochrome only.
- Never use box shadows. Elevation = luminance.
- Never use native scrollbars. shadcn ScrollArea only.
- Never use spinners. shadcn Skeleton only.
- Never use illustrations for empty states.
- Never add a light theme.
- Never use rounded-full on UI (except 6px agent dots).
- Never use radius > 8px.
- All spacing is 4px multiples. No exceptions.
- Stat cards: border-dashed. Everything else: solid or none.
- Agent colors: DAG nodes + tiny dots only. Nowhere else.
- Commit hashes: truncate to 7 chars.
- Timestamps: relative ("2m ago").
- Diffs: cache forever (immutable content).
- SPA: only content area re-renders on navigation.
- Polling: leaf-based incremental for DAG, direct for messages.
