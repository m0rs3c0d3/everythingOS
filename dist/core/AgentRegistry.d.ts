import { AgentConfig, AgentTier, AgentStatus } from './types';
import { BaseAgent } from '../agents/BaseAgent';
export declare class AgentRegistry {
    private agents;
    private tierIndex;
    private dependencyGraph;
    constructor();
    register(agent: BaseAgent): void;
    unregister(agentId: string): boolean;
    get(agentId: string): BaseAgent | undefined;
    getConfig(agentId: string): AgentConfig | undefined;
    getAll(): BaseAgent[];
    getByTier(tier: AgentTier): BaseAgent[];
    getDependents(agentId: string): string[];
    getDependencies(agentId: string): string[];
    startAll(): Promise<void>;
    stopAll(): Promise<void>;
    private getStartOrder;
    find(criteria: {
        tier?: AgentTier;
        status?: AgentStatus;
        name?: string | RegExp;
    }): BaseAgent[];
    getStats(): {
        total: number;
        byTier: Record<AgentTier, number>;
        byStatus: Record<AgentStatus, number>;
    };
    has(agentId: string): boolean;
    get count(): number;
}
export declare const registry: AgentRegistry;
//# sourceMappingURL=AgentRegistry.d.ts.map