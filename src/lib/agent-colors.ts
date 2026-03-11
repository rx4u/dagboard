// Agent Color Assignment
// 8 muted colors. Assigned by order of first appearance.
// Used ONLY on: DAG node fill, tiny dots, edge strokes.

export const AGENT_COLORS = [
  '#818CF8', // indigo
  '#38BDF8', // sky
  '#4ADE80', // green
  '#FB923C', // orange
  '#F472B6', // pink
  '#A78BFA', // violet
  '#2DD4BF', // teal
  '#FBBF24', // amber
] as const;

export type AgentColor = (typeof AGENT_COLORS)[number];

// Maps agent IDs to color indices (0-7), cycling if > 8 agents
const agentColorMap = new Map<string, number>();
let nextColorIndex = 0;

export function getAgentColor(agentId: string): string {
  if (!agentColorMap.has(agentId)) {
    agentColorMap.set(agentId, nextColorIndex % AGENT_COLORS.length);
    nextColorIndex++;
  }
  return AGENT_COLORS[agentColorMap.get(agentId)!];
}

export function getAgentIndex(agentId: string): number {
  if (!agentColorMap.has(agentId)) {
    agentColorMap.set(agentId, nextColorIndex % AGENT_COLORS.length);
    nextColorIndex++;
  }
  return agentColorMap.get(agentId)!;
}

export function resetAgentColors(): void {
  agentColorMap.clear();
  nextColorIndex = 0;
}

// Get all known agents and their colors
export function getAgentColorMap(): Map<string, number> {
  return new Map(agentColorMap);
}
