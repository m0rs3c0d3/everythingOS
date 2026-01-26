// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Swarm Coordinator
// Distributed multi-agent coordination, task allocation, and consensus
// Handles: Agent discovery, task distribution, leader election, state sync
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../../core/event-bus/EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SwarmAgent {
  id: string;
  name: string;
  type: string;                    // e.g., 'ground_robot', 'drone', 'manipulator'
  capabilities: string[];          // e.g., ['navigate', 'pick', 'scan']
  status: AgentStatus;
  position?: Position3D;
  battery?: number;                // 0-100
  currentTask?: string;
  lastSeen: number;
  metadata?: Record<string, unknown>;
}

export type AgentStatus = 'online' | 'busy' | 'idle' | 'offline' | 'error' | 'charging';

export interface Position3D {
  x: number;
  y: number;
  z: number;
  frame?: string;                  // Reference frame
}

export interface SwarmTask {
  id: string;
  type: string;
  priority: number;                // Higher = more urgent
  requirements: TaskRequirements;
  payload: unknown;
  status: TaskStatus;
  assignedTo?: string;             // Agent ID
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  deadline?: number;
  retries: number;
  maxRetries: number;
}

export interface TaskRequirements {
  capabilities?: string[];         // Required capabilities
  agentTypes?: string[];           // Allowed agent types
  minBattery?: number;             // Minimum battery level
  nearPosition?: Position3D;       // Prefer agents near this position
  maxDistance?: number;            // Max distance from nearPosition
  exclusive?: boolean;             // Only one agent can work on this
}

export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface ConsensusProposal {
  id: string;
  type: string;
  proposer: string;
  value: unknown;
  votes: Map<string, boolean>;
  requiredVotes: number;
  deadline: number;
  status: 'voting' | 'accepted' | 'rejected' | 'expired';
}

export interface SwarmConfig {
  agentId: string;                 // This agent's ID
  heartbeatInterval?: number;      // ms
  agentTimeout?: number;           // ms before agent considered offline
  taskTimeout?: number;            // ms before task reassigned
  consensusTimeout?: number;       // ms for consensus voting
  leaderElectionEnabled?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Swarm Coordinator Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class SwarmCoordinator {
  private config: SwarmConfig;
  private agents: Map<string, SwarmAgent> = new Map();
  private tasks: Map<string, SwarmTask> = new Map();
  private proposals: Map<string, ConsensusProposal> = new Map();
  
  // Leadership
  private leaderId?: string;
  private isLeader = false;
  private leaderElectionInProgress = false;
  
  // Timers
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private maintenanceTimer?: ReturnType<typeof setInterval>;
  
  // Callbacks
  private onTaskReceived?: (task: SwarmTask) => Promise<boolean>;
  private taskCounter = 0;
  private proposalCounter = 0;

  constructor(config: SwarmConfig) {
    this.config = {
      heartbeatInterval: 1000,
      agentTimeout: 5000,
      taskTimeout: 30000,
      consensusTimeout: 10000,
      leaderElectionEnabled: true,
      ...config,
    };

    // Register self
    this.registerSelf();
    this.setupEventListeners();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  start(): void {
    // Start heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);

    // Start maintenance (cleanup, reassignment)
    this.maintenanceTimer = setInterval(() => {
      this.performMaintenance();
    }, this.config.heartbeatInterval! * 2);

    this.log('info', `Swarm coordinator started (agent: ${this.config.agentId})`);
    eventBus.emit('swarm:started', { agentId: this.config.agentId });
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = undefined;
    }

    // Announce departure
    eventBus.emit('swarm:agent:leaving', { agentId: this.config.agentId });
    this.log('info', 'Swarm coordinator stopped');
  }

  private registerSelf(): void {
    const self: SwarmAgent = {
      id: this.config.agentId,
      name: this.config.agentId,
      type: 'unknown',
      capabilities: [],
      status: 'idle',
      lastSeen: Date.now(),
    };
    this.agents.set(this.config.agentId, self);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Agent Management
  // ─────────────────────────────────────────────────────────────────────────

  updateSelf(updates: Partial<Omit<SwarmAgent, 'id' | 'lastSeen'>>): void {
    const self = this.agents.get(this.config.agentId);
    if (self) {
      Object.assign(self, updates, { lastSeen: Date.now() });
    }
  }

  getAgent(agentId: string): SwarmAgent | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): SwarmAgent[] {
    return Array.from(this.agents.values());
  }

  getOnlineAgents(): SwarmAgent[] {
    return this.getAllAgents().filter(a => a.status !== 'offline');
  }

  getIdleAgents(): SwarmAgent[] {
    return this.getAllAgents().filter(a => a.status === 'idle');
  }

  getAgentsByCapability(capability: string): SwarmAgent[] {
    return this.getAllAgents().filter(a => 
      a.capabilities.includes(capability) && a.status !== 'offline'
    );
  }

  private handleAgentHeartbeat(agentId: string, data: Partial<SwarmAgent>): void {
    const existing = this.agents.get(agentId);
    
    if (existing) {
      Object.assign(existing, data, { lastSeen: Date.now() });
    } else {
      // New agent discovered
      const newAgent: SwarmAgent = {
        id: agentId,
        name: data.name ?? agentId,
        type: data.type ?? 'unknown',
        capabilities: data.capabilities ?? [],
        status: data.status ?? 'idle',
        lastSeen: Date.now(),
        ...data,
      };
      this.agents.set(agentId, newAgent);
      
      this.log('info', `New agent discovered: ${agentId}`);
      eventBus.emit('swarm:agent:joined', { agent: newAgent });
    }
  }

  private sendHeartbeat(): void {
    const self = this.agents.get(this.config.agentId);
    if (!self) return;

    self.lastSeen = Date.now();
    
    eventBus.emit('swarm:heartbeat', {
      agentId: this.config.agentId,
      ...self,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Task Management
  // ─────────────────────────────────────────────────────────────────────────

  createTask(
    type: string,
    payload: unknown,
    requirements?: Partial<TaskRequirements>,
    options?: { priority?: number; deadline?: number; maxRetries?: number }
  ): SwarmTask {
    const task: SwarmTask = {
      id: `task_${this.config.agentId}_${++this.taskCounter}`,
      type,
      priority: options?.priority ?? 5,
      requirements: {
        exclusive: true,
        ...requirements,
      },
      payload,
      status: 'pending',
      createdAt: Date.now(),
      deadline: options?.deadline,
      retries: 0,
      maxRetries: options?.maxRetries ?? 3,
    };

    this.tasks.set(task.id, task);
    eventBus.emit('swarm:task:created', { task });
    
    // Attempt assignment
    this.assignTask(task);
    
    return task;
  }

  private assignTask(task: SwarmTask): boolean {
    if (task.status !== 'pending') return false;

    const candidates = this.findCandidates(task);
    if (candidates.length === 0) {
      this.log('debug', `No candidates for task ${task.id}`);
      return false;
    }

    // Score and sort candidates
    const scored = candidates.map(agent => ({
      agent,
      score: this.scoreCandidate(agent, task),
    })).sort((a, b) => b.score - a.score);

    const bestCandidate = scored[0].agent;
    
    // Assign
    task.assignedTo = bestCandidate.id;
    task.status = 'assigned';
    
    // Update agent status
    bestCandidate.status = 'busy';
    bestCandidate.currentTask = task.id;

    this.log('info', `Task ${task.id} assigned to ${bestCandidate.id}`);
    eventBus.emit('swarm:task:assigned', { task, agentId: bestCandidate.id });

    // Notify the agent
    eventBus.emit('swarm:task:dispatch', {
      targetAgent: bestCandidate.id,
      task,
    });

    return true;
  }

  private findCandidates(task: SwarmTask): SwarmAgent[] {
    const req = task.requirements;
    
    return this.getOnlineAgents().filter(agent => {
      // Skip busy agents if task is exclusive
      if (req.exclusive && agent.status === 'busy') return false;
      
      // Check capabilities
      if (req.capabilities?.length) {
        if (!req.capabilities.every(c => agent.capabilities.includes(c))) return false;
      }

      // Check agent type
      if (req.agentTypes?.length) {
        if (!req.agentTypes.includes(agent.type)) return false;
      }

      // Check battery
      if (req.minBattery !== undefined && agent.battery !== undefined) {
        if (agent.battery < req.minBattery) return false;
      }

      // Check distance
      if (req.nearPosition && req.maxDistance !== undefined && agent.position) {
        const dist = this.distance(agent.position, req.nearPosition);
        if (dist > req.maxDistance) return false;
      }

      return true;
    });
  }

  private scoreCandidate(agent: SwarmAgent, task: SwarmTask): number {
    let score = 100;
    const req = task.requirements;

    // Prefer idle agents
    if (agent.status === 'idle') score += 50;

    // Prefer agents with higher battery
    if (agent.battery !== undefined) {
      score += agent.battery * 0.5;
    }

    // Prefer closer agents
    if (req.nearPosition && agent.position) {
      const dist = this.distance(agent.position, req.nearPosition);
      score -= dist * 0.1;
    }

    return score;
  }

  completeTask(taskId: string, success: boolean, result?: unknown): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (success) {
      task.status = 'completed';
      task.completedAt = Date.now();
      this.log('info', `Task ${taskId} completed`);
      eventBus.emit('swarm:task:completed', { task, result });
    } else {
      task.retries++;
      if (task.retries >= task.maxRetries) {
        task.status = 'failed';
        this.log('warn', `Task ${taskId} failed after ${task.retries} retries`);
        eventBus.emit('swarm:task:failed', { task });
      } else {
        task.status = 'pending';
        task.assignedTo = undefined;
        this.log('info', `Task ${taskId} retrying (${task.retries}/${task.maxRetries})`);
        this.assignTask(task);
      }
    }

    // Free up agent
    if (task.assignedTo) {
      const agent = this.agents.get(task.assignedTo);
      if (agent && agent.currentTask === taskId) {
        agent.status = 'idle';
        agent.currentTask = undefined;
      }
    }
  }

  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'cancelled';
    
    if (task.assignedTo) {
      const agent = this.agents.get(task.assignedTo);
      if (agent) {
        agent.status = 'idle';
        agent.currentTask = undefined;
      }
      eventBus.emit('swarm:task:cancel', { targetAgent: task.assignedTo, taskId });
    }

    eventBus.emit('swarm:task:cancelled', { task });
  }

  onTask(handler: (task: SwarmTask) => Promise<boolean>): void {
    this.onTaskReceived = handler;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Consensus
  // ─────────────────────────────────────────────────────────────────────────

  propose(type: string, value: unknown): ConsensusProposal {
    const onlineCount = this.getOnlineAgents().length;
    const requiredVotes = Math.floor(onlineCount / 2) + 1; // Majority

    const proposal: ConsensusProposal = {
      id: `proposal_${this.config.agentId}_${++this.proposalCounter}`,
      type,
      proposer: this.config.agentId,
      value,
      votes: new Map(),
      requiredVotes,
      deadline: Date.now() + this.config.consensusTimeout!,
      status: 'voting',
    };

    // Vote for own proposal
    proposal.votes.set(this.config.agentId, true);

    this.proposals.set(proposal.id, proposal);
    
    eventBus.emit('swarm:consensus:propose', { proposal });
    this.log('info', `Proposal created: ${proposal.id} (need ${requiredVotes} votes)`);

    // Set timeout
    setTimeout(() => this.finalizeProposal(proposal.id), this.config.consensusTimeout);

    return proposal;
  }

  vote(proposalId: string, accept: boolean): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'voting') return;

    proposal.votes.set(this.config.agentId, accept);
    
    eventBus.emit('swarm:consensus:vote', {
      proposalId,
      agentId: this.config.agentId,
      accept,
    });

    this.checkProposalStatus(proposal);
  }

  private handleVote(proposalId: string, agentId: string, accept: boolean): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'voting') return;

    proposal.votes.set(agentId, accept);
    this.checkProposalStatus(proposal);
  }

  private checkProposalStatus(proposal: ConsensusProposal): void {
    if (proposal.status !== 'voting') return;

    const accepts = Array.from(proposal.votes.values()).filter(v => v).length;
    const rejects = proposal.votes.size - accepts;
    const onlineCount = this.getOnlineAgents().length;

    if (accepts >= proposal.requiredVotes) {
      proposal.status = 'accepted';
      this.log('info', `Proposal ${proposal.id} ACCEPTED`);
      eventBus.emit('swarm:consensus:accepted', { proposal });
    } else if (rejects > onlineCount - proposal.requiredVotes) {
      proposal.status = 'rejected';
      this.log('info', `Proposal ${proposal.id} REJECTED`);
      eventBus.emit('swarm:consensus:rejected', { proposal });
    }
  }

  private finalizeProposal(proposalId: string): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'voting') return;

    proposal.status = 'expired';
    this.log('warn', `Proposal ${proposal.id} expired`);
    eventBus.emit('swarm:consensus:expired', { proposal });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Leader Election (Bully Algorithm simplified)
  // ─────────────────────────────────────────────────────────────────────────

  initiateLeaderElection(): void {
    if (!this.config.leaderElectionEnabled || this.leaderElectionInProgress) return;

    this.leaderElectionInProgress = true;
    this.log('info', 'Initiating leader election');

    // Find agents with higher IDs
    const higherAgents = this.getOnlineAgents().filter(a => a.id > this.config.agentId);

    if (higherAgents.length === 0) {
      // We are the leader
      this.becomeLeader();
    } else {
      // Ask higher agents
      eventBus.emit('swarm:election:challenge', {
        challengerId: this.config.agentId,
        targetAgents: higherAgents.map(a => a.id),
      });

      // Timeout - if no response, become leader
      setTimeout(() => {
        if (this.leaderElectionInProgress && !this.leaderId) {
          this.becomeLeader();
        }
      }, 3000);
    }
  }

  private becomeLeader(): void {
    this.leaderId = this.config.agentId;
    this.isLeader = true;
    this.leaderElectionInProgress = false;

    this.log('info', `I am now the leader: ${this.config.agentId}`);
    eventBus.emit('swarm:leader:elected', { leaderId: this.config.agentId });
  }

  private handleElectionChallenge(challengerId: string): void {
    if (this.config.agentId > challengerId) {
      // Respond to challenger - we're higher
      eventBus.emit('swarm:election:response', {
        responderId: this.config.agentId,
        challengerId,
      });
      // Start our own election
      this.initiateLeaderElection();
    }
  }

  getLeaderId(): string | undefined {
    return this.leaderId;
  }

  amILeader(): boolean {
    return this.isLeader;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Maintenance
  // ─────────────────────────────────────────────────────────────────────────

  private performMaintenance(): void {
    const now = Date.now();

    // Check for offline agents
    for (const agent of this.agents.values()) {
      if (agent.id === this.config.agentId) continue;

      if (now - agent.lastSeen > this.config.agentTimeout!) {
        if (agent.status !== 'offline') {
          agent.status = 'offline';
          this.log('warn', `Agent ${agent.id} went offline`);
          eventBus.emit('swarm:agent:offline', { agentId: agent.id });

          // Reassign their tasks
          this.reassignAgentTasks(agent.id);

          // Leader election if leader went offline
          if (agent.id === this.leaderId) {
            this.leaderId = undefined;
            this.initiateLeaderElection();
          }
        }
      }
    }

    // Check for timed out tasks
    for (const task of this.tasks.values()) {
      if (task.status === 'assigned' || task.status === 'in_progress') {
        if (task.startedAt && now - task.startedAt > this.config.taskTimeout!) {
          this.log('warn', `Task ${task.id} timed out`);
          this.completeTask(task.id, false);
        }
      }
    }

    // Retry pending tasks
    for (const task of this.tasks.values()) {
      if (task.status === 'pending') {
        this.assignTask(task);
      }
    }
  }

  private reassignAgentTasks(agentId: string): void {
    for (const task of this.tasks.values()) {
      if (task.assignedTo === agentId && task.status !== 'completed') {
        task.status = 'pending';
        task.assignedTo = undefined;
        this.assignTask(task);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Listeners
  // ─────────────────────────────────────────────────────────────────────────

  private setupEventListeners(): void {
    // Heartbeats from other agents
    eventBus.on('swarm:heartbeat', (event) => {
      const data = event.payload as SwarmAgent & { agentId: string };
      if (data.agentId !== this.config.agentId) {
        this.handleAgentHeartbeat(data.agentId, data);
      }
    });

    // Task dispatch (for us)
    eventBus.on('swarm:task:dispatch', (event) => {
      const { targetAgent, task } = event.payload as { targetAgent: string; task: SwarmTask };
      if (targetAgent === this.config.agentId && this.onTaskReceived) {
        this.handleIncomingTask(task);
      }
    });

    // Consensus votes
    eventBus.on('swarm:consensus:vote', (event) => {
      const { proposalId, agentId, accept } = event.payload as { proposalId: string; agentId: string; accept: boolean };
      if (agentId !== this.config.agentId) {
        this.handleVote(proposalId, agentId, accept);
      }
    });

    // Election challenges
    eventBus.on('swarm:election:challenge', (event) => {
      const { challengerId } = event.payload as { challengerId: string };
      this.handleElectionChallenge(challengerId);
    });

    // Election responses
    eventBus.on('swarm:election:response', (event) => {
      const { responderId } = event.payload as { responderId: string };
      if (this.leaderElectionInProgress) {
        // Someone higher responded, they'll become leader
        this.leaderElectionInProgress = false;
      }
    });

    // Leader elected
    eventBus.on('swarm:leader:elected', (event) => {
      const { leaderId } = event.payload as { leaderId: string };
      this.leaderId = leaderId;
      this.isLeader = leaderId === this.config.agentId;
      this.leaderElectionInProgress = false;
    });
  }

  private async handleIncomingTask(task: SwarmTask): Promise<void> {
    if (!this.onTaskReceived) return;

    task.status = 'in_progress';
    task.startedAt = Date.now();

    const self = this.agents.get(this.config.agentId);
    if (self) {
      self.status = 'busy';
      self.currentTask = task.id;
    }

    try {
      const success = await this.onTaskReceived(task);
      this.completeTask(task.id, success);
    } catch (error) {
      this.log('error', `Task ${task.id} error: ${error}`);
      this.completeTask(task.id, false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────

  private distance(a: Position3D, b: Position3D): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    eventBus.emit('swarm:log', { level, message, agentId: this.config.agentId, timestamp: Date.now() });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Status
  // ─────────────────────────────────────────────────────────────────────────

  getStatus(): {
    agentId: string;
    isLeader: boolean;
    leaderId?: string;
    agentCount: number;
    onlineCount: number;
    pendingTasks: number;
    activeTasks: number;
  } {
    return {
      agentId: this.config.agentId,
      isLeader: this.isLeader,
      leaderId: this.leaderId,
      agentCount: this.agents.size,
      onlineCount: this.getOnlineAgents().length,
      pendingTasks: Array.from(this.tasks.values()).filter(t => t.status === 'pending').length,
      activeTasks: Array.from(this.tasks.values()).filter(t => t.status === 'in_progress').length,
    };
  }
}
