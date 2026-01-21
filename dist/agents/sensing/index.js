"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Sensing Agents
// Data collection and monitoring agents
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorrelationAnalyzerAgent = exports.NewsAggregatorAgent = exports.SentimentAnalysisAgent = exports.AnomalyDetectorAgent = exports.VolatilityCalculatorAgent = exports.PriceTickerAgent = void 0;
const BaseAgent_1 = require("../BaseAgent");
// ═══════════════════════════════════════════════════════════════════════════════
// Price Ticker Agent - Real-time price monitoring
// ═══════════════════════════════════════════════════════════════════════════════
class PriceTickerAgent extends BaseAgent_1.BaseAgent {
    prices = new Map();
    watchlist = ['BTC', 'ETH', 'SOL', 'AAPL', 'GOOGL', 'MSFT'];
    constructor() {
        super({
            id: 'price_ticker',
            name: 'Price Ticker Agent',
            tier: 'sensing',
            description: 'Real-time price monitoring',
            version: '1.0.0',
        });
        this.tickRate = 1000;
    }
    async onStart() {
        this.initializePrices();
        this.emit('price:ticker_started', { symbols: this.watchlist });
    }
    async onStop() { }
    async onTick() {
        for (const symbol of this.watchlist) {
            const data = this.generateMarketData(symbol);
            this.prices.set(symbol, data);
            this.emit('price:update', data);
        }
    }
    initializePrices() {
        const basePrices = {
            BTC: 95000, ETH: 3200, SOL: 180,
            AAPL: 220, GOOGL: 175, MSFT: 415,
        };
        for (const [symbol, price] of Object.entries(basePrices)) {
            this.prices.set(symbol, this.createMarketData(symbol, price));
        }
    }
    generateMarketData(symbol) {
        const current = this.prices.get(symbol);
        const basePrice = current?.price || 100;
        const change = (Math.random() - 0.5) * basePrice * 0.002;
        const newPrice = basePrice + change;
        return this.createMarketData(symbol, newPrice, current);
    }
    createMarketData(symbol, price, prev) {
        const spread = price * 0.001;
        return {
            symbol, price,
            volume: Math.random() * 1000000,
            bid: price - spread / 2,
            ask: price + spread / 2,
            high24h: prev ? Math.max(prev.high24h, price) : price * 1.02,
            low24h: prev ? Math.min(prev.low24h, price) : price * 0.98,
            change24h: prev ? ((price - prev.price) / prev.price) * 100 : 0,
            timestamp: Date.now(),
        };
    }
    getPrice(symbol) { return this.prices.get(symbol); }
    getAllPrices() { return Array.from(this.prices.values()); }
    addToWatchlist(symbol) {
        if (!this.watchlist.includes(symbol)) {
            this.watchlist.push(symbol);
            this.prices.set(symbol, this.createMarketData(symbol, 100));
        }
    }
}
exports.PriceTickerAgent = PriceTickerAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Volatility Calculator Agent
// ═══════════════════════════════════════════════════════════════════════════════
class VolatilityCalculatorAgent extends BaseAgent_1.BaseAgent {
    priceHistory = new Map();
    volatility = new Map();
    constructor() {
        super({
            id: 'volatility_calculator',
            name: 'Volatility Calculator Agent',
            tier: 'sensing',
            description: 'Calculate price volatility',
            version: '1.0.0',
        });
        this.tickRate = 5000;
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
            if (prices.length >= 2) {
                const vol = this.calculateVolatility(prices);
                this.volatility.set(symbol, vol);
                this.emit('volatility:update', { symbol, volatility: vol });
            }
        }
    }
    addPrice(symbol, price) {
        if (!this.priceHistory.has(symbol))
            this.priceHistory.set(symbol, []);
        const history = this.priceHistory.get(symbol);
        history.push(price);
        if (history.length > 20)
            history.shift();
    }
    calculateVolatility(prices) {
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
        }
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        return Math.sqrt(variance) * Math.sqrt(252) * 100;
    }
    getVolatility(symbol) { return this.volatility.get(symbol); }
}
exports.VolatilityCalculatorAgent = VolatilityCalculatorAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Anomaly Detector Agent
// ═══════════════════════════════════════════════════════════════════════════════
class AnomalyDetectorAgent extends BaseAgent_1.BaseAgent {
    thresholds = new Map();
    anomalies = [];
    constructor() {
        super({
            id: 'anomaly_detector',
            name: 'Anomaly Detector Agent',
            tier: 'sensing',
            description: 'Detect statistical anomalies',
            version: '1.0.0',
        });
        this.tickRate = 1000;
    }
    async onStart() {
        this.subscribe('price:update', (event) => {
            this.checkAnomaly(event.payload);
        });
    }
    async onStop() { }
    async onTick() { }
    checkAnomaly(data) {
        const key = `${data.symbol}_change`;
        let stats = this.thresholds.get(key) || { mean: 0, std: 1 };
        const zscore = Math.abs((data.change24h - stats.mean) / stats.std);
        if (zscore > 2.5) {
            const anomaly = { symbol: data.symbol, value: data.change24h, zscore, timestamp: Date.now() };
            this.anomalies.push(anomaly);
            this.emit('anomaly:detected', anomaly);
            if (this.anomalies.length > 100)
                this.anomalies.shift();
        }
        const alpha = 0.1;
        stats.mean = alpha * data.change24h + (1 - alpha) * stats.mean;
        stats.std = Math.max(0.01, alpha * Math.abs(data.change24h - stats.mean) + (1 - alpha) * stats.std);
        this.thresholds.set(key, stats);
    }
    getAnomalies() { return [...this.anomalies]; }
}
exports.AnomalyDetectorAgent = AnomalyDetectorAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Sentiment Analysis Agent
// ═══════════════════════════════════════════════════════════════════════════════
class SentimentAnalysisAgent extends BaseAgent_1.BaseAgent {
    sentiments = new Map();
    constructor() {
        super({
            id: 'sentiment_analysis',
            name: 'Sentiment Analysis Agent',
            tier: 'sensing',
            description: 'Analyze market sentiment',
            version: '1.0.0',
        });
        this.tickRate = 30000;
    }
    async onStart() {
        ['BTC', 'ETH', 'SOL', 'MARKET'].forEach(s => {
            this.sentiments.set(s, {
                score: 0.5 + (Math.random() - 0.5) * 0.4,
                volume: Math.floor(Math.random() * 10000),
                sources: Math.floor(Math.random() * 50) + 10,
            });
        });
    }
    async onStop() { }
    async onTick() {
        for (const [symbol, data] of this.sentiments) {
            data.score = Math.max(0, Math.min(1, data.score + (Math.random() - 0.5) * 0.1));
            this.emit('sentiment:update', { symbol, ...data });
        }
    }
    getSentiment(symbol) {
        const data = this.sentiments.get(symbol);
        if (!data)
            return undefined;
        const label = data.score > 0.6 ? 'bullish' : data.score < 0.4 ? 'bearish' : 'neutral';
        return { score: data.score, label };
    }
}
exports.SentimentAnalysisAgent = SentimentAnalysisAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// News Aggregator Agent
// ═══════════════════════════════════════════════════════════════════════════════
class NewsAggregatorAgent extends BaseAgent_1.BaseAgent {
    newsItems = [];
    constructor() {
        super({
            id: 'news_aggregator',
            name: 'News Aggregator Agent',
            tier: 'sensing',
            description: 'Aggregate news from multiple sources',
            version: '1.0.0',
        });
        this.tickRate = 60000;
    }
    async onStart() {
        for (let i = 0; i < 10; i++)
            this.newsItems.push(this.generateNews());
    }
    async onStop() { }
    async onTick() {
        if (Math.random() > 0.7) {
            const news = this.generateNews();
            this.newsItems.unshift(news);
            this.emit('news:new', news);
            if (this.newsItems.length > 100)
                this.newsItems.pop();
        }
    }
    generateNews() {
        const headlines = [
            { title: 'Market Rally Continues', symbols: ['MARKET'], sentiment: 0.7 },
            { title: 'Bitcoin Breaks Resistance', symbols: ['BTC'], sentiment: 0.8 },
            { title: 'Fed Signals Rate Pause', symbols: ['MARKET'], sentiment: 0.6 },
            { title: 'Ethereum Upgrade Success', symbols: ['ETH'], sentiment: 0.75 },
            { title: 'Crypto Markets Mixed', symbols: ['BTC', 'ETH'], sentiment: 0.5 },
        ];
        const h = headlines[Math.floor(Math.random() * headlines.length)];
        return {
            id: `news_${Date.now()}`,
            title: h.title,
            source: ['Reuters', 'Bloomberg', 'CoinDesk'][Math.floor(Math.random() * 3)],
            sentiment: h.sentiment,
            symbols: h.symbols,
            timestamp: Date.now(),
        };
    }
    getNews(limit = 10) { return this.newsItems.slice(0, limit); }
}
exports.NewsAggregatorAgent = NewsAggregatorAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Correlation Analyzer Agent
// ═══════════════════════════════════════════════════════════════════════════════
class CorrelationAnalyzerAgent extends BaseAgent_1.BaseAgent {
    priceHistory = new Map();
    correlations = new Map();
    constructor() {
        super({
            id: 'correlation_analyzer',
            name: 'Correlation Analyzer Agent',
            tier: 'sensing',
            description: 'Analyze correlations between assets',
            version: '1.0.0',
        });
        this.tickRate = 10000;
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
        const symbols = Array.from(this.priceHistory.keys());
        for (let i = 0; i < symbols.length; i++) {
            for (let j = i + 1; j < symbols.length; j++) {
                const corr = this.calculateCorrelation(this.priceHistory.get(symbols[i]), this.priceHistory.get(symbols[j]));
                if (corr !== null) {
                    const key = `${symbols[i]}_${symbols[j]}`;
                    this.correlations.set(key, corr);
                    this.emit('correlation:update', { pair: key, correlation: corr });
                }
            }
        }
    }
    calculateCorrelation(a, b) {
        const n = Math.min(a.length, b.length);
        if (n < 5)
            return null;
        const meanA = a.slice(-n).reduce((s, v) => s + v, 0) / n;
        const meanB = b.slice(-n).reduce((s, v) => s + v, 0) / n;
        let num = 0, denA = 0, denB = 0;
        for (let i = 0; i < n; i++) {
            const dA = a[a.length - n + i] - meanA;
            const dB = b[b.length - n + i] - meanB;
            num += dA * dB;
            denA += dA * dA;
            denB += dB * dB;
        }
        const den = Math.sqrt(denA * denB);
        return den === 0 ? 0 : num / den;
    }
    getCorrelation(pair) {
        return this.correlations.get(pair);
    }
}
exports.CorrelationAnalyzerAgent = CorrelationAnalyzerAgent;
//# sourceMappingURL=index.js.map