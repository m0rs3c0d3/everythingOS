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

// Core Exports
export { EventBus, eventBus } from './core/EventBus';
export { WorldStateManager, worldState } from './core/WorldStateManager';
export { AgentRegistry, registry } from './core/AgentRegistry';
export { MetricsCollector, metrics } from './core/MetricsCollector';

// Type Exports
export * from './core/types';

// Agent Exports
export * from './agents';

// ═══════════════════════════════════════════════════════════════════════════════
// EverythingOS - Main System Class
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from './core/EventBus';
import { worldState } from './core/WorldStateManager';
import { registry } from './core/AgentRegistry';
import { metrics } from './core/MetricsCollector';
import { AgentFactory, AgentName } from './agents';
import { BaseAgent } from './agents/BaseAgent';

export interface EverythingOSConfig {
  autoStart?: boolean;
  tickRate?: number;
  agents?: AgentName[];
  presets?: ('trading' | 'healthcare' | 'full')[];
}

const PRESETS: Record<string, AgentName[]> = {
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

export class EverythingOS {
  private running = false;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private config: EverythingOSConfig;

  constructor(config: EverythingOSConfig = {}) {
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

  async initialize(): Promise<void> {
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

    console.log(`✅ Loaded ${registry.count} agents`);

    if (this.config.autoStart) {
      await this.start();
    }
  }

  async start(): Promise<void> {
    if (this.running) return;

    console.log('▶️  Starting EverythingOS...');
    this.running = true;

    // Start world tick
    this.tickInterval = setInterval(() => {
      worldState.tick();
    }, this.config.tickRate);

    // Start all agents
    await registry.startAll();

    eventBus.emit('system:started', { timestamp: Date.now() });
    console.log('✅ EverythingOS running');
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    console.log('⏹️  Stopping EverythingOS...');

    // Stop tick
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    // Stop all agents
    await registry.stopAll();

    this.running = false;
    eventBus.emit('system:stopped', { timestamp: Date.now() });
    console.log('✅ EverythingOS stopped');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Agent Management
  // ─────────────────────────────────────────────────────────────────────────────

  async loadAgent(name: AgentName): Promise<BaseAgent | null> {
    const factory = AgentFactory[name];
    if (!factory) {
      console.warn(`⚠️  Unknown agent: ${name}`);
      return null;
    }

    if (registry.has(name)) {
      return registry.get(name) || null;
    }

    const agent = factory();
    registry.register(agent);
    
    if (this.running) {
      await agent.start();
    }

    return agent;
  }

  async loadPreset(preset: string): Promise<void> {
    const agents = PRESETS[preset];
    if (!agents) {
      console.warn(`⚠️  Unknown preset: ${preset}`);
      return;
    }

    for (const agentName of agents) {
      await this.loadAgent(agentName);
    }
  }

  getAgent<T extends BaseAgent>(id: string): T | undefined {
    return registry.get(id) as T | undefined;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Event System
  // ─────────────────────────────────────────────────────────────────────────────

  on(event: string, handler: (data: unknown) => void): () => void {
    return eventBus.on(event, (e) => handler(e.payload));
  }

  emit(event: string, data: unknown): void {
    eventBus.emit(event, data, { source: 'user' });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // State & Metrics
  // ─────────────────────────────────────────────────────────────────────────────

  getState(): Record<string, unknown> {
    return {
      running: this.running,
      tick: worldState.getTick(),
      agents: registry.getStats(),
      globals: worldState.getGlobals(),
      eventBus: eventBus.getStats(),
    };
  }

  getMetrics(): Record<string, unknown> {
    return metrics.exportJSON();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────────

  isRunning(): boolean {
    return this.running;
  }

  getVersion(): string {
    return '1.0.0';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Default Export & Quick Start
// ═══════════════════════════════════════════════════════════════════════════════

export default EverythingOS;

// Quick start function
export async function createEverythingOS(
  config?: EverythingOSConfig
): Promise<EverythingOS> {
  const os = new EverythingOS(config);
  await os.initialize();
  return os;
}

// Preset quick starts
export const createTradingOS = () => createEverythingOS({ presets: ['trading'], autoStart: true });
export const createHealthcareOS = () => createEverythingOS({ presets: ['healthcare'], autoStart: true });
export const createFullOS = () => createEverythingOS({ presets: ['full'], autoStart: true });
