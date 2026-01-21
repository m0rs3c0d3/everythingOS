"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Orchestration Agents
// System coordination and monitoring
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsAggregatorAgent = exports.PerformanceTrackerAgent = exports.AlertingAgent = exports.HealthCheckAgent = exports.DashboardAgent = void 0;
const BaseAgent_1 = require("../BaseAgent");
const AgentRegistry_1 = require("../../core/AgentRegistry");
// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard Agent - System overview
// ═══════════════════════════════════════════════════════════════════════════════
class DashboardAgent extends BaseAgent_1.BaseAgent {
    metrics = {};
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
    async onStart() {
        this.subscribe('*:update', (event) => { this.metrics[event.type] = event.payload; });
        this.subscribe('*:status', (event) => { this.metrics[event.type] = event.payload; });
    }
    async onStop() { }
    async onTick() {
        this.emit('dashboard:update', {
            timestamp: Date.now(),
            agents: AgentRegistry_1.registry.getStats(),
            metrics: this.metrics
        });
    }
    getMetrics() { return { ...this.metrics }; }
}
exports.DashboardAgent = DashboardAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Health Check Agent
// ═══════════════════════════════════════════════════════════════════════════════
class HealthCheckAgent extends BaseAgent_1.BaseAgent {
    healthChecks = new Map();
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
    async onStart() { }
    async onStop() { }
    async onTick() {
        for (const agent of AgentRegistry_1.registry.getAll()) {
            const check = this.checkAgentHealth(agent.getId());
            this.healthChecks.set(agent.getId(), check);
        }
        this.emit('health:summary', this.getHealthSummary());
    }
    checkAgentHealth(agentId) {
        const start = performance.now();
        const agent = AgentRegistry_1.registry.get(agentId);
        let status = 'healthy';
        if (!agent)
            status = 'unhealthy';
        else if (agent.getStatus() === 'error')
            status = 'unhealthy';
        else if (agent.getStatus() === 'paused')
            status = 'degraded';
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
exports.HealthCheckAgent = HealthCheckAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Alerting Agent
// ═══════════════════════════════════════════════════════════════════════════════
class AlertingAgent extends BaseAgent_1.BaseAgent {
    alerts = [];
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
    async onStart() {
        this.subscribe('*:alert', (event) => {
            this.createAlert(event.payload);
        });
    }
    async onStop() { }
    async onTick() { }
    createAlert(params) {
        const alert = {
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
        if (this.alerts.length > 1000)
            this.alerts.pop();
        this.emit('alert:created', alert);
        return alert;
    }
    acknowledgeAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            return true;
        }
        return false;
    }
    getAlerts(filter) {
        return filter?.level ? this.alerts.filter(a => a.level === filter.level) : [...this.alerts];
    }
}
exports.AlertingAgent = AlertingAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Performance Tracker Agent
// ═══════════════════════════════════════════════════════════════════════════════
class PerformanceTrackerAgent extends BaseAgent_1.BaseAgent {
    portfolioValue = 100000;
    trades = [];
    dailyReturns = [];
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
    async onStart() {
        this.subscribe('order:filled', () => {
            const pnl = (Math.random() - 0.4) * 100;
            this.trades.push({ pnl, timestamp: Date.now() });
            this.portfolioValue += pnl;
        });
    }
    async onStop() { }
    async onTick() {
        const change = (Math.random() - 0.48) * 500;
        this.portfolioValue += change;
        this.dailyReturns.push(change / this.portfolioValue);
        if (this.dailyReturns.length > 252)
            this.dailyReturns.shift();
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
exports.PerformanceTrackerAgent = PerformanceTrackerAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Metrics Aggregator Agent
// ═══════════════════════════════════════════════════════════════════════════════
class MetricsAggregatorAgent extends BaseAgent_1.BaseAgent {
    aggregates = new Map();
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
    async onStart() {
        this.subscribe('*', (event) => {
            if (typeof event.payload === 'object' && event.payload !== null) {
                for (const [key, value] of Object.entries(event.payload)) {
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
    async onStop() { }
    async onTick() {
        this.emit('metrics:aggregated', this.getAggregates());
    }
    getAggregates() {
        const result = {};
        for (const [key, agg] of this.aggregates) {
            result[key] = agg.count > 0 ? agg.sum / agg.count : 0;
        }
        return result;
    }
}
exports.MetricsAggregatorAgent = MetricsAggregatorAgent;
//# sourceMappingURL=index.js.map