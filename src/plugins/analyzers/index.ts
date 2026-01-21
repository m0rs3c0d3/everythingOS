// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Analyzers
// Shared analysis functions for agents
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Technical Indicators
 * Common trading indicators
 */
export class TechnicalIndicators {
  /**
   * Simple Moving Average
   */
  static sma(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * Exponential Moving Average
   */
  static ema(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  }

  /**
   * Relative Strength Index
   */
  static rsi(prices: number[], period = 14): number {
    if (prices.length < period + 1) return 50;

    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const recentChanges = changes.slice(-period);
    const gains = recentChanges.filter(c => c > 0);
    const losses = recentChanges.filter(c => c < 0).map(Math.abs);

    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * MACD (Moving Average Convergence Divergence)
   */
  static macd(prices: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): {
    macd: number;
    signal: number;
    histogram: number;
  } {
    const fastEma = this.ema(prices, fastPeriod);
    const slowEma = this.ema(prices, slowPeriod);
    const macd = fastEma - slowEma;
    
    // Simplified signal line (would need MACD history for accurate calculation)
    const signal = macd * (2 / (signalPeriod + 1));
    
    return {
      macd,
      signal,
      histogram: macd - signal,
    };
  }

  /**
   * Bollinger Bands
   */
  static bollingerBands(prices: number[], period = 20, stdDevMultiplier = 2): {
    upper: number;
    middle: number;
    lower: number;
    width: number;
  } {
    const slice = prices.slice(-period);
    const middle = slice.reduce((a, b) => a + b, 0) / slice.length;
    
    const variance = slice.reduce((sum, p) => sum + Math.pow(p - middle, 2), 0) / slice.length;
    const stdDev = Math.sqrt(variance);
    
    const upper = middle + stdDevMultiplier * stdDev;
    const lower = middle - stdDevMultiplier * stdDev;
    
    return {
      upper,
      middle,
      lower,
      width: upper - lower,
    };
  }

  /**
   * Average True Range (ATR)
   */
  static atr(highs: number[], lows: number[], closes: number[], period = 14): number {
    if (highs.length < 2) return 0;

    const trueRanges: number[] = [];
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }

    return this.sma(trueRanges, period);
  }

  /**
   * Stochastic Oscillator
   */
  static stochastic(highs: number[], lows: number[], closes: number[], period = 14): {
    k: number;
    d: number;
  } {
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];

    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    const k = highestHigh === lowestLow 
      ? 50 
      : ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

    // %D is typically a 3-period SMA of %K
    const d = k; // Simplified

    return { k, d };
  }

  /**
   * Volume Weighted Average Price (VWAP)
   */
  static vwap(prices: number[], volumes: number[]): number {
    if (prices.length === 0 || prices.length !== volumes.length) return 0;
    
    let sumPV = 0;
    let sumV = 0;
    
    for (let i = 0; i < prices.length; i++) {
      sumPV += prices[i] * volumes[i];
      sumV += volumes[i];
    }
    
    return sumV === 0 ? 0 : sumPV / sumV;
  }
}

/**
 * Statistical Functions
 */
export class Statistics {
  /**
   * Calculate mean
   */
  static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate median
   */
  static median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Calculate standard deviation
   */
  static standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = this.mean(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate variance
   */
  static variance(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = this.mean(values);
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  /**
   * Calculate percentile
   */
  static percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate z-score
   */
  static zScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }

  /**
   * Calculate correlation coefficient
   */
  static correlation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const meanX = this.mean(x.slice(-n));
    const meanY = this.mean(y.slice(-n));

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (let i = 0; i < n; i++) {
      const dX = x[x.length - n + i] - meanX;
      const dY = y[y.length - n + i] - meanY;
      num += dX * dY;
      denX += dX * dX;
      denY += dY * dY;
    }

    const den = Math.sqrt(denX * denY);
    return den === 0 ? 0 : num / den;
  }

  /**
   * Calculate returns from prices
   */
  static returns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  /**
   * Calculate Sharpe Ratio
   */
  static sharpeRatio(returns: number[], riskFreeRate = 0): number {
    if (returns.length < 2) return 0;
    const excessReturns = returns.map(r => r - riskFreeRate / 252);
    const meanReturn = this.mean(excessReturns);
    const stdDev = this.standardDeviation(excessReturns);
    if (stdDev === 0) return 0;
    return (meanReturn * 252) / (stdDev * Math.sqrt(252));
  }

  /**
   * Calculate Maximum Drawdown
   */
  static maxDrawdown(values: number[]): number {
    if (values.length < 2) return 0;
    
    let maxDrawdown = 0;
    let peak = values[0];
    
    for (const value of values) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  /**
   * Linear regression
   */
  static linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
    const n = Math.min(x.length, y.length);
    if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

    const meanX = this.mean(x);
    const meanY = this.mean(y);

    let num = 0;
    let den = 0;

    for (let i = 0; i < n; i++) {
      num += (x[i] - meanX) * (y[i] - meanY);
      den += Math.pow(x[i] - meanX, 2);
    }

    const slope = den === 0 ? 0 : num / den;
    const intercept = meanY - slope * meanX;

    // Calculate R²
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
      const predicted = slope * x[i] + intercept;
      ssRes += Math.pow(y[i] - predicted, 2);
      ssTot += Math.pow(y[i] - meanY, 2);
    }
    const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    return { slope, intercept, r2 };
  }
}

/**
 * Time Series Analysis
 */
export class TimeSeries {
  /**
   * Detect trend direction
   */
  static detectTrend(values: number[], period = 20): 'up' | 'down' | 'sideways' {
    if (values.length < period) return 'sideways';
    
    const recent = values.slice(-period);
    const x = Array.from({ length: period }, (_, i) => i);
    const { slope } = Statistics.linearRegression(x, recent);
    
    const avgValue = Statistics.mean(recent);
    const threshold = avgValue * 0.001; // 0.1% threshold
    
    if (slope > threshold) return 'up';
    if (slope < -threshold) return 'down';
    return 'sideways';
  }

  /**
   * Find support and resistance levels
   */
  static findSupportResistance(highs: number[], lows: number[], period = 20): {
    support: number[];
    resistance: number[];
  } {
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    
    // Simple implementation: use recent highs/lows
    const sortedHighs = [...recentHighs].sort((a, b) => b - a);
    const sortedLows = [...recentLows].sort((a, b) => a - b);
    
    return {
      support: sortedLows.slice(0, 3),
      resistance: sortedHighs.slice(0, 3),
    };
  }

  /**
   * Detect volatility regime
   */
  static volatilityRegime(values: number[], shortPeriod = 10, longPeriod = 30): 'high' | 'normal' | 'low' {
    const shortVol = Statistics.standardDeviation(values.slice(-shortPeriod));
    const longVol = Statistics.standardDeviation(values.slice(-longPeriod));
    
    if (longVol === 0) return 'normal';
    
    const ratio = shortVol / longVol;
    
    if (ratio > 1.5) return 'high';
    if (ratio < 0.5) return 'low';
    return 'normal';
  }

  /**
   * Simple moving average crossover signal
   */
  static maCrossover(prices: number[], fastPeriod = 10, slowPeriod = 20): 'bullish' | 'bearish' | 'neutral' {
    if (prices.length < slowPeriod + 1) return 'neutral';
    
    const fastCurrent = TechnicalIndicators.sma(prices, fastPeriod);
    const slowCurrent = TechnicalIndicators.sma(prices, slowPeriod);
    
    const fastPrev = TechnicalIndicators.sma(prices.slice(0, -1), fastPeriod);
    const slowPrev = TechnicalIndicators.sma(prices.slice(0, -1), slowPeriod);
    
    if (fastPrev < slowPrev && fastCurrent > slowCurrent) return 'bullish';
    if (fastPrev > slowPrev && fastCurrent < slowCurrent) return 'bearish';
    return 'neutral';
  }
}
