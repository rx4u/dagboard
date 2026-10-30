# Conductor Layer — Design Document

**Date:** 2026-03-12
**Status:** Design complete, ready for implementation planning

---

## Understanding Summary

- **What:** A CLI + config file tool that orchestrates agenthub agents at scale, sitting above dagboard
- **Why:** Three unsolved pain points — overnight checkpoints, cognitive context paging on return, passive observer suggesting alternative approaches
- **Who:** Solo developer running large multi-agent sessions overnight
- **Key constraints:** agenthub protocol only, dagboard as visualization backend, no new UI surfaces, no hosted service
- **Non-goals:** multi-harness support, active interruptions, automatic approvals, database persistence

---

## Assumptions

- Agents read task instructions from their dagboard message channel
- Agents write a `COMPLETE: <task-id>` marker when done
- dagboard API is available at a known URL with API key
- Observer LLM cost is acceptable (haiku, 15-min intervals)
- No push notifications in v1 — human checks dagboard on return
- Sidecar is always started manually; no auto-start on boot

---

## Architecture

Three runtime components:

### 1. `conductor` CLI binary

Thin entry point distributed as an npm package (`npx conductor`) or standalone binary.

Commands:
- `conductor start` — start sidecar process
- `conductor stop` — gracefully stop sidecar
- `conductor status` — show current task/agent state
- `conductor page` — print context summary to terminal
- `conductor approve <task-id>` — approve a checkpoint
- `conductor reject <task-id>` — reject/skip a task

### 2. Sidecar process

Persistent daemon started by `conductor start`. Runs three concurrent loops:

- **Dispatch loop** — 30s tick, routes pending tasks to agents
- **Checkpoint loop** — 30s tick, watches for approval replies
- **Observer loop** — 15min tick, LLM call over recent activity

All loops communicate exclusively via agenthub REST API. No new server ports. In-memory state only — reconstructed from channel history on restart.

### 3. `conductor.yaml`

Config file at project root. Single source of truth for tasks, agents, and settings.

---

## Config File Schema

```yaml
dagboard:
  url: http://localhost:8080
  api_key: your-api-key

agents:
  - id: agent-alpha
    model: claude-opus-4
  - id: agent-beta
    model: claude-opus-4

tasks:
  - id: task-1
    description: "Implement auth module"
    channel: agent-alpha
    checkpoint: before_start      # none | before_start | after_complete
  - id: task-2
    description: "Write tests for auth module"
    channel: agent-beta
    depends_on: task-1
    checkpoint: none
    timeout_hours: 2              # per-task override

observer:
  enabled: true
  model: claude-haiku-3
  interval_minutes: 15
  channel: conductor-observer

checkpoints:
  channel: conductor-checkpoints
  timeout_hours: 8               # auto-defer after this, never auto-approve

context:
  channel: conductor-log

stall:
  threshold_minutes: 30
```

---

## Dispatch Loop

30-second tick. For each task in order:

1. Skip if already dispatched (in-memory set)
2. Skip if `depends_on` task not marked complete
3. If `checkpoint: before_start` → post to `conductor-checkpoints`, suspend
4. If checkpoint approved (or `none`) → dispatch

**Dispatching** posts a structured message to the agent's channel:

```
TASK: task-1
Implement auth module
---
Conductor dispatched at 2026-03-12T02:14:00Z
```

**Completion detection** watches the agent's channel for `COMPLETE: task-1`. If none arrives within `timeout_hours`, sidecar posts a stall checkpoint.

**Idempotent on restart** — replays last 500 posts per channel to reconstruct state. Will not re-dispatch tasks already marked complete.

---

## Checkpoint Mechanism

### Trigger

Sidecar posts to `conductor-checkpoints`:

```
CHECKPOINT: task-2
---
Agent beta is ready to start "Write tests for auth module"
Depends on: task-1 ✓ complete

Reply with:
  APPROVE: task-2
  REJECT: task-2
  DEFER: task-2 (ask again in 1 hour)
```

### Three response paths

1. **dagboard ComposeBar** — type `APPROVE: task-2` in `conductor-checkpoints` channel
2. **CLI** — `conductor approve task-2` (posts reply programmatically)
3. **Timeout** — after `timeout_hours`, sidecar auto-posts `DEFER: task-2`. Safety default is always pause, never proceed blind.

### Overnight flow

1. Run `conductor start` before sleeping
2. Agents complete tasks overnight
3. Sidecar detects completion, hits checkpoint for next task
4. Posts to `conductor-checkpoints`
5. Morning: open dagboard or run `conductor page`, then `conductor approve task-2`

---

## Observer Agent

LLM call inside the sidecar — not a real agenthub agent.

### Each tick (15 min)

1. Fetch last N posts from all active channels
2. Fetch DAG commit list
3. Build prompt with recent activity + task state
4. Call observer model
5. If suggestion: post to `conductor-observer`. If nothing notable: skip.

### System prompt

```
You are a passive observer watching a multi-agent software development session.
You have read-only access to agent activity. Your job is to surface non-obvious
suggestions: when to fork a sub-agent, when to try a different approach, when
an agent appears stuck in a loop, when an assumption seems wrong.

Only post if you have a concrete, actionable suggestion. If nothing is notable,
respond with exactly: NOTHING
```

### Example output in `conductor-observer`

```
OBSERVER [02:31]:
agent-beta has attempted the same test fix 3 times with minor variations.
Suggest: fork a sub-agent with a different approach, or pause and review
the test assumption in task-2 line 47.
```

Observer is strictly read-only. It never posts to agent channels, never approves checkpoints, never modifies state.

---

## Context Paging

`conductor page` — CLI command, terminal output only.

### Steps

1. Fetch last 200 posts from all active channels (parallel)
2. Fetch task state from `conductor.yaml` + channel history
3. Fetch DAG commit list (last 50)
4. Single LLM call to summarize
5. Print structured output

### Output shape

```
=== CONDUCTOR PAGE — 2026-03-12 09:14 ===

CURRENT STATE
  task-1  ✓ complete  (agent-alpha, 6h ago)
  task-2  ⏸ checkpoint waiting (pending your approval)
  task-3  — not started

WHAT HAPPENED OVERNIGHT
  agent-alpha completed the auth module at 03:22.
  17 commits. Key decisions: used JWT, skipped refresh tokens for now.
  agent-beta hit a test failure on line 47 (mocked DB returning null).
  3 retry attempts. Observer flagged this at 04:15.

OPEN QUESTIONS
  • task-2 checkpoint waiting since 05:01
  • agent-beta test failure unresolved — may need human input

SUGGESTED NEXT ACTION
  Run: conductor approve task-2
  Or open dagboard conductor-checkpoints channel to review first.

=== END PAGE ===
```

Stateless — pulls fresh from API on every call.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Sidecar crash | Restart rebuilds state from channel history (last 500 posts) |
| Agent goes silent | Stall checkpoint posted after `threshold_minutes` |
| dagboard unreachable | Exponential backoff (1s→60s), dispatch pauses after 5 failures |
| Invalid `conductor.yaml` | Validated at startup, sidecar exits with error before any dispatch |
| Circular `depends_on` | Detected at startup, sidecar exits listing the cycle |
| Observer LLM failure | Tick silently skips, logs to `conductor-log`, retries next interval |
| No `COMPLETE` marker | Per-task timeout triggers stall checkpoint |

---

## Decision Log

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| 1 | Sidecar process architecture | Pure CLI (B), Config wrapper + dagboard extension (C) | Overnight monitoring requires persistent process. B fails overnight. C couples the products. |
| 2 | Observer is sidecar LLM call, not a real agent | Real agenthub agent | Real agents consume continuous quota and appear confusingly in DAG. Sidecar call is cheap, controllable, 15-min intervals. |
| 3 | Context paging is CLI + terminal only | dagboard panel | Returning to work is a terminal action. Dagboard is for monitoring running sessions, not onboarding yourself back in. |
| 4 | Checkpoint protocol uses existing messages API | New REST endpoint | No new API surface. Checkpoint channel is just a dagboard channel — visible in dagboard, writeable from CLI. |
| 5 | In-memory state reconstructed from channel history | SQLite / file-based persistence | Keeps sidecar stateless and restartable. Channel history is the source of truth. |
| 6 | agenthub-only protocol | Multi-harness | Unnecessary complexity. agenthub (karpathy/nanochat pattern) is the target. |
| 7 | No push notifications in v1 | Email / SMS / desktop notification | Scope reduction. Human checks dagboard on return. |
