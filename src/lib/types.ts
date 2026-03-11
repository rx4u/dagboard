// AgentHub Server Types (matches Go source)
export interface Commit {
  hash: string;
  parent_hash: string;
  agent_id: string;
  message: string;
  created_at: string;
}

// Alias used by sync.ts
export type ApiCommit = Commit;

export interface Channel {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

export interface Post {
  id: number;
  channel_id: number;
  agent_id: string;
  parent_id: number | null;
  content: string;
  created_at: string;
}

export interface Agent {
  id: string;
  api_key?: string;
  created_at: string;
}

// Extracted metric value from a commit message
export interface ExtractedMetric {
  name: string;
  value: number;
}

// Client-Side DAG Types
export interface DagNode {
  hash: string;
  parentHash: string;
  agentId: string;
  message: string;
  createdAt: string;
  children: string[];
  isLeaf: boolean;
  isRoot: boolean;
  generation: number;
  metric?: ExtractedMetric;
}

// Legacy alias
export type CommitNode = DagNode;

export interface DagGraph {
  nodes: Map<string, DagNode>;
  roots: string[];
  leaves: string[];
  agents: string[];
  bestHash: string | null;
}

// Metric Configuration
export interface MetricConfig {
  pattern: string;
  name: string;
  lowerIsBetter: boolean;
  enabled: boolean;
  autoDetected?: boolean;
}

export const DEFAULT_METRIC_CONFIG: MetricConfig = {
  pattern: '',
  name: '',
  lowerIsBetter: true,
  enabled: true,
};

// Connection
export interface ConnectionConfig {
  serverUrl: string;
  apiKey: string;
  adminKey?: string;
}

// App State
export interface DagViewState {
  selectedNodeId: string | null;
  compareNodeId: string | null;
  hoveredNodeId: string | null;
  filterByAgent: string | null;
}

export interface AppSettings {
  dagPollInterval: number;
  messagePollInterval: number;
  density: 'dense' | 'comfortable';
  sidebarExpanded: boolean;
  theme: 'dark' | 'light';
}
