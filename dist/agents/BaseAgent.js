"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Base Agent
// Abstract base class for all agents in the system
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
const EventBus_1 = require("../core/EventBus");
const WorldStateManager_1 = require("../core/WorldStateManager");
const MetricsCollector_1 = require("../core/MetricsCollector");
class BaseAgent {
    config;
    status = 'idle';
    subscriptions = [];
    tickInterval = null;
    tickRate = 1000; // ms
    startTime = 0;
    constructor(config) {
        this.config = {
            ...config,
            enabled: config.enabled ?? true,
        };
    }
    // Get agent config
    getConfig() {
        return { ...this.config };
    }
    // Get agent ID
    getId() {
        return this.config.id;
    }
    // Get agent status
    getStatus() {
        return this.status;
    }
    // Start the agent
    async start() {
        if (this.status === 'running') {
            return;
        }
        this.status = 'running';
        this.startTime = Date.now();
        WorldStateManager_1.worldState.setAgentStatus(this.config.id, 'running');
        // Setup event subscriptions
        this.setupSubscriptions();
        // Call agent-specific initialization
        await this.onStart();
        // Start tick loop if needed
        if (this.tickRate > 0) {
            this.tickInterval = setInterval(() => this.tick(), this.tickRate);
        }
        this.emit('agent:started', { agentId: this.config.id });
    }
    // Stop the agent
    async stop() {
        if (this.status === 'stopped') {
            return;
        }
        this.status = 'stopped';
        WorldStateManager_1.worldState.setAgentStatus(this.config.id, 'stopped');
        // Stop tick loop
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        // Unsubscribe from events
        this.subscriptions.forEach((subId) => EventBus_1.eventBus.unsubscribe(subId));
        this.subscriptions = [];
        // Call agent-specific cleanup
        await this.onStop();
        this.emit('agent:stopped', { agentId: this.config.id });
    }
    // Pause the agent
    pause() {
        if (this.status !== 'running') {
            return;
        }
        this.status = 'paused';
        WorldStateManager_1.worldState.setAgentStatus(this.config.id, 'paused');
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        this.emit('agent:paused', { agentId: this.config.id });
    }
    // Resume the agent
    resume() {
        if (this.status !== 'paused') {
            return;
        }
        this.status = 'running';
        WorldStateManager_1.worldState.setAgentStatus(this.config.id, 'running');
        if (this.tickRate > 0) {
            this.tickInterval = setInterval(() => this.tick(), this.tickRate);
        }
        this.emit('agent:resumed', { agentId: this.config.id });
    }
    // Tick - called periodically
    async tick() {
        if (this.status !== 'running') {
            return;
        }
        const start = performance.now();
        try {
            await this.onTick();
            const state = WorldStateManager_1.worldState.getAgentState(this.config.id);
            if (state) {
                state.lastTick = WorldStateManager_1.worldState.getTick();
                state.tickCount++;
            }
        }
        catch (error) {
            this.handleError(error);
        }
        const duration = (performance.now() - start) / 1000;
        MetricsCollector_1.metrics.observe('agent_processing_duration_seconds', duration, {
            agent: this.config.id,
        });
        WorldStateManager_1.worldState.updateAgentMetrics(this.config.id, {
            lastProcessingTime: duration,
            uptime: Date.now() - this.startTime,
        });
    }
    // Setup event subscriptions
    setupSubscriptions() {
        // Subscribe to world tick
        const tickSub = EventBus_1.eventBus.subscribe('world:tick', () => {
            // Agents can react to world ticks
        });
        this.subscriptions.push(tickSub);
    }
    // Subscribe to an event
    subscribe(pattern, handler) {
        const subId = EventBus_1.eventBus.subscribe(pattern, async (event) => {
            const state = WorldStateManager_1.worldState.getAgentState(this.config.id);
            if (state) {
                state.metrics.eventsProcessed++;
            }
            try {
                await handler(event);
            }
            catch (error) {
                this.handleError(error);
            }
        });
        this.subscriptions.push(subId);
    }
    // Emit an event
    emit(type, payload, target) {
        EventBus_1.eventBus.emit(type, payload, {
            source: this.config.id,
            target,
        });
        const state = WorldStateManager_1.worldState.getAgentState(this.config.id);
        if (state) {
            state.metrics.eventsEmitted++;
        }
    }
    // Handle errors
    handleError(error, recoverable = true) {
        this.status = 'error';
        WorldStateManager_1.worldState.setAgentStatus(this.config.id, 'error');
        WorldStateManager_1.worldState.recordAgentError(this.config.id, error, recoverable);
        MetricsCollector_1.metrics.increment('agent_errors_total', 1, { agent: this.config.id });
        this.emit('agent:error', {
            agentId: this.config.id,
            error: error.message,
            recoverable,
        });
        if (recoverable) {
            // Auto-recover after error
            setTimeout(() => {
                if (this.status === 'error') {
                    this.status = 'running';
                    WorldStateManager_1.worldState.setAgentStatus(this.config.id, 'running');
                }
            }, 5000);
        }
    }
    // Get memory value
    getMemory(key) {
        return WorldStateManager_1.worldState.getAgentMemory(this.config.id, key);
    }
    // Set memory value
    setMemory(key, value) {
        WorldStateManager_1.worldState.setAgentMemory(this.config.id, key, value);
    }
    // Get global state
    getGlobal(key) {
        return WorldStateManager_1.worldState.getGlobal(key);
    }
    // Set global state
    setGlobal(key, value) {
        WorldStateManager_1.worldState.setGlobal(key, value);
    }
}
exports.BaseAgent = BaseAgent;
//# sourceMappingURL=BaseAgent.js.map