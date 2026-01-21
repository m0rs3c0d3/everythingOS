import { WorldSnapshot, AgentState, AgentStatus } from './types';
export declare class WorldStateManager {
    private state;
    private maxSnapshots;
    private snapshotInterval;
    private lastSnapshotTime;
    constructor();
    getTick(): number;
    tick(): number;
    registerAgent(agentId: string): void;
    unregisterAgent(agentId: string): boolean;
    getAgentState(agentId: string): AgentState | undefined;
    setAgentStatus(agentId: string, status: AgentStatus): void;
    updateAgentMetrics(agentId: string, metrics: Partial<AgentState['metrics']>): void;
    recordAgentError(agentId: string, error: Error, recoverable?: boolean): void;
    setAgentMemory(agentId: string, key: string, value: unknown): void;
    getAgentMemory<T = unknown>(agentId: string, key: string): T | undefined;
    setGlobal(key: string, value: unknown): void;
    getGlobal<T = unknown>(key: string): T | undefined;
    getGlobals(): Record<string, unknown>;
    createSnapshot(label?: string): WorldSnapshot;
    restoreSnapshot(tick: number): boolean;
    getSnapshots(): WorldSnapshot[];
    private computeChecksum;
    getSummary(): {
        tick: number;
        timestamp: number;
        agentCount: number;
        agentsByStatus: Record<AgentStatus, number>;
        snapshotCount: number;
        globalCount: number;
    };
    getAgentIds(): string[];
    hasAgent(agentId: string): boolean;
}
export declare const worldState: WorldStateManager;
//# sourceMappingURL=WorldStateManager.d.ts.map