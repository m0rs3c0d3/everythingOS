export { EventBus, eventBus } from './core/EventBus';
export { WorldStateManager, worldState } from './core/WorldStateManager';
export { AgentRegistry, registry } from './core/AgentRegistry';
export { MetricsCollector, metrics } from './core/MetricsCollector';
export * from './core/types';
export * from './agents';
import { AgentName } from './agents';
import { BaseAgent } from './agents/BaseAgent';
export interface EverythingOSConfig {
    autoStart?: boolean;
    tickRate?: number;
    agents?: AgentName[];
    presets?: ('trading' | 'healthcare' | 'full')[];
}
export declare class EverythingOS {
    private running;
    private tickInterval;
    private config;
    constructor(config?: EverythingOSConfig);
    initialize(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    loadAgent(name: AgentName): Promise<BaseAgent | null>;
    loadPreset(preset: string): Promise<void>;
    getAgent<T extends BaseAgent>(id: string): T | undefined;
    on(event: string, handler: (data: unknown) => void): () => void;
    emit(event: string, data: unknown): void;
    getState(): Record<string, unknown>;
    getMetrics(): Record<string, unknown>;
    isRunning(): boolean;
    getVersion(): string;
}
export default EverythingOS;
export declare function createEverythingOS(config?: EverythingOSConfig): Promise<EverythingOS>;
export declare const createTradingOS: () => Promise<EverythingOS>;
export declare const createHealthcareOS: () => Promise<EverythingOS>;
export declare const createFullOS: () => Promise<EverythingOS>;
//# sourceMappingURL=index.d.ts.map