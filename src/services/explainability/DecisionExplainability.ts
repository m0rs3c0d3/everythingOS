// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Decision Explainability
// Audit trail for all agent decisions
// "Why did the agent do X?" - answered.
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../../core/event-bus/EventBus';
import { Intent, IntentResult } from '../../runtime/IntentContract';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DecisionRecord {
  id: string;
  
  // What triggered the decision
  trigger: {
    type: 'event' | 'tick' | 'request' | 'workflow';
    source: string;
    data?: unknown;
  };
  
  // The decision itself
  decision: {
    intentId: string;
    type: string;
    action: string;
    target?: string;
    payload: unknown;
  };
  
  // Why this decision was made
  rationale: {
    reasoning: string;
    confidence: number;
    alternatives?: Array<{
      action: string;
      reason: string;
      confidenceIfChosen?: number;
    }>;
    factors?: string[];       // Key factors that influenced decision
  };
  
  // Context at decision time
  context: {
    agentId: string;
    agentState?: Record<string, unknown>;
    conversationId?: string;
    workflowExecutionId?: string;
    relevantMemories?: string[];
  };
  
  // What happened
  outcome: {
    status: 'pending' | 'approved' | 'denied' | 'completed' | 'failed';
    result?: unknown;
    error?: string;
    sideEffects?: string[];
  };
  
  // Approval info if applicable
  approval?: {
    required: boolean;
    approved?: boolean;
    approvedBy?: string;
    approvalReason?: string;
  };
  
  // Timestamps
  timestamps: {
    decided: number;
    approved?: number;
    executed?: number;
    completed?: number;
  };
}

export interface DecisionQuery {
  agentId?: string;
  intentType?: string;
  action?: string;
  status?: DecisionRecord['outcome']['status'];
  since?: number;
  until?: number;
  minConfidence?: number;
  maxConfidence?: number;
  limit?: number;
  offset?: number;
}

export interface DecisionStats {
  total: number;
  byAgent: Record<string, number>;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  avgConfidence: number;
  approvalRate: number;
  successRate: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Decision Explainability Service
// ─────────────────────────────────────────────────────────────────────────────

export class DecisionExplainability {
  private records: Map<string, DecisionRecord> = new Map();
  private maxRecords: number;

  constructor(config?: { maxRecords?: number }) {
    this.maxRecords = config?.maxRecords ?? 10000;
    this.setupListeners();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Listeners
  // ─────────────────────────────────────────────────────────────────────────

  private setupListeners(): void {
    // Capture intent submissions
    eventBus.on('intent:submitted', (event) => {
      const { intent } = event.payload as { intent: Intent };
      this.recordDecision(intent);
    });

    // Capture approvals
    eventBus.on('intent:approved', (event) => {
      const { intentId, approvedBy } = event.payload as { intentId: string; approvedBy: string };
      this.updateApproval(intentId, true, approvedBy);
    });

    eventBus.on('intent:denied', (event) => {
      const { intentId, deniedBy, reason } = event.payload as { intentId: string; deniedBy: string; reason: string };
      this.updateApproval(intentId, false, deniedBy, reason);
    });

    // Capture completions
    eventBus.on('intent:completed', (event) => {
      const { intentId, result } = event.payload as { intentId: string; result: IntentResult };
      this.updateOutcome(intentId, result);
    });

    // Capture tool executions for linking
    eventBus.on('tools:executed', (event) => {
      const execution = event.payload as {
        callId: string;
        tool: string;
        agentId: string;
        output: { success: boolean; error?: string };
      };
      this.linkToolExecution(execution);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Recording
  // ─────────────────────────────────────────────────────────────────────────

  private recordDecision(intent: Intent): void {
    const record: DecisionRecord = {
      id: intent.id,
      
      trigger: {
        type: intent.workflowExecutionId ? 'workflow' : 'event',
        source: intent.agentId,
      },
      
      decision: {
        intentId: intent.id,
        type: intent.type,
        action: intent.action,
        target: intent.target,
        payload: intent.payload,
      },
      
      rationale: {
        reasoning: intent.reasoning,
        confidence: intent.confidence,
        alternatives: intent.alternatives?.map(alt => ({
          action: alt.action,
          reason: alt.reasoning,
          confidenceIfChosen: alt.confidence,
        })),
      },
      
      context: {
        agentId: intent.agentId,
        conversationId: intent.conversationId,
        workflowExecutionId: intent.workflowExecutionId,
      },
      
      outcome: {
        status: 'pending',
      },
      
      approval: intent.requiresApproval ? {
        required: true,
      } : undefined,
      
      timestamps: {
        decided: intent.createdAt,
      },
    };

    this.records.set(intent.id, record);
    this.enforceLimit();
    
    eventBus.emit('decision:recorded', { id: intent.id });
  }

  private updateApproval(intentId: string, approved: boolean, by: string, reason?: string): void {
    const record = this.records.get(intentId);
    if (!record) return;

    record.approval = {
      required: true,
      approved,
      approvedBy: by,
      approvalReason: reason,
    };
    
    record.outcome.status = approved ? 'approved' : 'denied';
    record.timestamps.approved = Date.now();

    if (!approved && reason) {
      record.outcome.error = reason;
    }
  }

  private updateOutcome(intentId: string, result: IntentResult): void {
    const record = this.records.get(intentId);
    if (!record) return;

    record.outcome = {
      status: result.status === 'completed' ? 'completed' : 
              result.status === 'failed' ? 'failed' : record.outcome.status,
      result: result.output,
      error: result.error,
      sideEffects: result.sideEffects,
    };

    record.timestamps.completed = Date.now();
    if (result.startedAt) {
      record.timestamps.executed = result.startedAt;
    }
  }

  private linkToolExecution(execution: { callId: string; tool: string; agentId: string; output: { success: boolean } }): void {
    // Find recent decisions from same agent that might have triggered this
    for (const record of this.records.values()) {
      if (record.context.agentId === execution.agentId && 
          record.outcome.status === 'pending' &&
          Date.now() - record.timestamps.decided < 60000) {
        
        if (!record.outcome.sideEffects) {
          record.outcome.sideEffects = [];
        }
        record.outcome.sideEffects.push(`tool:${execution.tool}:${execution.output.success ? 'success' : 'failed'}`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Manual Recording (for non-intent decisions)
  // ─────────────────────────────────────────────────────────────────────────

  record(record: Omit<DecisionRecord, 'id' | 'timestamps'> & { id?: string }): string {
    const id = record.id ?? `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    
    const fullRecord: DecisionRecord = {
      ...record,
      id,
      timestamps: {
        decided: Date.now(),
      },
    };

    this.records.set(id, fullRecord);
    this.enforceLimit();
    
    return id;
  }

  addContext(id: string, context: Partial<DecisionRecord['context']>): void {
    const record = this.records.get(id);
    if (record) {
      record.context = { ...record.context, ...context };
    }
  }

  addFactors(id: string, factors: string[]): void {
    const record = this.records.get(id);
    if (record) {
      record.rationale.factors = [...(record.rationale.factors ?? []), ...factors];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Query
  // ─────────────────────────────────────────────────────────────────────────

  get(id: string): DecisionRecord | undefined {
    return this.records.get(id);
  }

  query(q: DecisionQuery): DecisionRecord[] {
    let results = Array.from(this.records.values());

    if (q.agentId) {
      results = results.filter(r => r.context.agentId === q.agentId);
    }
    if (q.intentType) {
      results = results.filter(r => r.decision.type === q.intentType);
    }
    if (q.action) {
      results = results.filter(r => r.decision.action === q.action);
    }
    if (q.status) {
      results = results.filter(r => r.outcome.status === q.status);
    }
    if (q.since) {
      results = results.filter(r => r.timestamps.decided >= q.since!);
    }
    if (q.until) {
      results = results.filter(r => r.timestamps.decided <= q.until!);
    }
    if (q.minConfidence !== undefined) {
      results = results.filter(r => r.rationale.confidence >= q.minConfidence!);
    }
    if (q.maxConfidence !== undefined) {
      results = results.filter(r => r.rationale.confidence <= q.maxConfidence!);
    }

    // Sort by decided timestamp descending (most recent first)
    results.sort((a, b) => b.timestamps.decided - a.timestamps.decided);

    if (q.offset) {
      results = results.slice(q.offset);
    }
    if (q.limit) {
      results = results.slice(0, q.limit);
    }

    return results;
  }

  getByAgent(agentId: string, limit = 100): DecisionRecord[] {
    return this.query({ agentId, limit });
  }

  getRecent(limit = 50): DecisionRecord[] {
    return this.query({ limit });
  }

  getFailed(limit = 50): DecisionRecord[] {
    return this.query({ status: 'failed', limit });
  }

  getLowConfidence(threshold = 0.5, limit = 50): DecisionRecord[] {
    return this.query({ maxConfidence: threshold, limit });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Explain
  // ─────────────────────────────────────────────────────────────────────────

  explain(id: string): string | null {
    const record = this.records.get(id);
    if (!record) return null;

    const lines: string[] = [
      `# Decision: ${record.decision.type}:${record.decision.action}`,
      ``,
      `## Summary`,
      `- Agent: ${record.context.agentId}`,
      `- Confidence: ${(record.rationale.confidence * 100).toFixed(0)}%`,
      `- Status: ${record.outcome.status}`,
      `- Time: ${new Date(record.timestamps.decided).toISOString()}`,
      ``,
      `## Reasoning`,
      record.rationale.reasoning,
      ``,
    ];

    if (record.rationale.factors?.length) {
      lines.push(`## Key Factors`);
      for (const factor of record.rationale.factors) {
        lines.push(`- ${factor}`);
      }
      lines.push(``);
    }

    if (record.rationale.alternatives?.length) {
      lines.push(`## Alternatives Considered`);
      for (const alt of record.rationale.alternatives) {
        lines.push(`- ${alt.action}: ${alt.reason}`);
      }
      lines.push(``);
    }

    if (record.approval?.required) {
      lines.push(`## Approval`);
      lines.push(`- Required: Yes`);
      lines.push(`- Approved: ${record.approval.approved ? 'Yes' : 'No'}`);
      if (record.approval.approvedBy) {
        lines.push(`- By: ${record.approval.approvedBy}`);
      }
      if (record.approval.approvalReason) {
        lines.push(`- Reason: ${record.approval.approvalReason}`);
      }
      lines.push(``);
    }

    lines.push(`## Outcome`);
    lines.push(`- Status: ${record.outcome.status}`);
    if (record.outcome.error) {
      lines.push(`- Error: ${record.outcome.error}`);
    }
    if (record.outcome.sideEffects?.length) {
      lines.push(`- Side Effects:`);
      for (const effect of record.outcome.sideEffects) {
        lines.push(`  - ${effect}`);
      }
    }

    return lines.join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stats
  // ─────────────────────────────────────────────────────────────────────────

  stats(): DecisionStats {
    const records = Array.from(this.records.values());
    
    const byAgent: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalConfidence = 0;
    let approvalRequired = 0;
    let approved = 0;
    let completed = 0;
    let successful = 0;

    for (const r of records) {
      byAgent[r.context.agentId] = (byAgent[r.context.agentId] || 0) + 1;
      byStatus[r.outcome.status] = (byStatus[r.outcome.status] || 0) + 1;
      byType[r.decision.type] = (byType[r.decision.type] || 0) + 1;
      totalConfidence += r.rationale.confidence;

      if (r.approval?.required) {
        approvalRequired++;
        if (r.approval.approved) approved++;
      }
      if (r.outcome.status === 'completed' || r.outcome.status === 'failed') {
        completed++;
        if (r.outcome.status === 'completed') successful++;
      }
    }

    return {
      total: records.length,
      byAgent,
      byStatus,
      byType,
      avgConfidence: records.length > 0 ? totalConfidence / records.length : 0,
      approvalRate: approvalRequired > 0 ? approved / approvalRequired : 1,
      successRate: completed > 0 ? successful / completed : 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Maintenance
  // ─────────────────────────────────────────────────────────────────────────

  private enforceLimit(): void {
    if (this.records.size <= this.maxRecords) return;

    // Remove oldest records
    const sorted = Array.from(this.records.entries())
      .sort((a, b) => a[1].timestamps.decided - b[1].timestamps.decided);

    const toRemove = sorted.slice(0, this.records.size - this.maxRecords);
    for (const [id] of toRemove) {
      this.records.delete(id);
    }
  }

  clear(): void {
    this.records.clear();
  }

  export(): DecisionRecord[] {
    return Array.from(this.records.values());
  }

  import(records: DecisionRecord[]): void {
    for (const record of records) {
      this.records.set(record.id, record);
    }
    this.enforceLimit();
  }
}

// Singleton export
export const decisionExplainability = new DecisionExplainability();
