// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Shutdown Agent
// Graceful shutdown coordination for the entire system
// Ensures all agents stop cleanly and resources are released
// ═══════════════════════════════════════════════════════════════════════════════

import { Agent, AgentConfig } from '../../runtime/Agent';
import { eventBus } from '../../core/event-bus/EventBus';
import { agentRegistry } from '../../core/registry/AgentRegistry';
import { snapshotManager } from '../../core/state/SnapshotManager';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ShutdownConfig {
  timeout: number;              // Max time to wait for graceful shutdown (ms)
  createSnapshot: boolean;      // Create state snapshot before shutdown
  stopOrder?: string[];         // Agent IDs to stop in specific order
  skipAgents?: string[];        // Agent IDs to skip (they handle their own shutdown)
}

export interface ShutdownProgress {
  phase: ShutdownPhase;
  agentsStopped: number;
  agentsTotal: number;
  currentAgent?: string;
  errors: string[];
  startTime: number;
  elapsed: number;
}

export type ShutdownPhase = 
  | 'idle'
  | 'initiated'
  | 'snapshot'
  | 'stopping_agents'
  | 'cleanup'
  | 'complete'
  | 'forced';

// ─────────────────────────────────────────────────────────────────────────────
// Shutdown Agent
// ─────────────────────────────────────────────────────────────────────────────

export class ShutdownAgent extends Agent {
  private config: ShutdownConfig;
  private phase: ShutdownPhase = 'idle';
  private shutdownPromise?: Promise<void>;
  private shutdownResolve?: () => void;
  private progress: ShutdownProgress;
  private signalHandlersInstalled = false;

  constructor(agentConfig?: Partial<AgentConfig>, shutdownConfig?: Partial<ShutdownConfig>) {
    super({
      id: 'shutdown',
      name: 'Shutdown Agent',
      type: 'foundation',
      description: 'Coordinates graceful system shutdown',
      tickRate: 0, // No tick needed
      ...agentConfig,
    });

    this.config = {
      timeout: 30000,
      createSnapshot: true,
      stopOrder: [],
      skipAgents: ['shutdown'], // Don't try to stop ourselves
      ...shutdownConfig,
    };

    this.progress = this.createInitialProgress();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  protected async onStart(): Promise<void> {
    // Listen for shutdown requests
    this.subscribe('system:shutdown', async (event) => {
      const { force, reason } = event.payload as { force?: boolean; reason?: string };
      await this.initiateShutdown(force, reason);
    });

    // Install process signal handlers
    this.installSignalHandlers();

    this.log('info', 'Shutdown agent started');
  }

  protected async onStop(): Promise<void> {
    // Remove signal handlers
    this.removeSignalHandlers();
    this.log('info', 'Shutdown agent stopped');
  }

  protected async onTick(): Promise<void> {
    // No periodic work needed
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Signal Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private installSignalHandlers(): void {
    if (this.signalHandlersInstalled) return;

    const handleSignal = (signal: string) => {
      this.log('info', `Received ${signal} signal`);
      this.initiateShutdown(false, `Signal: ${signal}`);
    };

    process.on('SIGINT', () => handleSignal('SIGINT'));
    process.on('SIGTERM', () => handleSignal('SIGTERM'));

    // Handle uncaught exceptions gracefully
    process.on('uncaughtException', (error) => {
      this.log('error', `Uncaught exception: ${error.message}`);
      this.initiateShutdown(true, `Uncaught exception: ${error.message}`);
    });

    process.on('unhandledRejection', (reason) => {
      this.log('error', `Unhandled rejection: ${reason}`);
      // Don't shutdown on unhandled rejection, just log
    });

    this.signalHandlersInstalled = true;
  }

  private removeSignalHandlers(): void {
    // Note: In real implementation, we'd track and remove specific handlers
    this.signalHandlersInstalled = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Shutdown Coordination
  // ─────────────────────────────────────────────────────────────────────────

  async initiateShutdown(force = false, reason?: string): Promise<void> {
    if (this.phase !== 'idle') {
      this.log('warn', 'Shutdown already in progress');
      return this.shutdownPromise;
    }

    this.phase = 'initiated';
    this.progress = this.createInitialProgress();
    this.progress.phase = 'initiated';

    this.log('info', `Shutdown initiated${reason ? `: ${reason}` : ''}`);
    this.emit('shutdown:initiated', { reason, force });

    this.shutdownPromise = new Promise<void>((resolve) => {
      this.shutdownResolve = resolve;
    });

    // Set timeout for forced shutdown
    const timeoutId = setTimeout(() => {
      if (this.phase !== 'complete') {
        this.log('warn', 'Shutdown timeout reached, forcing shutdown');
        this.forceShutdown();
      }
    }, this.config.timeout);

    try {
      if (force) {
        await this.forceShutdown();
      } else {
        await this.gracefulShutdown();
      }
    } finally {
      clearTimeout(timeoutId);
    }

    return this.shutdownPromise;
  }

  private async gracefulShutdown(): Promise<void> {
    const startTime = Date.now();

    // Phase 1: Create snapshot
    if (this.config.createSnapshot) {
      this.updatePhase('snapshot');
      try {
        const snapshot = snapshotManager.createSnapshot('pre-shutdown');
        this.log('info', `Snapshot created: ${snapshot.id}`);
        this.emit('shutdown:snapshot', { snapshotId: snapshot.id });
      } catch (error) {
        this.log('warn', `Snapshot failed: ${error}`);
        this.progress.errors.push(`Snapshot: ${error}`);
      }
    }

    // Phase 2: Stop agents
    this.updatePhase('stopping_agents');
    await this.stopAllAgents();

    // Phase 3: Cleanup
    this.updatePhase('cleanup');
    await this.cleanup();

    // Complete
    this.updatePhase('complete');
    this.progress.elapsed = Date.now() - startTime;

    this.log('info', `Graceful shutdown complete (${this.progress.elapsed}ms)`);
    this.emit('shutdown:complete', { 
      elapsed: this.progress.elapsed,
      errors: this.progress.errors,
    });

    this.shutdownResolve?.();
  }

  private async forceShutdown(): Promise<void> {
    this.updatePhase('forced');
    
    this.log('warn', 'Forcing immediate shutdown');
    this.emit('shutdown:forced', {});

    // Try to stop agents quickly
    const agents = agentRegistry.getAll();
    await Promise.allSettled(
      agents.map(agent => agent.stop().catch(() => {}))
    );

    this.updatePhase('complete');
    this.shutdownResolve?.();

    // In production, might call process.exit(1) here
  }

  private async stopAllAgents(): Promise<void> {
    const allAgents = agentRegistry.getAll();
    const skipSet = new Set(this.config.skipAgents);

    // Build stop order
    const orderedIds = [...this.config.stopOrder!];
    const remainingAgents = allAgents.filter(
      a => !skipSet.has(a.getId()) && !orderedIds.includes(a.getId())
    );
    
    // Add remaining agents (in reverse registration order for proper dependencies)
    for (const agent of remainingAgents.reverse()) {
      orderedIds.push(agent.getId());
    }

    this.progress.agentsTotal = orderedIds.length;

    // Stop agents in order
    for (const agentId of orderedIds) {
      if (skipSet.has(agentId)) continue;

      const agent = agentRegistry.get(agentId);
      if (!agent) continue;

      this.progress.currentAgent = agentId;
      this.emitProgress();

      try {
        this.log('debug', `Stopping agent: ${agentId}`);
        await agent.stop();
        this.progress.agentsStopped++;
        this.emit('shutdown:agent:stopped', { agentId });
      } catch (error) {
        const errorMsg = `Failed to stop ${agentId}: ${error}`;
        this.log('error', errorMsg);
        this.progress.errors.push(errorMsg);
        this.emit('shutdown:agent:error', { agentId, error: String(error) });
      }
    }

    this.progress.currentAgent = undefined;
  }

  private async cleanup(): Promise<void> {
    // Emit cleanup event for any listeners
    this.emit('shutdown:cleanup', {});

    // Give listeners a moment to cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Progress
  // ─────────────────────────────────────────────────────────────────────────

  private createInitialProgress(): ShutdownProgress {
    return {
      phase: 'idle',
      agentsStopped: 0,
      agentsTotal: 0,
      errors: [],
      startTime: Date.now(),
      elapsed: 0,
    };
  }

  private updatePhase(phase: ShutdownPhase): void {
    this.phase = phase;
    this.progress.phase = phase;
    this.progress.elapsed = Date.now() - this.progress.startTime;
    this.emitProgress();
  }

  private emitProgress(): void {
    this.emit('shutdown:progress', { ...this.progress });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  getPhase(): ShutdownPhase {
    return this.phase;
  }

  getProgress(): ShutdownProgress {
    return { ...this.progress };
  }

  isShuttingDown(): boolean {
    return this.phase !== 'idle' && this.phase !== 'complete';
  }

  setConfig(config: Partial<ShutdownConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Request shutdown programmatically
   */
  async shutdown(options?: { force?: boolean; reason?: string }): Promise<void> {
    return this.initiateShutdown(options?.force, options?.reason);
  }
}
