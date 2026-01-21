// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Decision Agents
// Analysis and signal generation agents
// ═══════════════════════════════════════════════════════════════════════════════

import { BaseAgent } from '../BaseAgent';
import { SignalData, MarketData } from '../../core/types';

// ═══════════════════════════════════════════════════════════════════════════════
// RSI Agent - Relative Strength Index
// ═══════════════════════════════════════════════════════════════════════════════

export class RSIAgent extends BaseAgent {
  private priceHistory: Map<string, number[]> = new Map();
  private rsiValues: Map<string, number> = new Map();
  private period = 14;

  constructor() {
    super({
      id: 'rsi_agent',
      name: 'RSI Agent',
      tier: 'decision',
      description: 'Calculate and analyze RSI indicator',
      version: '1.0.0',
    });
    this.tickRate = 2000;
  }

  protected async onStart(): Promise<void> {
    this.subscribe('price:update', (event) => {
      const data = event.payload as MarketData;
      this.addPrice(data.symbol, data.price);
    });
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    for (const [symbol, prices] of this.priceHistory) {
      if (prices.length >= this.period + 1) {
        const rsi = this.calculateRSI(prices);
        this.rsiValues.set(symbol, rsi);
        
        const signal = this.generateSignal(symbol, rsi);
        if (signal) {
          this.emit('signal:rsi', signal);
        }
        
        this.emit('indicator:rsi', { symbol, rsi });
      }
    }
  }

  private addPrice(symbol: string, price: number): void {
    if (!this.priceHistory.has(symbol)) this.priceHistory.set(symbol, []);
    const h = this.priceHistory.get(symbol)!;
    h.push(price);
    if (h.length > 50) h.shift();
  }

  private calculateRSI(prices: number[]): number {
    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const gains = changes.slice(-this.period).filter(c => c > 0);
    const losses = changes.slice(-this.period).filter(c => c < 0).map(Math.abs);

    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / this.period : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / this.period : 0;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private generateSignal(symbol: string, rsi: number): SignalData | null {
    if (rsi < 30) {
      return {
        symbol, direction: 'long', strength: (30 - rsi) / 30,
        confidence: 0.7, timeframe: '4h',
        metadata: { indicator: 'RSI', value: rsi, condition: 'oversold' }
      };
    } else if (rsi > 70) {
      return {
        symbol, direction: 'short', strength: (rsi - 70) / 30,
        confidence: 0.7, timeframe: '4h',
        metadata: { indicator: 'RSI', value: rsi, condition: 'overbought' }
      };
    }
    return null;
  }

  getRSI(symbol: string): number | undefined { return this.rsiValues.get(symbol); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MACD Agent - Moving Average Convergence Divergence
// ═══════════════════════════════════════════════════════════════════════════════

export class MACDAgent extends BaseAgent {
  private priceHistory: Map<string, number[]> = new Map();
  private macdValues: Map<string, { macd: number; signal: number; histogram: number }> = new Map();

  constructor() {
    super({
      id: 'macd_agent',
      name: 'MACD Agent',
      tier: 'decision',
      description: 'Calculate MACD indicator',
      version: '1.0.0',
    });
    this.tickRate = 2000;
  }

  protected async onStart(): Promise<void> {
    this.subscribe('price:update', (event) => {
      const data = event.payload as MarketData;
      if (!this.priceHistory.has(data.symbol)) this.priceHistory.set(data.symbol, []);
      const h = this.priceHistory.get(data.symbol)!;
      h.push(data.price);
      if (h.length > 50) h.shift();
    });
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    for (const [symbol, prices] of this.priceHistory) {
      if (prices.length >= 26) {
        const macd = this.calculateMACD(prices);
        this.macdValues.set(symbol, macd);
        this.emit('indicator:macd', { symbol, ...macd });

        // Generate signal on histogram crossover
        if (Math.abs(macd.histogram) < prices[prices.length - 1] * 0.001) {
          const signal: SignalData = {
            symbol,
            direction: macd.macd > macd.signal ? 'long' : 'short',
            strength: Math.min(1, Math.abs(macd.histogram) / (prices[prices.length - 1] * 0.01)),
            confidence: 0.65,
            timeframe: '4h',
            metadata: { indicator: 'MACD', ...macd }
          };
          this.emit('signal:macd', signal);
        }
      }
    }
  }

  private calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    const signal = macd * 0.9; // Simplified signal line
    return { macd, signal, histogram: macd - signal };
  }

  private calculateEMA(prices: number[], period: number): number {
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  }

  getMACD(symbol: string) { return this.macdValues.get(symbol); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Bollinger Band Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class BollingerBandAgent extends BaseAgent {
  private priceHistory: Map<string, number[]> = new Map();
  private bands: Map<string, { upper: number; middle: number; lower: number; width: number }> = new Map();

  constructor() {
    super({
      id: 'bollinger_band_agent',
      name: 'Bollinger Band Agent',
      tier: 'decision',
      description: 'Calculate Bollinger Bands',
      version: '1.0.0',
    });
    this.tickRate = 2000;
  }

  protected async onStart(): Promise<void> {
    this.subscribe('price:update', (event) => {
      const data = event.payload as MarketData;
      if (!this.priceHistory.has(data.symbol)) this.priceHistory.set(data.symbol, []);
      const h = this.priceHistory.get(data.symbol)!;
      h.push(data.price);
      if (h.length > 30) h.shift();
    });
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    for (const [symbol, prices] of this.priceHistory) {
      if (prices.length >= 20) {
        const bb = this.calculateBB(prices.slice(-20));
        this.bands.set(symbol, bb);
        this.emit('indicator:bollinger', { symbol, ...bb });

        const currentPrice = prices[prices.length - 1];
        if (currentPrice < bb.lower) {
          this.emit('signal:bollinger', {
            symbol, direction: 'long', strength: (bb.lower - currentPrice) / bb.width,
            confidence: 0.6, timeframe: '4h',
            metadata: { indicator: 'BB', condition: 'below_lower' }
          } as SignalData);
        } else if (currentPrice > bb.upper) {
          this.emit('signal:bollinger', {
            symbol, direction: 'short', strength: (currentPrice - bb.upper) / bb.width,
            confidence: 0.6, timeframe: '4h',
            metadata: { indicator: 'BB', condition: 'above_upper' }
          } as SignalData);
        }
      }
    }
  }

  private calculateBB(prices: number[]): { upper: number; middle: number; lower: number; width: number } {
    const middle = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - middle, 2), 0) / prices.length;
    const std = Math.sqrt(variance);
    const upper = middle + 2 * std;
    const lower = middle - 2 * std;
    return { upper, middle, lower, width: upper - lower };
  }

  getBands(symbol: string) { return this.bands.get(symbol); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Moving Average Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class MovingAverageAgent extends BaseAgent {
  private priceHistory: Map<string, number[]> = new Map();
  private mas: Map<string, { sma20: number; sma50: number; ema12: number; ema26: number }> = new Map();

  constructor() {
    super({
      id: 'moving_average_agent',
      name: 'Moving Average Agent',
      tier: 'decision',
      description: 'Calculate various moving averages',
      version: '1.0.0',
    });
    this.tickRate = 2000;
  }

  protected async onStart(): Promise<void> {
    this.subscribe('price:update', (event) => {
      const data = event.payload as MarketData;
      if (!this.priceHistory.has(data.symbol)) this.priceHistory.set(data.symbol, []);
      const h = this.priceHistory.get(data.symbol)!;
      h.push(data.price);
      if (h.length > 60) h.shift();
    });
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    for (const [symbol, prices] of this.priceHistory) {
      if (prices.length >= 50) {
        const ma = {
          sma20: this.sma(prices.slice(-20)),
          sma50: this.sma(prices.slice(-50)),
          ema12: this.ema(prices, 12),
          ema26: this.ema(prices, 26),
        };
        this.mas.set(symbol, ma);
        this.emit('indicator:ma', { symbol, ...ma });

        // Golden/Death cross detection
        const prevEma12 = this.ema(prices.slice(0, -1), 12);
        const prevEma26 = this.ema(prices.slice(0, -1), 26);
        if (prevEma12 < prevEma26 && ma.ema12 > ma.ema26) {
          this.emit('signal:ma_cross', {
            symbol, direction: 'long', strength: 0.8,
            confidence: 0.7, timeframe: '1d',
            metadata: { type: 'golden_cross' }
          } as SignalData);
        } else if (prevEma12 > prevEma26 && ma.ema12 < ma.ema26) {
          this.emit('signal:ma_cross', {
            symbol, direction: 'short', strength: 0.8,
            confidence: 0.7, timeframe: '1d',
            metadata: { type: 'death_cross' }
          } as SignalData);
        }
      }
    }
  }

  private sma(prices: number[]): number {
    return prices.reduce((a, b) => a + b, 0) / prices.length;
  }

  private ema(prices: number[], period: number): number {
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  }

  getMA(symbol: string) { return this.mas.get(symbol); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Signal Ensemble Agent - Combines signals from multiple indicators
// ═══════════════════════════════════════════════════════════════════════════════

export class SignalEnsembleAgent extends BaseAgent {
  private signals: Map<string, SignalData[]> = new Map();
  private consensus: Map<string, SignalData> = new Map();

  constructor() {
    super({
      id: 'signal_ensemble',
      name: 'Signal Ensemble Agent',
      tier: 'decision',
      description: 'Combine signals from multiple indicators',
      version: '1.0.0',
    });
    this.tickRate = 5000;
  }

  protected async onStart(): Promise<void> {
    this.subscribe('signal:*', (event) => {
      const signal = event.payload as SignalData;
      if (!this.signals.has(signal.symbol)) this.signals.set(signal.symbol, []);
      const sigs = this.signals.get(signal.symbol)!;
      sigs.push(signal);
      // Keep only recent signals
      const cutoff = Date.now() - 60000;
      while (sigs.length > 0 && (sigs[0].expiry || Date.now()) < cutoff) {
        sigs.shift();
      }
    });
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    for (const [symbol, signals] of this.signals) {
      if (signals.length >= 2) {
        const consensus = this.calculateConsensus(symbol, signals);
        if (consensus) {
          this.consensus.set(symbol, consensus);
          this.emit('signal:consensus', consensus);
        }
      }
    }
  }

  private calculateConsensus(symbol: string, signals: SignalData[]): SignalData | null {
    const longSignals = signals.filter(s => s.direction === 'long');
    const shortSignals = signals.filter(s => s.direction === 'short');

    const longScore = longSignals.reduce((sum, s) => sum + s.strength * s.confidence, 0);
    const shortScore = shortSignals.reduce((sum, s) => sum + s.strength * s.confidence, 0);

    if (Math.abs(longScore - shortScore) < 0.2) return null;

    const direction = longScore > shortScore ? 'long' : 'short';
    const winningSignals = direction === 'long' ? longSignals : shortSignals;
    const avgStrength = winningSignals.reduce((s, sig) => s + sig.strength, 0) / winningSignals.length;
    const avgConfidence = winningSignals.reduce((s, sig) => s + sig.confidence, 0) / winningSignals.length;

    return {
      symbol, direction, strength: avgStrength,
      confidence: avgConfidence * (winningSignals.length / signals.length),
      timeframe: '4h',
      metadata: { 
        type: 'ensemble',
        signalCount: signals.length,
        agreement: winningSignals.length / signals.length
      }
    };
  }

  getConsensus(symbol: string) { return this.consensus.get(symbol); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fear & Greed Index Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class FearGreedIndexAgent extends BaseAgent {
  private index = 50;
  private history: Array<{ value: number; timestamp: number }> = [];

  constructor() {
    super({
      id: 'fear_greed_index',
      name: 'Fear & Greed Index Agent',
      tier: 'decision',
      description: 'Calculate market fear and greed index',
      version: '1.0.0',
    });
    this.tickRate = 30000;
  }

  protected async onStart(): Promise<void> {
    this.subscribe('volatility:update', (event) => {
      const { volatility } = event.payload as { volatility: number };
      // High volatility increases fear
      this.adjustIndex(-volatility * 0.1);
    });

    this.subscribe('sentiment:update', (event) => {
      const { score } = event.payload as { score: number };
      // Sentiment directly affects index
      this.adjustIndex((score - 0.5) * 10);
    });
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    // Add some random drift
    this.adjustIndex((Math.random() - 0.5) * 5);
    
    this.history.push({ value: this.index, timestamp: Date.now() });
    if (this.history.length > 100) this.history.shift();

    this.emit('indicator:fear_greed', {
      value: this.index,
      label: this.getLabel(),
      history: this.history.slice(-10)
    });
  }

  private adjustIndex(delta: number): void {
    this.index = Math.max(0, Math.min(100, this.index + delta));
  }

  private getLabel(): string {
    if (this.index <= 20) return 'Extreme Fear';
    if (this.index <= 40) return 'Fear';
    if (this.index <= 60) return 'Neutral';
    if (this.index <= 80) return 'Greed';
    return 'Extreme Greed';
  }

  getIndex(): { value: number; label: string } {
    return { value: this.index, label: this.getLabel() };
  }
}
