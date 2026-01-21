// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Environment Sensor Agent
// System environment monitoring and resource tracking
// ═══════════════════════════════════════════════════════════════════════════════

import { BaseAgent } from '../BaseAgent';
import { metrics } from '../../core/MetricsCollector';

interface EnvironmentState {
  memory: {
    used: number;
    total: number;
    percent: number;
  };
  cpu: {
    usage: number;
    cores: number;
  };
  runtime: {
    platform: string;
    version: string;
    uptime: number;
  };
  network: {
    online: boolean;
    latency: number;
  };
}

export class EnvironmentSensorAgent extends BaseAgent {
  private lastCpuMeasure = 0;
  private cpuUsageHistory: number[] = [];

  constructor() {
    super({
      id: 'environment_sensor',
      name: 'Environment Sensor Agent',
      tier: 'foundation',
      description: 'System environment monitoring and resource tracking',
      version: '1.0.0',
    });

    this.tickRate = 5000; // Check every 5 seconds

    // Register metrics
    metrics.registerGauge('env_memory_used_bytes', 'Memory used in bytes');
    metrics.registerGauge('env_memory_percent', 'Memory usage percentage');
    metrics.registerGauge('env_cpu_usage_percent', 'CPU usage percentage');
  }

  protected async onStart(): Promise<void> {
    this.emit('environment:sensor_started', { timestamp: Date.now() });
    await this.measureEnvironment();
  }

  protected async onStop(): Promise<void> {
    this.emit('environment:sensor_stopped', { timestamp: Date.now() });
  }

  protected async onTick(): Promise<void> {
    await this.measureEnvironment();
  }

  private async measureEnvironment(): Promise<void> {
    const state = this.getEnvironmentState();
    
    // Update metrics
    metrics.set('env_memory_used_bytes', state.memory.used);
    metrics.set('env_memory_percent', state.memory.percent);
    metrics.set('env_cpu_usage_percent', state.cpu.usage);

    // Store in memory
    this.setMemory('environment_state', state);
    this.setGlobal('environment', state);

    // Emit state update
    this.emit('environment:state_updated', state);

    // Check thresholds and emit alerts
    this.checkThresholds(state);
  }

  private getEnvironmentState(): EnvironmentState {
    // Simulate memory usage (in browser/Node environment)
    const memoryUsed = this.simulateMemoryUsage();
    const memoryTotal = 8 * 1024 * 1024 * 1024; // 8GB simulated

    // Simulate CPU usage
    const cpuUsage = this.simulateCpuUsage();

    return {
      memory: {
        used: memoryUsed,
        total: memoryTotal,
        percent: (memoryUsed / memoryTotal) * 100,
      },
      cpu: {
        usage: cpuUsage,
        cores: 4, // Simulated
      },
      runtime: {
        platform: 'EverythingOS',
        version: '1.0.0',
        uptime: Date.now() - (this.getGlobal<number>('system_start_time') || Date.now()),
      },
      network: {
        online: true,
        latency: Math.random() * 50 + 10, // Simulated 10-60ms
      },
    };
  }

  private simulateMemoryUsage(): number {
    // Simulate fluctuating memory usage
    const base = 2 * 1024 * 1024 * 1024; // 2GB base
    const variance = Math.sin(Date.now() / 10000) * 500 * 1024 * 1024;
    return base + variance + Math.random() * 100 * 1024 * 1024;
  }

  private simulateCpuUsage(): number {
    // Simulate fluctuating CPU usage with some persistence
    const now = Date.now();
    const timeDelta = now - this.lastCpuMeasure;
    this.lastCpuMeasure = now;

    // Add some momentum to CPU usage
    const lastUsage = this.cpuUsageHistory[this.cpuUsageHistory.length - 1] || 30;
    const trend = (Math.random() - 0.5) * 20;
    let newUsage = lastUsage + trend;
    
    // Clamp between 5% and 95%
    newUsage = Math.max(5, Math.min(95, newUsage));
    
    this.cpuUsageHistory.push(newUsage);
    if (this.cpuUsageHistory.length > 60) {
      this.cpuUsageHistory.shift();
    }

    return newUsage;
  }

  private checkThresholds(state: EnvironmentState): void {
    // Memory warning at 80%, critical at 90%
    if (state.memory.percent > 90) {
      this.emit('environment:alert', {
        level: 'critical',
        type: 'memory',
        message: `Memory usage critical: ${state.memory.percent.toFixed(1)}%`,
        value: state.memory.percent,
      });
    } else if (state.memory.percent > 80) {
      this.emit('environment:alert', {
        level: 'warning',
        type: 'memory',
        message: `Memory usage high: ${state.memory.percent.toFixed(1)}%`,
        value: state.memory.percent,
      });
    }

    // CPU warning at 85%, critical at 95%
    if (state.cpu.usage > 95) {
      this.emit('environment:alert', {
        level: 'critical',
        type: 'cpu',
        message: `CPU usage critical: ${state.cpu.usage.toFixed(1)}%`,
        value: state.cpu.usage,
      });
    } else if (state.cpu.usage > 85) {
      this.emit('environment:alert', {
        level: 'warning',
        type: 'cpu',
        message: `CPU usage high: ${state.cpu.usage.toFixed(1)}%`,
        value: state.cpu.usage,
      });
    }

    // Network offline
    if (!state.network.online) {
      this.emit('environment:alert', {
        level: 'critical',
        type: 'network',
        message: 'Network connection lost',
        value: 0,
      });
    }
  }

  // Public API
  getState(): EnvironmentState | undefined {
    return this.getMemory<EnvironmentState>('environment_state');
  }

  getCpuHistory(): number[] {
    return [...this.cpuUsageHistory];
  }
}
