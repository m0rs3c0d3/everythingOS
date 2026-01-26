// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Formation Controller
// Multi-robot spatial coordination and formation control
// Handles: Formation patterns, leader-follower, collision avoidance, path planning
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../../core/event-bus/EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Position2D {
  x: number;
  y: number;
}

export interface Pose2D extends Position2D {
  theta: number;               // Heading in radians
}

export interface Velocity2D {
  linear: number;              // m/s
  angular: number;             // rad/s
}

export interface FormationAgent {
  id: string;
  pose: Pose2D;
  velocity: Velocity2D;
  targetPose?: Pose2D;
  role: 'leader' | 'follower';
  formationOffset: Position2D; // Offset from formation center/leader
  active: boolean;
}

export interface Formation {
  id: string;
  name: string;
  type: FormationType;
  positions: Position2D[];     // Relative positions for each slot
  spacing: number;             // Base spacing between agents
  orientation: number;         // Formation heading (radians)
}

export type FormationType = 
  | 'line'
  | 'column'
  | 'wedge'
  | 'diamond'
  | 'circle'
  | 'grid'
  | 'custom';

export interface FormationConfig {
  controlRate?: number;        // Hz
  maxLinearVelocity?: number;  // m/s
  maxAngularVelocity?: number; // rad/s
  positionTolerance?: number;  // meters
  headingTolerance?: number;   // radians
  safetyRadius?: number;       // meters, collision avoidance
  lookaheadDistance?: number;  // meters, for path following
}

type ControllerState = 'idle' | 'forming' | 'holding' | 'moving' | 'dissolving';

// ─────────────────────────────────────────────────────────────────────────────
// Formation Controller Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class FormationController {
  private config: FormationConfig;
  private agents: Map<string, FormationAgent> = new Map();
  private currentFormation?: Formation;
  private formationCenter: Pose2D = { x: 0, y: 0, theta: 0 };
  private state: ControllerState = 'idle';
  
  // Path following
  private path: Pose2D[] = [];
  private pathIndex = 0;
  
  // Control loop
  private controlTimer?: ReturnType<typeof setInterval>;
  private leaderId?: string;

  constructor(config?: FormationConfig) {
    this.config = {
      controlRate: 10,           // 10 Hz
      maxLinearVelocity: 1.0,    // 1 m/s
      maxAngularVelocity: 1.5,   // ~86 deg/s
      positionTolerance: 0.1,    // 10 cm
      headingTolerance: 0.1,     // ~5.7 deg
      safetyRadius: 0.5,         // 50 cm
      lookaheadDistance: 1.0,    // 1 m
      ...config,
    };

    this.setupEventListeners();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  start(): void {
    if (this.controlTimer) return;

    const interval = 1000 / this.config.controlRate!;
    this.controlTimer = setInterval(() => this.controlLoop(), interval);

    this.log('info', 'Formation controller started');
    eventBus.emit('formation:started', {});
  }

  stop(): void {
    if (this.controlTimer) {
      clearInterval(this.controlTimer);
      this.controlTimer = undefined;
    }
    this.state = 'idle';
    this.log('info', 'Formation controller stopped');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Agent Management
  // ─────────────────────────────────────────────────────────────────────────

  addAgent(id: string, pose: Pose2D, role: 'leader' | 'follower' = 'follower'): void {
    const agent: FormationAgent = {
      id,
      pose,
      velocity: { linear: 0, angular: 0 },
      role,
      formationOffset: { x: 0, y: 0 },
      active: true,
    };
    this.agents.set(id, agent);

    if (role === 'leader') {
      this.leaderId = id;
    }

    this.log('info', `Agent added: ${id} (${role})`);
    eventBus.emit('formation:agent:added', { agent });

    // Reassign formation slots
    if (this.currentFormation) {
      this.assignFormationSlots();
    }
  }

  removeAgent(id: string): void {
    this.agents.delete(id);
    
    if (this.leaderId === id) {
      this.electNewLeader();
    }

    if (this.currentFormation) {
      this.assignFormationSlots();
    }

    eventBus.emit('formation:agent:removed', { agentId: id });
  }

  updateAgentPose(id: string, pose: Pose2D): void {
    const agent = this.agents.get(id);
    if (agent) {
      agent.pose = pose;
    }
  }

  getAgent(id: string): FormationAgent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): FormationAgent[] {
    return Array.from(this.agents.values());
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Formation Management
  // ─────────────────────────────────────────────────────────────────────────

  setFormation(formation: Formation): void {
    this.currentFormation = formation;
    this.state = 'forming';
    this.assignFormationSlots();

    this.log('info', `Formation set: ${formation.name}`);
    eventBus.emit('formation:set', { formation });
  }

  private assignFormationSlots(): void {
    if (!this.currentFormation) return;

    const activeAgents = this.getAllAgents().filter(a => a.active);
    const positions = this.currentFormation.positions;

    // Simple assignment: closest agent to each slot
    const assigned = new Set<string>();
    
    for (let i = 0; i < Math.min(activeAgents.length, positions.length); i++) {
      let bestAgent: FormationAgent | null = null;
      let bestDistance = Infinity;

      const targetWorld = this.formationToWorld(positions[i]);

      for (const agent of activeAgents) {
        if (assigned.has(agent.id)) continue;

        const dist = this.distance(agent.pose, targetWorld);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestAgent = agent;
        }
      }

      if (bestAgent) {
        bestAgent.formationOffset = positions[i];
        assigned.add(bestAgent.id);
      }
    }
  }

  dissolveFormation(): void {
    this.state = 'dissolving';
    this.currentFormation = undefined;
    
    for (const agent of this.agents.values()) {
      agent.targetPose = undefined;
      agent.formationOffset = { x: 0, y: 0 };
    }

    this.state = 'idle';
    this.log('info', 'Formation dissolved');
    eventBus.emit('formation:dissolved', {});
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Predefined Formations
  // ─────────────────────────────────────────────────────────────────────────

  static createLineFormation(count: number, spacing: number): Formation {
    const positions: Position2D[] = [];
    for (let i = 0; i < count; i++) {
      positions.push({ x: 0, y: i * spacing - (count - 1) * spacing / 2 });
    }
    return { id: 'line', name: 'Line', type: 'line', positions, spacing, orientation: 0 };
  }

  static createColumnFormation(count: number, spacing: number): Formation {
    const positions: Position2D[] = [];
    for (let i = 0; i < count; i++) {
      positions.push({ x: -i * spacing, y: 0 });
    }
    return { id: 'column', name: 'Column', type: 'column', positions, spacing, orientation: 0 };
  }

  static createWedgeFormation(count: number, spacing: number): Formation {
    const positions: Position2D[] = [{ x: 0, y: 0 }]; // Leader at front
    let row = 1;
    let placed = 1;
    
    while (placed < count) {
      const y = row * spacing * 0.7;
      for (let i = 0; i <= row && placed < count; i++) {
        const x = -row * spacing + i * spacing * 2;
        positions.push({ x: -y, y: x - row * spacing / 2 });
        placed++;
      }
      row++;
    }
    
    return { id: 'wedge', name: 'Wedge', type: 'wedge', positions, spacing, orientation: 0 };
  }

  static createCircleFormation(count: number, radius: number): Formation {
    const positions: Position2D[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count;
      positions.push({
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      });
    }
    return { id: 'circle', name: 'Circle', type: 'circle', positions, spacing: radius, orientation: 0 };
  }

  static createGridFormation(rows: number, cols: number, spacing: number): Formation {
    const positions: Position2D[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        positions.push({
          x: -r * spacing,
          y: c * spacing - (cols - 1) * spacing / 2,
        });
      }
    }
    return { id: 'grid', name: 'Grid', type: 'grid', positions, spacing, orientation: 0 };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Movement
  // ─────────────────────────────────────────────────────────────────────────

  moveFormation(target: Pose2D): void {
    this.formationCenter = target;
    this.state = 'moving';
    this.updateTargetPoses();

    this.log('info', `Moving formation to (${target.x.toFixed(2)}, ${target.y.toFixed(2)})`);
    eventBus.emit('formation:moving', { target });
  }

  followPath(path: Pose2D[]): void {
    this.path = path;
    this.pathIndex = 0;
    this.state = 'moving';

    this.log('info', `Following path with ${path.length} waypoints`);
    eventBus.emit('formation:path:started', { waypointCount: path.length });
  }

  private updateTargetPoses(): void {
    if (!this.currentFormation) return;

    for (const agent of this.agents.values()) {
      agent.targetPose = this.formationToWorld(agent.formationOffset);
    }
  }

  private formationToWorld(offset: Position2D): Pose2D {
    const cos = Math.cos(this.formationCenter.theta);
    const sin = Math.sin(this.formationCenter.theta);

    return {
      x: this.formationCenter.x + offset.x * cos - offset.y * sin,
      y: this.formationCenter.y + offset.x * sin + offset.y * cos,
      theta: this.formationCenter.theta,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Control Loop
  // ─────────────────────────────────────────────────────────────────────────

  private controlLoop(): void {
    if (this.state === 'idle' || this.state === 'dissolving') return;

    // Path following: update formation center
    if (this.state === 'moving' && this.path.length > 0) {
      this.updatePathFollowing();
    }

    // Update target poses based on formation center
    this.updateTargetPoses();

    // Calculate velocities for each agent
    for (const agent of this.agents.values()) {
      if (!agent.active || !agent.targetPose) continue;

      const velocity = this.calculateVelocity(agent);
      
      // Apply collision avoidance
      const safeVelocity = this.applyCollisionAvoidance(agent, velocity);
      
      agent.velocity = safeVelocity;

      // Emit command
      eventBus.emit('formation:velocity_command', {
        agentId: agent.id,
        velocity: safeVelocity,
      });
    }

    // Check if formation is achieved
    if (this.state === 'forming' || this.state === 'moving') {
      if (this.isFormationAchieved()) {
        if (this.state === 'forming') {
          this.state = 'holding';
          this.log('info', 'Formation achieved');
          eventBus.emit('formation:achieved', {});
        } else if (this.path.length === 0 || this.pathIndex >= this.path.length) {
          this.state = 'holding';
          eventBus.emit('formation:path:completed', {});
        }
      }
    }
  }

  private calculateVelocity(agent: FormationAgent): Velocity2D {
    if (!agent.targetPose) return { linear: 0, angular: 0 };

    const dx = agent.targetPose.x - agent.pose.x;
    const dy = agent.targetPose.y - agent.pose.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Angle to target
    const angleToTarget = Math.atan2(dy, dx);
    let headingError = angleToTarget - agent.pose.theta;
    
    // Normalize to [-pi, pi]
    while (headingError > Math.PI) headingError -= 2 * Math.PI;
    while (headingError < -Math.PI) headingError += 2 * Math.PI;

    // Target heading error
    let targetHeadingError = agent.targetPose.theta - agent.pose.theta;
    while (targetHeadingError > Math.PI) targetHeadingError -= 2 * Math.PI;
    while (targetHeadingError < -Math.PI) targetHeadingError += 2 * Math.PI;

    // Calculate velocities
    let linear = 0;
    let angular = 0;

    if (distance > this.config.positionTolerance!) {
      // Move toward target
      if (Math.abs(headingError) > 0.5) {
        // Turn first if significantly off
        angular = Math.sign(headingError) * Math.min(
          Math.abs(headingError) * 2,
          this.config.maxAngularVelocity!
        );
      } else {
        // Move forward with heading correction
        linear = Math.min(distance, this.config.maxLinearVelocity!);
        angular = headingError * 2;
      }
    } else if (Math.abs(targetHeadingError) > this.config.headingTolerance!) {
      // Adjust heading
      angular = Math.sign(targetHeadingError) * Math.min(
        Math.abs(targetHeadingError) * 2,
        this.config.maxAngularVelocity!
      );
    }

    return { linear, angular };
  }

  private applyCollisionAvoidance(agent: FormationAgent, velocity: Velocity2D): Velocity2D {
    let adjustedVelocity = { ...velocity };

    for (const other of this.agents.values()) {
      if (other.id === agent.id || !other.active) continue;

      const dx = other.pose.x - agent.pose.x;
      const dy = other.pose.y - agent.pose.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < this.config.safetyRadius! * 2) {
        // Too close - reduce speed and turn away
        const avoidAngle = Math.atan2(-dy, -dx);
        let headingToOther = Math.atan2(dy, dx) - agent.pose.theta;
        
        while (headingToOther > Math.PI) headingToOther -= 2 * Math.PI;
        while (headingToOther < -Math.PI) headingToOther += 2 * Math.PI;

        // If heading toward the other agent, slow down
        if (Math.abs(headingToOther) < Math.PI / 2) {
          const slowFactor = distance / (this.config.safetyRadius! * 2);
          adjustedVelocity.linear *= slowFactor;

          // Add avoidance turn
          adjustedVelocity.angular += Math.sign(headingToOther) * 
            (1 - slowFactor) * this.config.maxAngularVelocity!;
        }
      }
    }

    // Clamp velocities
    adjustedVelocity.linear = Math.max(0, Math.min(
      adjustedVelocity.linear,
      this.config.maxLinearVelocity!
    ));
    adjustedVelocity.angular = Math.max(
      -this.config.maxAngularVelocity!,
      Math.min(adjustedVelocity.angular, this.config.maxAngularVelocity!)
    );

    return adjustedVelocity;
  }

  private updatePathFollowing(): void {
    if (this.pathIndex >= this.path.length) return;

    const target = this.path[this.pathIndex];
    const distance = this.distance(this.formationCenter, target);

    if (distance < this.config.lookaheadDistance!) {
      this.pathIndex++;
      if (this.pathIndex < this.path.length) {
        this.formationCenter = this.path[this.pathIndex];
        eventBus.emit('formation:path:waypoint', { 
          index: this.pathIndex, 
          total: this.path.length 
        });
      }
    } else {
      // Move center toward current waypoint
      const dx = target.x - this.formationCenter.x;
      const dy = target.y - this.formationCenter.y;
      const angle = Math.atan2(dy, dx);
      
      const step = this.config.maxLinearVelocity! / this.config.controlRate!;
      this.formationCenter.x += step * Math.cos(angle);
      this.formationCenter.y += step * Math.sin(angle);
      this.formationCenter.theta = target.theta;
    }
  }

  private isFormationAchieved(): boolean {
    for (const agent of this.agents.values()) {
      if (!agent.active || !agent.targetPose) continue;

      const posError = this.distance(agent.pose, agent.targetPose);
      if (posError > this.config.positionTolerance!) return false;

      let headingError = Math.abs(agent.targetPose.theta - agent.pose.theta);
      while (headingError > Math.PI) headingError -= 2 * Math.PI;
      if (Math.abs(headingError) > this.config.headingTolerance!) return false;
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Leader Management
  // ─────────────────────────────────────────────────────────────────────────

  private electNewLeader(): void {
    // Simple: first active agent becomes leader
    for (const agent of this.agents.values()) {
      if (agent.active) {
        agent.role = 'leader';
        this.leaderId = agent.id;
        this.log('info', `New leader elected: ${agent.id}`);
        eventBus.emit('formation:leader:changed', { leaderId: agent.id });
        return;
      }
    }
    this.leaderId = undefined;
  }

  setLeader(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    // Demote current leader
    if (this.leaderId) {
      const oldLeader = this.agents.get(this.leaderId);
      if (oldLeader) oldLeader.role = 'follower';
    }

    agent.role = 'leader';
    this.leaderId = agentId;
    
    eventBus.emit('formation:leader:changed', { leaderId: agentId });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Listeners
  // ─────────────────────────────────────────────────────────────────────────

  private setupEventListeners(): void {
    // Listen for pose updates from agents
    eventBus.on('robot:pose', (event) => {
      const { agentId, pose } = event.payload as { agentId: string; pose: Pose2D };
      this.updateAgentPose(agentId, pose);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────

  private distance(a: Position2D, b: Position2D): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    eventBus.emit('formation:log', { level, message, timestamp: Date.now() });
  }

  getState(): ControllerState {
    return this.state;
  }

  getFormationCenter(): Pose2D {
    return { ...this.formationCenter };
  }

  getStatus(): {
    state: ControllerState;
    agentCount: number;
    formation?: string;
    pathProgress?: number;
  } {
    return {
      state: this.state,
      agentCount: this.agents.size,
      formation: this.currentFormation?.name,
      pathProgress: this.path.length > 0 ? this.pathIndex / this.path.length : undefined,
    };
  }
}
