import type { ApiCommit, DagNode, DagGraph, MetricConfig } from './types';
import { extractMetric, findBest } from './metrics';

// Build the full DAG graph from a flat list of API commits
export function buildDagGraph(
  commits: ApiCommit[],
  metricConfig: MetricConfig | null,
): DagGraph {
  const nodes = new Map<string, DagNode>();
  const agentOrder: string[] = [];
  const agentSet = new Set<string>();

  // First pass: create all nodes
  for (const c of commits) {
    if (!agentSet.has(c.agent_id) && c.agent_id) {
      agentSet.add(c.agent_id);
      agentOrder.push(c.agent_id);
    }

    const metric = metricConfig ? extractMetric(c.message, metricConfig) : undefined;

    nodes.set(c.hash, {
      hash: c.hash,
      parentHash: c.parent_hash || '',
      agentId: c.agent_id,
      message: c.message,
      createdAt: c.created_at,
      children: [],
      isLeaf: true,    // will be updated
      isRoot: !c.parent_hash,
      generation: 0,   // will be computed
      metric,
    });
  }

  // Second pass: build children lists and mark non-leaves
  for (const node of nodes.values()) {
    if (node.parentHash && nodes.has(node.parentHash)) {
      const parent = nodes.get(node.parentHash)!;
      parent.children.push(node.hash);
      parent.isLeaf = false;
    }
  }

  // Third pass: compute generation depth (BFS from roots)
  const roots: string[] = [];
  for (const node of nodes.values()) {
    if (node.isRoot) {
      roots.push(node.hash);
      node.generation = 0;
    }
  }

  const queue = [...roots];
  while (queue.length > 0) {
    const hash = queue.shift()!;
    const node = nodes.get(hash)!;
    for (const childHash of node.children) {
      const child = nodes.get(childHash)!;
      child.generation = Math.max(child.generation, node.generation + 1);
      queue.push(childHash);
    }
  }

  // Find leaves and best score
  const leaves: string[] = [];
  const metricsForBest: { hash: string; value: number }[] = [];

  for (const node of nodes.values()) {
    if (node.isLeaf) leaves.push(node.hash);
    if (node.metric) {
      metricsForBest.push({ hash: node.hash, value: node.metric.value });
    }
  }

  const bestHash = metricConfig
    ? findBest(metricsForBest, metricConfig.lowerIsBetter)
    : null;

  return { nodes, roots, leaves, agents: agentOrder, bestHash };
}

// Merge new commits into an existing graph (for incremental updates)
export function mergeNewCommits(
  existing: DagGraph,
  newCommits: ApiCommit[],
  metricConfig: MetricConfig | null,
): DagGraph {
  // Combine all commits: existing node data + new commits
  const allCommits: ApiCommit[] = [];

  for (const node of existing.nodes.values()) {
    allCommits.push({
      hash: node.hash,
      parent_hash: node.parentHash,
      agent_id: node.agentId,
      message: node.message,
      created_at: node.createdAt,
    });
  }

  // Add only truly new commits
  for (const c of newCommits) {
    if (!existing.nodes.has(c.hash)) {
      allCommits.push(c);
    }
  }

  // Rebuild the full graph (simple and correct, cheap at <10k commits)
  return buildDagGraph(allCommits, metricConfig);
}

// Compare two leaf sets and return new leaf hashes
export function findNewLeaves(
  knownLeafHashes: Set<string>,
  currentLeaves: ApiCommit[],
): string[] {
  return currentLeaves
    .map(l => l.hash)
    .filter(h => !knownLeafHashes.has(h));
}
