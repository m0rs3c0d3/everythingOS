import { BaseAgent } from '../BaseAgent';
import { SignalData } from '../../core/types';
export declare class RSIAgent extends BaseAgent {
    private priceHistory;
    private rsiValues;
    private period;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private addPrice;
    private calculateRSI;
    private generateSignal;
    getRSI(symbol: string): number | undefined;
}
export declare class MACDAgent extends BaseAgent {
    private priceHistory;
    private macdValues;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private calculateMACD;
    private calculateEMA;
    getMACD(symbol: string): {
        macd: number;
        signal: number;
        histogram: number;
    } | undefined;
}
export declare class BollingerBandAgent extends BaseAgent {
    private priceHistory;
    private bands;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private calculateBB;
    getBands(symbol: string): {
        upper: number;
        middle: number;
        lower: number;
        width: number;
    } | undefined;
}
export declare class MovingAverageAgent extends BaseAgent {
    private priceHistory;
    private mas;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private sma;
    private ema;
    getMA(symbol: string): {
        sma20: number;
        sma50: number;
        ema12: number;
        ema26: number;
    } | undefined;
}
export declare class SignalEnsembleAgent extends BaseAgent {
    private signals;
    private consensus;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private calculateConsensus;
    getConsensus(symbol: string): SignalData | undefined;
}
export declare class FearGreedIndexAgent extends BaseAgent {
    private index;
    private history;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private adjustIndex;
    private getLabel;
    getIndex(): {
        value: number;
        label: string;
    };
}
//# sourceMappingURL=index.d.ts.map