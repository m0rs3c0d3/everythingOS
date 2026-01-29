// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Robot Agent
// An agent that controls a simulated (or real) robot
// ═══════════════════════════════════════════════════════════════════════════════

import { Agent, AgentConfig } from '../runtime/Agent';
import { eventBus } from '../core/event-bus/EventBus';
import { SimulatedRobot, MoveCommand, RobotState } from './SimulatedRobot';
import { Position } from './SimulatedWorld';

export interface RobotAgentConfig extends Partial<AgentConfig> {
  robot: SimulatedRobot;
  patrolPoints?: Position[];
  avoidDanger?: boolean;
}

export class RobotAgent extends Agent {
  private robot: SimulatedRobot;
  private patrolPoints: Position[];
  private currentPatrolIndex: number = 0;
  private avoidDanger: boolean;
  private isPatrolling: boolean = false;
  private lastState: RobotState | null = null;

  constructor(config: RobotAgentConfig) {
    super({
      id: config.id ?? `robot-agent-${config.robot.id}`,
      name: config.name ?? `Robot Agent (${config.robot.name})`,
      type: 'execution',
      tickRate: config.tickRate ?? 500,
      ...config,
    });

    this.robot = config.robot;
    this.patrolPoints = config.patrolPoints ?? [];
    this.avoidDanger = config.avoidDanger ?? true;
  }

  protected async onStart(): Promise<void> {
    // Start the robot's update loop
    this.robot.start();

    // Subscribe to robot events
    this.subscribe('robot:collision', (e) => this.handleCollision(e.payload));
    this.subscribe('robot:danger:zone', (e) => this.handleDanger(e.payload));
    this.subscribe('robot:goal:reached', (e) => this.handleGoalReached(e.payload));
    this.subscribe('robot:battery:depleted', (e) => this.handleBatteryDepleted(e.payload));
    this.subscribe('robot:navigation:complete', (e) => this.handleNavigationComplete(e.payload));

    // Subscribe to commands
    this.subscribe('robot:command:move', (e) => this.handleMoveCommand(e.payload));
    this.subscribe('robot:command:goto', (e) => this.handleGotoCommand(e.payload));
    this.subscribe('robot:command:patrol', (e) => this.handlePatrolCommand(e.payload));
    this.subscribe('robot:command:stop', () => this.stopAll());

    this.emit('robot:agent:ready', { robotId: this.robot.id });
  }

  protected async onStop(): Promise<void> {
    this.robot.stop();
    this.isPatrolling = false;
  }

  protected async onTick(): Promise<void> {
    const state = this.robot.getState();
    
    // Emit state periodically
    this.emit('robot:state', {
      robotId: this.robot.id,
      ...state,
    });

    // Check for low battery
    if (state.battery < 20 && state.battery > 0) {
      if (!this.lastState || this.lastState.battery >= 20) {
        this.emit('robot:battery:low', { robotId: this.robot.id, battery: state.battery });
      }
    }

    // Check for obstacles if moving
    if (state.status === 'moving') {
      const distance = this.robot.getDistanceToObstacle();
      if (distance < 1.0) {
        this.emit('robot:obstacle:near', { robotId: this.robot.id, distance });
      }
    }

    // Continue patrol if patrolling and idle
    if (this.isPatrolling && state.status === 'idle' && this.patrolPoints.length > 0) {
      this.continuePatrol();
    }

    this.lastState = state;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Command Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  private handleMoveCommand(payload: { direction: string; robotId?: string }): void {
    if (payload.robotId && payload.robotId !== this.robot.id) return;

    const commands: Record<string, MoveCommand> = {
      forward: { type: 'forward' },
      backward: { type: 'backward' },
      left: { type: 'left' },
      right: { type: 'right' },
      stop: { type: 'stop' },
    };

    const command = commands[payload.direction];
    if (command) {
      this.robot.execute(command);
    }
  }

  private handleGotoCommand(payload: { position: Position; robotId?: string }): void {
    if (payload.robotId && payload.robotId !== this.robot.id) return;

    this.isPatrolling = false;
    this.robot.execute({ type: 'goto', targetPosition: payload.position });
  }

  private handlePatrolCommand(payload: { points?: Position[]; robotId?: string }): void {
    if (payload.robotId && payload.robotId !== this.robot.id) return;

    if (payload.points) {
      this.patrolPoints = payload.points;
    }

    if (this.patrolPoints.length > 0) {
      this.isPatrolling = true;
      this.currentPatrolIndex = 0;
      this.continuePatrol();
      this.emit('robot:patrol:started', { robotId: this.robot.id, points: this.patrolPoints });
    }
  }

  private stopAll(): void {
    this.isPatrolling = false;
    this.robot.execute({ type: 'stop' });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  private handleCollision(payload: { id: string; reason: string }): void {
    if (payload.id !== this.robot.id) return;

    this.log('warn', `Collision: ${payload.reason}`);
    
    // Back up and try to recover
    this.robot.execute({ type: 'backward' });
    setTimeout(() => {
      this.robot.execute({ type: 'stop' });
      
      // Turn randomly to try to find a clear path
      const turnDirection = Math.random() > 0.5 ? 'left' : 'right';
      this.robot.execute({ type: turnDirection });
      setTimeout(() => {
        this.robot.execute({ type: 'stop' });
      }, 500);
    }, 500);
  }

  private handleDanger(payload: { id: string; zone: unknown }): void {
    if (payload.id !== this.robot.id) return;
    if (!this.avoidDanger) return;

    this.log('warn', 'Entered danger zone! Retreating...');
    this.emit('robot:alert', { robotId: this.robot.id, type: 'danger_zone' });

    // Emergency retreat
    this.robot.execute({ type: 'backward' });
    setTimeout(() => {
      this.robot.execute({ type: 'stop' });
    }, 1000);
  }

  private handleGoalReached(payload: { id: string }): void {
    if (payload.id !== this.robot.id) return;

    this.log('info', 'Goal reached!');
    this.emit('robot:mission:complete', { robotId: this.robot.id });
  }

  private handleBatteryDepleted(payload: { id: string }): void {
    if (payload.id !== this.robot.id) return;

    this.log('error', 'Battery depleted!');
    this.isPatrolling = false;
    this.emit('robot:alert', { robotId: this.robot.id, type: 'battery_depleted' });
  }

  private handleNavigationComplete(payload: { id: string }): void {
    if (payload.id !== this.robot.id) return;

    // If patrolling, this is handled by onTick
    if (!this.isPatrolling) {
      this.emit('robot:arrived', { robotId: this.robot.id, position: this.robot.getPosition() });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Patrol Logic
  // ─────────────────────────────────────────────────────────────────────────────

  private continuePatrol(): void {
    if (this.patrolPoints.length === 0) return;

    const target = this.patrolPoints[this.currentPatrolIndex];
    this.robot.execute({ type: 'goto', targetPosition: target });
    
    this.emit('robot:patrol:waypoint', {
      robotId: this.robot.id,
      index: this.currentPatrolIndex,
      target,
    });

    // Advance to next point
    this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────────

  getRobotState(): RobotState {
    return this.robot.getState();
  }

  getRobotPosition(): Position {
    return this.robot.getPosition();
  }

  sendCommand(command: MoveCommand): void {
    this.robot.execute(command);
  }

  setPatrolPoints(points: Position[]): void {
    this.patrolPoints = points;
  }

  startPatrol(): void {
    this.handlePatrolCommand({});
  }

  stopPatrol(): void {
    this.isPatrolling = false;
    this.robot.execute({ type: 'stop' });
    this.emit('robot:patrol:stopped', { robotId: this.robot.id });
  }
}
