// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Safety Monitor
// Real-time safety system for physical robots
// Monitors: Collisions, limits, velocities, forces, watchdogs
// Actions: Warn, slow, stop, e-stop based on severity
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../../core/event-bus/EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SafetyZone {
  id: string;
  name: string;
  type: 'box' | 'sphere' | 'cylinder' | 'polygon';
  bounds: ZoneBounds;
  action: SafetyAction;
  enabled: boolean;
}

export type ZoneBounds = 
  | { type: 'box'; min: Point3D; max: Point3D }
  | { type: 'sphere'; center: Point3D; radius: number }
  | { type: 'cylinder'; center: Point3D; radius: number; height: number }
  | { type: 'polygon'; points: Point3D[]; height: number };

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type SafetyAction = 'warn' | 'slow' | 'stop' | 'estop';

export interface SafetyRule {
  id: string;
  name: string;
  condition: SafetyCondition;
  action: SafetyAction;
  enabled: boolean;
  cooldownMs?: number;
  lastTriggered?: number;
}

export interface SafetyCondition {
  type: 'threshold' | 'rate' | 'timeout' | 'custom';
  metric: string;               // e.g., 'joint.elbow.position', 'sensor.force.z'
  operator: '<' | '>' | '<=' | '>=' | '==' | '!=';
  value: number;
  rateWindow?: number;          // For rate-based conditions (ms)
}

export interface SafetyViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  action: SafetyAction;
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
}

export interface WatchdogConfig {
  id: string;
  name: string;
  timeoutMs: number;
  action: SafetyAction;
  heartbeatEvent: string;       // Event that resets the watchdog
}

export interface SafetyMonitorConfig {
  updateRateMs?: number;
  defaultAction?: SafetyAction;
  enableHardwareEstop?: boolean;
  estopRecoveryRequiresManual?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Safety Monitor Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class SafetyMonitor {
  private config: SafetyMonitorConfig;
  private zones: Map<string, SafetyZone> = new Map();
  private rules: Map<string, SafetyRule> = new Map();
  private watchdogs: Map<string, WatchdogTimer> = new Map();
  private violations: SafetyViolation[] = [];
  private metrics: Map<string, number> = new Map();
  
  // State
  private running = false;
  private estopActive = false;
  private slowModeActive = false;
  private slowModeScale = 1.0;
  private updateTimer?: ReturnType<typeof setInterval>;
  private violationCounter = 0;

  constructor(config?: SafetyMonitorConfig) {
    this.config = {
      updateRateMs: 50,           // 20Hz safety checks
      defaultAction: 'stop',
      enableHardwareEstop: true,
      estopRecoveryRequiresManual: true,
      ...config,
    };

    this.setupEventListeners();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  start(): void {
    if (this.running) return;
    
    this.running = true;
    this.updateTimer = setInterval(() => this.update(), this.config.updateRateMs);
    
    // Start all watchdogs
    for (const watchdog of this.watchdogs.values()) {
      watchdog.start();
    }
    
    this.log('info', 'Safety monitor started');
    eventBus.emit('safety:started', {});
  }

  stop(): void {
    if (!this.running) return;
    
    this.running = false;
    
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
    
    // Stop all watchdogs
    for (const watchdog of this.watchdogs.values()) {
      watchdog.stop();
    }
    
    this.log('info', 'Safety monitor stopped');
    eventBus.emit('safety:stopped', {});
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Zone Management
  // ─────────────────────────────────────────────────────────────────────────

  addZone(zone: SafetyZone): void {
    this.zones.set(zone.id, zone);
    this.log('info', `Added safety zone: ${zone.name} (${zone.action})`);
  }

  removeZone(zoneId: string): void {
    this.zones.delete(zoneId);
  }

  enableZone(zoneId: string): void {
    const zone = this.zones.get(zoneId);
    if (zone) zone.enabled = true;
  }

  disableZone(zoneId: string): void {
    const zone = this.zones.get(zoneId);
    if (zone) zone.enabled = false;
  }

  checkPointInZones(point: Point3D): SafetyZone | null {
    for (const zone of this.zones.values()) {
      if (!zone.enabled) continue;
      if (this.isPointInZone(point, zone)) {
        return zone;
      }
    }
    return null;
  }

  private isPointInZone(point: Point3D, zone: SafetyZone): boolean {
    const bounds = zone.bounds;
    
    switch (bounds.type) {
      case 'box':
        return point.x >= bounds.min.x && point.x <= bounds.max.x &&
               point.y >= bounds.min.y && point.y <= bounds.max.y &&
               point.z >= bounds.min.z && point.z <= bounds.max.z;
        
      case 'sphere':
        const dist = Math.sqrt(
          (point.x - bounds.center.x) ** 2 +
          (point.y - bounds.center.y) ** 2 +
          (point.z - bounds.center.z) ** 2
        );
        return dist <= bounds.radius;
        
      case 'cylinder':
        const radialDist = Math.sqrt(
          (point.x - bounds.center.x) ** 2 +
          (point.y - bounds.center.y) ** 2
        );
        const heightOk = point.z >= bounds.center.z && 
                        point.z <= bounds.center.z + bounds.height;
        return radialDist <= bounds.radius && heightOk;
        
      default:
        return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rule Management
  // ─────────────────────────────────────────────────────────────────────────

  addRule(rule: SafetyRule): void {
    this.rules.set(rule.id, rule);
    this.log('info', `Added safety rule: ${rule.name} (${rule.action})`);
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) rule.enabled = true;
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) rule.enabled = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Watchdog Management
  // ─────────────────────────────────────────────────────────────────────────

  addWatchdog(config: WatchdogConfig): void {
    const watchdog = new WatchdogTimer(config, (cfg) => {
      this.handleWatchdogTimeout(cfg);
    });
    
    this.watchdogs.set(config.id, watchdog);
    
    // Listen for heartbeat event
    eventBus.on(config.heartbeatEvent, () => {
      watchdog.reset();
    });
    
    if (this.running) {
      watchdog.start();
    }
    
    this.log('info', `Added watchdog: ${config.name} (${config.timeoutMs}ms)`);
  }

  removeWatchdog(watchdogId: string): void {
    const watchdog = this.watchdogs.get(watchdogId);
    if (watchdog) {
      watchdog.stop();
      this.watchdogs.delete(watchdogId);
    }
  }

  feedWatchdog(watchdogId: string): void {
    this.watchdogs.get(watchdogId)?.reset();
  }

  private handleWatchdogTimeout(config: WatchdogConfig): void {
    this.log('error', `Watchdog timeout: ${config.name}`);
    this.triggerAction(config.action, `Watchdog timeout: ${config.name}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Metric Updates
  // ─────────────────────────────────────────────────────────────────────────

  updateMetric(name: string, value: number): void {
    this.metrics.set(name, value);
  }

  getMetric(name: string): number | undefined {
    return this.metrics.get(name);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Safety Check Loop
  // ─────────────────────────────────────────────────────────────────────────

  private update(): void {
    if (this.estopActive) return;
    
    // Check all rules
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      
      // Check cooldown
      if (rule.cooldownMs && rule.lastTriggered) {
        if (Date.now() - rule.lastTriggered < rule.cooldownMs) continue;
      }
      
      if (this.evaluateCondition(rule.condition)) {
        this.triggerViolation(rule);
      }
    }
  }

  private evaluateCondition(condition: SafetyCondition): boolean {
    const value = this.metrics.get(condition.metric);
    if (value === undefined) return false;
    
    switch (condition.operator) {
      case '<': return value < condition.value;
      case '>': return value > condition.value;
      case '<=': return value <= condition.value;
      case '>=': return value >= condition.value;
      case '==': return value === condition.value;
      case '!=': return value !== condition.value;
      default: return false;
    }
  }

  private triggerViolation(rule: SafetyRule): void {
    rule.lastTriggered = Date.now();
    
    const value = this.metrics.get(rule.condition.metric) ?? 0;
    
    const violation: SafetyViolation = {
      id: `violation_${++this.violationCounter}`,
      ruleId: rule.id,
      ruleName: rule.name,
      action: rule.action,
      metric: rule.condition.metric,
      value,
      threshold: rule.condition.value,
      timestamp: Date.now(),
      resolved: false,
    };
    
    this.violations.push(violation);
    
    // Keep last 100 violations
    if (this.violations.length > 100) {
      this.violations = this.violations.slice(-50);
    }
    
    this.log('warn', `Safety violation: ${rule.name} (${rule.condition.metric}=${value})`);
    eventBus.emit('safety:violation', violation);
    
    this.triggerAction(rule.action, rule.name);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Action Execution
  // ─────────────────────────────────────────────────────────────────────────

  private triggerAction(action: SafetyAction, reason: string): void {
    switch (action) {
      case 'warn':
        eventBus.emit('safety:warning', { reason });
        break;
        
      case 'slow':
        this.activateSlowMode(0.25); // 25% speed
        eventBus.emit('safety:slow_mode', { reason, scale: 0.25 });
        break;
        
      case 'stop':
        eventBus.emit('safety:stop', { reason });
        eventBus.emit('motion:stop', { reason: `Safety: ${reason}` });
        break;
        
      case 'estop':
        this.triggerEmergencyStop(reason);
        break;
    }
  }

  triggerEmergencyStop(reason: string): void {
    if (this.estopActive) return;
    
    this.estopActive = true;
    this.log('error', `EMERGENCY STOP: ${reason}`);
    
    // Emit to all systems
    eventBus.emit('hardware:emergency_stop', { reason });
    eventBus.emit('safety:estop', { reason, timestamp: Date.now() });
    
    // Hardware E-stop (if configured)
    if (this.config.enableHardwareEstop) {
      eventBus.emit('hardware:estop:trigger', { reason });
    }
  }

  resetEmergencyStop(): boolean {
    if (!this.estopActive) return true;
    
    if (this.config.estopRecoveryRequiresManual) {
      // Check that all violations are resolved
      const unresolvedViolations = this.violations.filter(v => 
        !v.resolved && v.action === 'estop'
      );
      
      if (unresolvedViolations.length > 0) {
        this.log('warn', `Cannot reset E-stop: ${unresolvedViolations.length} unresolved violations`);
        return false;
      }
    }
    
    this.estopActive = false;
    this.log('info', 'Emergency stop reset');
    eventBus.emit('safety:estop_reset', {});
    
    return true;
  }

  isEmergencyStopped(): boolean {
    return this.estopActive;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Slow Mode
  // ─────────────────────────────────────────────────────────────────────────

  activateSlowMode(scale: number): void {
    this.slowModeActive = true;
    this.slowModeScale = Math.max(0.1, Math.min(1.0, scale));
    eventBus.emit('safety:slow_mode:active', { scale: this.slowModeScale });
  }

  deactivateSlowMode(): void {
    this.slowModeActive = false;
    this.slowModeScale = 1.0;
    eventBus.emit('safety:slow_mode:inactive', {});
  }

  isSlowModeActive(): boolean {
    return this.slowModeActive;
  }

  getSlowModeScale(): number {
    return this.slowModeScale;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Violation Management
  // ─────────────────────────────────────────────────────────────────────────

  resolveViolation(violationId: string): void {
    const violation = this.violations.find(v => v.id === violationId);
    if (violation) {
      violation.resolved = true;
      eventBus.emit('safety:violation:resolved', { violationId });
    }
  }

  getActiveViolations(): SafetyViolation[] {
    return this.violations.filter(v => !v.resolved);
  }

  getViolationHistory(limit = 50): SafetyViolation[] {
    return this.violations.slice(-limit);
  }

  clearResolvedViolations(): void {
    this.violations = this.violations.filter(v => !v.resolved);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Listeners
  // ─────────────────────────────────────────────────────────────────────────

  private setupEventListeners(): void {
    // Listen for sensor data to update metrics
    eventBus.on('sensor:data', (event) => {
      const { sensorId, data } = event.payload as { sensorId: string; data: unknown };
      
      if (typeof data === 'number') {
        this.updateMetric(`sensor.${sensorId}`, data);
      } else if (typeof data === 'object' && data !== null) {
        // Flatten nested sensor data
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'number') {
            this.updateMetric(`sensor.${sensorId}.${key}`, value);
          }
        }
      }
    });

    // Listen for joint positions
    eventBus.on('motion:joint:position', (event) => {
      const { jointId, position } = event.payload as { jointId: string; position: number };
      this.updateMetric(`joint.${jointId}.position`, position);
    });

    // Listen for end-effector position (for zone checking)
    eventBus.on('robot:end_effector:position', (event) => {
      const point = event.payload as Point3D;
      const violatedZone = this.checkPointInZones(point);
      
      if (violatedZone) {
        this.log('warn', `End effector in safety zone: ${violatedZone.name}`);
        this.triggerAction(violatedZone.action, `Zone violation: ${violatedZone.name}`);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Status
  // ─────────────────────────────────────────────────────────────────────────

  getStatus(): {
    running: boolean;
    estopActive: boolean;
    slowModeActive: boolean;
    slowModeScale: number;
    activeViolations: number;
    zones: number;
    rules: number;
    watchdogs: number;
  } {
    return {
      running: this.running,
      estopActive: this.estopActive,
      slowModeActive: this.slowModeActive,
      slowModeScale: this.slowModeScale,
      activeViolations: this.getActiveViolations().length,
      zones: this.zones.size,
      rules: this.rules.size,
      watchdogs: this.watchdogs.size,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    eventBus.emit('safety:log', { level, message, timestamp: Date.now() });
    
    if (level === 'error' || level === 'warn') {
      console.log(`[SafetyMonitor] ${level.toUpperCase()}: ${message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Watchdog Timer Helper
// ─────────────────────────────────────────────────────────────────────────────

class WatchdogTimer {
  private config: WatchdogConfig;
  private onTimeout: (config: WatchdogConfig) => void;
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;

  constructor(config: WatchdogConfig, onTimeout: (config: WatchdogConfig) => void) {
    this.config = config;
    this.onTimeout = onTimeout;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.reset();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  reset(): void {
    if (!this.running) return;
    
    if (this.timer) {
      clearTimeout(this.timer);
    }
    
    this.timer = setTimeout(() => {
      this.onTimeout(this.config);
    }, this.config.timeoutMs);
  }
}
