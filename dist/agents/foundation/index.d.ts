export { ClockAgent } from './ClockAgent';
export { EnvironmentSensorAgent } from './EnvironmentSensorAgent';
import { BaseAgent } from '../BaseAgent';
export declare class ConfigWatcherAgent extends BaseAgent {
    private appConfig;
    private watchers;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private loadDefaults;
    get<T = unknown>(path: string): T | undefined;
    set(path: string, value: unknown): void;
    watch(path: string, callback: (value: unknown) => void): () => void;
    private notifyWatchers;
    getAll(): Record<string, unknown>;
}
export declare class SnapshotManagerAgent extends BaseAgent {
    private snapshots;
    private autoSnapshotInterval;
    private lastAutoSnapshot;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    createSnapshot(label?: string): string;
    getSnapshot(id: string): unknown | undefined;
    listSnapshots(): {
        id: string;
        timestamp: number;
    }[];
    deleteSnapshot(id: string): boolean;
}
export declare class GarbageCollectorAgent extends BaseAgent {
    private collectionCount;
    private totalCleaned;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    collect(): Promise<{
        cleaned: number;
        duration: number;
    }>;
    getStats(): {
        collectionCount: number;
        totalCleaned: number;
    };
}
export declare class AuditTrailAgent extends BaseAgent {
    private trail;
    private maxTrailSize;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    log(event: string, data: unknown): void;
    getTrail(filter?: {
        since?: number;
        event?: string;
    }): Array<{
        timestamp: number;
        event: string;
        data: unknown;
    }>;
    clear(): void;
}
export declare class EventBusMonitorAgent extends BaseAgent {
    private eventCounts;
    private errorCount;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    getStats(): {
        eventCounts: Record<string, number>;
        errorCount: number;
        totalEvents: number;
    };
}
export declare class InterAgentBridgeAgent extends BaseAgent {
    private messageQueue;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    send(from: string, to: string, payload: unknown): void;
}
export declare class DeadLetterHandlerAgent extends BaseAgent {
    private deadLetters;
    private maxDeadLetters;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private handleDeadLetter;
    getDeadLetters(): Array<{
        event: unknown;
        error: string;
        timestamp: number;
    }>;
    clear(): void;
}
export declare class ShutdownCoordinatorAgent extends BaseAgent {
    private shutdownHandlers;
    private isShuttingDown;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    registerShutdownHandler(handler: () => Promise<void>): void;
    initiateShutdown(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map