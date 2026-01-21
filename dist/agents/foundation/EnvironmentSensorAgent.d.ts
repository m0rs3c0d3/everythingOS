import { BaseAgent } from '../BaseAgent';
interface EnvironmentState {
    memory: {
        used: number;
        total: number;
        percent: number;
    };
    cpu: {
        usage: number;
        cores: number;
    };
    runtime: {
        platform: string;
        version: string;
        uptime: number;
    };
    network: {
        online: boolean;
        latency: number;
    };
}
export declare class EnvironmentSensorAgent extends BaseAgent {
    private lastCpuMeasure;
    private cpuUsageHistory;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private measureEnvironment;
    private getEnvironmentState;
    private simulateMemoryUsage;
    private simulateCpuUsage;
    private checkThresholds;
    getState(): EnvironmentState | undefined;
    getCpuHistory(): number[];
}
export {};
//# sourceMappingURL=EnvironmentSensorAgent.d.ts.map