// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Intent Contract
// Structured outputs from decision agents
// Agents emit intents, execution layer handles them
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../core/event-bus/EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// Intent Types
// ─────────────────────────────────────────────────────────────────────────────

export type IntentType =
  | 'communicate'    // Send a message somewhere
  | 'execute'        // Run a tool or action
  | 'query'          // Request information
  | 'store'          // Save something to memory
  | 'schedule'       // Schedule future action
  | 'delegate'       // Hand off to another agent
  | 'escalate'       // Escalate to human
  | 'wait'           // Wait for condition
  | 'cancel'         // Cancel previous intent
  | 'compound';      // Multiple intents

export type IntentStatus =
  | 'pending'        // Not yet processed
  | 'approved'       // Approved, awaiting execution
  | 'executing'      // Currently running
  | 'completed'      // Successfully done
  | 'failed'         // Execution failed
  | 'denied'         // Approval denied
  | 'cancelled';     // Cancelled before completion

export type IntentPriority = 'critical' | 'high' | 'normal' | 'low';

/**
 * Intent - A structured decision from an agent
 */
export interface Intent<T = unknown> {
  id: string;
  type: IntentType;
  
  // What to do
  action: string;
  target?: string;           // Plugin, agent, or system
  payload: T;
  
  // Decision metadata
  confidence: number;        // 0-1, how confident the agent is
  reasoning: string;         // Why this decision was made
  alternatives?: Intent[];   // Other options considered
  
  // Context
  agentId: string;
  conversationId?: string;
  workflowExecutionId?: string;
  correlationId?: string;    // Links related intents
  parentIntentId?: string;   // For compound intents
  
  // Execution control
  priority: IntentPriority;
  requiresApproval?: boolean;
  timeout?: number;          // Max time for execution
  retryPolicy?: RetryPolicy;
  
  // Constraints
  constraints?: IntentConstraint[];
  
  // Timestamps
  createdAt: number;
  expiresAt?: number;        // Intent expires if not executed
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier?: number;
}

export interface IntentConstraint {
  type: 'requires' | 'excludes' | 'before' | 'after' | 'condition';
  value: string;             // Tool name, intent ID, or condition expression
}

/**
 * Intent result - What happened when intent was executed
 */
export interface IntentResult {
  intentId: string;
  status: IntentStatus;
  output?: unknown;
  error?: string;
  executedBy?: string;       // Plugin/tool that handled it
  attempts?: number;
  startedAt?: number;
  completedAt?: number;
  sideEffects?: string[];    // What changed
}

/**
 * Intent record - Full audit trail
 */
export interface IntentRecord {
  intent: Intent;
  result?: IntentResult;
  approval?: {
    required: boolean;
    approved?: boolean;
    approvedBy?: string;
    reason?: string;
    timestamp?: number;
  };
  history: IntentHistoryEntry[];
}

export interface IntentHistoryEntry {
  timestamp: number;
  status: IntentStatus;
  message: string;
  data?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent Builder
// ─────────────────────────────────────────────────────────────────────────────

export class IntentBuilder<T = unknown> {
  private intent: Partial<Intent<T>> = {
    priority: 'normal',
    confidence: 0.5,
    createdAt: Date.now(),
  };

  constructor(type: IntentType, action: string) {
    this.intent.id = `int_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    this.intent.type = type;
    this.intent.action = action;
  }

  target(target: string): this {
    this.intent.target = target;
    return this;
  }

  payload(payload: T): this {
    this.intent.payload = payload;
    return this;
  }

  confidence(value: number): this {
    this.intent.confidence = Math.max(0, Math.min(1, value));
    return this;
  }

  reasoning(text: string): this {
    this.intent.reasoning = text;
    return this;
  }

  priority(priority: IntentPriority): this {
    this.intent.priority = priority;
    return this;
  }

  from(agentId: string): this {
    this.intent.agentId = agentId;
    return this;
  }

  conversation(id: string): this {
    this.intent.conversationId = id;
    return this;
  }

  workflow(id: string): this {
    this.intent.workflowExecutionId = id;
    return this;
  }

  correlate(id: string): this {
    this.intent.correlationId = id;
    return this;
  }

  requireApproval(): this {
    this.intent.requiresApproval = true;
    return this;
  }

  timeout(ms: number): this {
    this.intent.timeout = ms;
    return this;
  }

  expireIn(ms: number): this {
    this.intent.expiresAt = Date.now() + ms;
    return this;
  }

  retry(maxAttempts: number, backoffMs = 1000): this {
    this.intent.retryPolicy = { maxAttempts, backoffMs };
    return this;
  }

  constraint(type: IntentConstraint['type'], value: string): this {
    if (!this.intent.constraints) this.intent.constraints = [];
    this.intent.constraints.push({ type, value });
    return this;
  }

  alternative(intent: Intent): this {
    if (!this.intent.alternatives) this.intent.alternatives = [];
    this.intent.alternatives.push(intent);
    return this;
  }

  build(): Intent<T> {
    if (!this.intent.agentId) throw new Error('Intent requires agentId');
    if (!this.intent.reasoning) this.intent.reasoning = 'No reasoning provided';
    if (!this.intent.payload) this.intent.payload = {} as T;
    
    return this.intent as Intent<T>;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent Manager
// ─────────────────────────────────────────────────────────────────────────────

export class IntentManager {
  private records: Map<string, IntentRecord> = new Map();
  private handlers: Map<string, IntentHandler> = new Map();

  constructor() {
    this.setupEventListeners();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Handler Registration
  // ─────────────────────────────────────────────────────────────────────────

  registerHandler(intentType: IntentType, action: string, handler: IntentHandler): void {
    const key = `${intentType}:${action}`;
    this.handlers.set(key, handler);
  }

  registerDefaultHandler(intentType: IntentType, handler: IntentHandler): void {
    this.handlers.set(`${intentType}:*`, handler);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Intent Submission
  // ─────────────────────────────────────────────────────────────────────────

  submit(intent: Intent): string {
    // Validate
    this.validate(intent);

    // Create record
    const record: IntentRecord = {
      intent,
      history: [{
        timestamp: Date.now(),
        status: 'pending',
        message: 'Intent submitted',
      }],
    };

    this.records.set(intent.id, record);
    
    // Emit for processing
    eventBus.emit('intent:submitted', { intent });
    
    return intent.id;
  }

  private validate(intent: Intent): void {
    if (!intent.id) throw new Error('Intent missing id');
    if (!intent.type) throw new Error('Intent missing type');
    if (!intent.action) throw new Error('Intent missing action');
    if (!intent.agentId) throw new Error('Intent missing agentId');
    if (intent.confidence < 0 || intent.confidence > 1) {
      throw new Error('Intent confidence must be 0-1');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Intent Processing
  // ─────────────────────────────────────────────────────────────────────────

  private setupEventListeners(): void {
    eventBus.on('intent:submitted', async (event) => {
      const { intent } = event.payload as { intent: Intent };
      await this.process(intent);
    });

    eventBus.on('intent:approved', async (event) => {
      const { intentId, approvedBy } = event.payload as { intentId: string; approvedBy: string };
      const record = this.records.get(intentId);
      if (record && record.approval?.required) {
        record.approval.approved = true;
        record.approval.approvedBy = approvedBy;
        record.approval.timestamp = Date.now();
        this.addHistory(intentId, 'approved', `Approved by ${approvedBy}`);
        await this.execute(record.intent);
      }
    });

    eventBus.on('intent:denied', async (event) => {
      const { intentId, reason, deniedBy } = event.payload as { intentId: string; reason: string; deniedBy: string };
      const record = this.records.get(intentId);
      if (record) {
        record.approval = { required: true, approved: false, approvedBy: deniedBy, reason };
        record.result = { intentId, status: 'denied', error: reason };
        this.addHistory(intentId, 'denied', `Denied: ${reason}`);
        eventBus.emit('intent:completed', { intentId, result: record.result });
      }
    });
  }

  private async process(intent: Intent): Promise<void> {
    const record = this.records.get(intent.id);
    if (!record) return;

    // Check expiration
    if (intent.expiresAt && Date.now() > intent.expiresAt) {
      record.result = { intentId: intent.id, status: 'cancelled', error: 'Intent expired' };
      this.addHistory(intent.id, 'cancelled', 'Intent expired');
      eventBus.emit('intent:completed', { intentId: intent.id, result: record.result });
      return;
    }

    // Check if approval required
    if (intent.requiresApproval) {
      record.approval = { required: true };
      this.addHistory(intent.id, 'pending', 'Awaiting approval');
      eventBus.emit('intent:approval:required', { intent });
      return;
    }

    // Execute
    await this.execute(intent);
  }

  private async execute(intent: Intent): Promise<void> {
    const record = this.records.get(intent.id);
    if (!record) return;

    this.addHistory(intent.id, 'executing', 'Execution started');

    const startedAt = Date.now();
    let attempts = 0;
    let lastError: string | undefined;

    const maxAttempts = intent.retryPolicy?.maxAttempts ?? 1;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        // Find handler
        const handler = this.findHandler(intent);
        
        if (!handler) {
          throw new Error(`No handler for intent: ${intent.type}:${intent.action}`);
        }

        // Execute with timeout
        const result = await this.executeWithTimeout(handler, intent, intent.timeout);

        // Success
        record.result = {
          intentId: intent.id,
          status: 'completed',
          output: result.output,
          executedBy: result.executedBy,
          attempts,
          startedAt,
          completedAt: Date.now(),
          sideEffects: result.sideEffects,
        };

        this.addHistory(intent.id, 'completed', 'Execution completed');
        eventBus.emit('intent:completed', { intentId: intent.id, result: record.result });
        return;

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        this.addHistory(intent.id, 'executing', `Attempt ${attempts} failed: ${lastError}`);

        if (attempts < maxAttempts && intent.retryPolicy) {
          const delay = intent.retryPolicy.backoffMs * 
            Math.pow(intent.retryPolicy.backoffMultiplier ?? 1, attempts - 1);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    // All attempts failed
    record.result = {
      intentId: intent.id,
      status: 'failed',
      error: lastError,
      attempts,
      startedAt,
      completedAt: Date.now(),
    };

    this.addHistory(intent.id, 'failed', `Failed after ${attempts} attempts: ${lastError}`);
    eventBus.emit('intent:completed', { intentId: intent.id, result: record.result });
  }

  private findHandler(intent: Intent): IntentHandler | undefined {
    // Try specific handler first
    const specific = this.handlers.get(`${intent.type}:${intent.action}`);
    if (specific) return specific;

    // Try default handler for type
    return this.handlers.get(`${intent.type}:*`);
  }

  private async executeWithTimeout(
    handler: IntentHandler,
    intent: Intent,
    timeout?: number
  ): Promise<IntentHandlerResult> {
    if (!timeout) {
      return handler(intent);
    }

    return Promise.race([
      handler(intent),
      new Promise<IntentHandlerResult>((_, reject) =>
        setTimeout(() => reject(new Error(`Intent timeout: ${timeout}ms`)), timeout)
      ),
    ]);
  }

  private addHistory(intentId: string, status: IntentStatus, message: string, data?: unknown): void {
    const record = this.records.get(intentId);
    if (record) {
      record.history.push({ timestamp: Date.now(), status, message, data });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Query
  // ─────────────────────────────────────────────────────────────────────────

  get(intentId: string): IntentRecord | undefined {
    return this.records.get(intentId);
  }

  getByAgent(agentId: string): IntentRecord[] {
    return Array.from(this.records.values())
      .filter(r => r.intent.agentId === agentId);
  }

  getPending(): IntentRecord[] {
    return Array.from(this.records.values())
      .filter(r => !r.result || r.result.status === 'pending');
  }

  getAwaitingApproval(): IntentRecord[] {
    return Array.from(this.records.values())
      .filter(r => r.approval?.required && r.approval.approved === undefined);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Approval API
  // ─────────────────────────────────────────────────────────────────────────

  approve(intentId: string, approvedBy: string): void {
    eventBus.emit('intent:approved', { intentId, approvedBy });
  }

  deny(intentId: string, deniedBy: string, reason: string): void {
    eventBus.emit('intent:denied', { intentId, deniedBy, reason });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cancellation
  // ─────────────────────────────────────────────────────────────────────────

  cancel(intentId: string, reason: string): boolean {
    const record = this.records.get(intentId);
    if (!record) return false;
    
    if (record.result && ['completed', 'failed', 'denied'].includes(record.result.status)) {
      return false; // Can't cancel finished intents
    }

    record.result = { intentId, status: 'cancelled', error: reason };
    this.addHistory(intentId, 'cancelled', `Cancelled: ${reason}`);
    eventBus.emit('intent:completed', { intentId, result: record.result });
    return true;
  }
}

// Handler signature
export type IntentHandler = (intent: Intent) => Promise<IntentHandlerResult>;

export interface IntentHandlerResult {
  output?: unknown;
  executedBy?: string;
  sideEffects?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

export function createIntent<T>(type: IntentType, action: string): IntentBuilder<T> {
  return new IntentBuilder<T>(type, action);
}

// Common intent builders
export const intents = {
  communicate: (action: string) => createIntent('communicate', action),
  execute: (action: string) => createIntent('execute', action),
  query: (action: string) => createIntent('query', action),
  store: (action: string) => createIntent('store', action),
  schedule: (action: string) => createIntent('schedule', action),
  delegate: (toAgent: string) => createIntent('delegate', toAgent),
  escalate: (reason: string) => createIntent<{ reason: string }>('escalate', 'human').payload({ reason }),
  wait: (condition: string) => createIntent('wait', condition),
};

// Singleton export
export const intentManager = new IntentManager();
