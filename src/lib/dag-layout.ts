import Dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { DagGraph, DagNode } from './types';

export type DagNodeData = {
  node: DagNode;
  isBest: boolean;
  isSelected: boolean;
  isCompare: boolean;
};

const NODE_W = 24;
const NODE_H = 24;

// Scale spacing down for large graphs so fitView doesn't make nodes microscopic
function spacingForCount(n: number): { ranksep: number; nodesep: number } {
  if (n > 150) return { ranksep: 14, nodesep: 12 };
  if (n > 80)  return { ranksep: 20, nodesep: 16 };
  if (n > 40)  return { ranksep: 32, nodesep: 24 };
  return             { ranksep: 56, nodesep: 36 };
}

export function layoutDagGraph(graph: DagGraph): { nodes: Node<DagNodeData>[]; edges: Edge[] } {
  const { ranksep, nodesep } = spacingForCount(graph.nodes.size);
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep, ranksep, marginx: 16, marginy: 16 });

  for (const [hash] of graph.nodes) {
    g.setNode(hash, { width: NODE_W, height: NODE_H });
  }

  for (const [, node] of graph.nodes) {
    if (node.parentHash && graph.nodes.has(node.parentHash)) {
      g.setEdge(node.parentHash, node.hash);
    }
  }

  Dagre.layout(g);

  const nodes: Node<DagNodeData>[] = [];
  const edges: Edge[] = [];

  for (const [hash, dagNode] of graph.nodes) {
    const pos = g.node(hash);
    nodes.push({
      id: hash,
      type: 'dagNode',
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      data: {
        node: dagNode,
        isBest: hash === graph.bestHash,
        isSelected: false,
        isCompare: false,
      } satisfies DagNodeData,
      draggable: false,
      selectable: false,
    });
  }

  for (const [, node] of graph.nodes) {
    if (node.parentHash && graph.nodes.has(node.parentHash)) {
      edges.push({
        id: `e-${node.parentHash.slice(0, 7)}-${node.hash.slice(0, 7)}`,
        source: node.parentHash,
        target: node.hash,
        style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 },
        animated: false,
        selectable: false,
      });
    }
  }

  return { nodes, edges };
}
