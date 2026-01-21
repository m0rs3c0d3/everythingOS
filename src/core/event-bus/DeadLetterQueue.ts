// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Dead Letter Queue
// Failed event handling and retry management
// ═══════════════════════════════════════════════════════════════════════════════

import { Event } from './EventBus';

export interface DeadLetter {
  event: Event;
  error: Error;
  failedAt: number;
  retryCount: number;
  lastRetry?: number;
}

export class DeadLetterQueue {
  private letters: Map<string, DeadLetter> = new Map();
  private maxRetries = 3;
  private maxSize = 1000;

  add(event: Event, error: Error): void {
    const existing = this.letters.get(event.id);
    
    if (existing) {
      existing.retryCount++;
      existing.error = error;
      existing.lastRetry = Date.now();
    } else {
      this.letters.set(event.id, {
        event,
        error,
        failedAt: Date.now(),
        retryCount: 0,
      });
    }

    this.prune();
  }

  retry(eventId: string, callback: (event: Event) => void): boolean {
    const letter = this.letters.get(eventId);
    if (!letter) return false;
    if (letter.retryCount >= this.maxRetries) return false;

    callback(letter.event);
    return true;
  }

  remove(eventId: string): boolean {
    return this.letters.delete(eventId);
  }

  get(eventId: string): DeadLetter | undefined {
    return this.letters.get(eventId);
  }

  getAll(): DeadLetter[] {
    return Array.from(this.letters.values());
  }

  getRetriable(): DeadLetter[] {
    return this.getAll().filter(l => l.retryCount < this.maxRetries);
  }

  size(): number {
    return this.letters.size;
  }

  clear(): void {
    this.letters.clear();
  }

  private prune(): void {
    if (this.letters.size <= this.maxSize) return;

    const sorted = Array.from(this.letters.entries())
      .sort((a, b) => a[1].failedAt - b[1].failedAt);

    const toRemove = sorted.slice(0, this.letters.size - this.maxSize);
    for (const [id] of toRemove) {
      this.letters.delete(id);
    }
  }
}
