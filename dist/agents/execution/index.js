"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Execution Agents
// Order execution and risk management agents
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaRAgent = exports.DrawdownLimiterAgent = exports.CircuitBreakerAgent = exports.ProfitTakerAgent = exports.StopLossAgent = exports.PositionSizerAgent = exports.OrderExecutorAgent = void 0;
const BaseAgent_1 = require("../BaseAgent");
// ═══════════════════════════════════════════════════════════════════════════════
// Order Executor Agent
// ═══════════════════════════════════════════════════════════════════════════════
class OrderExecutorAgent extends BaseAgent_1.BaseAgent {
    orders = new Map();
    orderCounter = 0;
    constructor() {
        super({
            id: 'order_executor',
            name: 'Order Executor Agent',
            tier: 'execution',
            description: 'Execute and manage orders',
            version: '1.0.0',
        });
        this.tickRate = 100;
    }
    async onStart() {
        this.subscribe('order:create', (event) => {
            const order = event.payload;
            this.createOrder(order);
        });
        this.subscribe('order:cancel', (event) => {
            const { orderId } = event.payload;
            this.cancelOrder(orderId);
        });
        this.subscribe('price:update', (event) => {
            const data = event.payload;
            this.checkLimitOrders(data);
        });
    }
    async onStop() { }
    async onTick() {
        // Process pending orders
        for (const [id, order] of this.orders) {
            if (order.status === 'pending') {
                this.processOrder(order);
            }
        }
    }
    createOrder(params) {
        const order = {
            id: `order_${++this.orderCounter}`,
            symbol: params.symbol || 'BTC',
            side: params.side || 'buy',
            type: params.type || 'market',
            quantity: params.quantity || 0,
            price: params.price,
            stopPrice: params.stopPrice,
            status: 'pending',
            filledQuantity: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.orders.set(order.id, order);
        this.emit('order:created', order);
        return order;
    }
    processOrder(order) {
        if (order.type === 'market') {
            // Simulate immediate fill
            order.status = 'filled';
            order.filledQuantity = order.quantity;
            order.avgFillPrice = order.price || 100; // Would get from price feed
            order.updatedAt = Date.now();
            this.emit('order:filled', order);
        }
        else {
            order.status = 'open';
            order.updatedAt = Date.now();
            this.emit('order:opened', order);
        }
    }
    checkLimitOrders(data) {
        for (const [id, order] of this.orders) {
            if (order.status !== 'open' || order.symbol !== data.symbol)
                continue;
            if (order.type === 'limit') {
                if ((order.side === 'buy' && data.price <= order.price) ||
                    (order.side === 'sell' && data.price >= order.price)) {
                    order.status = 'filled';
                    order.filledQuantity = order.quantity;
                    order.avgFillPrice = order.price;
                    order.updatedAt = Date.now();
                    this.emit('order:filled', order);
                }
            }
        }
    }
    cancelOrder(orderId) {
        const order = this.orders.get(orderId);
        if (!order || order.status === 'filled')
            return false;
        order.status = 'cancelled';
        order.updatedAt = Date.now();
        this.emit('order:cancelled', order);
        return true;
    }
    getOrder(orderId) { return this.orders.get(orderId); }
    getOpenOrders() { return Array.from(this.orders.values()).filter(o => o.status === 'open'); }
}
exports.OrderExecutorAgent = OrderExecutorAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Position Sizer Agent
// ═══════════════════════════════════════════════════════════════════════════════
class PositionSizerAgent extends BaseAgent_1.BaseAgent {
    portfolioValue = 100000;
    maxPositionPct = 0.1;
    riskPerTradePct = 0.02;
    constructor() {
        super({
            id: 'position_sizer',
            name: 'Position Sizer Agent',
            tier: 'execution',
            description: 'Calculate optimal position sizes',
            version: '1.0.0',
        });
        this.tickRate = 0;
    }
    async onStart() {
        this.subscribe('signal:consensus', (event) => {
            const signal = event.payload;
            const size = this.calculateSize(signal);
            this.emit('position:size_calculated', { signal, size });
        });
    }
    async onStop() { }
    async onTick() { }
    calculateSize(signal, price) {
        const currentPrice = price || 100;
        const maxPositionValue = this.portfolioValue * this.maxPositionPct;
        const riskAmount = this.portfolioValue * this.riskPerTradePct;
        // Adjust by confidence
        const adjustedMax = maxPositionValue * signal.confidence;
        const quantity = adjustedMax / currentPrice;
        return {
            quantity: Math.floor(quantity * 1000) / 1000,
            value: adjustedMax,
            risk: riskAmount * signal.confidence
        };
    }
    setPortfolioValue(value) { this.portfolioValue = value; }
    setMaxPositionPct(pct) { this.maxPositionPct = pct; }
}
exports.PositionSizerAgent = PositionSizerAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Stop Loss Agent
// ═══════════════════════════════════════════════════════════════════════════════
class StopLossAgent extends BaseAgent_1.BaseAgent {
    stops = new Map();
    highWatermarks = new Map();
    constructor() {
        super({
            id: 'stop_loss_agent',
            name: 'Stop Loss Agent',
            tier: 'execution',
            description: 'Manage stop loss orders',
            version: '1.0.0',
        });
        this.tickRate = 100;
    }
    async onStart() {
        this.subscribe('price:update', (event) => {
            const data = event.payload;
            this.checkStops(data);
        });
        this.subscribe('position:opened', (event) => {
            const position = event.payload;
            this.setTrailingStop(position.id, position.entryPrice * 0.95, 0.05);
        });
    }
    async onStop() { }
    async onTick() { }
    checkStops(data) {
        for (const [positionId, stop] of this.stops) {
            if (stop.type === 'trailing') {
                const hwm = this.highWatermarks.get(positionId) || data.price;
                if (data.price > hwm) {
                    this.highWatermarks.set(positionId, data.price);
                    stop.price = data.price * (1 - (stop.trailPct || 0.05));
                }
            }
            if (data.price <= stop.price) {
                this.emit('stop:triggered', {
                    positionId,
                    stopPrice: stop.price,
                    currentPrice: data.price,
                    type: stop.type
                });
                this.stops.delete(positionId);
                this.highWatermarks.delete(positionId);
            }
        }
    }
    setFixedStop(positionId, price) {
        this.stops.set(positionId, { price, type: 'fixed' });
        this.emit('stop:set', { positionId, price, type: 'fixed' });
    }
    setTrailingStop(positionId, initialPrice, trailPct) {
        this.stops.set(positionId, { price: initialPrice, type: 'trailing', trailPct });
        this.emit('stop:set', { positionId, price: initialPrice, type: 'trailing', trailPct });
    }
    removeStop(positionId) {
        this.stops.delete(positionId);
        this.highWatermarks.delete(positionId);
    }
}
exports.StopLossAgent = StopLossAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Profit Taker Agent
// ═══════════════════════════════════════════════════════════════════════════════
class ProfitTakerAgent extends BaseAgent_1.BaseAgent {
    targets = new Map();
    constructor() {
        super({
            id: 'profit_taker',
            name: 'Profit Taker Agent',
            tier: 'execution',
            description: 'Manage take profit levels',
            version: '1.0.0',
        });
        this.tickRate = 100;
    }
    async onStart() {
        this.subscribe('price:update', (event) => {
            const data = event.payload;
            this.checkTargets(data);
        });
    }
    async onStop() { }
    async onTick() { }
    checkTargets(data) {
        for (const [positionId, target] of this.targets) {
            for (const level of target.levels) {
                if (!target.taken.includes(level) && data.price >= level) {
                    target.taken.push(level);
                    this.emit('profit:taken', {
                        positionId,
                        targetPrice: level,
                        currentPrice: data.price,
                        levelsRemaining: target.levels.filter(l => !target.taken.includes(l))
                    });
                }
            }
        }
    }
    setTargets(positionId, levels) {
        this.targets.set(positionId, { levels: levels.sort((a, b) => a - b), taken: [] });
        this.emit('profit:targets_set', { positionId, levels });
    }
    removeTargets(positionId) {
        this.targets.delete(positionId);
    }
}
exports.ProfitTakerAgent = ProfitTakerAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Circuit Breaker Agent
// ═══════════════════════════════════════════════════════════════════════════════
class CircuitBreakerAgent extends BaseAgent_1.BaseAgent {
    triggered = false;
    triggerCount = 0;
    lossThreshold = -0.05; // 5% portfolio loss
    volatilityThreshold = 50; // VIX equivalent
    dailyPnL = 0;
    constructor() {
        super({
            id: 'circuit_breaker',
            name: 'Circuit Breaker Agent',
            tier: 'execution',
            description: 'Emergency trading halt mechanism',
            version: '1.0.0',
        });
        this.tickRate = 1000;
    }
    async onStart() {
        this.subscribe('portfolio:pnl_update', (event) => {
            const { dailyPnL } = event.payload;
            this.dailyPnL = dailyPnL;
        });
        this.subscribe('volatility:update', (event) => {
            const { volatility } = event.payload;
            if (volatility > this.volatilityThreshold) {
                this.trigger('high_volatility', { volatility });
            }
        });
        this.subscribe('anomaly:detected', () => {
            // Multiple anomalies might trigger circuit breaker
            this.triggerCount++;
            if (this.triggerCount > 5) {
                this.trigger('multiple_anomalies', { count: this.triggerCount });
            }
        });
    }
    async onStop() { }
    async onTick() {
        if (this.dailyPnL < this.lossThreshold) {
            this.trigger('max_loss', { pnl: this.dailyPnL });
        }
        // Reset trigger count periodically
        if (this.triggerCount > 0) {
            this.triggerCount = Math.max(0, this.triggerCount - 0.1);
        }
    }
    trigger(reason, data) {
        if (this.triggered)
            return;
        this.triggered = true;
        this.emit('circuit_breaker:triggered', {
            reason,
            timestamp: Date.now(),
            ...data
        });
        // Auto-reset after 1 hour
        setTimeout(() => this.reset(), 3600000);
    }
    reset() {
        this.triggered = false;
        this.triggerCount = 0;
        this.emit('circuit_breaker:reset', { timestamp: Date.now() });
    }
    isTriggered() { return this.triggered; }
}
exports.CircuitBreakerAgent = CircuitBreakerAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Drawdown Limiter Agent
// ═══════════════════════════════════════════════════════════════════════════════
class DrawdownLimiterAgent extends BaseAgent_1.BaseAgent {
    peakValue = 100000;
    currentValue = 100000;
    maxDrawdownPct = 0.2;
    currentDrawdown = 0;
    constructor() {
        super({
            id: 'drawdown_limiter',
            name: 'Drawdown Limiter Agent',
            tier: 'execution',
            description: 'Monitor and limit portfolio drawdown',
            version: '1.0.0',
        });
        this.tickRate = 5000;
    }
    async onStart() {
        this.subscribe('portfolio:value_update', (event) => {
            const { value } = event.payload;
            this.updateValue(value);
        });
    }
    async onStop() { }
    async onTick() {
        this.emit('drawdown:status', {
            currentDrawdown: this.currentDrawdown,
            peakValue: this.peakValue,
            currentValue: this.currentValue,
            maxAllowed: this.maxDrawdownPct,
            breached: this.currentDrawdown > this.maxDrawdownPct
        });
    }
    updateValue(value) {
        this.currentValue = value;
        if (value > this.peakValue) {
            this.peakValue = value;
        }
        this.currentDrawdown = (this.peakValue - value) / this.peakValue;
        if (this.currentDrawdown > this.maxDrawdownPct) {
            this.emit('drawdown:limit_breached', {
                drawdown: this.currentDrawdown,
                limit: this.maxDrawdownPct,
                peakValue: this.peakValue,
                currentValue: this.currentValue
            });
        }
    }
    setMaxDrawdown(pct) { this.maxDrawdownPct = pct; }
    getCurrentDrawdown() { return this.currentDrawdown; }
}
exports.DrawdownLimiterAgent = DrawdownLimiterAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// VaR (Value at Risk) Agent
// ═══════════════════════════════════════════════════════════════════════════════
class VaRAgent extends BaseAgent_1.BaseAgent {
    portfolioValue = 100000;
    returns = [];
    confidenceLevel = 0.95;
    constructor() {
        super({
            id: 'var_agent',
            name: 'VaR Agent',
            tier: 'execution',
            description: 'Calculate Value at Risk',
            version: '1.0.0',
        });
        this.tickRate = 60000;
    }
    async onStart() {
        this.subscribe('portfolio:return', (event) => {
            const { dailyReturn } = event.payload;
            this.returns.push(dailyReturn);
            if (this.returns.length > 252)
                this.returns.shift();
        });
    }
    async onStop() { }
    async onTick() {
        // Simulate some returns if we don't have real data
        if (this.returns.length < 30) {
            this.returns.push((Math.random() - 0.5) * 0.04);
        }
        const var95 = this.calculateVaR(0.95);
        const var99 = this.calculateVaR(0.99);
        this.emit('risk:var', {
            portfolioValue: this.portfolioValue,
            var95: var95,
            var99: var99,
            var95Pct: var95 / this.portfolioValue,
            var99Pct: var99 / this.portfolioValue
        });
    }
    calculateVaR(confidence) {
        if (this.returns.length < 10)
            return 0;
        const sorted = [...this.returns].sort((a, b) => a - b);
        const idx = Math.floor((1 - confidence) * sorted.length);
        const percentile = sorted[idx];
        return Math.abs(percentile * this.portfolioValue);
    }
    setPortfolioValue(value) { this.portfolioValue = value; }
    getVaR(confidence = 0.95) { return this.calculateVaR(confidence); }
}
exports.VaRAgent = VaRAgent;
//# sourceMappingURL=index.js.map