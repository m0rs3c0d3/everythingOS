// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Swarm Module
// Multi-agent coordination, mesh networking, and formation control
// ═══════════════════════════════════════════════════════════════════════════════

export {
  SwarmCoordinator,
  SwarmConfig,
  SwarmAgent,
  SwarmTask,
  TaskRequirements,
  TaskStatus,
  AgentStatus,
  ConsensusProposal,
  Position3D,
} from './SwarmCoordinator';

export {
  MeshNetwork,
  MeshConfig,
  MeshPeer,
  MeshMessage,
  MessageHandler,
} from './MeshNetwork';

export {
  FormationController,
  FormationConfig,
  Formation,
  FormationType,
  FormationAgent,
  Position2D,
  Pose2D,
  Velocity2D,
} from './FormationController';
