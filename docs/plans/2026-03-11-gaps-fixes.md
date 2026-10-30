# Gap Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all UX, product, and technical gaps identified in the dagboard app assessment.

**Architecture:** Fixes are isolated — each task touches specific files with no cross-dependencies unless noted. Work in order: quick wins first, then medium, then large.

**Tech Stack:** Next.js 15 App Router, TypeScript, Zustand, TanStack Query, @phosphor-icons/react, ReactFlow

---

## Tier 1 — Quick Wins (< 30 min each)

---

### Task 1: Favicon

**Files:**
- Create: `src/app/favicon.ico` (or `src/app/icon.png`)

**Step 1: Generate favicon**

Create a 32×32 PNG that matches the LogoMark SVG (3 squares in an L shape, white on dark background). Save as `src/app/icon.png`. Next.js App Router auto-serves `icon.png` as the favicon — no config needed.

Simplest approach — create a 32×32 SVG and convert:
```
3 squares: top-left 13×13, top-right 13×13, bottom-left 13×13
Gap: 2px between squares
Background: #0a0a0a (var --base)
Squares: #e5e5e5
```

**Step 2: Verify**

Run dev server, open browser, check tab icon.

**Step 3: Commit**
```bash
git add src/app/icon.png
git commit -m "feat: add favicon (LogoMark icon)"
```

---

### Task 2: OG Image

**Files:**
- Create: `src/app/opengraph-image.tsx`

**Step 1: Create OG image using Next.js ImageResponse**

```tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'dagboard — AI agent experiment dashboard'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '80px',
          fontFamily: 'monospace',
        }}
      >
        {/* Logo mark — 3 squares */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '32px' }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 18, height: 18, background: '#e5e5e5', borderRadius: 2 }} />
          ))}
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, color: '#e5e5e5', lineHeight: 1.1, marginBottom: 24 }}>
          dagboard
        </div>
        <div style={{ fontSize: 28, color: '#737373', lineHeight: 1.4 }}>
          Open-source dashboard for karpathy/agenthub.<br />
          Watch your agents branch, compete, and converge.
        </div>
      </div>
    ),
    { ...size }
  )
}
```

**Step 2: Verify**

Navigate to `http://localhost:3000/opengraph-image` — should render the image.

**Step 3: Commit**
```bash
git add src/app/opengraph-image.tsx
git commit -m "feat: add OG image for social sharing"
```

---

### Task 3: 404 Page

**Files:**
- Create: `src/app/not-found.tsx`

**Step 1: Create not-found page**

```tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      style={{
        background: 'var(--base)',
        color: 'var(--text-primary)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        gap: '16px',
      }}
    >
      <div style={{ color: 'var(--text-ghost)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        404
      </div>
      <div style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
        Page not found
      </div>
      <Link
        href="/"
        style={{ fontSize: '13px', color: 'var(--text-ghost)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
      >
        Back to home
      </Link>
    </div>
  )
}
```

**Step 2: Verify**

Navigate to `http://localhost:3000/anything-fake` — should render 404 page.

**Step 3: Commit**
```bash
git add src/app/not-found.tsx
git commit -m "feat: add 404 page"
```

---

### Task 4: GitHub Repo Topics + Description

**Step 1: Set repo description via gh CLI**

```bash
gh repo edit rx4u/dagboard \
  --description "Open-source dashboard for karpathy/agenthub — visualize AI agent experiment DAGs, leaderboard, diffs, and messages" \
  --add-topic agenthub \
  --add-topic ai-agents \
  --add-topic llm \
  --add-topic machine-learning \
  --add-topic dashboard \
  --add-topic visualization \
  --add-topic nextjs \
  --add-topic experiment-tracking \
  --homepage "https://agenthub-dashboard-three.vercel.app"
```

**Step 2: Verify**

Open `https://github.com/rx4u/dagboard` — confirm description, topics, and website URL are visible.

---

## Tier 2 — Medium Fixes (1–2 hrs each)

---

### Task 5: Error Boundary

**Files:**
- Create: `src/components/error-boundary.tsx`
- Modify: `src/app/dashboard/layout.tsx`

**Step 1: Create error boundary component**

```tsx
'use client'

import { Component, type ReactNode } from 'react'
import { ArrowCounterClockwise } from '@phosphor-icons/react'

interface Props { children: ReactNode; label?: string }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex flex-col items-center justify-center h-full gap-4"
          style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
        >
          <div className="text-[11px] uppercase tracking-widest">
            {this.props.label ?? 'Error'}
          </div>
          <div className="text-[12px] text-center max-w-[320px]" style={{ color: 'var(--text-muted)' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="flex items-center gap-1.5 text-[12px]"
            style={{ color: 'var(--text-ghost)' }}
          >
            <ArrowCounterClockwise size={12} />
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

**Step 2: Wrap dashboard content area**

In `src/app/dashboard/layout.tsx`, import `ErrorBoundary` and wrap the `<ScrollArea>` content:

```tsx
import { ErrorBoundary } from '@/components/error-boundary'

// Inside the layout JSX, around the children:
<ErrorBoundary label="panel error">
  {children}
</ErrorBoundary>
```

**Step 3: Verify**

Temporarily throw in a dashboard page, confirm error boundary catches and shows retry.

**Step 4: Commit**
```bash
git add src/components/error-boundary.tsx src/app/dashboard/layout.tsx
git commit -m "feat: add error boundary around dashboard panels"
```

---

### Task 6: Connection Error States on /connect

**Files:**
- Modify: `src/app/connect/page.tsx`

**Step 1: Read the current connect page**

Read `src/app/connect/page.tsx` fully before editing.

**Step 2: Add explicit error messages**

Find where connection test happens (the `handleConnect` or similar function). Add specific error cases:

```tsx
// Inside try/catch around the health check:
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('fetch')) {
    setError('Cannot reach server. Check the URL and make sure agenthub is running.')
  } else if (msg.includes('401') || msg.includes('403')) {
    setError('Invalid API key.')
  } else if (msg.includes('timeout')) {
    setError('Connection timed out. Server may be overloaded.')
  } else {
    setError(`Connection failed: ${msg}`)
  }
}
```

**Step 3: Style error display**

Error should appear below the form inputs, in red-tinted text using existing token pattern:
```tsx
{error && (
  <div className="text-[12px]" style={{ color: '#f87171' }}>
    {error}
  </div>
)}
```

**Step 4: Verify**

Enter a bad URL, bad API key — confirm readable error messages appear.

**Step 5: Commit**
```bash
git add src/app/connect/page.tsx
git commit -m "feat: add specific error messages to connect form"
```

---

### Task 7: GitHub Rate Limit UX

**Files:**
- Modify: `src/lib/github.ts`
- Modify: `src/app/connect/page.tsx` (or wherever GitHub mode is handled)

**Step 1: Read github.ts**

Read `src/lib/github.ts` to understand current error handling.

**Step 2: Detect rate limit response**

GitHub returns HTTP 403 with `X-RateLimit-Remaining: 0` when rate-limited. Add detection:

```ts
if (res.status === 403) {
  const remaining = res.headers.get('X-RateLimit-Remaining')
  const reset = res.headers.get('X-RateLimit-Reset')
  if (remaining === '0') {
    const resetTime = reset ? new Date(parseInt(reset) * 1000).toLocaleTimeString() : 'soon'
    throw new Error(`GitHub API rate limit reached. Resets at ${resetTime}. Authenticate to get 5000 req/hr.`)
  }
}
```

**Step 3: Surface the message**

Ensure the error propagates to the UI where GitHub URL is entered and is shown in the same error display from Task 6.

**Step 4: Commit**
```bash
git add src/lib/github.ts
git commit -m "feat: detect and surface GitHub API rate limit with reset time"
```

---

### Task 8: Mobile — "Best on Desktop" Notice

**Files:**
- Modify: `src/app/dashboard/page.tsx` (DAG view)
- Modify: `src/app/dashboard/layout.tsx`

**Step 1: Add mobile detection hook**

```tsx
// In layout or page:
const [isMobile, setIsMobile] = useState(false)
useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 768)
  check()
  window.addEventListener('resize', check)
  return () => window.removeEventListener('resize', check)
}, [])
```

**Step 2: Show notice banner on mobile in dashboard layout**

```tsx
{isMobile && (
  <div
    className="px-4 py-2.5 text-[12px] text-center"
    style={{
      background: 'var(--surface-2)',
      borderBottom: '1px solid var(--border-subtle)',
      color: 'var(--text-muted)',
    }}
  >
    DAG canvas works best on desktop. Some panels are touch-friendly.
  </div>
)}
```

**Step 3: Hide DAG canvas on mobile, show grid view instead**

In `src/app/dashboard/page.tsx`, if mobile, force `viewMode = 'grid'` and hide the DAG/Grid toggle:

```tsx
const effectiveViewMode = isMobile ? 'grid' : viewMode
```

**Step 4: Commit**
```bash
git add src/app/dashboard/layout.tsx src/app/dashboard/page.tsx
git commit -m "feat: mobile notice + force grid view on small screens"
```

---

### Task 9: Onboarding Context on /connect

**Files:**
- Modify: `src/app/connect/page.tsx`

**Step 1: Read the current connect page in full**

**Step 2: Add a collapsible "How does this work?" section**

Below the form, add a help section visible by default on first visit:

```tsx
// Static, always-visible helper text under the server URL field:
<div className="text-[11px]" style={{ color: 'var(--text-ghost)' }}>
  Run agenthub locally:{' '}
  <code style={{ color: 'var(--text-muted)' }}>pip install agenthub && ah serve</code>
  {' '}then enter{' '}
  <code style={{ color: 'var(--text-muted)' }}>http://localhost:8000</code>
</div>
```

Also add a link to karpathy/agenthub below the GitHub mode section if one exists.

**Step 3: Verify copy is accurate**

Check karpathy/agenthub README for actual install command before committing.

**Step 4: Commit**
```bash
git add src/app/connect/page.tsx
git commit -m "feat: add setup hints to connect page"
```

---

### Task 10: Make GitHub Mode More Visible on /connect

**Files:**
- Modify: `src/app/connect/page.tsx`

**Step 1: Read current connect page**

Find where GitHub mode is currently exposed (input field, section, etc.)

**Step 2: Elevate GitHub mode above the server form**

GitHub mode should be the first thing shown, as a prominent "no server needed" option:

```
┌─────────────────────────────────────────────┐
│  Try without a server                       │
│  [github.com/owner/repo         ] [Open →]  │
├─────────────────────────────────────────────┤
│  Have an agenthub server?                   │
│  Server URL _______________                 │
│  API Key ___________________                │
│  [Connect]                                  │
└─────────────────────────────────────────────┘
```

**Step 3: Implement**

Move the GitHub URL input to the top of the form with an `or` divider before the server connection section.

**Step 4: Verify**

On page load, GitHub mode should be the first interactive element.

**Step 5: Commit**
```bash
git add src/app/connect/page.tsx
git commit -m "feat: elevate GitHub mode above server form on connect page"
```

---

## Tier 3 — Larger Fixes

---

### Task 11: README

**Files:**
- Modify: `README.md`

**Step 1: Write the README**

Sections needed:
1. Hero — what it is (1 sentence), live demo link, GitHub stars badge
2. Screenshot / GIF placeholder (add real screenshot once captured)
3. Features — bulleted, with GitHub mode called out prominently
4. Quick Start — two paths: (a) GitHub mode (no install), (b) self-host
5. Self-host — `git clone`, `npm install`, `npm run dev`, point at agenthub
6. GitHub mode — paste any public repo URL, no account needed
7. Tech stack
8. Contributing
9. License

**Step 2: Add badges to README header**

```markdown
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/rx4u/dagboard)
```

**Step 3: Commit**
```bash
git add README.md
git commit -m "docs: comprehensive README with quick start, features, GitHub mode"
git push
```

---

### Task 12: Animated Demo Mode

**Files:**
- Modify: `src/lib/mock-data.ts`
- Modify: `src/hooks/use-dag-data.ts` (or wherever demo polling is handled)

**Step 1: Read mock-data.ts and use-dag-data.ts**

Understand the current shape of demo data and how it's loaded.

**Step 2: Add a commit stream simulation**

Every 5 seconds in demo mode, append a new synthetic commit to the graph — rotating through agents, incrementing metrics slightly:

```ts
// Simulated commit generator
function makeNextCommit(existing: Commit[]): Commit {
  const agents = ['agent-1', 'agent-2', 'agent-3']
  const agent = agents[existing.length % agents.length]
  const lastMetric = 0.85 + Math.random() * 0.12
  const parent = existing[existing.length - 1]?.hash ?? null
  return {
    hash: Math.random().toString(36).slice(2, 9),
    parent_hash: parent,
    agent_id: agent,
    message: `step ${existing.length * 100}: val_bpb=${lastMetric.toFixed(4)}`,
    created_at: new Date().toISOString(),
  }
}
```

**Step 3: Wire up polling in demo mode**

In the hook that provides demo data, set a `setInterval` (5s) that appends a new commit using the generator above and updates the Zustand graph state.

**Step 4: Verify**

Open demo mode, watch DAG update with new nodes every 5 seconds.

**Step 5: Commit**
```bash
git add src/lib/mock-data.ts src/hooks/use-dag-data.ts
git commit -m "feat: animate demo mode with live commit simulation"
```

---

## Execution Order

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | Favicon | 15m | Medium |
| 2 | OG Image | 20m | High (social) |
| 3 | 404 page | 10m | Low |
| 4 | GitHub topics + description | 5m | Medium |
| 5 | Error boundary | 30m | High (stability) |
| 6 | Connection error states | 30m | High (UX) |
| 7 | GitHub rate limit UX | 20m | Medium |
| 8 | Mobile notice + grid fallback | 30m | Medium |
| 9 | Onboarding hints on /connect | 20m | High (conversion) |
| 10 | GitHub mode elevation | 45m | High (discoverability) |
| 11 | README | 45m | High (marketing) |
| 12 | Animated demo mode | 60m | Medium |
