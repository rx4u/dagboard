import type { DagGraph, DagNode } from "./types";

const AGENTS = ["agent-alpha", "agent-beta", "agent-gamma"];

function h() {
  return Math.random().toString(16).slice(2, 10);
}

function node(
  hash: string,
  agentId: string,
  parentHash: string,
  val: number,
  minsAgo: number,
  generation: number,
  isLeaf = false,
  isRoot = false
): DagNode {
  return {
    hash,
    parentHash,
    agentId,
    message: `val_bpb: ${val.toFixed(4)} — training step ${generation}`,
    createdAt: new Date(Date.now() - minsAgo * 60_000).toISOString(),
    children: [],
    isLeaf,
    isRoot,
    generation,
    metric: { name: "val_bpb", value: val },
  };
}

export function buildMockGraph(): DagGraph {
  const nodes = new Map<string, DagNode>();

  const rootHash = "a1b2c3d4";
  const root = node(rootHash, AGENTS[0], "", 1.02, 180, 0, false, true);
  nodes.set(rootHash, root);

  const chains: [string, number[]][] = [
    [AGENTS[0], [0.985, 0.962, 0.941, 0.926, 0.914, 0.905]],
    [AGENTS[1], [0.975, 0.948, 0.930, 0.918, 0.907, 0.898]],
    [AGENTS[2], [0.950, 0.925, 0.905, 0.890, 0.878, 0.869]],
  ];

  const leaves: string[] = [];

  chains.forEach(([agentId, vals], ai) => {
    let prev = rootHash;
    vals.forEach((val, i) => {
      const hash = h();
      const isLeaf = i === vals.length - 1;
      const n = node(hash, agentId, prev, val, 150 - ai * 20 - i * 15, i + 1, isLeaf);
      nodes.get(prev)!.children.push(hash);
      nodes.set(hash, n);
      if (isLeaf) leaves.push(hash);
      prev = hash;
    });
  });

  // Best hash = lowest val_bpb (lower is better)
  let bestHash: string | null = null;
  let bestVal = Infinity;
  nodes.forEach((n) => {
    if (n.metric && n.metric.value < bestVal) {
      bestVal = n.metric.value;
      bestHash = n.hash;
    }
  });

  return { nodes, roots: [rootHash], leaves, agents: AGENTS, bestHash };
}

export const DEMO_CONNECTION = {
  serverUrl: "demo://localhost",
  apiKey: "demo-key",
};
