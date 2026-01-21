"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Foundation Agents Index
// Core system agents that provide fundamental services
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShutdownCoordinatorAgent = exports.DeadLetterHandlerAgent = exports.InterAgentBridgeAgent = exports.EventBusMonitorAgent = exports.AuditTrailAgent = exports.GarbageCollectorAgent = exports.SnapshotManagerAgent = exports.ConfigWatcherAgent = exports.EnvironmentSensorAgent = exports.ClockAgent = void 0;
var ClockAgent_1 = require("./ClockAgent");
Object.defineProperty(exports, "ClockAgent", { enumerable: true, get: function () { return ClockAgent_1.ClockAgent; } });
var EnvironmentSensorAgent_1 = require("./EnvironmentSensorAgent");
Object.defineProperty(exports, "EnvironmentSensorAgent", { enumerable: true, get: function () { return EnvironmentSensorAgent_1.EnvironmentSensorAgent; } });
const BaseAgent_1 = require("../BaseAgent");
// ═══════════════════════════════════════════════════════════════════════════════
// Config Watcher Agent - Configuration monitoring and hot-reload
// ═══════════════════════════════════════════════════════════════════════════════
class ConfigWatcherAgent extends BaseAgent_1.BaseAgent {
    appConfig = {};
    watchers = new Map();
    constructor() {
        super({
            id: 'config_watcher',
            name: 'Config Watcher Agent',
            tier: 'foundation',
            description: 'Configuration monitoring and hot-reload',
            version: '1.0.0',
        });
        this.tickRate = 10000; // Check every 10s
    }
    async onStart() {
        this.loadDefaults();
        this.emit('config:loaded', { config: this.appConfig });
    }
    async onStop() {
        this.watchers.clear();
    }
    async onTick() {
        // In real impl, would check for config file changes
    }
    loadDefaults() {
        this.appConfig = {
            system: { debug: false, logLevel: 'info' },
            agents: { defaultTickRate: 1000, maxErrors: 10 },
            ui: { theme: 'dark', refreshRate: 60 },
        };
    }
    get(path) {
        const parts = path.split('.');
        let current = this.appConfig;
        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            }
            else {
                return undefined;
            }
        }
        return current;
    }
    set(path, value) {
        const parts = path.split('.');
        const key = parts.pop();
        let current = this.appConfig;
        for (const part of parts) {
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part];
        }
        const oldValue = current[key];
        current[key] = value;
        this.emit('config:changed', { path, oldValue, newValue: value });
        this.notifyWatchers(path, value);
    }
    watch(path, callback) {
        if (!this.watchers.has(path)) {
            this.watchers.set(path, []);
        }
        this.watchers.get(path).push(callback);
        return () => {
            const callbacks = this.watchers.get(path);
            if (callbacks) {
                const idx = callbacks.indexOf(callback);
                if (idx > -1)
                    callbacks.splice(idx, 1);
            }
        };
    }
    notifyWatchers(path, value) {
        const callbacks = this.watchers.get(path) || [];
        callbacks.forEach(cb => cb(value));
    }
    getAll() {
        return JSON.parse(JSON.stringify(this.appConfig));
    }
}
exports.ConfigWatcherAgent = ConfigWatcherAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Snapshot Manager Agent - State persistence and recovery
// ═══════════════════════════════════════════════════════════════════════════════
class SnapshotManagerAgent extends BaseAgent_1.BaseAgent {
    snapshots = new Map();
    autoSnapshotInterval = 60000; // 1 minute
    lastAutoSnapshot = 0;
    constructor() {
        super({
            id: 'snapshot_manager',
            name: 'Snapshot Manager Agent',
            tier: 'foundation',
            description: 'State persistence and recovery',
            version: '1.0.0',
        });
        this.tickRate = 5000;
    }
    async onStart() {
        this.emit('snapshots:manager_started', {});
    }
    async onStop() {
        // Final snapshot before shutdown
        this.createSnapshot('shutdown');
    }
    async onTick() {
        const now = Date.now();
        if (now - this.lastAutoSnapshot >= this.autoSnapshotInterval) {
            this.createSnapshot('auto');
            this.lastAutoSnapshot = now;
        }
    }
    createSnapshot(label = 'manual') {
        const id = `snap_${Date.now()}_${label}`;
        const globals = this.getGlobal('environment') || {};
        this.snapshots.set(id, {
            data: { globals, timestamp: Date.now(), label },
            timestamp: Date.now(),
        });
        this.emit('snapshots:created', { snapshotId: id, label });
        // Keep only last 100 snapshots
        if (this.snapshots.size > 100) {
            const oldest = Array.from(this.snapshots.keys())[0];
            this.snapshots.delete(oldest);
        }
        return id;
    }
    getSnapshot(id) {
        return this.snapshots.get(id)?.data;
    }
    listSnapshots() {
        return Array.from(this.snapshots.entries()).map(([id, snap]) => ({
            id,
            timestamp: snap.timestamp,
        }));
    }
    deleteSnapshot(id) {
        return this.snapshots.delete(id);
    }
}
exports.SnapshotManagerAgent = SnapshotManagerAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Garbage Collector Agent - Memory management
// ═══════════════════════════════════════════════════════════════════════════════
class GarbageCollectorAgent extends BaseAgent_1.BaseAgent {
    collectionCount = 0;
    totalCleaned = 0;
    constructor() {
        super({
            id: 'garbage_collector',
            name: 'Garbage Collector Agent',
            tier: 'foundation',
            description: 'Memory management and cleanup',
            version: '1.0.0',
        });
        this.tickRate = 30000; // Run every 30s
    }
    async onStart() {
        this.emit('gc:started', {});
    }
    async onStop() { }
    async onTick() {
        await this.collect();
    }
    async collect() {
        const start = performance.now();
        // Simulate garbage collection
        const cleaned = Math.floor(Math.random() * 1000);
        this.totalCleaned += cleaned;
        this.collectionCount++;
        const duration = performance.now() - start;
        this.emit('gc:collected', {
            cleaned,
            duration,
            totalCleaned: this.totalCleaned,
            collectionCount: this.collectionCount,
        });
        return { cleaned, duration };
    }
    getStats() {
        return { collectionCount: this.collectionCount, totalCleaned: this.totalCleaned };
    }
}
exports.GarbageCollectorAgent = GarbageCollectorAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Audit Trail Agent - Activity logging
// ═══════════════════════════════════════════════════════════════════════════════
class AuditTrailAgent extends BaseAgent_1.BaseAgent {
    trail = [];
    maxTrailSize = 10000;
    constructor() {
        super({
            id: 'audit_trail',
            name: 'Audit Trail Agent',
            tier: 'foundation',
            description: 'Activity logging and audit trail',
            version: '1.0.0',
        });
        this.tickRate = 0; // Event-driven only
    }
    async onStart() {
        // Subscribe to all events for auditing
        this.subscribe('*', (event) => {
            this.log(event.type, event.payload);
        });
        this.emit('audit:started', {});
    }
    async onStop() { }
    async onTick() { }
    log(event, data) {
        this.trail.push({ timestamp: Date.now(), event, data });
        if (this.trail.length > this.maxTrailSize) {
            this.trail.shift();
        }
    }
    getTrail(filter) {
        let result = [...this.trail];
        if (filter?.since) {
            result = result.filter(e => e.timestamp >= filter.since);
        }
        if (filter?.event) {
            result = result.filter(e => e.event.includes(filter.event));
        }
        return result;
    }
    clear() {
        this.trail = [];
        this.emit('audit:cleared', {});
    }
}
exports.AuditTrailAgent = AuditTrailAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Event Bus Monitor Agent - Event system health
// ═══════════════════════════════════════════════════════════════════════════════
class EventBusMonitorAgent extends BaseAgent_1.BaseAgent {
    eventCounts = new Map();
    errorCount = 0;
    constructor() {
        super({
            id: 'event_bus_monitor',
            name: 'Event Bus Monitor Agent',
            tier: 'foundation',
            description: 'Event system health monitoring',
            version: '1.0.0',
        });
        this.tickRate = 10000;
    }
    async onStart() {
        this.subscribe('*', (event) => {
            const count = this.eventCounts.get(event.type) || 0;
            this.eventCounts.set(event.type, count + 1);
        });
        this.subscribe('system:dead_letter', () => {
            this.errorCount++;
        });
    }
    async onStop() { }
    async onTick() {
        const stats = this.getStats();
        this.emit('event_bus:stats', stats);
    }
    getStats() {
        const counts = Object.fromEntries(this.eventCounts);
        const total = Array.from(this.eventCounts.values()).reduce((a, b) => a + b, 0);
        return { eventCounts: counts, errorCount: this.errorCount, totalEvents: total };
    }
}
exports.EventBusMonitorAgent = EventBusMonitorAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Inter-Agent Bridge Agent - Cross-agent communication
// ═══════════════════════════════════════════════════════════════════════════════
class InterAgentBridgeAgent extends BaseAgent_1.BaseAgent {
    messageQueue = [];
    constructor() {
        super({
            id: 'inter_agent_bridge',
            name: 'Inter-Agent Bridge Agent',
            tier: 'foundation',
            description: 'Cross-agent communication routing',
            version: '1.0.0',
        });
        this.tickRate = 100; // Fast message routing
    }
    async onStart() {
        this.subscribe('bridge:send', (event) => {
            const { to, payload } = event.payload;
            this.messageQueue.push({ from: event.source, to, payload });
        });
    }
    async onStop() {
        this.messageQueue = [];
    }
    async onTick() {
        while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            this.emit(`agent:${msg.to}:message`, { from: msg.from, payload: msg.payload });
        }
    }
    send(from, to, payload) {
        this.emit(`agent:${to}:message`, { from, payload });
    }
}
exports.InterAgentBridgeAgent = InterAgentBridgeAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Dead Letter Handler Agent - Failed event handling
// ═══════════════════════════════════════════════════════════════════════════════
class DeadLetterHandlerAgent extends BaseAgent_1.BaseAgent {
    deadLetters = [];
    maxDeadLetters = 1000;
    constructor() {
        super({
            id: 'dead_letter_handler',
            name: 'Dead Letter Handler Agent',
            tier: 'foundation',
            description: 'Failed event handling and recovery',
            version: '1.0.0',
        });
        this.tickRate = 0; // Event-driven
    }
    async onStart() {
        this.subscribe('system:dead_letter', (event) => {
            this.handleDeadLetter(event.payload);
        });
    }
    async onStop() { }
    async onTick() { }
    handleDeadLetter(payload) {
        const { event, error } = payload;
        this.deadLetters.push({ event, error, timestamp: Date.now() });
        if (this.deadLetters.length > this.maxDeadLetters) {
            this.deadLetters.shift();
        }
        this.emit('dead_letter:received', { event, error });
    }
    getDeadLetters() {
        return [...this.deadLetters];
    }
    clear() {
        this.deadLetters = [];
    }
}
exports.DeadLetterHandlerAgent = DeadLetterHandlerAgent;
// ═══════════════════════════════════════════════════════════════════════════════
// Shutdown Coordinator Agent - Graceful shutdown
// ═══════════════════════════════════════════════════════════════════════════════
class ShutdownCoordinatorAgent extends BaseAgent_1.BaseAgent {
    shutdownHandlers = [];
    isShuttingDown = false;
    constructor() {
        super({
            id: 'shutdown_coordinator',
            name: 'Shutdown Coordinator Agent',
            tier: 'foundation',
            description: 'Graceful shutdown coordination',
            version: '1.0.0',
        });
        this.tickRate = 0;
    }
    async onStart() {
        this.subscribe('system:shutdown', async () => {
            await this.initiateShutdown();
        });
    }
    async onStop() { }
    async onTick() { }
    registerShutdownHandler(handler) {
        this.shutdownHandlers.push(handler);
    }
    async initiateShutdown() {
        if (this.isShuttingDown)
            return;
        this.isShuttingDown = true;
        this.emit('shutdown:initiated', { timestamp: Date.now() });
        for (const handler of this.shutdownHandlers) {
            try {
                await handler();
            }
            catch (error) {
                this.emit('shutdown:handler_error', { error: error.message });
            }
        }
        this.emit('shutdown:complete', { timestamp: Date.now() });
    }
}
exports.ShutdownCoordinatorAgent = ShutdownCoordinatorAgent;
//# sourceMappingURL=index.js.map