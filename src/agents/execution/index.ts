// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Execution Agents
// Order execution and risk management agents
// ═══════════════════════════════════════════════════════════════════════════════

import { BaseAgent } from '../BaseAgent';
import { Order, Position, SignalData, MarketData } from '../../core/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Order Executor Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class OrderExecutorAgent extends BaseAgent {
  private orders: Map<string, Order> = new Map();
  private orderCounter = 0;

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

  protected async onStart(): Promise<void> {
    this.subscribe('order:create', (event) => {
      const order = event.payload as Partial<Order>;
      this.createOrder(order);
    });

    this.subscribe('order:cancel', (event) => {
      const { orderId } = event.payload as { orderId: string };
      this.cancelOrder(orderId);
    });

    this.subscribe('price:update', (event) => {
      const data = event.payload as MarketData;
      this.checkLimitOrders(data);
    });
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    // Process pending orders
    for (const [id, order] of this.orders) {
      if (order.status === 'pending') {
        this.processOrder(order);
      }
    }
  }

  createOrder(params: Partial<Order>): Order {
    const order: Order = {
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

  private processOrder(order: Order): void {
    if (order.type === 'market') {
      // Simulate immediate fill
      order.status = 'filled';
      order.filledQuantity = order.quantity;
      order.avgFillPrice = order.price || 100; // Would get from price feed
      order.updatedAt = Date.now();
      this.emit('order:filled', order);
    } else {
      order.status = 'open';
      order.updatedAt = Date.now();
      this.emit('order:opened', order);
    }
  }

  private checkLimitOrders(data: MarketData): void {
    for (const [id, order] of this.orders) {
      if (order.status !== 'open' || order.symbol !== data.symbol) continue;

      if (order.type === 'limit') {
        if ((order.side === 'buy' && data.price <= order.price!) ||
            (order.side === 'sell' && data.price >= order.price!)) {
          order.status = 'filled';
          order.filledQuantity = order.quantity;
          order.avgFillPrice = order.price;
          order.updatedAt = Date.now();
          this.emit('order:filled', order);
        }
      }
    }
  }

  cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order || order.status === 'filled') return false;
    
    order.status = 'cancelled';
    order.updatedAt = Date.now();
    this.emit('order:cancelled', order);
    return true;
  }

  getOrder(orderId: string): Order | undefined { return this.orders.get(orderId); }
  getOpenOrders(): Order[] { return Array.from(this.orders.values()).filter(o => o.status === 'open'); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Position Sizer Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class PositionSizerAgent extends BaseAgent {
  private portfolioValue = 100000;
  private maxPositionPct = 0.1;
  private riskPerTradePct = 0.02;

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

  protected async onStart(): Promise<void> {
    this.subscribe('signal:consensus', (event) => {
      const signal = event.payload as SignalData;
      const size = this.calculateSize(signal);
      this.emit('position:size_calculated', { signal, size });
    });
  }

  protected async onStop(): Promise<void> {}
  protected async onTick(): Promise<void> {}

  calculateSize(signal: SignalData, price?: number): { quantity: number; value: number; risk: number } {
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

  setPortfolioValue(value: number): void { this.portfolioValue = value; }
  setMaxPositionPct(pct: number): void { this.maxPositionPct = pct; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Stop Loss Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class StopLossAgent extends BaseAgent {
  private stops: Map<string, { price: number; type: 'fixed' | 'trailing'; trailPct?: number }> = new Map();
  private highWatermarks: Map<string, number> = new Map();

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

  protected async onStart(): Promise<void> {
    this.subscribe('price:update', (event) => {
      const data = event.payload as MarketData;
      this.checkStops(data);
    });

    this.subscribe('position:opened', (event) => {
      const position = event.payload as Position;
      this.setTrailingStop(position.id, position.entryPrice * 0.95, 0.05);
    });
  }

  protected async onStop(): Promise<void> {}
  protected async onTick(): Promise<void> {}

  private checkStops(data: MarketData): void {
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

  setFixedStop(positionId: string, price: number): void {
    this.stops.set(positionId, { price, type: 'fixed' });
    this.emit('stop:set', { positionId, price, type: 'fixed' });
  }

  setTrailingStop(positionId: string, initialPrice: number, trailPct: number): void {
    this.stops.set(positionId, { price: initialPrice, type: 'trailing', trailPct });
    this.emit('stop:set', { positionId, price: initialPrice, type: 'trailing', trailPct });
  }

  removeStop(positionId: string): void {
    this.stops.delete(positionId);
    this.highWatermarks.delete(positionId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Profit Taker Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class ProfitTakerAgent extends BaseAgent {
  private targets: Map<string, { levels: number[]; taken: number[] }> = new Map();

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

  protected async onStart(): Promise<void> {
    this.subscribe('price:update', (event) => {
      const data = event.payload as MarketData;
      this.checkTargets(data);
    });
  }

  protected async onStop(): Promise<void> {}
  protected async onTick(): Promise<void> {}

  private checkTargets(data: MarketData): void {
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

  setTargets(positionId: string, levels: number[]): void {
    this.targets.set(positionId, { levels: levels.sort((a, b) => a - b), taken: [] });
    this.emit('profit:targets_set', { positionId, levels });
  }

  removeTargets(positionId: string): void {
    this.targets.delete(positionId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Circuit Breaker Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class CircuitBreakerAgent extends BaseAgent {
  private triggered = false;
  private triggerCount = 0;
  private lossThreshold = -0.05; // 5% portfolio loss
  private volatilityThreshold = 50; // VIX equivalent
  private dailyPnL = 0;

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

  protected async onStart(): Promise<void> {
    this.subscribe('portfolio:pnl_update', (event) => {
      const { dailyPnL } = event.payload as { dailyPnL: number };
      this.dailyPnL = dailyPnL;
    });

    this.subscribe('volatility:update', (event) => {
      const { volatility } = event.payload as { volatility: number };
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

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    if (this.dailyPnL < this.lossThreshold) {
      this.trigger('max_loss', { pnl: this.dailyPnL });
    }

    // Reset trigger count periodically
    if (this.triggerCount > 0) {
      this.triggerCount = Math.max(0, this.triggerCount - 0.1);
    }
  }

  private trigger(reason: string, data: Record<string, unknown>): void {
    if (this.triggered) return;

    this.triggered = true;
    this.emit('circuit_breaker:triggered', {
      reason,
      timestamp: Date.now(),
      ...data
    });

    // Auto-reset after 1 hour
    setTimeout(() => this.reset(), 3600000);
  }

  reset(): void {
    this.triggered = false;
    this.triggerCount = 0;
    this.emit('circuit_breaker:reset', { timestamp: Date.now() });
  }

  isTriggered(): boolean { return this.triggered; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Drawdown Limiter Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class DrawdownLimiterAgent extends BaseAgent {
  private peakValue = 100000;
  private currentValue = 100000;
  private maxDrawdownPct = 0.2;
  private currentDrawdown = 0;

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

  protected async onStart(): Promise<void> {
    this.subscribe('portfolio:value_update', (event) => {
      const { value } = event.payload as { value: number };
      this.updateValue(value);
    });
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    this.emit('drawdown:status', {
      currentDrawdown: this.currentDrawdown,
      peakValue: this.peakValue,
      currentValue: this.currentValue,
      maxAllowed: this.maxDrawdownPct,
      breached: this.currentDrawdown > this.maxDrawdownPct
    });
  }

  private updateValue(value: number): void {
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

  setMaxDrawdown(pct: number): void { this.maxDrawdownPct = pct; }
  getCurrentDrawdown(): number { return this.currentDrawdown; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VaR (Value at Risk) Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class VaRAgent extends BaseAgent {
  private portfolioValue = 100000;
  private returns: number[] = [];
  private confidenceLevel = 0.95;

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

  protected async onStart(): Promise<void> {
    this.subscribe('portfolio:return', (event) => {
      const { dailyReturn } = event.payload as { dailyReturn: number };
      this.returns.push(dailyReturn);
      if (this.returns.length > 252) this.returns.shift();
    });
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
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

  private calculateVaR(confidence: number): number {
    if (this.returns.length < 10) return 0;

    const sorted = [...this.returns].sort((a, b) => a - b);
    const idx = Math.floor((1 - confidence) * sorted.length);
    const percentile = sorted[idx];

    return Math.abs(percentile * this.portfolioValue);
  }

  setPortfolioValue(value: number): void { this.portfolioValue = value; }
  getVaR(confidence = 0.95): number { return this.calculateVaR(confidence); }
}
