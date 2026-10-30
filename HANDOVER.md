# Dagboard (AgentHub Dashboard) — Handover

## What it is
An open-source "mission control" dashboard for karpathy/agenthub, a hub where AI agents branch and compete on experiments. It shows the experiment DAG, a leaderboard, a diff viewer between commits, an agent message board, and agent management. It can run in GitHub mode (paste any public repo URL), demo mode (synthetic data), or against a self-hosted agenthub server. CLAUDE.md calls this "Product A", a free project meant to test demand for a hosted version. That hosted version was not built.

The folder also contains conductor/, a separate Node CLI (@agenthub/conductor) that orchestrates agent swarms.

## Stack
- Next.js 15 (App Router), React, TypeScript, Tailwind CSS (postcss), Geist font
- @xyflow/react (React Flow) and dagre for the DAG; react-diff-viewer-continued for diffs
- Zustand (state), @tanstack/react-query, Radix UI, cmdk, Phosphor icons
- conductor/: its own package.json, tsconfig and package-lock.json. Scripts: build, dev, test, test:watch

## How to run
```bash
npm install
npm run dev        # Next.js default port 3000
```
Demo mode and GitHub mode need no server. Self-hosting needs an agenthub server URL, entered in the app.
Conductor: `cd conductor && npm install && npm run build`.
Lockfile: package-lock.json, so npm.

## Environment variables
None found.

## Deploy
Vercel project "agenthub-dashboard" (from .vercel/project.json, projectId prj_W6uki0S0OgtGWOqj4kjFkkxA1RnW). The README links a live demo at agenthub-dashboard-three.vercel.app. There is no vercel.json.

## Where it was left
- Archived: 2026-10-30, repo rx4u/dagboard
- Branch main. Last commit 71edd2d (2026-03-12): "fix: address critical and important issues from final review"
- Uncommitted at archive time: 16 entries. Modified: .gitignore, package.json, conductor/dist/index.js. Untracked: the rest of conductor/dist/ (api, cli, config, page, sidecar, state, loops/ and their tests), docs/PRD-agent-ide.md and docs/plans/. Committed as a snapshot when archived.

## Notes / next steps
- docs/PRD-agent-ide.md and docs/plans/2026-03-12-phase1-phase2-agent-ide.md were never committed. The plan's acceptance checklist is still unchecked: agent health dots, last-active time, eye toggle that hides an agent from the DAG, message compose bar, Cmd+Enter to send, and the idle-threshold setting. Check each against the code before trusting either document.
- conductor/dist/ is compiled output and is partly untracked. The source is conductor/src/.
- docs/DESIGN.md is the design reference. CLAUDE.md asks for a dark, monochrome, mono-font look.
- The hosted "Product B" (Clerk auth, Stripe billing) is only an idea in CLAUDE.md. Nothing for it is in the code.
