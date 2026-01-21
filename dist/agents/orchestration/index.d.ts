import { BaseAgent } from '../BaseAgent';
import { Alert } from '../../core/types';
export declare class DashboardAgent extends BaseAgent {
    private metrics;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    getMetrics(): Record<string, unknown>;
}
export declare class HealthCheckAgent extends BaseAgent {
    private healthChecks;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private checkAgentHealth;
    getHealthSummary(): {
        healthy: number;
        degraded: number;
        unhealthy: number;
    };
}
export declare class AlertingAgent extends BaseAgent {
    private alerts;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    createAlert(params: Partial<Alert>): Alert;
    acknowledgeAlert(alertId: string): boolean;
    getAlerts(filter?: {
        level?: Alert['level'];
    }): Alert[];
}
export declare class PerformanceTrackerAgent extends BaseAgent {
    private portfolioValue;
    private trades;
    private dailyReturns;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    getMetrics(): {
        portfolioValue: number;
        totalTrades: number;
        winRate: number;
    };
}
export declare class MetricsAggregatorAgent extends BaseAgent {
    private aggregates;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    getAggregates(): Record<string, number>;
}
//# sourceMappingURL=index.d.ts.map