/**
 * Agent Memory
 * Short-term and long-term memory for agents
 */
export declare class AgentMemory {
    private shortTerm;
    private longTerm;
    private maxShortTermSize;
    remember(key: string, value: unknown, ttlMs?: number): void;
    rememberLongTerm(key: string, value: unknown): void;
    recall<T>(key: string): T | undefined;
    forget(key: string): void;
    clearShortTerm(): void;
    clearAll(): void;
    has(key: string): boolean;
    private pruneShortTerm;
    export(): {
        shortTerm: Record<string, unknown>;
        longTerm: Record<string, unknown>;
    };
}
/**
 * Time Series Memory
 */
export declare class TimeSeriesMemory<T = number> {
    private data;
    private maxSize;
    constructor(maxSize?: number);
    add(value: T, timestamp?: number): void;
    getAll(): Array<{
        timestamp: number;
        value: T;
    }>;
    getValues(): T[];
    getSince(timestamp: number): Array<{
        timestamp: number;
        value: T;
    }>;
    getLast(n: number): Array<{
        timestamp: number;
        value: T;
    }>;
    getLatest(): {
        timestamp: number;
        value: T;
    } | undefined;
    size(): number;
    clear(): void;
}
/**
 * Sliding Window
 */
export declare class SlidingWindow<T = number> {
    private data;
    private windowSize;
    constructor(windowSize: number);
    push(value: T): void;
    getAll(): T[];
    getLast(): T | undefined;
    getFirst(): T | undefined;
    isFull(): boolean;
    size(): number;
    clear(): void;
    map<U>(fn: (value: T, index: number) => U): U[];
    reduce<U>(fn: (acc: U, value: T) => U, initial: U): U;
}
/**
 * Event Log
 */
export declare class EventLog<T = unknown> {
    private events;
    private maxSize;
    private idCounter;
    constructor(maxSize?: number);
    log(type: string, data: T): string;
    getByType(type: string): {
        id: string;
        type: string;
        data: T;
        timestamp: number;
    }[];
    getSince(timestamp: number): {
        id: string;
        type: string;
        data: T;
        timestamp: number;
    }[];
    getLast(n: number): {
        id: string;
        type: string;
        data: T;
        timestamp: number;
    }[];
    count(type?: string): number;
    clear(): void;
}
//# sourceMappingURL=index.d.ts.map