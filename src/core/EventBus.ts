// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Event Bus
// Central nervous system for inter-agent communication
// ═══════════════════════════════════════════════════════════════════════════════

import { SystemEvent, EventPriority } from './types';

type EventHandler<T = unknown> = (event: SystemEvent<T>) => void | Promise<void>;
type EventFilter = (event: SystemEvent) => boolean;

interface Subscription {
  id: string;
  pattern: string | RegExp;
  handler: EventHandler;
  filter?: EventFilter;
  priority: number;
  once: boolean;
}

interface DeadLetter {
  event: SystemEvent;
  error: Error;
  timestamp: number;
  attempts: number;
}

export class EventBus {
  private subscriptions: Map<string, Subscription[]> = new Map();
  private wildcardSubscriptions: Subscription[] = [];
  private eventQueue: SystemEvent[] = [];
  private deadLetterQueue: DeadLetter[] = [];
  private processing = false;
  private eventHistory: SystemEvent[] = [];
  private maxHistory = 1000;
  private maxDeadLetters = 100;
  private eventIdCounter = 0;
  private listeners: Map<string, Set<EventHandler>> = new Map();

  constructor() {
    this.startProcessing();
  }

  // Generate unique event ID
  private generateEventId(): string {
    return `evt_${Date.now()}_${++this.eventIdCounter}`;
  }

  // Subscribe to specific event type
  subscribe<T = unknown>(
    pattern: string | RegExp,
    handler: EventHandler<T>,
    options: { priority?: number; filter?: EventFilter; once?: boolean } = {}
  ): string {
    const subscription: Subscription = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      pattern,
      handler: handler as EventHandler,
      filter: options.filter,
      priority: options.priority ?? 0,
      once: options.once ?? false,
    };

    if (typeof pattern === 'string' && !pattern.includes('*')) {
      const subs = this.subscriptions.get(pattern) || [];
      subs.push(subscription);
      subs.sort((a, b) => b.priority - a.priority);
      this.subscriptions.set(pattern, subs);
    } else {
      this.wildcardSubscriptions.push(subscription);
      this.wildcardSubscriptions.sort((a, b) => b.priority - a.priority);
    }

    return subscription.id;
  }

  // Subscribe to event once
  once<T = unknown>(pattern: string | RegExp, handler: EventHandler<T>): string {
    return this.subscribe(pattern, handler, { once: true });
  }

  // Unsubscribe by subscription ID
  unsubscribe(subscriptionId: string): boolean {
    for (const [type, subs] of this.subscriptions) {
      const idx = subs.findIndex((s) => s.id === subscriptionId);
      if (idx !== -1) {
        subs.splice(idx, 1);
        return true;
      }
    }

    const wcIdx = this.wildcardSubscriptions.findIndex((s) => s.id === subscriptionId);
    if (wcIdx !== -1) {
      this.wildcardSubscriptions.splice(wcIdx, 1);
      return true;
    }

    return false;
  }

  // Emit event
  emit<T = unknown>(
    type: string,
    payload: T,
    options: {
      source?: string;
      target?: string | string[];
      priority?: EventPriority;
      correlationId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): string {
    const event: SystemEvent<T> = {
      id: this.generateEventId(),
      type,
      source: options.source || 'system',
      target: options.target,
      payload,
      timestamp: Date.now(),
      priority: options.priority || 'normal',
      correlationId: options.correlationId,
      metadata: options.metadata,
    };

    // Priority queue insertion
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const insertIdx = this.eventQueue.findIndex(
      (e) => priorityOrder[e.priority] > priorityOrder[event.priority]
    );

    if (insertIdx === -1) {
      this.eventQueue.push(event);
    } else {
      this.eventQueue.splice(insertIdx, 0, event);
    }

    return event.id;
  }

  // Synchronous emit for immediate handling
  emitSync<T = unknown>(type: string, payload: T, source = 'system'): void {
    const event: SystemEvent<T> = {
      id: this.generateEventId(),
      type,
      source,
      payload,
      timestamp: Date.now(),
      priority: 'normal',
    };

    this.processEvent(event);
  }

  // Process single event
  private async processEvent(event: SystemEvent): Promise<void> {
    const handlers: Subscription[] = [];

    // Get exact match subscriptions
    const exactSubs = this.subscriptions.get(event.type) || [];
    handlers.push(...exactSubs);

    // Get wildcard matches
    for (const sub of this.wildcardSubscriptions) {
      if (typeof sub.pattern === 'string') {
        const regex = new RegExp('^' + sub.pattern.replace(/\*/g, '.*') + '$');
        if (regex.test(event.type)) {
          handlers.push(sub);
        }
      } else if (sub.pattern.test(event.type)) {
        handlers.push(sub);
      }
    }

    // Sort by priority
    handlers.sort((a, b) => b.priority - a.priority);

    // Remove one-time handlers
    const toRemove: string[] = [];

    for (const handler of handlers) {
      if (handler.filter && !handler.filter(event)) {
        continue;
      }

      try {
        await handler.handler(event);
      } catch (error) {
        this.addDeadLetter(event, error as Error);
      }

      if (handler.once) {
        toRemove.push(handler.id);
      }
    }

    // Clean up one-time handlers
    toRemove.forEach((id) => this.unsubscribe(id));

    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }
  }

  // Add to dead letter queue
  private addDeadLetter(event: SystemEvent, error: Error): void {
    this.deadLetterQueue.push({
      event,
      error,
      timestamp: Date.now(),
      attempts: 1,
    });

    if (this.deadLetterQueue.length > this.maxDeadLetters) {
      this.deadLetterQueue.shift();
    }

    // Emit dead letter event
    this.emit('system:dead_letter', { event, error: error.message }, { source: 'event_bus' });
  }

  // Start event processing loop
  private startProcessing(): void {
    const process = async () => {
      if (this.processing || this.eventQueue.length === 0) {
        setTimeout(process, 10);
        return;
      }

      this.processing = true;

      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        await this.processEvent(event);
      }

      this.processing = false;
      setTimeout(process, 10);
    };

    process();
  }

  // Get event history
  getHistory(filter?: { type?: string; source?: string; since?: number }): SystemEvent[] {
    let history = [...this.eventHistory];

    if (filter?.type) {
      history = history.filter((e) => e.type === filter.type);
    }
    if (filter?.source) {
      history = history.filter((e) => e.source === filter.source);
    }
    if (filter?.since) {
      history = history.filter((e) => e.timestamp >= filter.since!);
    }

    return history;
  }

  // Get dead letters
  getDeadLetters(): DeadLetter[] {
    return [...this.deadLetterQueue];
  }

  // Retry dead letter
  retryDeadLetter(eventId: string): boolean {
    const idx = this.deadLetterQueue.findIndex((dl) => dl.event.id === eventId);
    if (idx === -1) return false;

    const deadLetter = this.deadLetterQueue.splice(idx, 1)[0];
    this.eventQueue.push(deadLetter.event);
    return true;
  }

  // Clear dead letters
  clearDeadLetters(): void {
    this.deadLetterQueue = [];
  }

  // Get queue stats
  getStats(): {
    queueLength: number;
    historyLength: number;
    deadLetters: number;
    subscriptions: number;
  } {
    let totalSubs = this.wildcardSubscriptions.length;
    for (const subs of this.subscriptions.values()) {
      totalSubs += subs.length;
    }

    return {
      queueLength: this.eventQueue.length,
      historyLength: this.eventHistory.length,
      deadLetters: this.deadLetterQueue.length,
      subscriptions: totalSubs,
    };
  }

  // Simple on/off for component listeners
  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    
    const subId = this.subscribe(event, handler);
    
    return () => {
      this.listeners.get(event)?.delete(handler);
      this.unsubscribe(subId);
    };
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }
}

// Singleton instance
export const eventBus = new EventBus();
