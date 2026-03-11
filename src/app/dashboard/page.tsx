"use client";

import { useState, useEffect } from "react";
import { GitBranch, Robot, Clock, Trophy, Plug, ArrowsClockwise, SquaresFour } from "@phosphor-icons/react";
import { GithubLogo } from "@phosphor-icons/react";
import { useStore } from "@/lib/store";
import { useDagData } from "@/hooks/use-dag-data";
import { DagCanvas } from "@/components/dag/dag-canvas";
import { Skeleton } from "@/components/ui/skeleton";
import { getAgentColor } from "@/lib/agent-colors";
import { shortHash, timeAgo } from "@/lib/utils";

type ViewMode = 'dag' | 'grid';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  delay = 0,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  delay?: number;
}) {
  return (
    <div
      className="border border-border-subtle rounded-[6px] p-3 animate-fade-up bg-surface-1"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-1 mb-2">
        <Icon size={14} className="text-muted" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
          {label}
        </span>
      </div>
      <div className="text-[30px] font-bold text-primary leading-none tabular-nums">{value}</div>
      <div className="text-[11px] text-muted mt-1">{sub}</div>
    </div>
  );
}

function StatCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="border border-border-subtle rounded-[6px] p-3 animate-fade-in bg-surface-1"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-1 mb-2">
        <Skeleton className="h-3 w-3 rounded-[2px]" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <Skeleton className="h-8 w-14 mb-1.5" />
      <Skeleton className="h-2.5 w-20" />
    </div>
  );
}

function WorkspaceBar() {
  const { connection, lastSyncedAt, requestRefresh, removeTab, activeTabId } = useStore();
  if (!connection) return null;

  const url = connection.serverUrl;
  const isGitHub = url.startsWith('github://');
  const isDemo = url.startsWith('demo://');

  let displayName: string;
  if (isDemo) {
    displayName = 'demo';
  } else if (isGitHub) {
    displayName = url.replace('github://', '');
  } else {
    try { displayName = new URL(url).host; } catch { displayName = url; }
  }

  return (
    <div className="flex items-center justify-between animate-fade-up">
      <div className="flex items-center gap-2">
        {isGitHub
          ? <GithubLogo size={13} className="text-ghost" />
          : <Plug size={13} className="text-ghost" />
        }
        <span className="text-[13px] text-secondary font-medium">{displayName}</span>
        {lastSyncedAt ? (
          <span className="text-[11px] text-ghost">· synced {timeAgo(new Date(lastSyncedAt).toISOString())}</span>
        ) : (
          <span className="text-[11px] text-ghost">· not yet synced</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={requestRefresh}
          className="flex items-center gap-1.5 text-[11px] text-ghost hover:text-muted transition-colors"
          title="Refresh data"
        >
          <ArrowsClockwise size={12} />
          Refresh
        </button>
        <button
          onClick={() => activeTabId && removeTab(activeTabId)}
          className="text-[11px] text-ghost hover:text-muted transition-colors"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}

export default function DagPage() {
  const { graph, metricConfig, dag } = useStore();
  const { isLoading, error } = useDagData();
  const [viewMode, setViewMode] = useState<ViewMode>('dag');

  useEffect(() => {
    const check = () => {
      if (window.innerWidth < 768) setViewMode('grid')
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const totalCommits = graph?.nodes.size ?? 0;
  const agentCount = graph?.agents.length ?? 0;
  const activeLeaves = graph?.leaves.length ?? 0;

  const bestNode = graph?.bestHash ? graph.nodes.get(graph.bestHash) : null;
  const bestScore = bestNode?.metric ? bestNode.metric.value.toFixed(4) : '--';
  const metricLabel = metricConfig.name || (metricConfig.pattern ? 'metric' : 'no metric');

  const showSkeleton = isLoading && !graph;

  // Recent commits (last 12, sorted by date)
  const recentCommits = graph
    ? Array.from(graph.nodes.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 12)
    : [];

  // Agent activity — per-agent stats
  const agentActivity = graph
    ? graph.agents.map(agentId => {
        const commits = Array.from(graph.nodes.values()).filter(n => n.agentId === agentId);
        commits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const best = commits
          .filter(c => c.metric)
          .sort((a, b) =>
            metricConfig.lowerIsBetter
              ? a.metric!.value - b.metric!.value
              : b.metric!.value - a.metric!.value
          )[0];
        return {
          agentId,
          count: commits.length,
          lastActive: commits[0]?.createdAt ?? '',
          bestMetric: best?.metric ?? null,
        };
      }).sort((a, b) => b.count - a.count)
    : [];

  return (
    <div className="space-y-4">
      <WorkspaceBar />
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {showSkeleton ? (
          <>
            <StatCardSkeleton delay={0} />
            <StatCardSkeleton delay={50} />
            <StatCardSkeleton delay={100} />
            <StatCardSkeleton delay={150} />
          </>
        ) : (
          <>
            <StatCard
              icon={GitBranch}
              label="Experiments"
              value={totalCommits > 0 ? String(totalCommits) : '--'}
              sub="total commits"
              delay={0}
            />
            <StatCard
              icon={Trophy}
              label="Best Score"
              value={bestScore}
              sub={metricLabel}
              delay={60}
            />
            <StatCard
              icon={Clock}
              label="Active"
              value={activeLeaves > 0 ? String(activeLeaves) : '--'}
              sub="leaf branches"
              delay={120}
            />
            <StatCard
              icon={Robot}
              label="Agents"
              value={agentCount > 0 ? String(agentCount) : '--'}
              sub="unique agents"
              delay={180}
            />
          </>
        )}
      </div>

      {error && (
        <div className="text-[11px] text-[var(--error)] px-1">
          {error instanceof Error ? error.message : 'Failed to load commits'}
        </div>
      )}

      {/* Canvas toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted">Experiment DAG</span>
          {graph && graph.nodes.size > 0 && (
            <span className="text-[10px] text-ghost">
              {totalCommits} commits · {agentCount} agents · {activeLeaves} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {viewMode === 'dag' && graph && graph.nodes.size > 0 && (
            <span className="text-[10px] text-ghost hidden sm:block">
              {dag.selectedNodeId ? 'shift+click to compare' : 'click to select · shift+click to compare'}
            </span>
          )}
          <div className="hidden md:flex gap-0.5 border border-border-subtle rounded-[4px] p-0.5" style={{ background: 'var(--surface-1)' }}>
            {([
              { mode: 'dag' as ViewMode, Icon: GitBranch, label: 'DAG' },
              { mode: 'grid' as ViewMode, Icon: SquaresFour, label: 'Grid' },
            ]).map(({ mode, Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] text-[11px] transition-colors"
                style={viewMode === mode
                  ? { background: 'var(--surface-3)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }
                  : { color: 'var(--text-ghost)' }
                }
                title={label}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Agent legend */}
      {graph && graph.agents.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap -mt-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-ghost">Agents</span>
          {graph.agents.map(agentId => {
            const color = getAgentColor(agentId);
            return (
              <div key={agentId} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[11px] text-ghost">{agentId}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* DAG canvas or Grid view */}
      {viewMode === 'dag' ? (
        <DagCanvas isLoading={isLoading} />
      ) : (
        <div
          className="border border-border-subtle rounded-[6px] overflow-hidden animate-fade-in"
          style={{ minHeight: 280 }}
        >
          {!graph || graph.nodes.size === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-[13px] text-ghost">No commits yet</div>
            </div>
          ) : (
            <div className="p-3 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
              {Array.from(graph.nodes.values())
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map(commit => {
                  const color = getAgentColor(commit.agentId);
                  const isSelected = dag.selectedNodeId === commit.hash;
                  return (
                    <div
                      key={commit.hash}
                      className="border border-border-subtle rounded-[4px] p-2.5 bg-surface-1 hover:bg-surface-2 transition-colors cursor-pointer"
                      style={isSelected ? { borderColor: 'var(--border-default)', background: 'var(--surface-2)' } : {}}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-[10px] text-ghost truncate flex-1">{commit.agentId}</span>
                        <span className="text-[10px] font-mono text-ghost flex-shrink-0">{shortHash(commit.hash)}</span>
                      </div>
                      <div className="text-[11px] text-secondary line-clamp-2 mb-1.5 leading-relaxed">
                        {commit.message.split('\n')[0]}
                      </div>
                      <div className="flex items-center justify-between">
                        {commit.metric ? (
                          <span className="text-[11px] font-mono text-primary">{commit.metric.value.toFixed(4)}</span>
                        ) : (
                          <span />
                        )}
                        <span className="text-[10px] text-ghost">{timeAgo(commit.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Bottom widgets — only shown when there is data */}
      {graph && graph.nodes.size > 0 && (
        <div className="grid grid-cols-[1fr_280px] gap-3">

          {/* Recent Commits */}
          <div className="border border-border-subtle rounded-[6px] overflow-hidden bg-surface-1 animate-fade-up" style={{ animationDelay: '60ms' }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted">Recent Commits</span>
              <span className="text-[10px] text-ghost">{Math.min(recentCommits.length, 12)} of {totalCommits}</span>
            </div>
            {showSkeleton ? (
              <div className="p-3 space-y-2">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-5 w-full rounded-[2px]" />)}
              </div>
            ) : (
              <div>
                {recentCommits.map(commit => {
                  const color = getAgentColor(commit.agentId);
                  return (
                    <div
                      key={commit.hash}
                      className="flex items-center gap-3 px-3 py-2 border-b border-border-subtle last:border-0 hover:bg-surface-2 transition-colors"
                    >
                      <span className="text-[11px] font-mono text-ghost flex-shrink-0 w-[56px]">
                        {shortHash(commit.hash)}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0 w-[120px] min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-[11px] text-ghost truncate">{commit.agentId}</span>
                      </div>
                      <span className="text-[12px] text-secondary truncate flex-1">
                        {commit.message.split('\n')[0]}
                      </span>
                      {commit.metric && (
                        <span className="text-[11px] font-mono text-primary flex-shrink-0">
                          {commit.metric.value.toFixed(4)}
                        </span>
                      )}
                      <span className="text-[11px] text-ghost flex-shrink-0 w-[52px] text-right">
                        {timeAgo(commit.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Agent Activity */}
          <div className="border border-border-subtle rounded-[6px] overflow-hidden bg-surface-1 animate-fade-up" style={{ animationDelay: '90ms' }}>
            <div className="px-3 py-2 border-b border-border-subtle">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted">Agent Activity</span>
            </div>
            {agentActivity.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-ghost">No agents yet</div>
            ) : (
              <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
                {agentActivity.map(a => {
                  const color = getAgentColor(a.agentId);
                  return (
                    <div key={a.agentId} className="px-3 py-2.5 border-b border-border-subtle last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-[12px] text-secondary truncate flex-1">{a.agentId}</span>
                        <span className="text-[11px] font-mono text-ghost">{a.count}</span>
                      </div>
                      <div className="flex items-center justify-between pl-3.5">
                        {a.bestMetric ? (
                          <span className="text-[11px] font-mono text-primary">
                            best: {a.bestMetric.value.toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-ghost">no metric</span>
                        )}
                        <span className="text-[11px] text-ghost">{timeAgo(a.lastActive)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
