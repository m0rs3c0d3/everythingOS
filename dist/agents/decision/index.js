"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Decision Agents
// Analysis and signal generation agents
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.FearGreedIndexAgent = exports.SignalEnsembleAgent = exports.MovingAverageAgent = exports.BollingerBandAgent = exports.MACDAgent = exports.RSIAgent = void 0;
const BaseAgent_1 = require("../BaseAgent");
// ═══════════════════════════════════════════════════════════════════════════════
// RSI Agent - Relative Strength Index
// ═══════════════════════════════════════════════════════════════════════════════
class RSIAgent extends BaseAgent_1.BaseAgent {
    priceHistory = new Map();
    rsiValues = new Map();
    period = 14;
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
    async onStart() {
        this.subscribe('price:update', (event) => {
            const data = event.payload;
            this.addPrice(data.symbol, data.price);
        });
    }
    async onStop() { }
    async onTick() {
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
    addPrice(symbol, price) {
        if (!this.priceHistory.has(symbol))
            this.priceHistory.set(symbol, []);
        const h = this.priceHistory.get(symbol);
        h.push(price);
        if (h.length > 50)
            h.shift();
    }
    calculateRSI(prices) {
        const changes = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i - 1]);
        }
        const gains = changes.slice(-this.period).filter(c => c > 0);
        const losses = changes.slice(-this.period).filter(c => c < 0).map(Math.abs);
        const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / this.period : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / this.period : 0;
        if (avgLoss === 0)
            return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
    generateSignal(symbol, rsi) {
        if (rsi < 30) {
            return {
                symbol, direction: 'long', strength: (30 - rsi) / 30,
                confidence: 0.7, timeframe: '4h',
                metadata: { indicator: 'RSI', value: rsi, condition: 'oversold' }
            };
        }
        else if (rsi > 70) {
            return {
                symbol, direction: 'short', strength: (rsi - 70) / 30,
                confidence: 0.7, timeframe: '4h',
                metadata: { indicator: 'RSI', value: rsi, condition: 'overbought' }
            };
        }
        return null;
    }
    getRSI(symbol) { return this.rsiValues.get(symbol); }
}
exports.RSIAgent = RSIAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// MACD Agent - Moving Average Convergence Divergence
// ═══════════════════════════════════════════════════════════════════════════════
class MACDAgent extends BaseAgent_1.BaseAgent {
    priceHistory = new Map();
    macdValues = new Map();
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
    async onStart() {
        this.subscribe('price:update', (event) => {
            const data = event.payload;
            if (!this.priceHistory.has(data.symbol))
                this.priceHistory.set(data.symbol, []);
            const h = this.priceHistory.get(data.symbol);
            h.push(data.price);
            if (h.length > 50)
                h.shift();
        });
    }
    async onStop() { }
    async onTick() {
        for (const [symbol, prices] of this.priceHistory) {
            if (prices.length >= 26) {
                const macd = this.calculateMACD(prices);
                this.macdValues.set(symbol, macd);
                this.emit('indicator:macd', { symbol, ...macd });
                // Generate signal on histogram crossover
                if (Math.abs(macd.histogram) < prices[prices.length - 1] * 0.001) {
                    const signal = {
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
    calculateMACD(prices) {
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        const macd = ema12 - ema26;
        const signal = macd * 0.9; // Simplified signal line
        return { macd, signal, histogram: macd - signal };
    }
    calculateEMA(prices, period) {
        const k = 2 / (period + 1);
        let ema = prices[0];
        for (let i = 1; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }
        return ema;
    }
    getMACD(symbol) { return this.macdValues.get(symbol); }
}
exports.MACDAgent = MACDAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Bollinger Band Agent
// ═══════════════════════════════════════════════════════════════════════════════
class BollingerBandAgent extends BaseAgent_1.BaseAgent {
    priceHistory = new Map();
    bands = new Map();
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
    async onStart() {
        this.subscribe('price:update', (event) => {
            const data = event.payload;
            if (!this.priceHistory.has(data.symbol))
                this.priceHistory.set(data.symbol, []);
            const h = this.priceHistory.get(data.symbol);
            h.push(data.price);
            if (h.length > 30)
                h.shift();
        });
    }
    async onStop() { }
    async onTick() {
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
                    });
                }
                else if (currentPrice > bb.upper) {
                    this.emit('signal:bollinger', {
                        symbol, direction: 'short', strength: (currentPrice - bb.upper) / bb.width,
                        confidence: 0.6, timeframe: '4h',
                        metadata: { indicator: 'BB', condition: 'above_upper' }
                    });
                }
            }
        }
    }
    calculateBB(prices) {
        const middle = prices.reduce((a, b) => a + b, 0) / prices.length;
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - middle, 2), 0) / prices.length;
        const std = Math.sqrt(variance);
        const upper = middle + 2 * std;
        const lower = middle - 2 * std;
        return { upper, middle, lower, width: upper - lower };
    }
    getBands(symbol) { return this.bands.get(symbol); }
}
exports.BollingerBandAgent = BollingerBandAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Moving Average Agent
// ═══════════════════════════════════════════════════════════════════════════════
class MovingAverageAgent extends BaseAgent_1.BaseAgent {
    priceHistory = new Map();
    mas = new Map();
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
    async onStart() {
        this.subscribe('price:update', (event) => {
            const data = event.payload;
            if (!this.priceHistory.has(data.symbol))
                this.priceHistory.set(data.symbol, []);
            const h = this.priceHistory.get(data.symbol);
            h.push(data.price);
            if (h.length > 60)
                h.shift();
        });
    }
    async onStop() { }
    async onTick() {
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
                    });
                }
                else if (prevEma12 > prevEma26 && ma.ema12 < ma.ema26) {
                    this.emit('signal:ma_cross', {
                        symbol, direction: 'short', strength: 0.8,
                        confidence: 0.7, timeframe: '1d',
                        metadata: { type: 'death_cross' }
                    });
                }
            }
        }
    }
    sma(prices) {
        return prices.reduce((a, b) => a + b, 0) / prices.length;
    }
    ema(prices, period) {
        const k = 2 / (period + 1);
        let ema = prices[0];
        for (let i = 1; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }
        return ema;
    }
    getMA(symbol) { return this.mas.get(symbol); }
}
exports.MovingAverageAgent = MovingAverageAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Signal Ensemble Agent - Combines signals from multiple indicators
// ═══════════════════════════════════════════════════════════════════════════════
class SignalEnsembleAgent extends BaseAgent_1.BaseAgent {
    signals = new Map();
    consensus = new Map();
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
    async onStart() {
        this.subscribe('signal:*', (event) => {
            const signal = event.payload;
            if (!this.signals.has(signal.symbol))
                this.signals.set(signal.symbol, []);
            const sigs = this.signals.get(signal.symbol);
            sigs.push(signal);
            // Keep only recent signals
            const cutoff = Date.now() - 60000;
            while (sigs.length > 0 && (sigs[0].expiry || Date.now()) < cutoff) {
                sigs.shift();
            }
        });
    }
    async onStop() { }
    async onTick() {
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
    calculateConsensus(symbol, signals) {
        const longSignals = signals.filter(s => s.direction === 'long');
        const shortSignals = signals.filter(s => s.direction === 'short');
        const longScore = longSignals.reduce((sum, s) => sum + s.strength * s.confidence, 0);
        const shortScore = shortSignals.reduce((sum, s) => sum + s.strength * s.confidence, 0);
        if (Math.abs(longScore - shortScore) < 0.2)
            return null;
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
    getConsensus(symbol) { return this.consensus.get(symbol); }
}
exports.SignalEnsembleAgent = SignalEnsembleAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Fear & Greed Index Agent
// ═══════════════════════════════════════════════════════════════════════════════
class FearGreedIndexAgent extends BaseAgent_1.BaseAgent {
    index = 50;
    history = [];
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
    async onStart() {
        this.subscribe('volatility:update', (event) => {
            const { volatility } = event.payload;
            // High volatility increases fear
            this.adjustIndex(-volatility * 0.1);
        });
        this.subscribe('sentiment:update', (event) => {
            const { score } = event.payload;
            // Sentiment directly affects index
            this.adjustIndex((score - 0.5) * 10);
        });
    }
    async onStop() { }
    async onTick() {
        // Add some random drift
        this.adjustIndex((Math.random() - 0.5) * 5);
        this.history.push({ value: this.index, timestamp: Date.now() });
        if (this.history.length > 100)
            this.history.shift();
        this.emit('indicator:fear_greed', {
            value: this.index,
            label: this.getLabel(),
            history: this.history.slice(-10)
        });
    }
    adjustIndex(delta) {
        this.index = Math.max(0, Math.min(100, this.index + delta));
    }
    getLabel() {
        if (this.index <= 20)
            return 'Extreme Fear';
        if (this.index <= 40)
            return 'Fear';
        if (this.index <= 60)
            return 'Neutral';
        if (this.index <= 80)
            return 'Greed';
        return 'Extreme Greed';
    }
    getIndex() {
        return { value: this.index, label: this.getLabel() };
    }
}
exports.FearGreedIndexAgent = FearGreedIndexAgent;
//# sourceMappingURL=index.js.map