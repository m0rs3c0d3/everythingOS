// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Orchestration Agents
// System coordination and monitoring
// ═══════════════════════════════════════════════════════════════════════════════

import { BaseAgent } from '../BaseAgent';
import { Alert, HealthCheck } from '../../core/types';
import { registry } from '../../core/AgentRegistry';

// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard Agent - System overview
// ═══════════════════════════════════════════════════════════════════════════════

export class DashboardAgent extends BaseAgent {
  private metrics: Record<string, unknown> = {};

  constructor() {
    super({
      id: 'dashboard',
      name: 'Dashboard Agent',
      tier: 'orchestration',
      description: 'System dashboard and visualization',
      version: '1.0.0',
    });
    this.tickRate = 1000;
  }

  protected async onStart(): Promise<void> {
    this.subscribe('*:update', (event) => { this.metrics[event.type] = event.payload; });
    this.subscribe('*:status', (event) => { this.metrics[event.type] = event.payload; });
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    this.emit('dashboard:update', {
      timestamp: Date.now(),
      agents: registry.getStats(),
      metrics: this.metrics
    });
  }

  getMetrics(): Record<string, unknown> { return { ...this.metrics }; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Health Check Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class HealthCheckAgent extends BaseAgent {
  private healthChecks: Map<string, HealthCheck> = new Map();

  constructor() {
    super({
      id: 'health_check',
      name: 'Health Check Agent',
      tier: 'orchestration',
      description: 'Monitor agent health status',
      version: '1.0.0',
    });
    this.tickRate = 5000;
  }

  protected async onStart(): Promise<void> {}
  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    for (const agent of registry.getAll()) {
      const check = this.checkAgentHealth(agent.getId());
      this.healthChecks.set(agent.getId(), check);
    }
    this.emit('health:summary', this.getHealthSummary());
  }

  private checkAgentHealth(agentId: string): HealthCheck {
    const start = performance.now();
    const agent = registry.get(agentId);
    let status: HealthCheck['status'] = 'healthy';
    
    if (!agent) status = 'unhealthy';
    else if (agent.getStatus() === 'error') status = 'unhealthy';
    else if (agent.getStatus() === 'paused') status = 'degraded';

    return { agentId, status, latency: performance.now() - start, lastCheck: Date.now() };
  }

  getHealthSummary() {
    const checks = Array.from(this.healthChecks.values());
    return {
      healthy: checks.filter(c => c.status === 'healthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Alerting Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class AlertingAgent extends BaseAgent {
  private alerts: Alert[] = [];

  constructor() {
    super({
      id: 'alerting',
      name: 'Alerting Agent',
      tier: 'orchestration',
      description: 'Centralized alert management',
      version: '1.0.0',
    });
    this.tickRate = 0;
  }

  protected async onStart(): Promise<void> {
    this.subscribe('*:alert', (event) => {
      this.createAlert(event.payload as Partial<Alert>);
    });
  }

  protected async onStop(): Promise<void> {}
  protected async onTick(): Promise<void> {}

  createAlert(params: Partial<Alert>): Alert {
    const alert: Alert = {
      id: `alert_${Date.now()}`,
      level: params.level || 'info',
      title: params.title || 'Alert',
      message: params.message || '',
      source: params.source || 'system',
      timestamp: Date.now(),
      acknowledged: false,
      data: params.data
    };
    this.alerts.unshift(alert);
    if (this.alerts.length > 1000) this.alerts.pop();
    this.emit('alert:created', alert);
    return alert;
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) { alert.acknowledged = true; return true; }
    return false;
  }

  getAlerts(filter?: { level?: Alert['level'] }): Alert[] {
    return filter?.level ? this.alerts.filter(a => a.level === filter.level) : [...this.alerts];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Performance Tracker Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class PerformanceTrackerAgent extends BaseAgent {
  private portfolioValue = 100000;
  private trades: Array<{ pnl: number; timestamp: number }> = [];
  private dailyReturns: number[] = [];

  constructor() {
    super({
      id: 'performance_tracker',
      name: 'Performance Tracker Agent',
      tier: 'orchestration',
      description: 'Track trading performance',
      version: '1.0.0',
    });
    this.tickRate = 60000;
  }

  protected async onStart(): Promise<void> {
    this.subscribe('order:filled', () => {
      const pnl = (Math.random() - 0.4) * 100;
      this.trades.push({ pnl, timestamp: Date.now() });
      this.portfolioValue += pnl;
    });
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    const change = (Math.random() - 0.48) * 500;
    this.portfolioValue += change;
    this.dailyReturns.push(change / this.portfolioValue);
    if (this.dailyReturns.length > 252) this.dailyReturns.shift();
    this.emit('performance:update', this.getMetrics());
  }

  getMetrics() {
    const wins = this.trades.filter(t => t.pnl > 0);
    return {
      portfolioValue: this.portfolioValue,
      totalTrades: this.trades.length,
      winRate: this.trades.length > 0 ? (wins.length / this.trades.length) * 100 : 0
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Metrics Aggregator Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class MetricsAggregatorAgent extends BaseAgent {
  private aggregates: Map<string, { sum: number; count: number }> = new Map();

  constructor() {
    super({
      id: 'metrics_aggregator',
      name: 'Metrics Aggregator Agent',
      tier: 'orchestration',
      description: 'Aggregate metrics from all agents',
      version: '1.0.0',
    });
    this.tickRate = 10000;
  }

  protected async onStart(): Promise<void> {
    this.subscribe('*', (event) => {
      if (typeof event.payload === 'object' && event.payload !== null) {
        for (const [key, value] of Object.entries(event.payload as Record<string, unknown>)) {
          if (typeof value === 'number') {
            const metricKey = `${event.type}.${key}`;
            const agg = this.aggregates.get(metricKey) || { sum: 0, count: 0 };
            agg.sum += value;
            agg.count++;
            this.aggregates.set(metricKey, agg);
          }
        }
      }
    });
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    this.emit('metrics:aggregated', this.getAggregates());
  }

  getAggregates(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, agg] of this.aggregates) {
      result[key] = agg.count > 0 ? agg.sum / agg.count : 0;
    }
    return result;
  }
}
