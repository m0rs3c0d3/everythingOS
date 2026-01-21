// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Memory Module
// ═══════════════════════════════════════════════════════════════════════════════

// Types
export * from './MemoryTypes';

// Memory Layers
export { WorkingMemory, ScopedWorkingMemory, workingMemory } from './WorkingMemory';
export { EpisodicMemory, episodicMemory } from './EpisodicMemory';
export { LongTermMemory, longTermMemory } from './LongTermMemory';

// Main Service (agents use this)
export { 
  MemoryService, 
  memoryService,
  AgentMemory,
  WorkflowMemory,
  DecisionContext,
  MemoryStats,
} from './MemoryService';

// Adapters
export { InMemoryAdapter } from './adapters/InMemoryAdapter';
