// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Workflow Types
// Type definitions for workflow system
// ═══════════════════════════════════════════════════════════════════════════════

export type NodeType =
  | 'trigger'
  | 'action'
  | 'condition'
  | 'loop'
  | 'parallel'
  | 'delay'
  | 'transform'
  | 'agent'
  | 'subworkflow'
  | 'merge';

export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  plugin?: string;           // Plugin that handles this node
  action?: string;           // Action within the plugin
  config: Record<string, unknown>;
  position?: { x: number; y: number };
  timeout?: number;          // Node timeout in ms
  retries?: number;
  onError?: 'fail' | 'continue' | 'retry' | string;  // string = jump to node
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  condition?: string;        // Expression for conditional edges
  label?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: number;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: Record<string, unknown>;
  triggers?: WorkflowTrigger[];
  metadata?: {
    createdAt: number;
    updatedAt: number;
    createdBy?: string;
    tags?: string[];
  };
}

export interface WorkflowTrigger {
  id: string;
  type: 'event' | 'schedule' | 'webhook' | 'manual';
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: number;
  status: ExecutionStatus;
  startedAt: number;
  completedAt?: number;
  currentNodes: string[];
  data: WorkflowData;
  logs: ExecutionLog[];
  error?: string;
  triggeredBy?: {
    type: string;
    id?: string;
    data?: unknown;
  };
}

export interface WorkflowData {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  nodes: Record<string, NodeOutput>;
  variables: Record<string, unknown>;
}

export interface NodeOutput {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: number;
  completedAt?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
}

export interface ExecutionLog {
  timestamp: number;
  nodeId?: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
}

// Node handler signature
export type NodeHandler = (
  node: WorkflowNode,
  context: NodeContext
) => Promise<NodeResult>;

export interface NodeContext {
  execution: WorkflowExecution;
  input: unknown;
  variables: Record<string, unknown>;
  emit: (type: string, payload: unknown) => void;
  log: (level: ExecutionLog['level'], message: string, data?: unknown) => void;
  getNodeOutput: (nodeId: string) => NodeOutput | undefined;
}

export interface NodeResult {
  output?: unknown;
  next?: string | string[];   // Override next nodes
  error?: string;
}
