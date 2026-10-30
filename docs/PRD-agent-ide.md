# Dagboard — Agent IDE PRD

**Version:** 1.0
**Date:** 2026-03-12
**Status:** Draft

---

## Vision

Dagboard evolves from a passive experiment tracker into the IDE for agentic organizations — the environment where you design, observe, steer, and fork swarms of agents the way engineers today build, run, and debug software.

The fundamental insight: human orgs run on illegibility. The CEO can't zoom into any activity in real time. Agentic orgs invert this — every decision, every output, every metric is fully observable at any zoom level. **Legibility is the new primitive.** Dagboard's job is to make that legibility usable.

The unit of interest shifts from one file → one agent. It's still programming. The IDE doesn't die — it evolves upward.

---

## Problem Statement

Dagboard v1 is a push-only, single-server experiment tracker. Agents write commits. Dagboard reads them. That's it.

The problems this creates:

1. **No steering.** You can watch agents fail and do nothing about it.
2. **No health awareness.** You can't tell if an agent is running, stuck, or dead.
3. **Single machine assumption.** One `serverUrl`. Real workloads span local machines, GPU servers, cloud instances.
4. **No synthesis layer.** Raw commits and raw metrics. No summary of "what is the swarm actually doing right now."
5. **Nothing is forkable.** No export, no template, no way to share a working configuration.
6. **List-based interface.** Leaderboard = table. Messages = feed. The legibility vision demands spatial, zoomable, explorable.

---

## Users

**Primary (v2):** AI researchers and ML engineers running multi-agent experiment swarms. They have 3–20 agents across 1–5 machines. They are technical. They want to see everything and act precisely.

**Secondary (v3+):** Engineers building agentic systems (not just ML). The "org topology" they're managing might be a research pipeline, a coding swarm, a content pipeline — not just training runs.

**Not yet:** Enterprise, non-technical users, mobile-primary users. That's Product B.

---

## North Star Metric

Time from "something is wrong in the swarm" to "human has identified it, acted on it, and confirmed the fix" — this should be under 60 seconds from the dashboard.

---

## What We're Building

### Phase 1 — Legibility (make the observer much better)

This phase requires no architecture changes. It makes what we already have dramatically more useful.

**1.1 Agent health + liveness**
- Each agent shows a live status: `active` / `idle` / `stalled` / `offline`
- Active = committed in last N minutes (configurable, default 5m)
- Stalled = last commit older than threshold but process appears running (detected via leaf age)
- Offline = no commits and no response to health ping
- Status shown as colored indicator in sidebar agent list, DAG nodes, leaderboard, agent page

**1.2 See/hide per agent**
- Toggle visibility of any agent's nodes in the DAG
- Hidden agents are greyed in the agent legend, their nodes disappear from DAG
- Persisted to localStorage per-server

**1.3 Idle detection + alert**
- Configurable idle threshold per agent (default: 10 minutes)
- Visual alert in the topbar when any agent crosses threshold
- Clicking the alert jumps to that agent's last commit

**1.4 Per-agent stats panel**
- Click any agent in the agent list → slide-out panel
- Shows: commit count, best metric, avg commit interval, last active time, current streak (consecutive improvements)
- Sparkline of metric over time

**1.5 Spatial DAG improvements**
- Filter DAG to show only selected agents
- Zoom-to-fit per agent (click agent → DAG zooms to show only that agent's chain)
- Mini-heatmap overlay: node color intensity = metric value (not just agent color)

---

### Phase 2 — Bidirectional Control (lightweight steering)

Bidirectional control via the existing messages layer. No new infrastructure. Agents already poll the messages board — this formalizes that as a control channel.

**2.1 Task commands**
- New message type: `TASK` (vs plain `POST`)
- From the dashboard, send a task to a specific agent: text instruction, priority, optional deadline
- Agent acknowledges by posting a `TASK_ACK` message
- Dashboard shows task as pending → acknowledged → completed (based on subsequent commits)
- This is lightweight — agents need to implement the polling convention, but the server doesn't change

**2.2 Agent interrupt**
- "Pause" button per agent — sends a `PAUSE` command via messages
- "Resume" — sends `RESUME`
- Agent's liveness indicator reflects whether it's honoring the command
- This requires agents to implement the convention — dagboard's job is the UI and the protocol spec

**2.3 Broadcast**
- Send a message to all agents simultaneously (e.g., "switch to eval mode", "checkpoint now")
- Shows delivery/ack status per agent

**2.4 Task history**
- New tab in messages: "Commands" — shows all sent commands, their targets, acknowledgment status, outcome
- Links to the commit that resulted from the command (if traceable)

---

### Phase 3 — Multi-Machine Awareness

Make machines first-class. The assumption of one `serverUrl` breaks down at 2+ machines.

**3.1 Multiple server connections**
- Connection model expands from one config → a list of named connections
- Each connection: name, serverUrl, apiKey, optional adminKey, optional machine label (e.g., "GPU-1", "local", "cloud-a100")
- All connections visible simultaneously in a unified dashboard
- Agents from different servers appear in the same DAG (cross-server DAG merge by agent_id)

**3.2 Machine panel**
- New sidebar section: Machines
- Each machine shows: name, connection status, agent count, last activity
- Click machine → filter DAG and leaderboard to that machine's agents only

**3.3 Cross-machine leaderboard**
- Leaderboard ranks agents across ALL connected machines
- Machine label shown as column
- Sort/filter by machine

**3.4 Connection health**
- Each machine connection shows latency, last successful poll, error count
- Red/yellow/green indicator in sidebar
- Reconnection with exponential backoff, visible in UI

---

### Phase 4 — Org Topology + Forking

This is the farthest horizon. Make agent configurations portable and composable.

**4.1 Workspace export**
- Export the full current workspace config as JSON:
  - All server connections (URLs only, no keys)
  - Agent list with roles (if labeled)
  - Metric config
  - Topology layout (DAG visual positions)
- Import workspace config to reproduce the same setup on a new machine

**4.2 Agent roles + topology labels**
- User can label each agent with a role: `researcher`, `coder`, `evaluator`, `manager`, etc.
- Roles shown in DAG and leaderboard
- Topology view: shows agents grouped by role, with arrows showing coordination relationships (inferred from message patterns)

**4.3 Manager agent display**
- Designate one agent as the "manager agent"
- Manager agent's messages are surfaced prominently at the top of the dashboard
- Manager agent summaries shown inline in the DAG (as annotations on child agent nodes)
- This doesn't require a special agent type — just a convention: the manager posts periodic summaries to the messages board

**4.4 Org templates**
- Save current topology config as a named template
- Templates are JSON files — shareable via GitHub, copy-paste, etc.
- Load template → instantiates the connection structure and agent role assignments
- Community templates: link to a GitHub repo of org topology templates (external, not hosted by us)

---

## What We're NOT Building

These are explicit out-of-scope items for Product A:

- **SSH / process management.** Dagboard does not SSH into machines. It connects to AgentHub servers. Machine-level process control is Product B or user's own infra.
- **Agent runtime.** Dagboard does not run agents. It connects to agents that already exist.
- **Hosted infrastructure.** No cloud hosting, no managed AgentHub servers. Product A is self-hosted only.
- **Auth / billing.** No Clerk, no Stripe. Product A is open source and free.
- **Mobile-first UI.** Desktop browser is the target. Responsive enough to be usable on tablet but not optimized for mobile. Legibility requires screen real estate.
- **Voice control.** Not this version. The legibility demands a rich visual interface first.
- **Agent-to-agent topology enforcement.** Dagboard labels and visualizes topology — it does not enforce it or route messages between agents.
- **Built-in LLM / manager agent.** Dagboard can display a manager agent's output, but it doesn't run one. The user provides the manager agent.

---

## Technical Constraints

**Must not break existing users.** All Phase 1 changes are additive. Existing single-server setups continue to work unchanged.

**No new backend required for Phases 1–2.** AgentHub server API is used as-is. Bidirectional control (Phase 2) uses the existing messages API. No server-side changes needed.

**Phase 3 requires connection model refactor.** The Zustand store's `connection: ConnectionConfig | null` becomes `connections: ConnectionConfig[]`. This is a breaking change to persisted localStorage — needs migration.

**Phase 4 is purely additive.** Export/import is local file I/O. Topology labels are stored in Zustand.

---

## Interface Philosophy

From the brainstorming: just because full legibility makes voice/mobile *possible* doesn't mean it's optimal. The legibility IS the interface. The right pattern is:

**Zoom, then act.** Not "issue a command." See the whole swarm first. Identify the leverage point. Intervene precisely.

This means:
- Spatial, not list-based — DAG canvas remains the hero
- Every agent visible at once — no pagination, no hiding by default
- Actions are confirmable and reversible where possible
- Density controls matter — comfortable for exploration, dense for operational monitoring

---

## Success Metrics

| Metric | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| Time to identify stalled agent | < 10s | < 10s | < 10s |
| Time to send steering command | — | < 30s | < 30s |
| Swarms across multiple machines | 1 | 1 | ≥ 3 |
| Agent count supported in DAG | 20 | 20 | 50 |
| GitHub stars (validation signal) | 500 | 1000 | 2000 |

---

## Phases Summary

| Phase | Theme | Arch change? | Effort |
|---|---|---|---|
| 1 | Legibility | None | Medium |
| 2 | Bidirectional (lightweight) | None | Medium |
| 3 | Multi-machine | Connection model refactor | Large |
| 4 | Org topology + forking | Additive | Large |

---

## Open Questions

1. **Manager agent convention** — should we define a message format spec that a manager agent must follow (e.g., post to a `manager` channel with structured JSON), or keep it flexible (any designated agent's messages get surfaced)?

2. **Phase 2 agent-side convention** — the TASK/PAUSE/RESUME protocol requires agents to implement polling. Should we ship a reference implementation (Python snippet) alongside dagboard, or leave it to the user?

3. **Phase 3 cross-server DAG merge** — if two servers have agents with the same `agent_id`, how do we handle collision? Namespace by machine label?

4. **Phase 4 timing** — Phase 4 is high effort and partially speculative (depends on whether users actually want to fork org configs). Should it wait for signal from Phase 3 adoption?
