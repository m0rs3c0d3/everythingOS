// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Priority Queue
// ═══════════════════════════════════════════════════════════════════════════════

export type Priority = 'critical' | 'high' | 'normal' | 'low';

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export class PriorityQueue<T> {
  private queues: Map<Priority, T[]> = new Map([
    ['critical', []],
    ['high', []],
    ['normal', []],
    ['low', []],
  ]);

  enqueue(item: T, priority: Priority = 'normal'): void {
    this.queues.get(priority)!.push(item);
  }

  dequeue(): T | undefined {
    for (const priority of ['critical', 'high', 'normal', 'low'] as Priority[]) {
      const queue = this.queues.get(priority)!;
      if (queue.length > 0) {
        return queue.shift();
      }
    }
    return undefined;
  }

  peek(): T | undefined {
    for (const priority of ['critical', 'high', 'normal', 'low'] as Priority[]) {
      const queue = this.queues.get(priority)!;
      if (queue.length > 0) {
        return queue[0];
      }
    }
    return undefined;
  }

  isEmpty(): boolean {
    return this.size() === 0;
  }

  size(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  sizeByPriority(): Record<Priority, number> {
    return {
      critical: this.queues.get('critical')!.length,
      high: this.queues.get('high')!.length,
      normal: this.queues.get('normal')!.length,
      low: this.queues.get('low')!.length,
    };
  }

  clear(): void {
    for (const queue of this.queues.values()) {
      queue.length = 0;
    }
  }
}
