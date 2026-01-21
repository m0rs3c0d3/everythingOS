import { AgentConfig, AgentStatus, SystemEvent } from '../core/types';
export declare abstract class BaseAgent {
    protected config: AgentConfig;
    protected status: AgentStatus;
    protected subscriptions: string[];
    protected tickInterval: number | null;
    protected tickRate: number;
    protected startTime: number;
    constructor(config: AgentConfig);
    getConfig(): AgentConfig;
    getId(): string;
    getStatus(): AgentStatus;
    start(): Promise<void>;
    stop(): Promise<void>;
    pause(): void;
    resume(): void;
    protected tick(): Promise<void>;
    protected setupSubscriptions(): void;
    protected subscribe<T = unknown>(pattern: string | RegExp, handler: (event: SystemEvent<T>) => void | Promise<void>): void;
    protected emit<T = unknown>(type: string, payload: T, target?: string | string[]): void;
    protected handleError(error: Error, recoverable?: boolean): void;
    protected getMemory<T = unknown>(key: string): T | undefined;
    protected setMemory(key: string, value: unknown): void;
    protected getGlobal<T = unknown>(key: string): T | undefined;
    protected setGlobal(key: string, value: unknown): void;
    protected abstract onStart(): Promise<void>;
    protected abstract onStop(): Promise<void>;
    protected abstract onTick(): Promise<void>;
}
//# sourceMappingURL=BaseAgent.d.ts.map