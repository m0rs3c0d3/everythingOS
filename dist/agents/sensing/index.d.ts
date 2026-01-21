import { BaseAgent } from '../BaseAgent';
import { MarketData } from '../../core/types';
export declare class PriceTickerAgent extends BaseAgent {
    private prices;
    private watchlist;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private initializePrices;
    private generateMarketData;
    private createMarketData;
    getPrice(symbol: string): MarketData | undefined;
    getAllPrices(): MarketData[];
    addToWatchlist(symbol: string): void;
}
export declare class VolatilityCalculatorAgent extends BaseAgent {
    private priceHistory;
    private volatility;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private addPrice;
    private calculateVolatility;
    getVolatility(symbol: string): number | undefined;
}
export declare class AnomalyDetectorAgent extends BaseAgent {
    private thresholds;
    private anomalies;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private checkAnomaly;
    getAnomalies(): typeof this.anomalies;
}
export declare class SentimentAnalysisAgent extends BaseAgent {
    private sentiments;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    getSentiment(symbol: string): {
        score: number;
        label: string;
    } | undefined;
}
export declare class NewsAggregatorAgent extends BaseAgent {
    private newsItems;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private generateNews;
    getNews(limit?: number): {
        id: string;
        title: string;
        source: string;
        sentiment: number;
        symbols: string[];
        timestamp: number;
    }[];
}
export declare class CorrelationAnalyzerAgent extends BaseAgent {
    private priceHistory;
    private correlations;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private calculateCorrelation;
    getCorrelation(pair: string): number | undefined;
}
//# sourceMappingURL=index.d.ts.map