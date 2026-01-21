// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Memory
// Agent memory and state persistence
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Agent Memory
 * Short-term and long-term memory for agents
 */
export class AgentMemory {
  private shortTerm: Map<string, { value: unknown; timestamp: number; ttl?: number }> = new Map();
  private longTerm: Map<string, unknown> = new Map();
  private maxShortTermSize = 1000;

  remember(key: string, value: unknown, ttlMs?: number): void {
    this.shortTerm.set(key, { value, timestamp: Date.now(), ttl: ttlMs });
    if (this.shortTerm.size > this.maxShortTermSize) this.pruneShortTerm();
  }

  rememberLongTerm(key: string, value: unknown): void {
    this.longTerm.set(key, value);
  }

  recall<T>(key: string): T | undefined {
    const entry = this.shortTerm.get(key);
    if (entry) {
      if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
        this.shortTerm.delete(key);
      } else {
        return entry.value as T;
      }
    }
    return this.longTerm.get(key) as T | undefined;
  }

  forget(key: string): void {
    this.shortTerm.delete(key);
    this.longTerm.delete(key);
  }

  clearShortTerm(): void { this.shortTerm.clear(); }
  clearAll(): void { this.shortTerm.clear(); this.longTerm.clear(); }
  has(key: string): boolean { return this.shortTerm.has(key) || this.longTerm.has(key); }

  private pruneShortTerm(): void {
    const now = Date.now();
    for (const [key, entry] of this.shortTerm) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) this.shortTerm.delete(key);
    }
  }

  export(): { shortTerm: Record<string, unknown>; longTerm: Record<string, unknown> } {
    return {
      shortTerm: Object.fromEntries(this.shortTerm),
      longTerm: Object.fromEntries(this.longTerm),
    };
  }
}

/**
 * Time Series Memory
 */
export class TimeSeriesMemory<T = number> {
  private data: Array<{ timestamp: number; value: T }> = [];
  private maxSize: number;

  constructor(maxSize = 1000) { this.maxSize = maxSize; }

  add(value: T, timestamp = Date.now()): void {
    this.data.push({ timestamp, value });
    this.data.sort((a, b) => a.timestamp - b.timestamp);
    if (this.data.length > this.maxSize) this.data = this.data.slice(-this.maxSize);
  }

  getAll(): Array<{ timestamp: number; value: T }> { return [...this.data]; }
  getValues(): T[] { return this.data.map(d => d.value); }
  getSince(timestamp: number): Array<{ timestamp: number; value: T }> {
    return this.data.filter(d => d.timestamp >= timestamp);
  }
  getLast(n: number): Array<{ timestamp: number; value: T }> { return this.data.slice(-n); }
  getLatest(): { timestamp: number; value: T } | undefined { return this.data[this.data.length - 1]; }
  size(): number { return this.data.length; }
  clear(): void { this.data = []; }
}

/**
 * Sliding Window
 */
export class SlidingWindow<T = number> {
  private data: T[] = [];
  private windowSize: number;

  constructor(windowSize: number) { this.windowSize = windowSize; }

  push(value: T): void {
    this.data.push(value);
    if (this.data.length > this.windowSize) this.data.shift();
  }

  getAll(): T[] { return [...this.data]; }
  getLast(): T | undefined { return this.data[this.data.length - 1]; }
  getFirst(): T | undefined { return this.data[0]; }
  isFull(): boolean { return this.data.length >= this.windowSize; }
  size(): number { return this.data.length; }
  clear(): void { this.data = []; }
  
  map<U>(fn: (value: T, index: number) => U): U[] { return this.data.map(fn); }
  reduce<U>(fn: (acc: U, value: T) => U, initial: U): U { return this.data.reduce(fn, initial); }
}

/**
 * Event Log
 */
export class EventLog<T = unknown> {
  private events: Array<{ id: string; type: string; data: T; timestamp: number }> = [];
  private maxSize: number;
  private idCounter = 0;

  constructor(maxSize = 10000) { this.maxSize = maxSize; }

  log(type: string, data: T): string {
    const id = `evt_${++this.idCounter}`;
    this.events.push({ id, type, data, timestamp: Date.now() });
    if (this.events.length > this.maxSize) this.events.shift();
    return id;
  }

  getByType(type: string) { return this.events.filter(e => e.type === type); }
  getSince(timestamp: number) { return this.events.filter(e => e.timestamp >= timestamp); }
  getLast(n: number) { return this.events.slice(-n); }
  count(type?: string): number {
    return type ? this.events.filter(e => e.type === type).length : this.events.length;
  }
  clear(): void { this.events = []; }
}
