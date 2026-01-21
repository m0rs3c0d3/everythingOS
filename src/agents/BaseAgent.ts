// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Base Agent
// Abstract base class for all agents in the system
// ═══════════════════════════════════════════════════════════════════════════════

import { AgentConfig, AgentStatus, SystemEvent } from '../core/types';
import { eventBus } from '../core/EventBus';
import { worldState } from '../core/WorldStateManager';
import { metrics } from '../core/MetricsCollector';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected status: AgentStatus = 'idle';
  protected subscriptions: string[] = [];
  protected tickInterval: number | null = null;
  protected tickRate = 1000; // ms
  protected startTime = 0;

  constructor(config: AgentConfig) {
    this.config = {
      ...config,
      enabled: config.enabled ?? true,
    };
  }

  // Get agent config
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  // Get agent ID
  getId(): string {
    return this.config.id;
  }

  // Get agent status
  getStatus(): AgentStatus {
    return this.status;
  }

  // Start the agent
  async start(): Promise<void> {
    if (this.status === 'running') {
      return;
    }

    this.status = 'running';
    this.startTime = Date.now();
    worldState.setAgentStatus(this.config.id, 'running');

    // Setup event subscriptions
    this.setupSubscriptions();

    // Call agent-specific initialization
    await this.onStart();

    // Start tick loop if needed
    if (this.tickRate > 0) {
      this.tickInterval = setInterval(() => this.tick(), this.tickRate) as unknown as number;
    }

    this.emit('agent:started', { agentId: this.config.id });
  }

  // Stop the agent
  async stop(): Promise<void> {
    if (this.status === 'stopped') {
      return;
    }

    this.status = 'stopped';
    worldState.setAgentStatus(this.config.id, 'stopped');

    // Stop tick loop
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    // Unsubscribe from events
    this.subscriptions.forEach((subId) => eventBus.unsubscribe(subId));
    this.subscriptions = [];

    // Call agent-specific cleanup
    await this.onStop();

    this.emit('agent:stopped', { agentId: this.config.id });
  }

  // Pause the agent
  pause(): void {
    if (this.status !== 'running') {
      return;
    }

    this.status = 'paused';
    worldState.setAgentStatus(this.config.id, 'paused');

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    this.emit('agent:paused', { agentId: this.config.id });
  }

  // Resume the agent
  resume(): void {
    if (this.status !== 'paused') {
      return;
    }

    this.status = 'running';
    worldState.setAgentStatus(this.config.id, 'running');

    if (this.tickRate > 0) {
      this.tickInterval = setInterval(() => this.tick(), this.tickRate) as unknown as number;
    }

    this.emit('agent:resumed', { agentId: this.config.id });
  }

  // Tick - called periodically
  protected async tick(): Promise<void> {
    if (this.status !== 'running') {
      return;
    }

    const start = performance.now();

    try {
      await this.onTick();

      const state = worldState.getAgentState(this.config.id);
      if (state) {
        state.lastTick = worldState.getTick();
        state.tickCount++;
      }
    } catch (error) {
      this.handleError(error as Error);
    }

    const duration = (performance.now() - start) / 1000;
    metrics.observe('agent_processing_duration_seconds', duration, {
      agent: this.config.id,
    });

    worldState.updateAgentMetrics(this.config.id, {
      lastProcessingTime: duration,
      uptime: Date.now() - this.startTime,
    });
  }

  // Setup event subscriptions
  protected setupSubscriptions(): void {
    // Subscribe to world tick
    const tickSub = eventBus.subscribe('world:tick', () => {
      // Agents can react to world ticks
    });
    this.subscriptions.push(tickSub);
  }

  // Subscribe to an event
  protected subscribe<T = unknown>(
    pattern: string | RegExp,
    handler: (event: SystemEvent<T>) => void | Promise<void>
  ): void {
    const subId = eventBus.subscribe(pattern, async (event) => {
      const state = worldState.getAgentState(this.config.id);
      if (state) {
        state.metrics.eventsProcessed++;
      }

      try {
        await handler(event as SystemEvent<T>);
      } catch (error) {
        this.handleError(error as Error);
      }
    });

    this.subscriptions.push(subId);
  }

  // Emit an event
  protected emit<T = unknown>(type: string, payload: T, target?: string | string[]): void {
    eventBus.emit(type, payload, {
      source: this.config.id,
      target,
    });

    const state = worldState.getAgentState(this.config.id);
    if (state) {
      state.metrics.eventsEmitted++;
    }
  }

  // Handle errors
  protected handleError(error: Error, recoverable = true): void {
    this.status = 'error';
    worldState.setAgentStatus(this.config.id, 'error');
    worldState.recordAgentError(this.config.id, error, recoverable);
    metrics.increment('agent_errors_total', 1, { agent: this.config.id });

    this.emit('agent:error', {
      agentId: this.config.id,
      error: error.message,
      recoverable,
    });

    if (recoverable) {
      // Auto-recover after error
      setTimeout(() => {
        if (this.status === 'error') {
          this.status = 'running';
          worldState.setAgentStatus(this.config.id, 'running');
        }
      }, 5000);
    }
  }

  // Get memory value
  protected getMemory<T = unknown>(key: string): T | undefined {
    return worldState.getAgentMemory<T>(this.config.id, key);
  }

  // Set memory value
  protected setMemory(key: string, value: unknown): void {
    worldState.setAgentMemory(this.config.id, key, value);
  }

  // Get global state
  protected getGlobal<T = unknown>(key: string): T | undefined {
    return worldState.getGlobal<T>(key);
  }

  // Set global state
  protected setGlobal(key: string, value: unknown): void {
    worldState.setGlobal(key, value);
  }

  // Abstract methods for subclasses
  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
  protected abstract onTick(): Promise<void>;
}
