// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Base Agent
// Foundation for all agents
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus, Event } from '../core/event-bus/EventBus';
import { worldState } from '../core/state/WorldState';
import { AgentContext, createAgentContext } from './AgentContext';
import { LLMRouter } from './LLMRouter';

export type AgentStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'error';
export type AgentType = 'perception' | 'analysis' | 'decision' | 'execution' | 'learning';

export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  description?: string;
  version?: string;
  tags?: string[];
  llm?: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  tickRate?: number;
  timeout?: number;
}

export abstract class Agent {
  readonly id: string;
  readonly config: AgentConfig;
  protected context: AgentContext;
  protected llm: LLMRouter | null = null;
  protected subscriptions: Array<() => void> = [];
  protected tickInterval: ReturnType<typeof setInterval> | null = null;
  private _status: AgentStatus = 'idle';

  constructor(config: AgentConfig) {
    this.id = config.id;
    this.config = config;
    this.context = createAgentContext(this.id);
    if (config.llm) this.llm = new LLMRouter();
  }

  get status(): AgentStatus { return this._status; }

  async start(): Promise<void> {
    if (this._status === 'running') return;
    this._status = 'running';
    try {
      await this.onStart();
      if (this.config.tickRate && this.config.tickRate > 0) {
        this.tickInterval = setInterval(() => this.tick(), this.config.tickRate);
      }
      eventBus.emit('agent:started', { agentId: this.id });
    } catch (error) {
      this._status = 'error';
      eventBus.emit('agent:error', { agentId: this.id, error: String(error) });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this._status === 'stopped') return;
    this._status = 'stopped';
    if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions = [];
    await this.onStop();
    eventBus.emit('agent:stopped', { agentId: this.id });
  }

  pause(): void {
    if (this._status !== 'running') return;
    this._status = 'paused';
    eventBus.emit('agent:paused', { agentId: this.id });
  }

  resume(): void {
    if (this._status !== 'paused') return;
    this._status = 'running';
    eventBus.emit('agent:resumed', { agentId: this.id });
  }

  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
  protected abstract onTick(): Promise<void>;

  private async tick(): Promise<void> {
    if (this._status !== 'running') return;
    try { await this.onTick(); }
    catch (error) { eventBus.emit('agent:error', { agentId: this.id, error: String(error) }); }
  }

  protected subscribe<T>(pattern: string, handler: (event: Event<T>) => void | Promise<void>): void {
    const unsub = eventBus.on(pattern, async (event) => {
      if (this._status !== 'running') return;
      await handler(event as Event<T>);
    });
    this.subscriptions.push(unsub);
  }

  protected emit<T>(type: string, payload: T, options?: { priority?: 'critical' | 'high' | 'normal' | 'low'; target?: string }): void {
    eventBus.emit(type, payload, { source: this.id, priority: options?.priority, target: options?.target });
  }

  protected async request<T, R>(type: string, payload: T, timeoutMs?: number): Promise<R> {
    return eventBus.request<T, R>(type, payload, timeoutMs);
  }

  protected getState<T>(key: string): T | undefined { return worldState.getAgentState<T>(this.id, key); }
  protected setState<T>(key: string, value: T): void { worldState.setAgentState(this.id, key, value); }
  protected getGlobal<T>(key: string): T | undefined { return worldState.getGlobal<T>(key); }
  protected setGlobal<T>(key: string, value: T): void { worldState.setGlobal(key, value); }

  protected async think(prompt: string, options?: { systemPrompt?: string; temperature?: number }): Promise<string> {
    if (!this.llm || !this.config.llm) throw new Error(`Agent ${this.id} has no LLM configured`);
    const response = await this.llm.complete({
      provider: this.config.llm.provider,
      model: this.config.llm.model,
      messages: [
        ...(options?.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ],
      temperature: options?.temperature ?? this.config.llm.temperature,
      maxTokens: this.config.llm.maxTokens,
    });
    return response.content;
  }

  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    eventBus.emit('agent:log', { agentId: this.id, level, message, data, timestamp: Date.now() });
  }
}
