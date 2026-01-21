// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Working Memory
// Short-lived memory for current context
// Per-agent, per-workflow, automatically expires
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../../core/event-bus/EventBus';

export interface WorkingMemoryEntry {
  key: string;
  value: unknown;
  createdAt: number;
  expiresAt: number;
  scope: WorkingMemoryScope;
}

export interface WorkingMemoryScope {
  type: 'agent' | 'workflow' | 'global';
  id?: string;  // agentId or workflowExecutionId
}

export interface WorkingMemoryConfig {
  defaultTTL?: number;      // Default time to live in ms (default: 5 min)
  maxEntries?: number;      // Max entries per scope (default: 1000)
  cleanupInterval?: number; // Cleanup expired entries interval (default: 30s)
}

export class WorkingMemory {
  private store: Map<string, WorkingMemoryEntry> = new Map();
  private config: Required<WorkingMemoryConfig>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: WorkingMemoryConfig = {}) {
    this.config = {
      defaultTTL: config.defaultTTL ?? 5 * 60 * 1000,        // 5 minutes
      maxEntries: config.maxEntries ?? 1000,
      cleanupInterval: config.cleanupInterval ?? 30 * 1000,  // 30 seconds
    };
    
    this.startCleanup();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Core Operations
  // ─────────────────────────────────────────────────────────────────────────────

  set(key: string, value: unknown, scope: WorkingMemoryScope, ttl?: number): void {
    const fullKey = this.buildKey(key, scope);
    const now = Date.now();
    
    const entry: WorkingMemoryEntry = {
      key,
      value,
      createdAt: now,
      expiresAt: now + (ttl ?? this.config.defaultTTL),
      scope,
    };
    
    this.store.set(fullKey, entry);
    this.enforceLimit(scope);
    
    eventBus.emit('memory:working:set', { key, scope });
  }

  get<T = unknown>(key: string, scope: WorkingMemoryScope): T | undefined {
    const fullKey = this.buildKey(key, scope);
    const entry = this.store.get(fullKey);
    
    if (!entry) return undefined;
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.store.delete(fullKey);
      return undefined;
    }
    
    return entry.value as T;
  }

  has(key: string, scope: WorkingMemoryScope): boolean {
    return this.get(key, scope) !== undefined;
  }

  delete(key: string, scope: WorkingMemoryScope): boolean {
    const fullKey = this.buildKey(key, scope);
    const existed = this.store.delete(fullKey);
    
    if (existed) {
      eventBus.emit('memory:working:delete', { key, scope });
    }
    
    return existed;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Bulk Operations
  // ─────────────────────────────────────────────────────────────────────────────

  getAll(scope: WorkingMemoryScope): Record<string, unknown> {
    const prefix = this.buildScopePrefix(scope);
    const result: Record<string, unknown> = {};
    const now = Date.now();
    
    for (const [fullKey, entry] of this.store) {
      if (fullKey.startsWith(prefix) && entry.expiresAt > now) {
        result[entry.key] = entry.value;
      }
    }
    
    return result;
  }

  setMany(entries: Record<string, unknown>, scope: WorkingMemoryScope, ttl?: number): void {
    for (const [key, value] of Object.entries(entries)) {
      this.set(key, value, scope, ttl);
    }
  }

  clearScope(scope: WorkingMemoryScope): number {
    const prefix = this.buildScopePrefix(scope);
    let cleared = 0;
    
    for (const fullKey of this.store.keys()) {
      if (fullKey.startsWith(prefix)) {
        this.store.delete(fullKey);
        cleared++;
      }
    }
    
    if (cleared > 0) {
      eventBus.emit('memory:working:cleared', { scope, count: cleared });
    }
    
    return cleared;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Agent Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  forAgent(agentId: string): ScopedWorkingMemory {
    const scope: WorkingMemoryScope = { type: 'agent', id: agentId };
    return new ScopedWorkingMemory(this, scope);
  }

  forWorkflow(executionId: string): ScopedWorkingMemory {
    const scope: WorkingMemoryScope = { type: 'workflow', id: executionId };
    return new ScopedWorkingMemory(this, scope);
  }

  global(): ScopedWorkingMemory {
    const scope: WorkingMemoryScope = { type: 'global' };
    return new ScopedWorkingMemory(this, scope);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TTL Extension
  // ─────────────────────────────────────────────────────────────────────────────

  extend(key: string, scope: WorkingMemoryScope, additionalTTL: number): boolean {
    const fullKey = this.buildKey(key, scope);
    const entry = this.store.get(fullKey);
    
    if (!entry || Date.now() > entry.expiresAt) {
      return false;
    }
    
    entry.expiresAt += additionalTTL;
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────────────────────────────────────

  private buildKey(key: string, scope: WorkingMemoryScope): string {
    return `${this.buildScopePrefix(scope)}${key}`;
  }

  private buildScopePrefix(scope: WorkingMemoryScope): string {
    if (scope.type === 'global') return 'global:';
    return `${scope.type}:${scope.id}:`;
  }

  private enforceLimit(scope: WorkingMemoryScope): void {
    const prefix = this.buildScopePrefix(scope);
    const scopeEntries: Array<[string, WorkingMemoryEntry]> = [];
    
    for (const [key, entry] of this.store) {
      if (key.startsWith(prefix)) {
        scopeEntries.push([key, entry]);
      }
    }
    
    if (scopeEntries.length <= this.config.maxEntries) return;
    
    // Sort by creation time, remove oldest
    scopeEntries.sort((a, b) => a[1].createdAt - b[1].createdAt);
    const toRemove = scopeEntries.slice(0, scopeEntries.length - this.config.maxEntries);
    
    for (const [key] of toRemove) {
      this.store.delete(key);
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    let expired = 0;
    
    for (const [key, entry] of this.store) {
      if (entry.expiresAt < now) {
        this.store.delete(key);
        expired++;
      }
    }
    
    if (expired > 0) {
      eventBus.emit('memory:working:cleanup', { expired });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────────

  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  stats(): { total: number; byScope: Record<string, number> } {
    const byScope: Record<string, number> = {};
    
    for (const entry of this.store.values()) {
      const scopeKey = entry.scope.id 
        ? `${entry.scope.type}:${entry.scope.id}`
        : entry.scope.type;
      byScope[scopeKey] = (byScope[scopeKey] || 0) + 1;
    }
    
    return { total: this.store.size, byScope };
  }
}

/**
 * Scoped working memory - convenience wrapper for a specific scope
 */
export class ScopedWorkingMemory {
  constructor(
    private memory: WorkingMemory,
    private scope: WorkingMemoryScope
  ) {}

  set(key: string, value: unknown, ttl?: number): void {
    this.memory.set(key, value, this.scope, ttl);
  }

  get<T = unknown>(key: string): T | undefined {
    return this.memory.get<T>(key, this.scope);
  }

  has(key: string): boolean {
    return this.memory.has(key, this.scope);
  }

  delete(key: string): boolean {
    return this.memory.delete(key, this.scope);
  }

  getAll(): Record<string, unknown> {
    return this.memory.getAll(this.scope);
  }

  setMany(entries: Record<string, unknown>, ttl?: number): void {
    this.memory.setMany(entries, this.scope, ttl);
  }

  clear(): number {
    return this.memory.clearScope(this.scope);
  }

  extend(key: string, additionalTTL: number): boolean {
    return this.memory.extend(key, this.scope, additionalTTL);
  }
}

// Singleton export
export const workingMemory = new WorkingMemory();
