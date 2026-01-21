// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Tool Types
// Type definitions for the tool system
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tool definition - what a tool is
 */
export interface Tool {
  name: string;
  version: string;
  description: string;
  category?: ToolCategory;
  
  // JSON Schema for input validation
  inputSchema: JsonSchema;
  
  // JSON Schema for output (optional, for documentation)
  outputSchema?: JsonSchema;
  
  // The actual function
  handler: ToolHandler;
  
  // Security
  trustLevel: ToolTrustLevel;
  requiresApproval?: boolean;
  
  // Metadata
  examples?: ToolExample[];
  tags?: string[];
  deprecated?: boolean;
  deprecationMessage?: string;
}

export type ToolCategory = 
  | 'math'
  | 'search'
  | 'file'
  | 'network'
  | 'data'
  | 'system'
  | 'ai'
  | 'utility'
  | 'custom';

export type ToolTrustLevel = 
  | 'safe'        // No side effects, can run freely
  | 'moderate'    // Minor side effects, logged
  | 'sensitive'   // Requires approval for certain agents
  | 'dangerous';  // Always requires approval

/**
 * Tool handler signature
 */
export type ToolHandler = (
  input: unknown,
  context: ToolContext
) => Promise<ToolResult>;

/**
 * Context passed to tool handlers
 */
export interface ToolContext {
  toolName: string;
  callId: string;
  agentId: string;
  executionId?: string;  // Workflow execution ID if in workflow
  timestamp: number;
  
  // For tools that need to emit events
  emit: (type: string, payload: unknown) => void;
  
  // For tools that need to log
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
}

/**
 * Result from tool execution
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    executionTime?: number;
    cached?: boolean;
    [key: string]: unknown;
  };
}

/**
 * Tool call request from LLM
 */
export interface ToolCall {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
  agentId: string;
  timestamp: number;
}

/**
 * Tool execution record (for audit)
 */
export interface ToolExecution {
  callId: string;
  tool: string;
  toolVersion: string;
  agentId: string;
  input: unknown;
  output: ToolResult;
  approved: boolean;
  approvedBy?: string;  // 'supervisor' | 'policy' | agentId
  denialReason?: string;
  startedAt: number;
  completedAt: number;
  duration: number;
}

/**
 * Example for documentation
 */
export interface ToolExample {
  description: string;
  input: Record<string, unknown>;
  output: unknown;
}

/**
 * Simplified JSON Schema (subset we actually use)
 */
export interface JsonSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  items?: JsonSchemaProperty;
  description?: string;
}

export interface JsonSchemaProperty {
  type: string | string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

/**
 * Tool selection for LLM prompts
 */
export interface ToolForLLM {
  name: string;
  description: string;
  parameters: JsonSchema;
}

/**
 * Approval request for gated tools
 */
export interface ToolApprovalRequest {
  callId: string;
  tool: string;
  agentId: string;
  input: unknown;
  reason: string;
  trustLevel: ToolTrustLevel;
  timestamp: number;
}

/**
 * Approval response
 */
export interface ToolApprovalResponse {
  callId: string;
  approved: boolean;
  approvedBy: string;
  reason?: string;
  modifiedInput?: unknown;  // Supervisor can modify input
  timestamp: number;
}
