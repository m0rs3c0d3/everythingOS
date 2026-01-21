import { SystemEvent, EventPriority } from './types';
type EventHandler<T = unknown> = (event: SystemEvent<T>) => void | Promise<void>;
type EventFilter = (event: SystemEvent) => boolean;
interface DeadLetter {
    event: SystemEvent;
    error: Error;
    timestamp: number;
    attempts: number;
}
export declare class EventBus {
    private subscriptions;
    private wildcardSubscriptions;
    private eventQueue;
    private deadLetterQueue;
    private processing;
    private eventHistory;
    private maxHistory;
    private maxDeadLetters;
    private eventIdCounter;
    private listeners;
    constructor();
    private generateEventId;
    subscribe<T = unknown>(pattern: string | RegExp, handler: EventHandler<T>, options?: {
        priority?: number;
        filter?: EventFilter;
        once?: boolean;
    }): string;
    once<T = unknown>(pattern: string | RegExp, handler: EventHandler<T>): string;
    unsubscribe(subscriptionId: string): boolean;
    emit<T = unknown>(type: string, payload: T, options?: {
        source?: string;
        target?: string | string[];
        priority?: EventPriority;
        correlationId?: string;
        metadata?: Record<string, unknown>;
    }): string;
    emitSync<T = unknown>(type: string, payload: T, source?: string): void;
    private processEvent;
    private addDeadLetter;
    private startProcessing;
    getHistory(filter?: {
        type?: string;
        source?: string;
        since?: number;
    }): SystemEvent[];
    getDeadLetters(): DeadLetter[];
    retryDeadLetter(eventId: string): boolean;
    clearDeadLetters(): void;
    getStats(): {
        queueLength: number;
        historyLength: number;
        deadLetters: number;
        subscriptions: number;
    };
    on(event: string, handler: EventHandler): () => void;
    off(event: string, handler: EventHandler): void;
}
export declare const eventBus: EventBus;
export {};
//# sourceMappingURL=EventBus.d.ts.map