// ═══════════════════════════════════════════════════════════════════════════════
//
//  ███████╗██╗   ██╗███████╗██████╗ ██╗   ██╗████████╗██╗  ██╗██╗███╗   ██╗ ██████╗ 
//  ██╔════╝██║   ██║██╔════╝██╔══██╗╚██╗ ██╔╝╚══██╔══╝██║  ██║██║████╗  ██║██╔════╝ 
//  █████╗  ██║   ██║█████╗  ██████╔╝ ╚████╔╝    ██║   ███████║██║██╔██╗ ██║██║  ███╗
//  ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██╔══██╗  ╚██╔╝     ██║   ██╔══██║██║██║╚██╗██║██║   ██║
//  ███████╗ ╚████╔╝ ███████╗██║  ██║   ██║      ██║   ██║  ██║██║██║ ╚████║╚██████╔╝
//  ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝ 
//                           ██████╗ ███████╗
//                          ██╔═══██╗██╔════╝
//                          ██║   ██║███████╗
//                          ██║   ██║╚════██║
//                          ╚██████╔╝███████║
//                           ╚═════╝ ╚══════╝
//
//  LLM-Agnostic Multi-Agent Operating System
//
// ═══════════════════════════════════════════════════════════════════════════════

// Core
export { eventBus, EventBus, Event, EventHandler } from './core/event-bus/EventBus';
export { PriorityQueue } from './core/event-bus/PriorityQueue';
export { DeadLetterQueue } from './core/event-bus/DeadLetterQueue';

export { workflowEngine, WorkflowEngine } from './core/workflow/WorkflowEngine';
export { workflowRegistry, WorkflowRegistry } from './core/workflow/WorkflowRegistry';
export * from './core/workflow/WorkflowTypes';

export { worldState, WorldState, StateSnapshot } from './core/state/WorldState';
export { snapshotManager, SnapshotManager } from './core/state/SnapshotManager';

export { agentRegistry, AgentRegistry } from './core/registry/AgentRegistry';
export { pluginRegistry, PluginRegistry, PluginConfig, PluginAction } from './core/registry/PluginRegistry';

export { supervisor, SupervisorAgent } from './core/supervisor/SupervisorAgent';
export { PolicyEngine, Policy, PolicyDecision } from './core/supervisor/PolicyEngine';

// Runtime
export { Agent, AgentConfig, AgentStatus, AgentType } from './runtime/Agent';
export { AgentContext, createAgentContext } from './runtime/AgentContext';
export { llmRouter, LLMRouter, LLMProvider, LLMRequest, LLMResponse } from './runtime/LLMRouter';
export * from './runtime/ActionTypes';

// Config
export { getConfig, updateConfig, SystemConfig } from './config/system';

// ─────────────────────────────────────────────────────────────────────────────
// EverythingOS Main Class
// ─────────────────────────────────────────────────────────────────────────────

import { eventBus } from './core/event-bus/EventBus';
import { supervisor } from './core/supervisor/SupervisorAgent';
import { agentRegistry } from './core/registry/AgentRegistry';
import { pluginRegistry, PluginConfig } from './core/registry/PluginRegistry';
import { workflowRegistry } from './core/workflow/WorkflowRegistry';
import { snapshotManager } from './core/state/SnapshotManager';
import { llmRouter } from './runtime/LLMRouter';
import { getConfig, updateConfig, SystemConfig } from './config/system';
import { startServer } from './api/server';

export interface EverythingOSConfig {
  config?: Partial<SystemConfig>;
  plugins?: PluginConfig[];
  autoStart?: boolean;
  apiServer?: boolean;
}

export class EverythingOS {
  private running = false;

  async initialize(options: EverythingOSConfig = {}): Promise<void> {
    // Apply config
    if (options.config) {
      updateConfig(options.config);
    }

    const config = getConfig();

    // Set default LLM provider
    llmRouter.setDefaultProvider(config.llm.defaultProvider);

    // Register plugins
    if (options.plugins) {
      for (const plugin of options.plugins) {
        await pluginRegistry.register(plugin);
      }
    }

    // Start auto snapshots
    if (config.snapshots.autoInterval > 0) {
      snapshotManager.startAutoSnapshot(config.snapshots.autoInterval);
    }

    eventBus.emit('system:initialized', { timestamp: Date.now() });
  }

  async start(): Promise<void> {
    if (this.running) return;

    // Start supervisor
    supervisor.start();

    // Start all registered agents
    await agentRegistry.startAll();

    this.running = true;
    eventBus.emit('system:started', { timestamp: Date.now() });
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    // Stop all agents
    await agentRegistry.stopAll();

    // Stop supervisor
    supervisor.stop();

    // Stop auto snapshots
    snapshotManager.stopAutoSnapshot();

    this.running = false;
    eventBus.emit('system:stopped', { timestamp: Date.now() });
  }

  startAPI(port?: number): void {
    startServer(port);
  }

  // Convenience accessors
  get events() { return eventBus; }
  get agents() { return agentRegistry; }
  get plugins() { return pluginRegistry; }
  get workflows() { return workflowRegistry; }
  get llm() { return llmRouter; }
  get isRunning() { return this.running; }
}

// Default export
export default EverythingOS;

// ─────────────────────────────────────────────────────────────────────────────
// Quick Start
// ─────────────────────────────────────────────────────────────────────────────

export async function createEverythingOS(options: EverythingOSConfig = {}): Promise<EverythingOS> {
  const os = new EverythingOS();
  await os.initialize(options);
  
  if (options.autoStart) {
    await os.start();
  }
  
  if (options.apiServer) {
    os.startAPI();
  }
  
  return os;
}
