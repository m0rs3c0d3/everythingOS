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
//  LLM-Agnostic Multi-Agent Operating System v2
//  From chatbots to robot swarms
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
export * from './runtime/IntentContract';

// Config
export { getConfig, updateConfig, SystemConfig } from './config/system';

// Services
export * from './services';

// Security
export * from './security';

// Observability
export * from './observability';

// Agents
export * from './agents';

// Hardware (optional imports)
export * from './plugins/hardware';

// Robotics (optional imports)
export * from './plugins/robotics';

// Swarm (optional imports)
export * from './plugins/swarm';

// Platforms (optional imports)
export * from './plugins/platforms';

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
import { intentManager } from './runtime/IntentContract';
import { memoryService } from './services/memory';
import { toolRegistry } from './services/tools';
import { capabilityDiscovery } from './services/capabilities';
import { getConfig, updateConfig, SystemConfig } from './config/system';
import { startServer } from './api/server';
import { security, SecurityConfig } from './security';
import { metrics } from './observability';

// ─────────────────────────────────────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────────────────────────────────────

export type Preset = 'core' | 'hardware' | 'robotics' | 'swarm' | 'full';

const PRESET_DESCRIPTIONS: Record<Preset, string> = {
  core: 'Core agents, memory, tools, workflows',
  hardware: 'Sensors, actuators, protocols',
  robotics: 'ROS2, motion control, safety',
  swarm: 'Multi-robot coordination, mesh networking',
  full: 'Everything included',
};

// ─────────────────────────────────────────────────────────────────────────────
// Config Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EverythingOSConfig {
  // System config
  config?: Partial<SystemConfig>;
  
  // Presets to load
  presets?: Preset[];
  
  // Plugins
  plugins?: PluginConfig[];
  
  // Security
  security?: SecurityConfig;
  
  // Hardware platform
  platform?: 'raspberry_pi' | 'jetson' | 'linux' | 'auto';
  
  // Lifecycle
  autoStart?: boolean;
  apiServer?: boolean;
  apiPort?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// EverythingOS Class
// ─────────────────────────────────────────────────────────────────────────────

export class EverythingOS {
  private running = false;
  private loadedPresets: Set<Preset> = new Set();
  private startTime = 0;

  async initialize(options: EverythingOSConfig = {}): Promise<void> {
    console.log('🚀 EverythingOS v2 initializing...');

    // Apply config
    if (options.config) {
      updateConfig(options.config);
    }

    const config = getConfig();

    // Set default LLM provider
    llmRouter.setDefaultProvider(config.llm.defaultProvider);

    // Load presets
    const presets = options.presets ?? ['core'];
    for (const preset of presets) {
      await this.loadPreset(preset);
    }

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

    console.log(`✅ Loaded presets: ${Array.from(this.loadedPresets).join(', ')}`);
    eventBus.emit('system:initialized', { timestamp: Date.now(), presets: Array.from(this.loadedPresets) });
  }

  private async loadPreset(preset: Preset): Promise<void> {
    if (this.loadedPresets.has(preset)) return;
    
    switch (preset) {
      case 'core':
        // Core is always loaded by default
        console.log('  📦 Loading core preset...');
        break;
        
      case 'hardware':
        console.log('  📦 Loading hardware preset...');
        // Hardware modules are already exported
        break;
        
      case 'robotics':
        console.log('  📦 Loading robotics preset...');
        // Depends on hardware
        await this.loadPreset('hardware');
        break;
        
      case 'swarm':
        console.log('  📦 Loading swarm preset...');
        break;
        
      case 'full':
        console.log('  📦 Loading full preset...');
        await this.loadPreset('hardware');
        await this.loadPreset('robotics');
        await this.loadPreset('swarm');
        break;
    }
    
    this.loadedPresets.add(preset);
  }

  async start(): Promise<void> {
    if (this.running) return;

    console.log('▶️  Starting EverythingOS...');
    this.startTime = Date.now();

    // Start supervisor
    supervisor.start();

    // Start all registered agents
    await agentRegistry.startAll();

    this.running = true;
    metrics.set('everythingos_agents_active', agentRegistry.getAll().length);
    
    eventBus.emit('system:started', { timestamp: Date.now() });
    console.log('✅ EverythingOS running');
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    console.log('⏹️  Stopping EverythingOS...');

    // Stop all agents
    await agentRegistry.stopAll();

    // Stop supervisor
    supervisor.stop();

    // Stop auto snapshots
    snapshotManager.stopAutoSnapshot();

    // Shutdown memory service
    memoryService.shutdown();

    // Shutdown security
    security.shutdown();

    this.running = false;
    eventBus.emit('system:stopped', { timestamp: Date.now() });
    console.log('✅ EverythingOS stopped');
  }

  startAPI(port?: number): void {
    startServer(port);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Convenience Accessors
  // ─────────────────────────────────────────────────────────────────────────

  get events() { return eventBus; }
  get agents() { return agentRegistry; }
  get plugins() { return pluginRegistry; }
  get workflows() { return workflowRegistry; }
  get memory() { return memoryService; }
  get tools() { return toolRegistry; }
  get intents() { return intentManager; }
  get capabilities() { return capabilityDiscovery; }
  get llm() { return llmRouter; }
  get sec() { return security; }
  get isRunning() { return this.running; }

  // ─────────────────────────────────────────────────────────────────────────
  // Status
  // ─────────────────────────────────────────────────────────────────────────

  getStatus(): {
    running: boolean;
    uptime: number;
    presets: Preset[];
    agents: number;
    plugins: number;
    events: number;
  } {
    return {
      running: this.running,
      uptime: this.running ? Date.now() - this.startTime : 0,
      presets: Array.from(this.loadedPresets),
      agents: agentRegistry.getAll().length,
      plugins: pluginRegistry.count,
      events: 0, // Would get from eventBus stats
    };
  }

  getMetrics(): Record<string, unknown> {
    return metrics.exportJSON();
  }

  getMetricsPrometheus(): string {
    return metrics.exportPrometheus();
  }
}

// Default export
export default EverythingOS;

// ─────────────────────────────────────────────────────────────────────────────
// Quick Start Functions
// ─────────────────────────────────────────────────────────────────────────────

export async function createEverythingOS(options: EverythingOSConfig = {}): Promise<EverythingOS> {
  const os = new EverythingOS();
  await os.initialize(options);
  
  if (options.autoStart) {
    await os.start();
  }
  
  if (options.apiServer) {
    os.startAPI(options.apiPort);
  }
  
  return os;
}

// Preset quick starts
export const createRoboticsOS = () => createEverythingOS({ 
  presets: ['robotics'], 
  autoStart: true 
});

export const createSwarmOS = () => createEverythingOS({ 
  presets: ['swarm'], 
  autoStart: true 
});

export const createFullOS = () => createEverythingOS({ 
  presets: ['full'], 
  autoStart: true,
  apiServer: true,
});
