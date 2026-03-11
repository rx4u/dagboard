export type CheckpointValue = 'none' | 'before_start' | 'after_complete'

export interface AgentConfig {
  id: string
  model: string
}

export interface TaskConfig {
  id: string
  description: string
  channel: string
  checkpoint: CheckpointValue
  depends_on?: string
  timeout_hours?: number
}

export interface ObserverConfig {
  enabled: boolean
  model: string
  interval_minutes: number
  channel: string
}

export interface CheckpointConfig {
  channel: string
  timeout_hours: number
}

export interface StallConfig {
  threshold_minutes: number
}

export interface ConductorConfig {
  dagboard: { url: string; api_key: string }
  agents: AgentConfig[]
  tasks: TaskConfig[]
  observer: ObserverConfig
  checkpoints: CheckpointConfig
  context: { channel: string }
  stall: StallConfig
}

export type TaskStatus = 'pending' | 'checkpoint_waiting' | 'dispatched' | 'complete' | 'rejected'

export interface TaskState {
  id: string
  status: TaskStatus
  dispatched_at?: string
  completed_at?: string
}

export interface SidecarState {
  tasks: Map<string, TaskState>
  pendingCheckpoints: Set<string>
}

export interface Post {
  id: string
  agent_id: string
  content: string
  created_at: string
  channel: string
}
