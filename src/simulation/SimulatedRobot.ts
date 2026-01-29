// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Simulated Robot
// A virtual robot for testing agent control without hardware
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../core/event-bus/EventBus';
import { SimulatedWorld, Position } from './SimulatedWorld';

export interface RobotState {
  position: Position;
  heading: number;        // Degrees, 0 = right, 90 = up
  velocity: number;       // Units per second
  angularVelocity: number; // Degrees per second
  battery: number;        // 0-100
  status: 'idle' | 'moving' | 'rotating' | 'stopped' | 'error';
}

export interface RobotConfig {
  id: string;
  name: string;
  startPosition: Position;
  startHeading?: number;
  maxVelocity?: number;
  maxAngularVelocity?: number;
  batteryDrain?: number;  // Per second when moving
}

export interface MoveCommand {
  type: 'forward' | 'backward' | 'left' | 'right' | 'stop' | 'goto';
  value?: number;         // Distance or angle
  targetPosition?: Position;
}

export class SimulatedRobot {
  readonly id: string;
  readonly name: string;
  
  private state: RobotState;
  private world: SimulatedWorld;
  private maxVelocity: number;
  private maxAngularVelocity: number;
  private batteryDrain: number;
  
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private targetPosition: Position | null = null;
  private commandQueue: MoveCommand[] = [];

  constructor(config: RobotConfig, world: SimulatedWorld) {
    this.id = config.id;
    this.name = config.name;
    this.world = world;
    this.maxVelocity = config.maxVelocity ?? 2;
    this.maxAngularVelocity = config.maxAngularVelocity ?? 90;
    this.batteryDrain = config.batteryDrain ?? 0.5;

    this.state = {
      position: { ...config.startPosition },
      heading: config.startHeading ?? 0,
      velocity: 0,
      angularVelocity: 0,
      battery: 100,
      status: 'idle',
    };

    // Register with world
    this.world.registerEntity(this.id, this.state.position);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────────

  start(): void {
    if (this.updateInterval) return;

    const tickRate = 100; // 10 Hz
    this.updateInterval = setInterval(() => this.update(tickRate / 1000), tickRate);
    
    eventBus.emit('robot:started', { id: this.id, state: this.getState() });
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.state.velocity = 0;
    this.state.angularVelocity = 0;
    this.state.status = 'stopped';
    
    eventBus.emit('robot:stopped', { id: this.id, state: this.getState() });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Commands
  // ─────────────────────────────────────────────────────────────────────────────

  execute(command: MoveCommand): void {
    eventBus.emit('robot:command', { id: this.id, command });

    switch (command.type) {
      case 'forward':
        this.state.velocity = this.maxVelocity;
        this.state.angularVelocity = 0;
        this.state.status = 'moving';
        break;

      case 'backward':
        this.state.velocity = -this.maxVelocity * 0.5; // Slower in reverse
        this.state.angularVelocity = 0;
        this.state.status = 'moving';
        break;

      case 'left':
        this.state.angularVelocity = this.maxAngularVelocity;
        this.state.status = 'rotating';
        break;

      case 'right':
        this.state.angularVelocity = -this.maxAngularVelocity;
        this.state.status = 'rotating';
        break;

      case 'stop':
        this.state.velocity = 0;
        this.state.angularVelocity = 0;
        this.state.status = 'idle';
        this.targetPosition = null;
        break;

      case 'goto':
        if (command.targetPosition) {
          this.targetPosition = command.targetPosition;
          this.state.status = 'moving';
          eventBus.emit('robot:navigation:started', {
            id: this.id,
            from: this.state.position,
            to: command.targetPosition,
          });
        }
        break;
    }
  }

  queueCommand(command: MoveCommand): void {
    this.commandQueue.push(command);
    eventBus.emit('robot:command:queued', { id: this.id, command, queueLength: this.commandQueue.length });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Update Loop
  // ─────────────────────────────────────────────────────────────────────────────

  private update(dt: number): void {
    // Check battery
    if (this.state.battery <= 0) {
      this.state.status = 'error';
      this.state.velocity = 0;
      this.state.angularVelocity = 0;
      eventBus.emit('robot:battery:depleted', { id: this.id });
      return;
    }

    // Handle goto navigation
    if (this.targetPosition) {
      this.navigateToTarget(dt);
    }

    // Update heading
    if (this.state.angularVelocity !== 0) {
      this.state.heading += this.state.angularVelocity * dt;
      this.state.heading = ((this.state.heading % 360) + 360) % 360;
    }

    // Update position
    if (this.state.velocity !== 0) {
      const radians = (this.state.heading * Math.PI) / 180;
      const newPosition = {
        x: this.state.position.x + Math.cos(radians) * this.state.velocity * dt,
        y: this.state.position.y + Math.sin(radians) * this.state.velocity * dt,
      };

      // Check with world
      const result = this.world.updateEntityPosition(this.id, newPosition);
      
      if (result.allowed) {
        this.state.position = newPosition;
        
        // Drain battery when moving
        this.state.battery -= this.batteryDrain * dt;
        this.state.battery = Math.max(0, this.state.battery);

        // Emit position update
        eventBus.emit('robot:position', {
          id: this.id,
          position: this.state.position,
          heading: this.state.heading,
          velocity: this.state.velocity,
        });

        // Check if in danger zone
        if (result.zone?.type === 'danger') {
          eventBus.emit('robot:danger:zone', { id: this.id, zone: result.zone });
        }

        // Check if reached goal
        if (result.zone?.type === 'goal') {
          eventBus.emit('robot:goal:reached', { id: this.id, zone: result.zone });
          this.execute({ type: 'stop' });
        }
      } else {
        // Collision - stop
        this.state.velocity = 0;
        this.state.status = 'error';
        eventBus.emit('robot:collision', {
          id: this.id,
          reason: result.reason,
          position: newPosition,
        });
      }
    }

    // Process command queue if idle
    if (this.state.status === 'idle' && this.commandQueue.length > 0) {
      const nextCommand = this.commandQueue.shift()!;
      this.execute(nextCommand);
    }
  }

  private navigateToTarget(dt: number): void {
    if (!this.targetPosition) return;

    const dx = this.targetPosition.x - this.state.position.x;
    const dy = this.targetPosition.y - this.state.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Reached target?
    if (distance < 0.2) {
      this.targetPosition = null;
      this.state.velocity = 0;
      this.state.angularVelocity = 0;
      this.state.status = 'idle';
      eventBus.emit('robot:navigation:complete', { id: this.id, position: this.state.position });
      return;
    }

    // Calculate desired heading
    const targetHeading = (Math.atan2(dy, dx) * 180) / Math.PI;
    const headingDiff = this.normalizeAngle(targetHeading - this.state.heading);

    // Turn towards target
    if (Math.abs(headingDiff) > 5) {
      this.state.angularVelocity = Math.sign(headingDiff) * this.maxAngularVelocity;
      this.state.velocity = this.maxVelocity * 0.3; // Slow while turning
    } else {
      this.state.angularVelocity = 0;
      this.state.velocity = this.maxVelocity;
    }
  }

  private normalizeAngle(angle: number): number {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Sensors (simulated)
  // ─────────────────────────────────────────────────────────────────────────────

  getDistanceToObstacle(): number {
    return this.world.distanceToNearestObstacle(this.state.position);
  }

  scan(): { angle: number; distance: number }[] {
    // Simulate a simple LIDAR scan
    const readings: { angle: number; distance: number }[] = [];
    const numRays = 8;
    
    for (let i = 0; i < numRays; i++) {
      const angle = (i * 360) / numRays;
      const radians = ((this.state.heading + angle) * Math.PI) / 180;
      
      // Cast ray and find distance (simplified)
      let distance = 10; // Max range
      for (let d = 0.1; d < 10; d += 0.1) {
        const testPos = {
          x: this.state.position.x + Math.cos(radians) * d,
          y: this.state.position.y + Math.sin(radians) * d,
        };
        if (!this.world.isValidPosition(testPos)) {
          distance = d;
          break;
        }
      }
      
      readings.push({ angle, distance });
    }
    
    return readings;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────────

  getState(): RobotState {
    return { ...this.state };
  }

  getPosition(): Position {
    return { ...this.state.position };
  }

  getBattery(): number {
    return this.state.battery;
  }

  recharge(): void {
    this.state.battery = 100;
    eventBus.emit('robot:recharged', { id: this.id });
  }
}
