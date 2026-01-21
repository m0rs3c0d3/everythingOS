// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Tool Registry
// Central registry for all tools
// LLMs select tools, Supervisor gates execution
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../../core/event-bus/EventBus';
import {
  Tool,
  ToolCall,
  ToolResult,
  ToolExecution,
  ToolContext,
  ToolForLLM,
  ToolTrustLevel,
  ToolApprovalRequest,
  ToolApprovalResponse,
  JsonSchema,
} from './ToolTypes';

export interface ToolRegistryConfig {
  requireApprovalForDangerous?: boolean;
  requireApprovalForSensitive?: boolean;
  maxExecutionTime?: number;
  enableAuditLog?: boolean;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private executions: ToolExecution[] = [];
  private pendingApprovals: Map<string, {
    request: ToolApprovalRequest;
    resolve: (response: ToolApprovalResponse) => void;
  }> = new Map();
  private config: Required<ToolRegistryConfig>;
  private agentPermissions: Map<string, Set<string>> = new Map(); // agentId -> allowed tools

  constructor(config: ToolRegistryConfig = {}) {
    this.config = {
      requireApprovalForDangerous: config.requireApprovalForDangerous ?? true,
      requireApprovalForSensitive: config.requireApprovalForSensitive ?? false,
      maxExecutionTime: config.maxExecutionTime ?? 30000,
      enableAuditLog: config.enableAuditLog ?? true,
    };

    this.setupApprovalListener();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Registration
  // ─────────────────────────────────────────────────────────────────────────────

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      const existing = this.tools.get(tool.name)!;
      if (existing.version === tool.version) {
        throw new Error(`Tool already registered: ${tool.name}@${tool.version}`);
      }
      // Allow version upgrade
    }

    this.tools.set(tool.name, tool);
    eventBus.emit('tools:registered', { name: tool.name, version: tool.version });
  }

  unregister(name: string): boolean {
    const existed = this.tools.delete(name);
    if (existed) {
      eventBus.emit('tools:unregistered', { name });
    }
    return existed;
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  listByCategory(category: Tool['category']): Tool[] {
    return this.list().filter(t => t.category === category);
  }

  listByTrustLevel(level: ToolTrustLevel): Tool[] {
    return this.list().filter(t => t.trustLevel === level);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Permissions
  // ─────────────────────────────────────────────────────────────────────────────

  grantPermission(agentId: string, toolName: string): void {
    if (!this.agentPermissions.has(agentId)) {
      this.agentPermissions.set(agentId, new Set());
    }
    this.agentPermissions.get(agentId)!.add(toolName);
    eventBus.emit('tools:permission:granted', { agentId, toolName });
  }

  revokePermission(agentId: string, toolName: string): void {
    this.agentPermissions.get(agentId)?.delete(toolName);
    eventBus.emit('tools:permission:revoked', { agentId, toolName });
  }

  grantAllSafe(agentId: string): void {
    for (const tool of this.tools.values()) {
      if (tool.trustLevel === 'safe') {
        this.grantPermission(agentId, tool.name);
      }
    }
  }

  hasPermission(agentId: string, toolName: string): boolean {
    const tool = this.tools.get(toolName);
    if (!tool) return false;

    // Safe tools are always allowed
    if (tool.trustLevel === 'safe') return true;

    // Check explicit permissions
    return this.agentPermissions.get(agentId)?.has(toolName) ?? false;
  }

  getAgentTools(agentId: string): Tool[] {
    return this.list().filter(t => this.hasPermission(agentId, t.name));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Execution
  // ─────────────────────────────────────────────────────────────────────────────

  async execute(call: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(call.tool);
    
    if (!tool) {
      return { success: false, error: `Tool not found: ${call.tool}` };
    }

    if (tool.deprecated) {
      eventBus.emit('tools:deprecated:called', { 
        tool: call.tool, 
        message: tool.deprecationMessage 
      });
    }

    // Check permission
    if (!this.hasPermission(call.agentId, call.tool)) {
      return { 
        success: false, 
        error: `Agent ${call.agentId} does not have permission to use ${call.tool}` 
      };
    }

    // Validate input
    const validationError = this.validateInput(call.arguments, tool.inputSchema);
    if (validationError) {
      return { success: false, error: `Invalid input: ${validationError}` };
    }

    // Check if approval required
    const needsApproval = this.needsApproval(tool, call.agentId);
    let approved = !needsApproval;
    let approvedBy = 'policy';
    let modifiedInput = call.arguments;

    if (needsApproval) {
      const approval = await this.requestApproval(call, tool);
      approved = approval.approved;
      approvedBy = approval.approvedBy;
      
      if (!approved) {
        this.recordExecution(call, tool, { success: false, error: approval.reason }, false, approval.reason);
        return { success: false, error: `Approval denied: ${approval.reason}` };
      }

      if (approval.modifiedInput) {
        modifiedInput = approval.modifiedInput as Record<string, unknown>;
      }
    }

    // Execute with timeout
    const startTime = Date.now();
    const context = this.createContext(call);

    try {
      const result = await this.executeWithTimeout(
        tool.handler(modifiedInput, context),
        this.config.maxExecutionTime
      );

      result.metadata = {
        ...result.metadata,
        executionTime: Date.now() - startTime,
      };

      this.recordExecution(call, tool, result, true, undefined, approvedBy);
      return result;

    } catch (error) {
      const result: ToolResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { executionTime: Date.now() - startTime },
      };

      this.recordExecution(call, tool, result, approved, undefined, approvedBy);
      return result;
    }
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Tool execution timeout: ${timeout}ms`)), timeout)
      ),
    ]);
  }

  private needsApproval(tool: Tool, agentId: string): boolean {
    if (tool.requiresApproval) return true;
    if (tool.trustLevel === 'dangerous' && this.config.requireApprovalForDangerous) return true;
    if (tool.trustLevel === 'sensitive' && this.config.requireApprovalForSensitive) return true;
    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Approval System
  // ─────────────────────────────────────────────────────────────────────────────

  private setupApprovalListener(): void {
    eventBus.on('tools:approval:response', (event) => {
      const response = event.payload as ToolApprovalResponse;
      const pending = this.pendingApprovals.get(response.callId);
      
      if (pending) {
        pending.resolve(response);
        this.pendingApprovals.delete(response.callId);
      }
    });
  }

  private async requestApproval(call: ToolCall, tool: Tool): Promise<ToolApprovalResponse> {
    const request: ToolApprovalRequest = {
      callId: call.id,
      tool: call.tool,
      agentId: call.agentId,
      input: call.arguments,
      reason: `Tool ${call.tool} requires approval (trust level: ${tool.trustLevel})`,
      trustLevel: tool.trustLevel,
      timestamp: Date.now(),
    };

    eventBus.emit('tools:approval:request', request);

    // Wait for approval with timeout
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingApprovals.delete(call.id);
        resolve({
          callId: call.id,
          approved: false,
          approvedBy: 'timeout',
          reason: 'Approval request timed out',
          timestamp: Date.now(),
        });
      }, 60000); // 1 minute timeout

      this.pendingApprovals.set(call.id, {
        request,
        resolve: (response) => {
          clearTimeout(timeout);
          resolve(response);
        },
      });
    });
  }

  // Manual approval (for Supervisor or human-in-loop)
  approve(callId: string, approvedBy: string, modifiedInput?: unknown): void {
    eventBus.emit('tools:approval:response', {
      callId,
      approved: true,
      approvedBy,
      modifiedInput,
      timestamp: Date.now(),
    } as ToolApprovalResponse);
  }

  deny(callId: string, approvedBy: string, reason: string): void {
    eventBus.emit('tools:approval:response', {
      callId,
      approved: false,
      approvedBy,
      reason,
      timestamp: Date.now(),
    } as ToolApprovalResponse);
  }

  getPendingApprovals(): ToolApprovalRequest[] {
    return Array.from(this.pendingApprovals.values()).map(p => p.request);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────────────────────

  private validateInput(input: unknown, schema: JsonSchema): string | null {
    if (schema.type !== 'object') {
      return 'Tool input must be an object';
    }

    if (typeof input !== 'object' || input === null) {
      return 'Input must be an object';
    }

    const obj = input as Record<string, unknown>;

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in obj)) {
          return `Missing required field: ${field}`;
        }
      }
    }

    // Check property types (basic validation)
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (key in obj) {
          const value = obj[key];
          const expectedType = Array.isArray(prop.type) ? prop.type : [prop.type];
          const actualType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
          
          if (!expectedType.includes(actualType)) {
            return `Field ${key}: expected ${expectedType.join('|')}, got ${actualType}`;
          }

          // Check enum
          if (prop.enum && !prop.enum.includes(value)) {
            return `Field ${key}: value must be one of ${prop.enum.join(', ')}`;
          }
        }
      }
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Context & Audit
  // ─────────────────────────────────────────────────────────────────────────────

  private createContext(call: ToolCall): ToolContext {
    return {
      toolName: call.tool,
      callId: call.id,
      agentId: call.agentId,
      timestamp: call.timestamp,
      emit: (type, payload) => eventBus.emit(`tools:${call.tool}:${type}`, payload),
      log: (level, message) => eventBus.emit('tools:log', {
        callId: call.id,
        tool: call.tool,
        level,
        message,
      }),
    };
  }

  private recordExecution(
    call: ToolCall,
    tool: Tool,
    result: ToolResult,
    approved: boolean,
    denialReason?: string,
    approvedBy?: string
  ): void {
    if (!this.config.enableAuditLog) return;

    const execution: ToolExecution = {
      callId: call.id,
      tool: call.tool,
      toolVersion: tool.version,
      agentId: call.agentId,
      input: call.arguments,
      output: result,
      approved,
      approvedBy,
      denialReason,
      startedAt: call.timestamp,
      completedAt: Date.now(),
      duration: Date.now() - call.timestamp,
    };

    this.executions.push(execution);
    
    // Keep last 1000 executions
    if (this.executions.length > 1000) {
      this.executions = this.executions.slice(-500);
    }

    eventBus.emit('tools:executed', execution);
  }

  getExecutionHistory(filter?: {
    tool?: string;
    agentId?: string;
    since?: number;
    limit?: number;
  }): ToolExecution[] {
    let results = [...this.executions];

    if (filter?.tool) results = results.filter(e => e.tool === filter.tool);
    if (filter?.agentId) results = results.filter(e => e.agentId === filter.agentId);
    if (filter?.since) results = results.filter(e => e.startedAt >= filter.since!);
    if (filter?.limit) results = results.slice(-filter.limit);

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LLM Integration
  // ─────────────────────────────────────────────────────────────────────────────

  getToolsForLLM(agentId: string): ToolForLLM[] {
    return this.getAgentTools(agentId)
      .filter(t => !t.deprecated)
      .map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      }));
  }

  generateToolPrompt(agentId: string): string {
    const tools = this.getToolsForLLM(agentId);
    
    if (tools.length === 0) {
      return 'No tools available.';
    }

    const lines = ['You have access to the following tools:', ''];
    
    for (const tool of tools) {
      lines.push(`## ${tool.name}`);
      lines.push(tool.description);
      lines.push('');
      lines.push('Parameters:');
      lines.push('```json');
      lines.push(JSON.stringify(tool.parameters, null, 2));
      lines.push('```');
      lines.push('');
    }

    lines.push('To use a tool, respond with:');
    lines.push('```json');
    lines.push('{ "tool": "tool_name", "arguments": { ... } }');
    lines.push('```');

    return lines.join('\n');
  }

  // Parse tool call from LLM response
  parseToolCall(response: string, agentId: string): ToolCall | null {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*"tool"[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.tool || typeof parsed.tool !== 'string') return null;

      return {
        id: `tc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        tool: parsed.tool,
        arguments: parsed.arguments || {},
        agentId,
        timestamp: Date.now(),
      };
    } catch {
      return null;
    }
  }
}

// Singleton export
export const toolRegistry = new ToolRegistry();
