import type { DagGraph, AgentHealth, AgentHealthStatus } from './types';

export function computeAgentHealth(
  graph: DagGraph,
  idleThresholdMinutes = 15,
  activeThresholdMinutes = 5,
  lowerIsBetter = true,
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

    const sorted = [...agentNodes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latest = sorted[0];
    const minutesSince = Math.round((now - new Date(latest.createdAt).getTime()) / 600) / 100;

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
          if (best === null) return v;
          return lowerIsBetter ? (v < best ? v : best) : (v > best ? v : best);
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
