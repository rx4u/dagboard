"use client";

import { useMemo } from "react";
import { Trophy, TrendUp, TrendDown, GitDiff } from "@phosphor-icons/react";
import { useStore } from "@/lib/store";
import { getAgentColor } from "@/lib/agent-colors";
import { shortHash, timeAgo, formatMetric, formatDelta } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface LeaderboardRow {
  hash: string;
  agentId: string;
  metricValue: number;
  delta: number | null;
  timestamp: string;
  rank: number;
  isBest: boolean;
}

export default function LeaderboardPage() {
  const { graph, metricConfig, selectNode, setCompareNode, dag, connection } = useStore();
  const isGitHub = connection?.serverUrl.startsWith('github://') ?? false;
  const router = useRouter();

  const rows = useMemo<LeaderboardRow[]>(() => {
    if (!graph) return [];

    const withMetric = Array.from(graph.nodes.values()).filter(
      (n) => n.metric !== undefined
    );

    if (withMetric.length === 0) return [];

    const sorted = [...withMetric].sort((a, b) => {
      const av = a.metric!.value;
      const bv = b.metric!.value;
      return metricConfig.lowerIsBetter ? av - bv : bv - av;
    });

    const bestValue = sorted[0].metric!.value;

    return sorted.map((n, i) => ({
      hash: n.hash,
      agentId: n.agentId,
      metricValue: n.metric!.value,
      delta: i === 0 ? null : n.metric!.value - bestValue,
      timestamp: n.createdAt,
      rank: i + 1,
      isBest: n.hash === graph.bestHash,
    }));
  }, [graph, metricConfig.lowerIsBetter]);

  const metricName = metricConfig.name || "metric";
  const hasData = graph && graph.nodes.size > 0;

  // Select node in store without navigating away — user can still go to DAG via sidebar
  function handleRowClick(hash: string) {
    selectNode(dag.selectedNodeId === hash ? null : hash);
  }

  function handleCompareClick(e: React.MouseEvent, hash: string) {
    e.stopPropagation();
    setCompareNode(hash);
    router.push("/dashboard/diff");
  }

  if (!hasData) {
    return (
      <div>
        <div className="section-label mb-1.5">Leaderboard</div>
        <div className="divider-fade mb-6" />
        <div className="flex flex-col items-center justify-center py-16">
          <Trophy size={24} className="text-ghost mb-3" />
          <div className="text-[16px] font-medium text-muted mb-1">No experiments ranked</div>
          <div className="text-[13px] text-muted">Experiments appear here once agents push commits</div>
        </div>
      </div>
    );
  }

  // Fallback: commit log sorted by date when no metric data exists
  if (rows.length === 0) {
    const allCommits = graph
      ? Array.from(graph.nodes.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      : [];

    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="section-label">Leaderboard</div>
          <div className="text-[11px] text-ghost">{allCommits.length} commits · no metric data</div>
        </div>
        <div className="divider-fade mb-4" />
        <p className="text-[11px] text-ghost mb-4">
          No metric values found in commit messages. Showing commit log.
          {!isGitHub && !!(graph?.nodes.size) && " Add metric patterns in Settings to enable ranking."}
        </p>
        <div className="border border-border-subtle rounded-[6px] overflow-hidden">
          <div className="grid grid-cols-[72px_1fr_120px_80px] gap-0 px-3 py-2 border-b border-border-subtle bg-surface-1">
            <div className="text-[10px] font-medium uppercase tracking-wider text-ghost">Hash</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-ghost">Message</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-ghost">Agent</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-ghost text-right">Time</div>
          </div>
          {allCommits.slice(0, 200).map((n) => {
            const color = getAgentColor(n.agentId);
            return (
              <div
                key={n.hash}
                onClick={() => handleRowClick(n.hash)}
                className={`grid grid-cols-[72px_1fr_120px_80px] gap-0 px-3 py-2 border-b border-border-subtle last:border-0 cursor-pointer transition-colors ${
                  dag.selectedNodeId === n.hash ? 'bg-surface-2' : 'hover:bg-surface-1'
                }`}
              >
                <span className="text-[11px] font-mono text-ghost">{shortHash(n.hash)}</span>
                <span className="text-[12px] text-secondary truncate pr-4">{n.message.split("\n")[0]}</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[11px] text-ghost truncate">{n.agentId}</span>
                </div>
                <span className="text-[11px] text-ghost text-right">{timeAgo(n.createdAt)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Per-agent summary for the grid at top
  const agentSummary = useMemo(() => {
    if (!graph) return [];
    return graph.agents.map((agentId) => {
      const agentRows = rows.filter((r) => r.agentId === agentId);
      const best = agentRows[0] ?? null; // rows already sorted best-first
      const commitCount = Array.from(graph.nodes.values()).filter((n) => n.agentId === agentId).length;
      return { agentId, best, commitCount };
    }).sort((a, b) => {
      if (!a.best && !b.best) return 0;
      if (!a.best) return 1;
      if (!b.best) return -1;
      return a.best.rank - b.best.rank;
    });
  }, [graph, rows]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="section-label">Leaderboard</div>
        <div className="text-[11px] text-ghost">
          {rows.length} commits · {metricName} · {metricConfig.lowerIsBetter ? "lower is better" : "higher is better"}
        </div>
      </div>
      <div className="divider-fade mb-4" />

      {/* Agent summary grid */}
      {agentSummary.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2 mb-4">
          {agentSummary.map(({ agentId, best, commitCount }) => {
            const color = getAgentColor(agentId);
            return (
              <div key={agentId} className="border border-border-subtle rounded-[6px] p-3 bg-surface-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[12px] text-secondary truncate">{agentId}</span>
                </div>
                {best ? (
                  <div className="text-[22px] font-bold text-primary leading-none tabular-nums mb-1">
                    {formatMetric(best.metricValue)}
                  </div>
                ) : (
                  <div className="text-[22px] font-bold text-ghost leading-none mb-1">--</div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-ghost">{best ? `rank #${best.rank}` : "no metric"}</span>
                  <span className="text-[10px] text-ghost">{commitCount} commits</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="border border-border-subtle rounded-[6px] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[28px_1fr_100px_96px_72px_80px_32px] gap-0 px-3 py-2 border-b border-border-subtle bg-surface-1">
          <div className="text-[10px] font-medium uppercase tracking-wider text-ghost">#</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-ghost">Agent</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-ghost text-right">{metricName}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-ghost text-right">Delta</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-ghost">Hash</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-ghost text-right">Time</div>
          <div />
        </div>

        {/* Rows */}
        {rows.map((row) => {
          const color = getAgentColor(row.agentId);
          const isSelected = dag.selectedNodeId === row.hash;
          const isCompare = dag.compareNodeId === row.hash;

          return (
            <div
              key={row.hash}
              onClick={() => handleRowClick(row.hash)}
              className={`
                grid grid-cols-[28px_1fr_100px_96px_72px_80px_32px] gap-0 px-3 py-2.5
                border-b border-border-subtle last:border-0 cursor-pointer
                transition-colors group relative
                ${isSelected ? "bg-surface-2" : "hover:bg-surface-1"}
                ${row.isBest ? "border-l-2 border-l-improved" : ""}
              `}
            >
              {/* Rank */}
              <div className="flex items-center">
                <span className={`text-[12px] font-medium ${row.rank === 1 ? "text-primary" : "text-ghost"}`}>
                  {row.rank}
                </span>
              </div>

              {/* Agent */}
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[12px] text-secondary truncate">{row.agentId}</span>
                {isCompare && (
                  <span className="text-[10px] text-ghost bg-surface-3 px-1 rounded-[2px] flex-shrink-0">compare</span>
                )}
              </div>

              {/* Metric */}
              <div className="flex items-center justify-end">
                <span className={`text-[12px] font-medium font-mono ${row.isBest ? "text-primary" : "text-secondary"}`}>
                  {formatMetric(row.metricValue)}
                </span>
              </div>

              {/* Delta */}
              <div className="flex items-center justify-end gap-1">
                {row.delta === null ? (
                  <span className="text-[10px] text-ghost">best</span>
                ) : (
                  <>
                    {metricConfig.lowerIsBetter
                      ? (row.delta > 0 ? <TrendDown size={10} className="text-regressed" /> : <TrendUp size={10} className="text-improved" />)
                      : (row.delta < 0 ? <TrendDown size={10} className="text-regressed" /> : <TrendUp size={10} className="text-improved" />)
                    }
                    <span className={`text-[11px] font-mono ${
                      (metricConfig.lowerIsBetter ? row.delta > 0 : row.delta < 0)
                        ? "text-regressed"
                        : "text-improved"
                    }`}>
                      {formatDelta(row.delta)}
                    </span>
                  </>
                )}
              </div>

              {/* Hash */}
              <div className="flex items-center">
                <span className="text-[11px] font-mono text-ghost">{shortHash(row.hash)}</span>
              </div>

              {/* Time */}
              <div className="flex items-center justify-end">
                <span className="text-[11px] text-ghost">{timeAgo(row.timestamp)}</span>
              </div>

              {/* Compare button — always visible */}
              <div className="flex items-center justify-center">
                <button
                  onClick={(e) => handleCompareClick(e, row.hash)}
                  className={`p-1 rounded-[2px] hover:bg-surface-3 transition-all ${
                    dag.compareNodeId === row.hash ? 'text-primary' : 'text-ghost hover:text-muted'
                  }`}
                  title={dag.compareNodeId === row.hash ? 'Compare target (click to open diff)' : 'Set as compare target'}
                >
                  <GitDiff size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
