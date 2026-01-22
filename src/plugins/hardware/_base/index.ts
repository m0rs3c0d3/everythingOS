// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Hardware Base Module
// Base classes and types for all hardware plugins
// ═══════════════════════════════════════════════════════════════════════════════

// Types
export * from './HardwareTypes';

// Base classes
export { SensorPlugin, SensorConfig } from './SensorPlugin';
export { ActuatorPlugin, ActuatorConfig, CommandResult } from './ActuatorPlugin';
