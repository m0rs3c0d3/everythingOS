"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Agent Registry
// Agent lifecycle management and discovery
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.registry = exports.AgentRegistry = void 0;
const EventBus_1 = require("./EventBus");
const WorldStateManager_1 = require("./WorldStateManager");
class AgentRegistry {
    agents = new Map();
    tierIndex = new Map();
    dependencyGraph = new Map();
    constructor() {
        // Initialize tier index
        const tiers = [
            'foundation',
            'sensing',
            'decision',
            'execution',
            'learning',
            'orchestration',
            'specialized',
        ];
        tiers.forEach((tier) => this.tierIndex.set(tier, new Set()));
    }
    // Register an agent
    register(agent) {
        const config = agent.getConfig();
        if (this.agents.has(config.id)) {
            throw new Error(`Agent ${config.id} is already registered`);
        }
        // Check dependencies
        if (config.dependencies) {
            for (const depId of config.dependencies) {
                if (!this.agents.has(depId)) {
                    throw new Error(`Agent ${config.id} depends on ${depId}, which is not registered`);
                }
            }
        }
        // Register with world state
        WorldStateManager_1.worldState.registerAgent(config.id);
        // Store agent
        this.agents.set(config.id, {
            config,
            instance: agent,
            registeredAt: Date.now(),
        });
        // Update tier index
        this.tierIndex.get(config.tier)?.add(config.id);
        // Update dependency graph
        if (config.dependencies) {
            this.dependencyGraph.set(config.id, new Set(config.dependencies));
        }
        EventBus_1.eventBus.emit('registry:agent_registered', {
            agentId: config.id,
            tier: config.tier,
            name: config.name,
        });
    }
    // Unregister an agent
    unregister(agentId) {
        const registered = this.agents.get(agentId);
        if (!registered) {
            return false;
        }
        // Check if other agents depend on this one
        const dependents = this.getDependents(agentId);
        if (dependents.length > 0) {
            throw new Error(`Cannot unregister ${agentId}: agents ${dependents.join(', ')} depend on it`);
        }
        // Stop the agent first
        registered.instance.stop();
        // Remove from world state
        WorldStateManager_1.worldState.unregisterAgent(agentId);
        // Remove from tier index
        this.tierIndex.get(registered.config.tier)?.delete(agentId);
        // Remove from dependency graph
        this.dependencyGraph.delete(agentId);
        // Remove agent
        this.agents.delete(agentId);
        EventBus_1.eventBus.emit('registry:agent_unregistered', { agentId });
        return true;
    }
    // Get agent by ID
    get(agentId) {
        return this.agents.get(agentId)?.instance;
    }
    // Get agent config
    getConfig(agentId) {
        return this.agents.get(agentId)?.config;
    }
    // Get all agents
    getAll() {
        return Array.from(this.agents.values()).map((r) => r.instance);
    }
    // Get agents by tier
    getByTier(tier) {
        const ids = this.tierIndex.get(tier) || new Set();
        return Array.from(ids)
            .map((id) => this.agents.get(id)?.instance)
            .filter((a) => a !== undefined);
    }
    // Get agents that depend on a given agent
    getDependents(agentId) {
        const dependents = [];
        for (const [id, deps] of this.dependencyGraph) {
            if (deps.has(agentId)) {
                dependents.push(id);
            }
        }
        return dependents;
    }
    // Get dependencies for an agent
    getDependencies(agentId) {
        const deps = this.dependencyGraph.get(agentId);
        return deps ? Array.from(deps) : [];
    }
    // Start all agents in dependency order
    async startAll() {
        const startOrder = this.getStartOrder();
        for (const agentId of startOrder) {
            const agent = this.agents.get(agentId);
            if (agent && agent.config.enabled !== false) {
                await agent.instance.start();
            }
        }
        EventBus_1.eventBus.emit('registry:all_started', { count: startOrder.length });
    }
    // Stop all agents in reverse dependency order
    async stopAll() {
        const stopOrder = this.getStartOrder().reverse();
        for (const agentId of stopOrder) {
            const agent = this.agents.get(agentId);
            if (agent) {
                await agent.instance.stop();
            }
        }
        EventBus_1.eventBus.emit('registry:all_stopped', { count: stopOrder.length });
    }
    // Get topologically sorted start order
    getStartOrder() {
        const visited = new Set();
        const result = [];
        const visit = (id) => {
            if (visited.has(id))
                return;
            visited.add(id);
            const deps = this.dependencyGraph.get(id);
            if (deps) {
                for (const dep of deps) {
                    visit(dep);
                }
            }
            result.push(id);
        };
        for (const id of this.agents.keys()) {
            visit(id);
        }
        return result;
    }
    // Find agents by criteria
    find(criteria) {
        let results = this.getAll();
        if (criteria.tier) {
            results = results.filter((a) => a.getConfig().tier === criteria.tier);
        }
        if (criteria.status) {
            results = results.filter((a) => a.getStatus() === criteria.status);
        }
        if (criteria.name) {
            const pattern = criteria.name instanceof RegExp
                ? criteria.name
                : new RegExp(criteria.name, 'i');
            results = results.filter((a) => pattern.test(a.getConfig().name));
        }
        return results;
    }
    // Get registry stats
    getStats() {
        const byTier = {
            foundation: 0,
            sensing: 0,
            decision: 0,
            execution: 0,
            learning: 0,
            orchestration: 0,
            specialized: 0,
        };
        const byStatus = {
            idle: 0,
            running: 0,
            paused: 0,
            error: 0,
            stopped: 0,
        };
        for (const [, registered] of this.agents) {
            byTier[registered.config.tier]++;
            byStatus[registered.instance.getStatus()]++;
        }
        return {
            total: this.agents.size,
            byTier,
            byStatus,
        };
    }
    // Check if agent is registered
    has(agentId) {
        return this.agents.has(agentId);
    }
    // Get agent count
    get count() {
        return this.agents.size;
    }
}
exports.AgentRegistry = AgentRegistry;
// Singleton instance
exports.registry = new AgentRegistry();
//# sourceMappingURL=AgentRegistry.js.map