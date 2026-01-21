"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - World State Manager
// Global state coordination and snapshot management
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.worldState = exports.WorldStateManager = void 0;
const EventBus_1 = require("./EventBus");
class WorldStateManager {
    state;
    maxSnapshots = 100;
    snapshotInterval = 1000; // ms
    lastSnapshotTime = 0;
    constructor() {
        this.state = {
            timestamp: Date.now(),
            tick: 0,
            agents: new Map(),
            globals: new Map(),
            snapshots: [],
        };
        // Initialize default globals
        this.state.globals.set('startTime', Date.now());
        this.state.globals.set('version', '1.0.0');
        this.state.globals.set('environment', 'development');
    }
    // Get current tick
    getTick() {
        return this.state.tick;
    }
    // Advance world tick
    tick() {
        this.state.tick++;
        this.state.timestamp = Date.now();
        // Auto-snapshot at intervals
        if (Date.now() - this.lastSnapshotTime >= this.snapshotInterval) {
            this.createSnapshot();
        }
        EventBus_1.eventBus.emit('world:tick', { tick: this.state.tick, timestamp: this.state.timestamp });
        return this.state.tick;
    }
    // Register agent state
    registerAgent(agentId) {
        if (this.state.agents.has(agentId)) {
            return;
        }
        const agentState = {
            status: 'idle',
            lastTick: 0,
            tickCount: 0,
            errors: [],
            metrics: {
                eventsProcessed: 0,
                eventsEmitted: 0,
                avgProcessingTime: 0,
                lastProcessingTime: 0,
                uptime: 0,
                memoryUsage: 0,
            },
            memory: new Map(),
        };
        this.state.agents.set(agentId, agentState);
        EventBus_1.eventBus.emit('world:agent_registered', { agentId });
    }
    // Unregister agent
    unregisterAgent(agentId) {
        const removed = this.state.agents.delete(agentId);
        if (removed) {
            EventBus_1.eventBus.emit('world:agent_unregistered', { agentId });
        }
        return removed;
    }
    // Get agent state
    getAgentState(agentId) {
        return this.state.agents.get(agentId);
    }
    // Update agent status
    setAgentStatus(agentId, status) {
        const agent = this.state.agents.get(agentId);
        if (agent) {
            agent.status = status;
            EventBus_1.eventBus.emit('world:agent_status_changed', { agentId, status });
        }
    }
    // Update agent metrics
    updateAgentMetrics(agentId, metrics) {
        const agent = this.state.agents.get(agentId);
        if (agent) {
            Object.assign(agent.metrics, metrics);
        }
    }
    // Record agent error
    recordAgentError(agentId, error, recoverable = true) {
        const agent = this.state.agents.get(agentId);
        if (agent) {
            agent.errors.push({
                timestamp: Date.now(),
                message: error.message,
                stack: error.stack,
                recoverable,
            });
            // Keep only last 50 errors
            if (agent.errors.length > 50) {
                agent.errors.shift();
            }
            EventBus_1.eventBus.emit('world:agent_error', {
                agentId,
                error: error.message,
                recoverable,
            });
        }
    }
    // Set agent memory
    setAgentMemory(agentId, key, value) {
        const agent = this.state.agents.get(agentId);
        if (agent) {
            agent.memory.set(key, value);
        }
    }
    // Get agent memory
    getAgentMemory(agentId, key) {
        const agent = this.state.agents.get(agentId);
        return agent?.memory.get(key);
    }
    // Set global state
    setGlobal(key, value) {
        this.state.globals.set(key, value);
        EventBus_1.eventBus.emit('world:global_changed', { key, value });
    }
    // Get global state
    getGlobal(key) {
        return this.state.globals.get(key);
    }
    // Get all globals
    getGlobals() {
        return Object.fromEntries(this.state.globals);
    }
    // Create state snapshot
    createSnapshot(label) {
        const snapshot = {
            tick: this.state.tick,
            timestamp: Date.now(),
            state: {
                globals: Object.fromEntries(this.state.globals),
                agents: Object.fromEntries(Array.from(this.state.agents.entries()).map(([id, state]) => [
                    id,
                    {
                        status: state.status,
                        tickCount: state.tickCount,
                        metrics: { ...state.metrics },
                    },
                ])),
                label,
            },
            checksum: this.computeChecksum(),
        };
        this.state.snapshots.push(snapshot);
        this.lastSnapshotTime = Date.now();
        // Prune old snapshots
        if (this.state.snapshots.length > this.maxSnapshots) {
            this.state.snapshots.shift();
        }
        EventBus_1.eventBus.emit('world:snapshot_created', { tick: snapshot.tick });
        return snapshot;
    }
    // Restore from snapshot
    restoreSnapshot(tick) {
        const snapshot = this.state.snapshots.find((s) => s.tick === tick);
        if (!snapshot) {
            return false;
        }
        // Restore globals
        this.state.globals.clear();
        const globals = snapshot.state.globals;
        for (const [key, value] of Object.entries(globals)) {
            this.state.globals.set(key, value);
        }
        this.state.tick = snapshot.tick;
        this.state.timestamp = snapshot.timestamp;
        EventBus_1.eventBus.emit('world:snapshot_restored', { tick });
        return true;
    }
    // Get snapshots
    getSnapshots() {
        return [...this.state.snapshots];
    }
    // Compute state checksum
    computeChecksum() {
        const data = JSON.stringify({
            tick: this.state.tick,
            globals: Object.fromEntries(this.state.globals),
            agentCount: this.state.agents.size,
        });
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
    // Get full world state summary
    getSummary() {
        const agentsByStatus = {
            idle: 0,
            running: 0,
            paused: 0,
            error: 0,
            stopped: 0,
        };
        for (const agent of this.state.agents.values()) {
            agentsByStatus[agent.status]++;
        }
        return {
            tick: this.state.tick,
            timestamp: this.state.timestamp,
            agentCount: this.state.agents.size,
            agentsByStatus,
            snapshotCount: this.state.snapshots.length,
            globalCount: this.state.globals.size,
        };
    }
    // Get all agent IDs
    getAgentIds() {
        return Array.from(this.state.agents.keys());
    }
    // Check if agent exists
    hasAgent(agentId) {
        return this.state.agents.has(agentId);
    }
}
exports.WorldStateManager = WorldStateManager;
// Singleton instance
exports.worldState = new WorldStateManager();
//# sourceMappingURL=WorldStateManager.js.map