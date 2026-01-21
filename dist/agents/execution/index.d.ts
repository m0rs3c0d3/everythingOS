import { BaseAgent } from '../BaseAgent';
import { Order, SignalData } from '../../core/types';
export declare class OrderExecutorAgent extends BaseAgent {
    private orders;
    private orderCounter;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    createOrder(params: Partial<Order>): Order;
    private processOrder;
    private checkLimitOrders;
    cancelOrder(orderId: string): boolean;
    getOrder(orderId: string): Order | undefined;
    getOpenOrders(): Order[];
}
export declare class PositionSizerAgent extends BaseAgent {
    private portfolioValue;
    private maxPositionPct;
    private riskPerTradePct;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    calculateSize(signal: SignalData, price?: number): {
        quantity: number;
        value: number;
        risk: number;
    };
    setPortfolioValue(value: number): void;
    setMaxPositionPct(pct: number): void;
}
export declare class StopLossAgent extends BaseAgent {
    private stops;
    private highWatermarks;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private checkStops;
    setFixedStop(positionId: string, price: number): void;
    setTrailingStop(positionId: string, initialPrice: number, trailPct: number): void;
    removeStop(positionId: string): void;
}
export declare class ProfitTakerAgent extends BaseAgent {
    private targets;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private checkTargets;
    setTargets(positionId: string, levels: number[]): void;
    removeTargets(positionId: string): void;
}
export declare class CircuitBreakerAgent extends BaseAgent {
    private triggered;
    private triggerCount;
    private lossThreshold;
    private volatilityThreshold;
    private dailyPnL;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private trigger;
    reset(): void;
    isTriggered(): boolean;
}
export declare class DrawdownLimiterAgent extends BaseAgent {
    private peakValue;
    private currentValue;
    private maxDrawdownPct;
    private currentDrawdown;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private updateValue;
    setMaxDrawdown(pct: number): void;
    getCurrentDrawdown(): number;
}
export declare class VaRAgent extends BaseAgent {
    private portfolioValue;
    private returns;
    private confidenceLevel;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private calculateVaR;
    setPortfolioValue(value: number): void;
    getVaR(confidence?: number): number;
}
//# sourceMappingURL=index.d.ts.map