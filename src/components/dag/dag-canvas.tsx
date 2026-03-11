"use client";

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GitBranch, GitDiff } from '@phosphor-icons/react';
import { useStore } from '@/lib/store';
import { layoutDagGraph } from '@/lib/dag-layout';
import { DagNodeComponent } from './dag-node';
import { getAgentColor } from '@/lib/agent-colors';
import { Skeleton } from '@/components/ui/skeleton';
import type { DagNodeData } from '@/lib/dag-layout';

const nodeTypes = { dagNode: DagNodeComponent };

const CANVAS_STYLE = { height: '360px', minHeight: 280 };

function formatRelTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function DagCanvas({ isLoading }: { isLoading?: boolean }) {
  const { graph, dag, selectNode, setCompareNode, hoverNode, settings } = useStore();
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<DagNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const rfInstance = useRef<ReactFlowInstance<Node<DagNodeData>, Edge> | null>(null);

  const handleInit = useCallback((instance: ReactFlowInstance<Node<DagNodeData>, Edge>) => {
    rfInstance.current = instance;
  }, []);

  // Rebuild layout when graph changes, then animated fitView
  useEffect(() => {
    if (!graph || graph.nodes.size === 0) return;
    const { nodes: newNodes, edges: newEdges } = layoutDagGraph(graph);
    setNodes(
      newNodes.map(n => ({
        ...n,
        data: {
          ...n.data,
          isSelected: n.id === dag.selectedNodeId,
          isCompare: n.id === dag.compareNodeId,
        },
      }))
    );
    setEdges(newEdges);
    // Animated fit after React updates the DOM
    setTimeout(() => {
      rfInstance.current?.fitView({ padding: 0.1, duration: 400 });
    }, 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  // Update selection state without re-layout
  useEffect(() => {
    setNodes(prev =>
      prev.map(n => ({
        ...n,
        data: {
          ...n.data,
          isSelected: n.id === dag.selectedNodeId,
          isCompare: n.id === dag.compareNodeId,
        },
      }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dag.selectedNodeId, dag.compareNodeId]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (e, node) => {
      if (e.shiftKey) {
        setCompareNode(node.id);
      } else {
        selectNode(dag.selectedNodeId === node.id ? null : node.id);
      }
    },
    [dag.selectedNodeId, selectNode, setCompareNode]
  );

  const handleNodeHover: NodeMouseHandler = useCallback(
    (_, node) => hoverNode(node.id),
    [hoverNode]
  );

  const handleMouseLeave = useCallback(() => hoverNode(null), [hoverNode]);

  const hoveredNode = dag.hoveredNodeId ? graph?.nodes.get(dag.hoveredNodeId) : null;
  const selectedNode = dag.selectedNodeId ? graph?.nodes.get(dag.selectedNodeId) : null;

  if (isLoading && !graph) {
    return (
      <div
        className="border border-border-subtle rounded-[6px] bg-surface-1 overflow-hidden animate-fade-in"
        style={CANVAS_STYLE}
      >
        {/* Simulate a few agent chains */}
        <div className="p-6 space-y-5">
          {[6, 9, 4, 7, 5].map((count, row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton className="h-2.5 w-10 rounded-[2px] flex-shrink-0" />
              <div className="flex items-center gap-2">
                {[...Array(count)].map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-5 w-5 rounded-[3px] flex-shrink-0"
                    style={{ animationDelay: `${(row * 60 + i * 25)}ms` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!graph || graph.nodes.size === 0) {
    return (
      <div
        className="relative border border-border-subtle rounded-[6px] bg-surface-1 flex items-center justify-center animate-fade-in"
        style={CANVAS_STYLE}
      >
        {/* Subtle dot-grid background */}
        <div
          className="absolute inset-0 rounded-[6px] opacity-40"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--border-subtle) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative text-center">
          <GitBranch size={28} className="text-ghost mx-auto mb-3 opacity-60" />
          <div className="text-[13px] text-secondary mb-1.5">No experiments yet</div>
          <div className="text-[11px] text-muted leading-relaxed max-w-[220px]">
            Waiting for commits from connected agents.
            <br />
            Run agents on your AgentHub server to start.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-[6px] overflow-hidden border border-border-subtle animate-fade-in"
      style={CANVAS_STYLE}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeHover}
        onNodeMouseLeave={handleMouseLeave}
        onInit={handleInit}
        minZoom={0.05}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--surface-1)' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="var(--border-subtle)"
          gap={24}
          size={1}
        />
        <MiniMap
          position="bottom-right"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-default)',
            borderRadius: 4,
          }}
          nodeColor={n => {
            const d = n.data as DagNodeData;
            return d?.node ? getAgentColor(d.node.agentId) + '99' : '#333';
          }}
          maskColor={settings.theme === 'light' ? 'rgba(249,249,251,0.75)' : 'rgba(9,9,11,0.75)'}
          zoomable
          pannable
        />
      </ReactFlow>

      {/* Hover tooltip */}
      {hoveredNode && (
        <div className="absolute bottom-10 left-2 bg-surface-2 border border-border-default rounded-[4px] px-3 py-1.5 text-[11px] text-secondary pointer-events-none z-10">
          <span className="text-ghost">{hoveredNode.hash.slice(0, 7)}</span>
          {' · '}
          <span>{hoveredNode.agentId}</span>
          {hoveredNode.metric && (
            <>
              {' · '}
              <span className="text-primary">{hoveredNode.metric.value.toFixed(4)}</span>
            </>
          )}
          {' · '}
          <span className="text-ghost">{formatRelTime(hoveredNode.createdAt)}</span>
        </div>
      )}

      {/* Selected node detail */}
      {selectedNode && (
        <div className="absolute top-2 right-2 bg-surface-2 border border-border-default rounded-[4px] p-3 text-[11px] z-10 w-[220px]">
          <div className="flex items-center justify-between mb-2">
            <span className="section-label">COMMIT</span>
            <button
              onClick={() => selectNode(null)}
              className="text-ghost hover:text-muted leading-none"
            >
              ×
            </button>
          </div>
          <div className="space-y-1 text-secondary">
            <div>
              <span className="text-ghost">hash </span>
              <span className="text-primary">{selectedNode.hash.slice(0, 7)}</span>
            </div>
            <div>
              <span className="text-ghost">agent </span>
              <span>{selectedNode.agentId}</span>
            </div>
            {selectedNode.metric && (
              <div>
                <span className="text-ghost">{selectedNode.metric.name} </span>
                <span className="text-primary">{selectedNode.metric.value}</span>
              </div>
            )}
            <div>
              <span className="text-ghost">time </span>
              <span>{formatRelTime(selectedNode.createdAt)}</span>
            </div>
            {selectedNode.message && (
              <div className="mt-2 text-ghost text-[10px] leading-relaxed line-clamp-3 break-all">
                {selectedNode.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Diff CTA — shown when two nodes are selected */}
      {dag.selectedNodeId && dag.compareNodeId && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <button
            onClick={() => router.push('/dashboard/diff')}
            className="flex items-center gap-2 px-3 py-1.5 bg-surface-3 border border-border-default rounded-[6px] text-[12px] text-primary hover:bg-surface-4 transition-colors"
          >
            <GitDiff size={13} />
            View diff
            <span className="text-ghost text-[10px] font-mono">
              {dag.selectedNodeId.slice(0, 7)}…{dag.compareNodeId.slice(0, 7)}
            </span>
          </button>
        </div>
      )}

      {/* Shift+click hint — shown when one node is selected but no compare yet */}
      {dag.selectedNodeId && !dag.compareNodeId && (
        <div className="absolute bottom-2 left-2 text-[10px] text-ghost pointer-events-none z-10">
          shift+click another node to compare
        </div>
      )}
    </div>
  );
}
