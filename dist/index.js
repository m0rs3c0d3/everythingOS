"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
//
//   ███████╗██╗   ██╗███████╗██████╗ ██╗   ██╗████████╗██╗  ██╗██╗███╗   ██╗ ██████╗
//   ██╔════╝██║   ██║██╔════╝██╔══██╗╚██╗ ██╔╝╚══██╔══╝██║  ██║██║████╗  ██║██╔════╝
//   █████╗  ██║   ██║█████╗  ██████╔╝ ╚████╔╝    ██║   ███████║██║██╔██╗ ██║██║  ███╗
//   ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██╔══██╗  ╚██╔╝     ██║   ██╔══██║██║██║╚██╗██║██║   ██║
//   ███████╗ ╚████╔╝ ███████╗██║  ██║   ██║      ██║   ██║  ██║██║██║ ╚████║╚██████╔╝
//   ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝
//
//                              ██████╗ ███████╗
//                             ██╔═══██╗██╔════╝
//                             ██║   ██║███████╗
//                             ██║   ██║╚════██║
//                             ╚██████╔╝███████║
//                              ╚═════╝ ╚══════╝
//
//   A Multi-Agent Operating System for Everything
//   Version 1.0.0
//
// ═══════════════════════════════════════════════════════════════════════════════
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFullOS = exports.createHealthcareOS = exports.createTradingOS = exports.EverythingOS = exports.metrics = exports.MetricsCollector = exports.registry = exports.AgentRegistry = exports.worldState = exports.WorldStateManager = exports.eventBus = exports.EventBus = void 0;
exports.createEverythingOS = createEverythingOS;
// Core Exports
var EventBus_1 = require("./core/EventBus");
Object.defineProperty(exports, "EventBus", { enumerable: true, get: function () { return EventBus_1.EventBus; } });
Object.defineProperty(exports, "eventBus", { enumerable: true, get: function () { return EventBus_1.eventBus; } });
var WorldStateManager_1 = require("./core/WorldStateManager");
Object.defineProperty(exports, "WorldStateManager", { enumerable: true, get: function () { return WorldStateManager_1.WorldStateManager; } });
Object.defineProperty(exports, "worldState", { enumerable: true, get: function () { return WorldStateManager_1.worldState; } });
var AgentRegistry_1 = require("./core/AgentRegistry");
Object.defineProperty(exports, "AgentRegistry", { enumerable: true, get: function () { return AgentRegistry_1.AgentRegistry; } });
Object.defineProperty(exports, "registry", { enumerable: true, get: function () { return AgentRegistry_1.registry; } });
var MetricsCollector_1 = require("./core/MetricsCollector");
Object.defineProperty(exports, "MetricsCollector", { enumerable: true, get: function () { return MetricsCollector_1.MetricsCollector; } });
Object.defineProperty(exports, "metrics", { enumerable: true, get: function () { return MetricsCollector_1.metrics; } });
// Type Exports
__exportStar(require("./core/types"), exports);
// Agent Exports
__exportStar(require("./agents"), exports);
// ═══════════════════════════════════════════════════════════════════════════════
// EverythingOS - Main System Class
// ═══════════════════════════════════════════════════════════════════════════════
const EventBus_2 = require("./core/EventBus");
const WorldStateManager_2 = require("./core/WorldStateManager");
const AgentRegistry_2 = require("./core/AgentRegistry");
const MetricsCollector_2 = require("./core/MetricsCollector");
const agents_1 = require("./agents");
const PRESETS = {
    foundation: [
        'clock', 'environment_sensor', 'config_watcher', 'snapshot_manager',
        'garbage_collector', 'audit_trail', 'event_bus_monitor',
        'inter_agent_bridge', 'dead_letter_handler', 'shutdown_coordinator'
    ],
    trading: [
        'price_ticker', 'volatility_calculator', 'anomaly_detector',
        'sentiment_analysis', 'news_aggregator', 'correlation_analyzer',
        'rsi_agent', 'macd_agent', 'bollinger_band_agent', 'moving_average_agent',
        'signal_ensemble', 'fear_greed_index', 'order_executor', 'position_sizer',
        'stop_loss_agent', 'profit_taker', 'circuit_breaker', 'drawdown_limiter',
        'var_agent', 'performance_tracker'
    ],
    healthcare: [
        'patient_queue', 'staff_scheduling', 'vitals_monitoring',
        'resource_allocation', 'medication_inventory'
    ],
    orchestration: [
        'dashboard', 'health_check', 'alerting', 'metrics_aggregator'
    ]
};
PRESETS.full = [
    ...PRESETS.foundation,
    ...PRESETS.trading,
    ...PRESETS.healthcare,
    ...PRESETS.orchestration
];
class EverythingOS {
    running = false;
    tickInterval = null;
    config;
    constructor(config = {}) {
        this.config = {
            autoStart: false,
            tickRate: 100,
            agents: [],
            presets: [],
            ...config
        };
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────────
    async initialize() {
        console.log('🚀 EverythingOS initializing...');
        // Always load foundation agents
        await this.loadPreset('foundation');
        // Load presets
        for (const preset of this.config.presets || []) {
            await this.loadPreset(preset);
        }
        // Load individual agents
        for (const agentName of this.config.agents || []) {
            await this.loadAgent(agentName);
        }
        // Always load orchestration
        await this.loadPreset('orchestration');
        console.log(`✅ Loaded ${AgentRegistry_2.registry.count} agents`);
        if (this.config.autoStart) {
            await this.start();
        }
    }
    async start() {
        if (this.running)
            return;
        console.log('▶️  Starting EverythingOS...');
        this.running = true;
        // Start world tick
        this.tickInterval = setInterval(() => {
            WorldStateManager_2.worldState.tick();
        }, this.config.tickRate);
        // Start all agents
        await AgentRegistry_2.registry.startAll();
        EventBus_2.eventBus.emit('system:started', { timestamp: Date.now() });
        console.log('✅ EverythingOS running');
    }
    async stop() {
        if (!this.running)
            return;
        console.log('⏹️  Stopping EverythingOS...');
        // Stop tick
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        // Stop all agents
        await AgentRegistry_2.registry.stopAll();
        this.running = false;
        EventBus_2.eventBus.emit('system:stopped', { timestamp: Date.now() });
        console.log('✅ EverythingOS stopped');
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Agent Management
    // ─────────────────────────────────────────────────────────────────────────────
    async loadAgent(name) {
        const factory = agents_1.AgentFactory[name];
        if (!factory) {
            console.warn(`⚠️  Unknown agent: ${name}`);
            return null;
        }
        if (AgentRegistry_2.registry.has(name)) {
            return AgentRegistry_2.registry.get(name) || null;
        }
        const agent = factory();
        AgentRegistry_2.registry.register(agent);
        if (this.running) {
            await agent.start();
        }
        return agent;
    }
    async loadPreset(preset) {
        const agents = PRESETS[preset];
        if (!agents) {
            console.warn(`⚠️  Unknown preset: ${preset}`);
            return;
        }
        for (const agentName of agents) {
            await this.loadAgent(agentName);
        }
    }
    getAgent(id) {
        return AgentRegistry_2.registry.get(id);
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Event System
    // ─────────────────────────────────────────────────────────────────────────────
    on(event, handler) {
        return EventBus_2.eventBus.on(event, (e) => handler(e.payload));
    }
    emit(event, data) {
        EventBus_2.eventBus.emit(event, data, { source: 'user' });
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // State & Metrics
    // ─────────────────────────────────────────────────────────────────────────────
    getState() {
        return {
            running: this.running,
            tick: WorldStateManager_2.worldState.getTick(),
            agents: AgentRegistry_2.registry.getStats(),
            globals: WorldStateManager_2.worldState.getGlobals(),
            eventBus: EventBus_2.eventBus.getStats(),
        };
    }
    getMetrics() {
        return MetricsCollector_2.metrics.exportJSON();
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Utilities
    // ─────────────────────────────────────────────────────────────────────────────
    isRunning() {
        return this.running;
    }
    getVersion() {
        return '1.0.0';
    }
}
exports.EverythingOS = EverythingOS;
// ═══════════════════════════════════════════════════════════════════════════════
// Default Export & Quick Start
// ═══════════════════════════════════════════════════════════════════════════════
exports.default = EverythingOS;
// Quick start function
async function createEverythingOS(config) {
    const os = new EverythingOS(config);
    await os.initialize();
    return os;
}
// Preset quick starts
const createTradingOS = () => createEverythingOS({ presets: ['trading'], autoStart: true });
exports.createTradingOS = createTradingOS;
const createHealthcareOS = () => createEverythingOS({ presets: ['healthcare'], autoStart: true });
exports.createHealthcareOS = createHealthcareOS;
const createFullOS = () => createEverythingOS({ presets: ['full'], autoStart: true });
exports.createFullOS = createFullOS;
//# sourceMappingURL=index.js.map