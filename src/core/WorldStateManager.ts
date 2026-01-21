// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - World State Manager
// Global state coordination and snapshot management
// ═══════════════════════════════════════════════════════════════════════════════

import { WorldState, WorldSnapshot, AgentState, AgentStatus } from './types';
import { eventBus } from './EventBus';

export class WorldStateManager {
  private state: WorldState;
  private maxSnapshots = 100;
  private snapshotInterval = 1000; // ms
  private lastSnapshotTime = 0;

  constructor() {
    this.state = {
      timestamp: Date.now(),
      tick: 0,
      agents: new Map(),
      globals: new Map(),
      snapshots: [],
    };

    // Initialize default globals
    this.state.globals.set('startTime', Date.now());
    this.state.globals.set('version', '1.0.0');
    this.state.globals.set('environment', 'development');
  }

  // Get current tick
  getTick(): number {
    return this.state.tick;
  }

  // Advance world tick
  tick(): number {
    this.state.tick++;
    this.state.timestamp = Date.now();

    // Auto-snapshot at intervals
    if (Date.now() - this.lastSnapshotTime >= this.snapshotInterval) {
      this.createSnapshot();
    }

    eventBus.emit('world:tick', { tick: this.state.tick, timestamp: this.state.timestamp });

    return this.state.tick;
  }

  // Register agent state
  registerAgent(agentId: string): void {
    if (this.state.agents.has(agentId)) {
      return;
    }

    const agentState: AgentState = {
      status: 'idle',
      lastTick: 0,
      tickCount: 0,
      errors: [],
      metrics: {
        eventsProcessed: 0,
        eventsEmitted: 0,
        avgProcessingTime: 0,
        lastProcessingTime: 0,
        uptime: 0,
        memoryUsage: 0,
      },
      memory: new Map(),
    };

    this.state.agents.set(agentId, agentState);
    eventBus.emit('world:agent_registered', { agentId });
  }

  // Unregister agent
  unregisterAgent(agentId: string): boolean {
    const removed = this.state.agents.delete(agentId);
    if (removed) {
      eventBus.emit('world:agent_unregistered', { agentId });
    }
    return removed;
  }

  // Get agent state
  getAgentState(agentId: string): AgentState | undefined {
    return this.state.agents.get(agentId);
  }

  // Update agent status
  setAgentStatus(agentId: string, status: AgentStatus): void {
    const agent = this.state.agents.get(agentId);
    if (agent) {
      agent.status = status;
      eventBus.emit('world:agent_status_changed', { agentId, status });
    }
  }

  // Update agent metrics
  updateAgentMetrics(
    agentId: string,
    metrics: Partial<AgentState['metrics']>
  ): void {
    const agent = this.state.agents.get(agentId);
    if (agent) {
      Object.assign(agent.metrics, metrics);
    }
  }

  // Record agent error
  recordAgentError(
    agentId: string,
    error: Error,
    recoverable = true
  ): void {
    const agent = this.state.agents.get(agentId);
    if (agent) {
      agent.errors.push({
        timestamp: Date.now(),
        message: error.message,
        stack: error.stack,
        recoverable,
      });

      // Keep only last 50 errors
      if (agent.errors.length > 50) {
        agent.errors.shift();
      }

      eventBus.emit('world:agent_error', {
        agentId,
        error: error.message,
        recoverable,
      });
    }
  }

  // Set agent memory
  setAgentMemory(agentId: string, key: string, value: unknown): void {
    const agent = this.state.agents.get(agentId);
    if (agent) {
      agent.memory.set(key, value);
    }
  }

  // Get agent memory
  getAgentMemory<T = unknown>(agentId: string, key: string): T | undefined {
    const agent = this.state.agents.get(agentId);
    return agent?.memory.get(key) as T | undefined;
  }

  // Set global state
  setGlobal(key: string, value: unknown): void {
    this.state.globals.set(key, value);
    eventBus.emit('world:global_changed', { key, value });
  }

  // Get global state
  getGlobal<T = unknown>(key: string): T | undefined {
    return this.state.globals.get(key) as T | undefined;
  }

  // Get all globals
  getGlobals(): Record<string, unknown> {
    return Object.fromEntries(this.state.globals);
  }

  // Create state snapshot
  createSnapshot(label?: string): WorldSnapshot {
    const snapshot: WorldSnapshot = {
      tick: this.state.tick,
      timestamp: Date.now(),
      state: {
        globals: Object.fromEntries(this.state.globals),
        agents: Object.fromEntries(
          Array.from(this.state.agents.entries()).map(([id, state]) => [
            id,
            {
              status: state.status,
              tickCount: state.tickCount,
              metrics: { ...state.metrics },
            },
          ])
        ),
        label,
      },
      checksum: this.computeChecksum(),
    };

    this.state.snapshots.push(snapshot);
    this.lastSnapshotTime = Date.now();

    // Prune old snapshots
    if (this.state.snapshots.length > this.maxSnapshots) {
      this.state.snapshots.shift();
    }

    eventBus.emit('world:snapshot_created', { tick: snapshot.tick });

    return snapshot;
  }

  // Restore from snapshot
  restoreSnapshot(tick: number): boolean {
    const snapshot = this.state.snapshots.find((s) => s.tick === tick);
    if (!snapshot) {
      return false;
    }

    // Restore globals
    this.state.globals.clear();
    const globals = snapshot.state.globals as Record<string, unknown>;
    for (const [key, value] of Object.entries(globals)) {
      this.state.globals.set(key, value);
    }

    this.state.tick = snapshot.tick;
    this.state.timestamp = snapshot.timestamp;

    eventBus.emit('world:snapshot_restored', { tick });

    return true;
  }

  // Get snapshots
  getSnapshots(): WorldSnapshot[] {
    return [...this.state.snapshots];
  }

  // Compute state checksum
  private computeChecksum(): string {
    const data = JSON.stringify({
      tick: this.state.tick,
      globals: Object.fromEntries(this.state.globals),
      agentCount: this.state.agents.size,
    });

    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return hash.toString(16);
  }

  // Get full world state summary
  getSummary(): {
    tick: number;
    timestamp: number;
    agentCount: number;
    agentsByStatus: Record<AgentStatus, number>;
    snapshotCount: number;
    globalCount: number;
  } {
    const agentsByStatus: Record<AgentStatus, number> = {
      idle: 0,
      running: 0,
      paused: 0,
      error: 0,
      stopped: 0,
    };

    for (const agent of this.state.agents.values()) {
      agentsByStatus[agent.status]++;
    }

    return {
      tick: this.state.tick,
      timestamp: this.state.timestamp,
      agentCount: this.state.agents.size,
      agentsByStatus,
      snapshotCount: this.state.snapshots.length,
      globalCount: this.state.globals.size,
    };
  }

  // Get all agent IDs
  getAgentIds(): string[] {
    return Array.from(this.state.agents.keys());
  }

  // Check if agent exists
  hasAgent(agentId: string): boolean {
    return this.state.agents.has(agentId);
  }
}

// Singleton instance
export const worldState = new WorldStateManager();
