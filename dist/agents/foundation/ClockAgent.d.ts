import { BaseAgent } from '../BaseAgent';
interface ScheduledTask {
    id: string;
    name: string;
    cron?: string;
    interval?: number;
    nextRun: number;
    lastRun?: number;
    callback: string;
    payload?: unknown;
    enabled: boolean;
}
export declare class ClockAgent extends BaseAgent {
    private tasks;
    private timeZone;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private emitTimeEvents;
    private executeTask;
    private getNextCronRun;
    schedule(task: Omit<ScheduledTask, 'nextRun' | 'enabled'>): string;
    cancelTask(taskId: string): boolean;
    enableTask(taskId: string): void;
    disableTask(taskId: string): void;
    getTasks(): ScheduledTask[];
    getTime(): {
        timestamp: number;
        iso: string;
        unix: number;
    };
    setTimeZone(tz: string): void;
}
export {};
//# sourceMappingURL=ClockAgent.d.ts.map