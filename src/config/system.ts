// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - System Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface SystemConfig {
  // Core
  debug: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  
  // Event Bus
  eventBus: {
    maxHistory: number;
    maxDeadLetters: number;
    defaultTimeout: number;
  };
  
  // Workflows
  workflows: {
    maxConcurrent: number;
    defaultTimeout: number;
    retryAttempts: number;
  };
  
  // Agents
  agents: {
    defaultTickRate: number;
    maxErrors: number;
    healthCheckInterval: number;
  };
  
  // LLM
  llm: {
    defaultProvider: string;
    defaultModel: string;
    defaultTemperature: number;
    maxTokens: number;
    timeout: number;
  };
  
  // API
  api: {
    port: number;
    cors: boolean;
    rateLimit: number;
  };
  
  // Snapshots
  snapshots: {
    autoInterval: number;
    maxCount: number;
  };
}

export const defaultConfig: SystemConfig = {
  debug: process.env.NODE_ENV !== 'production',
  logLevel: 'info',
  
  eventBus: {
    maxHistory: 1000,
    maxDeadLetters: 100,
    defaultTimeout: 30000,
  },
  
  workflows: {
    maxConcurrent: 10,
    defaultTimeout: 60000,
    retryAttempts: 3,
  },
  
  agents: {
    defaultTickRate: 1000,
    maxErrors: 10,
    healthCheckInterval: 30000,
  },
  
  llm: {
    defaultProvider: 'claude',
    defaultModel: 'claude-sonnet-4-20250514',
    defaultTemperature: 0.7,
    maxTokens: 4096,
    timeout: 60000,
  },
  
  api: {
    port: parseInt(process.env.PORT || '3000'),
    cors: true,
    rateLimit: 100,
  },
  
  snapshots: {
    autoInterval: 300000,  // 5 minutes
    maxCount: 100,
  },
};

let config: SystemConfig = { ...defaultConfig };

export function getConfig(): SystemConfig {
  return config;
}

export function updateConfig(updates: Partial<SystemConfig>): void {
  config = { ...config, ...updates };
}

export function resetConfig(): void {
  config = { ...defaultConfig };
}
