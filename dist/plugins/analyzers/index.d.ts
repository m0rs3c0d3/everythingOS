/**
 * Technical Indicators
 * Common trading indicators
 */
export declare class TechnicalIndicators {
    /**
     * Simple Moving Average
     */
    static sma(prices: number[], period: number): number;
    /**
     * Exponential Moving Average
     */
    static ema(prices: number[], period: number): number;
    /**
     * Relative Strength Index
     */
    static rsi(prices: number[], period?: number): number;
    /**
     * MACD (Moving Average Convergence Divergence)
     */
    static macd(prices: number[], fastPeriod?: number, slowPeriod?: number, signalPeriod?: number): {
        macd: number;
        signal: number;
        histogram: number;
    };
    /**
     * Bollinger Bands
     */
    static bollingerBands(prices: number[], period?: number, stdDevMultiplier?: number): {
        upper: number;
        middle: number;
        lower: number;
        width: number;
    };
    /**
     * Average True Range (ATR)
     */
    static atr(highs: number[], lows: number[], closes: number[], period?: number): number;
    /**
     * Stochastic Oscillator
     */
    static stochastic(highs: number[], lows: number[], closes: number[], period?: number): {
        k: number;
        d: number;
    };
    /**
     * Volume Weighted Average Price (VWAP)
     */
    static vwap(prices: number[], volumes: number[]): number;
}
/**
 * Statistical Functions
 */
export declare class Statistics {
    /**
     * Calculate mean
     */
    static mean(values: number[]): number;
    /**
     * Calculate median
     */
    static median(values: number[]): number;
    /**
     * Calculate standard deviation
     */
    static standardDeviation(values: number[]): number;
    /**
     * Calculate variance
     */
    static variance(values: number[]): number;
    /**
     * Calculate percentile
     */
    static percentile(values: number[], p: number): number;
    /**
     * Calculate z-score
     */
    static zScore(value: number, mean: number, stdDev: number): number;
    /**
     * Calculate correlation coefficient
     */
    static correlation(x: number[], y: number[]): number;
    /**
     * Calculate returns from prices
     */
    static returns(prices: number[]): number[];
    /**
     * Calculate Sharpe Ratio
     */
    static sharpeRatio(returns: number[], riskFreeRate?: number): number;
    /**
     * Calculate Maximum Drawdown
     */
    static maxDrawdown(values: number[]): number;
    /**
     * Linear regression
     */
    static linearRegression(x: number[], y: number[]): {
        slope: number;
        intercept: number;
        r2: number;
    };
}
/**
 * Time Series Analysis
 */
export declare class TimeSeries {
    /**
     * Detect trend direction
     */
    static detectTrend(values: number[], period?: number): 'up' | 'down' | 'sideways';
    /**
     * Find support and resistance levels
     */
    static findSupportResistance(highs: number[], lows: number[], period?: number): {
        support: number[];
        resistance: number[];
    };
    /**
     * Detect volatility regime
     */
    static volatilityRegime(values: number[], shortPeriod?: number, longPeriod?: number): 'high' | 'normal' | 'low';
    /**
     * Simple moving average crossover signal
     */
    static maCrossover(prices: number[], fastPeriod?: number, slowPeriod?: number): 'bullish' | 'bearish' | 'neutral';
}
//# sourceMappingURL=index.d.ts.map