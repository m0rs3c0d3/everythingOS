// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Foundation Agents Index
// Core system agents that provide fundamental services
// ═══════════════════════════════════════════════════════════════════════════════

export { ClockAgent } from './ClockAgent';
export { EnvironmentSensorAgent } from './EnvironmentSensorAgent';

import { BaseAgent } from '../BaseAgent';

// ═══════════════════════════════════════════════════════════════════════════════
// Config Watcher Agent - Configuration monitoring and hot-reload
// ═══════════════════════════════════════════════════════════════════════════════

export class ConfigWatcherAgent extends BaseAgent {
  private appConfig: Record<string, unknown> = {};
  private watchers: Map<string, ((value: unknown) => void)[]> = new Map();

  constructor() {
    super({
      id: 'config_watcher',
      name: 'Config Watcher Agent',
      tier: 'foundation',
      description: 'Configuration monitoring and hot-reload',
      version: '1.0.0',
    });
    this.tickRate = 10000; // Check every 10s
  }

  protected async onStart(): Promise<void> {
    this.loadDefaults();
    this.emit('config:loaded', { config: this.appConfig });
  }

  protected async onStop(): Promise<void> {
    this.watchers.clear();
  }

  protected async onTick(): Promise<void> {
    // In real impl, would check for config file changes
  }

  private loadDefaults(): void {
    this.appConfig = {
      system: { debug: false, logLevel: 'info' },
      agents: { defaultTickRate: 1000, maxErrors: 10 },
      ui: { theme: 'dark', refreshRate: 60 },
    };
  }

  get<T = unknown>(path: string): T | undefined {
    const parts = path.split('.');
    let current: unknown = this.appConfig;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current as T;
  }

  set(path: string, value: unknown): void {
    const parts = path.split('.');
    const key = parts.pop()!;
    let current = this.appConfig;
    
    for (const part of parts) {
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    
    const oldValue = current[key];
    current[key] = value;
    
    this.emit('config:changed', { path, oldValue, newValue: value });
    this.notifyWatchers(path, value);
  }

  watch(path: string, callback: (value: unknown) => void): () => void {
    if (!this.watchers.has(path)) {
      this.watchers.set(path, []);
    }
    this.watchers.get(path)!.push(callback);
    
    return () => {
      const callbacks = this.watchers.get(path);
      if (callbacks) {
        const idx = callbacks.indexOf(callback);
        if (idx > -1) callbacks.splice(idx, 1);
      }
    };
  }

  private notifyWatchers(path: string, value: unknown): void {
    const callbacks = this.watchers.get(path) || [];
    callbacks.forEach(cb => cb(value));
  }

  getAll(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(this.appConfig));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Snapshot Manager Agent - State persistence and recovery
// ═══════════════════════════════════════════════════════════════════════════════

export class SnapshotManagerAgent extends BaseAgent {
  private snapshots: Map<string, { data: unknown; timestamp: number }> = new Map();
  private autoSnapshotInterval = 60000; // 1 minute
  private lastAutoSnapshot = 0;

  constructor() {
    super({
      id: 'snapshot_manager',
      name: 'Snapshot Manager Agent',
      tier: 'foundation',
      description: 'State persistence and recovery',
      version: '1.0.0',
    });
    this.tickRate = 5000;
  }

  protected async onStart(): Promise<void> {
    this.emit('snapshots:manager_started', {});
  }

  protected async onStop(): Promise<void> {
    // Final snapshot before shutdown
    this.createSnapshot('shutdown');
  }

  protected async onTick(): Promise<void> {
    const now = Date.now();
    if (now - this.lastAutoSnapshot >= this.autoSnapshotInterval) {
      this.createSnapshot('auto');
      this.lastAutoSnapshot = now;
    }
  }

  createSnapshot(label = 'manual'): string {
    const id = `snap_${Date.now()}_${label}`;
    const globals = this.getGlobal<Record<string, unknown>>('environment') || {};
    
    this.snapshots.set(id, {
      data: { globals, timestamp: Date.now(), label },
      timestamp: Date.now(),
    });

    this.emit('snapshots:created', { snapshotId: id, label });
    
    // Keep only last 100 snapshots
    if (this.snapshots.size > 100) {
      const oldest = Array.from(this.snapshots.keys())[0];
      this.snapshots.delete(oldest);
    }

    return id;
  }

  getSnapshot(id: string): unknown | undefined {
    return this.snapshots.get(id)?.data;
  }

  listSnapshots(): { id: string; timestamp: number }[] {
    return Array.from(this.snapshots.entries()).map(([id, snap]) => ({
      id,
      timestamp: snap.timestamp,
    }));
  }

  deleteSnapshot(id: string): boolean {
    return this.snapshots.delete(id);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Garbage Collector Agent - Memory management
// ═══════════════════════════════════════════════════════════════════════════════

export class GarbageCollectorAgent extends BaseAgent {
  private collectionCount = 0;
  private totalCleaned = 0;

  constructor() {
    super({
      id: 'garbage_collector',
      name: 'Garbage Collector Agent',
      tier: 'foundation',
      description: 'Memory management and cleanup',
      version: '1.0.0',
    });
    this.tickRate = 30000; // Run every 30s
  }

  protected async onStart(): Promise<void> {
    this.emit('gc:started', {});
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    await this.collect();
  }

  async collect(): Promise<{ cleaned: number; duration: number }> {
    const start = performance.now();
    
    // Simulate garbage collection
    const cleaned = Math.floor(Math.random() * 1000);
    this.totalCleaned += cleaned;
    this.collectionCount++;

    const duration = performance.now() - start;

    this.emit('gc:collected', {
      cleaned,
      duration,
      totalCleaned: this.totalCleaned,
      collectionCount: this.collectionCount,
    });

    return { cleaned, duration };
  }

  getStats(): { collectionCount: number; totalCleaned: number } {
    return { collectionCount: this.collectionCount, totalCleaned: this.totalCleaned };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Audit Trail Agent - Activity logging
// ═══════════════════════════════════════════════════════════════════════════════

export class AuditTrailAgent extends BaseAgent {
  private trail: Array<{ timestamp: number; event: string; data: unknown }> = [];
  private maxTrailSize = 10000;

  constructor() {
    super({
      id: 'audit_trail',
      name: 'Audit Trail Agent',
      tier: 'foundation',
      description: 'Activity logging and audit trail',
      version: '1.0.0',
    });
    this.tickRate = 0; // Event-driven only
  }

  protected async onStart(): Promise<void> {
    // Subscribe to all events for auditing
    this.subscribe('*', (event) => {
      this.log(event.type, event.payload);
    });
    this.emit('audit:started', {});
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {}

  log(event: string, data: unknown): void {
    this.trail.push({ timestamp: Date.now(), event, data });
    
    if (this.trail.length > this.maxTrailSize) {
      this.trail.shift();
    }
  }

  getTrail(filter?: { since?: number; event?: string }): Array<{ timestamp: number; event: string; data: unknown }> {
    let result = [...this.trail];
    
    if (filter?.since) {
      result = result.filter(e => e.timestamp >= filter.since!);
    }
    if (filter?.event) {
      result = result.filter(e => e.event.includes(filter.event!));
    }
    
    return result;
  }

  clear(): void {
    this.trail = [];
    this.emit('audit:cleared', {});
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Event Bus Monitor Agent - Event system health
// ═══════════════════════════════════════════════════════════════════════════════

export class EventBusMonitorAgent extends BaseAgent {
  private eventCounts: Map<string, number> = new Map();
  private errorCount = 0;

  constructor() {
    super({
      id: 'event_bus_monitor',
      name: 'Event Bus Monitor Agent',
      tier: 'foundation',
      description: 'Event system health monitoring',
      version: '1.0.0',
    });
    this.tickRate = 10000;
  }

  protected async onStart(): Promise<void> {
    this.subscribe('*', (event) => {
      const count = this.eventCounts.get(event.type) || 0;
      this.eventCounts.set(event.type, count + 1);
    });

    this.subscribe('system:dead_letter', () => {
      this.errorCount++;
    });
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    const stats = this.getStats();
    this.emit('event_bus:stats', stats);
  }

  getStats(): { eventCounts: Record<string, number>; errorCount: number; totalEvents: number } {
    const counts = Object.fromEntries(this.eventCounts);
    const total = Array.from(this.eventCounts.values()).reduce((a, b) => a + b, 0);
    return { eventCounts: counts, errorCount: this.errorCount, totalEvents: total };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Inter-Agent Bridge Agent - Cross-agent communication
// ═══════════════════════════════════════════════════════════════════════════════

export class InterAgentBridgeAgent extends BaseAgent {
  private messageQueue: Array<{ from: string; to: string; payload: unknown }> = [];

  constructor() {
    super({
      id: 'inter_agent_bridge',
      name: 'Inter-Agent Bridge Agent',
      tier: 'foundation',
      description: 'Cross-agent communication routing',
      version: '1.0.0',
    });
    this.tickRate = 100; // Fast message routing
  }

  protected async onStart(): Promise<void> {
    this.subscribe('bridge:send', (event) => {
      const { to, payload } = event.payload as { to: string; payload: unknown };
      this.messageQueue.push({ from: event.source, to, payload });
    });
  }

  protected async onStop(): Promise<void> {
    this.messageQueue = [];
  }

  protected async onTick(): Promise<void> {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()!;
      this.emit(`agent:${msg.to}:message`, { from: msg.from, payload: msg.payload });
    }
  }

  send(from: string, to: string, payload: unknown): void {
    this.emit(`agent:${to}:message`, { from, payload });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dead Letter Handler Agent - Failed event handling
// ═══════════════════════════════════════════════════════════════════════════════

export class DeadLetterHandlerAgent extends BaseAgent {
  private deadLetters: Array<{ event: unknown; error: string; timestamp: number }> = [];
  private maxDeadLetters = 1000;

  constructor() {
    super({
      id: 'dead_letter_handler',
      name: 'Dead Letter Handler Agent',
      tier: 'foundation',
      description: 'Failed event handling and recovery',
      version: '1.0.0',
    });
    this.tickRate = 0; // Event-driven
  }

  protected async onStart(): Promise<void> {
    this.subscribe('system:dead_letter', (event) => {
      this.handleDeadLetter(event.payload);
    });
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {}

  private handleDeadLetter(payload: unknown): void {
    const { event, error } = payload as { event: unknown; error: string };
    
    this.deadLetters.push({ event, error, timestamp: Date.now() });
    
    if (this.deadLetters.length > this.maxDeadLetters) {
      this.deadLetters.shift();
    }

    this.emit('dead_letter:received', { event, error });
  }

  getDeadLetters(): Array<{ event: unknown; error: string; timestamp: number }> {
    return [...this.deadLetters];
  }

  clear(): void {
    this.deadLetters = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shutdown Coordinator Agent - Graceful shutdown
// ═══════════════════════════════════════════════════════════════════════════════

export class ShutdownCoordinatorAgent extends BaseAgent {
  private shutdownHandlers: Array<() => Promise<void>> = [];
  private isShuttingDown = false;

  constructor() {
    super({
      id: 'shutdown_coordinator',
      name: 'Shutdown Coordinator Agent',
      tier: 'foundation',
      description: 'Graceful shutdown coordination',
      version: '1.0.0',
    });
    this.tickRate = 0;
  }

  protected async onStart(): Promise<void> {
    this.subscribe('system:shutdown', async () => {
      await this.initiateShutdown();
    });
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {}

  registerShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  async initiateShutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.emit('shutdown:initiated', { timestamp: Date.now() });

    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        this.emit('shutdown:handler_error', { error: (error as Error).message });
      }
    }

    this.emit('shutdown:complete', { timestamp: Date.now() });
  }
}
