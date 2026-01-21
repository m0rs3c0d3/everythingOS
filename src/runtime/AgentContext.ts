// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Agent Context
// Execution context for agents
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../core/event-bus/EventBus';
import { worldState } from '../core/state/WorldState';
import { pluginRegistry } from '../core/registry/PluginRegistry';

export interface AgentContext {
  agentId: string;
  
  // State
  getState: <T>(key: string) => T | undefined;
  setState: <T>(key: string, value: T) => void;
  getGlobal: <T>(key: string) => T | undefined;
  
  // Events
  emit: (type: string, payload: unknown) => void;
  
  // Plugins
  executeAction: (plugin: string, action: string, input: unknown) => Promise<unknown>;
  
  // Logging
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown) => void;
}

export function createAgentContext(agentId: string): AgentContext {
  return {
    agentId,
    
    getState: <T>(key: string) => worldState.getAgentState<T>(agentId, key),
    setState: <T>(key: string, value: T) => worldState.setAgentState(agentId, key, value),
    getGlobal: <T>(key: string) => worldState.getGlobal<T>(key),
    
    emit: (type, payload) => eventBus.emit(type, payload, { source: agentId }),
    
    executeAction: (plugin, action, input) => pluginRegistry.execute(plugin, action, input),
    
    log: (level, message, data) => {
      eventBus.emit('agent:log', { agentId, level, message, data, timestamp: Date.now() });
    },
  };
}
