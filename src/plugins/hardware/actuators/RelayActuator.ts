// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Relay Actuator
// Digital on/off switching for relays, LEDs, solenoids, etc.
// Supports: Single relays, relay boards, GPIO pins
// ═══════════════════════════════════════════════════════════════════════════════

import { ActuatorPlugin, ActuatorConfig, CommandResult } from '../../_base/ActuatorPlugin';
import { SerialProtocol } from '../../protocols/SerialProtocol';
import { ActuatorCommand, ActuatorState } from '../../_base/HardwareTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Relay Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface RelayConfig extends Omit<ActuatorConfig, 'actuatorType' | 'protocol'> {
  actuatorType: 'relay';
  protocol: 'serial';
  
  // Serial to microcontroller
  port: string;
  baudRate?: number;
  
  // Relay settings
  channel: number;             // Relay/pin number
  
  // Logic
  activeHigh?: boolean;        // true = HIGH to activate, false = LOW to activate
  defaultState?: 'on' | 'off'; // State after initialization
  
  // Safety
  maxOnTime?: number;          // Auto-off after this many ms (0 = no limit)
  
  // Scheduling
  allowScheduled?: boolean;    // Allow timed on/off
}

export type RelayState = 'on' | 'off' | 'unknown';

// ─────────────────────────────────────────────────────────────────────────────
// Relay Actuator Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class RelayActuator extends ActuatorPlugin<boolean> {
  private serial: SerialProtocol;
  private relayConfig: RelayConfig;
  
  // State
  private relayState: RelayState = 'unknown';
  private stateChangedAt?: number;
  private autoOffTimer?: ReturnType<typeof setTimeout>;
  private scheduledTimer?: ReturnType<typeof setTimeout>;

  constructor(config: Omit<RelayConfig, 'type' | 'actuatorType' | 'protocol'> & {
    type?: 'actuator';
    actuatorType?: 'relay';
    protocol?: 'serial';
  }) {
    const fullConfig: RelayConfig = {
      ...config,
      type: 'actuator',
      actuatorType: 'relay',
      protocol: 'serial',
      baudRate: config.baudRate ?? 115200,
      activeHigh: config.activeHigh ?? true,
      defaultState: config.defaultState ?? 'off',
      maxOnTime: config.maxOnTime ?? 0,
      allowScheduled: config.allowScheduled ?? true,
      requiresApproval: config.requiresApproval ?? false,
      safetyLimits: config.safetyLimits ?? {},
      connection: {
        port: config.port,
        baudRate: config.baudRate ?? 115200,
      },
    };

    super(fullConfig);
    this.relayConfig = fullConfig;

    this.serial = new SerialProtocol({
      id: `${config.id}-serial`,
      type: 'serial',
      connection: {
        port: config.port,
        baudRate: config.baudRate ?? 115200,
      },
      parser: 'readline',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ActuatorPlugin Implementation
  // ─────────────────────────────────────────────────────────────────────────

  protected async connect(): Promise<void> {
    await this.serial.connect();
    
    this.serial.onMessage((message) => {
      this.handleSerialResponse(message.data.toString());
    });
    
    // Set to default state
    if (this.relayConfig.defaultState === 'on') {
      await this.turnOn();
    } else {
      await this.turnOff();
    }
    
    this.log('info', `Relay ${this.relayConfig.channel} connected (default: ${this.relayConfig.defaultState})`);
  }

  protected async disconnect(): Promise<void> {
    await this.turnOff();
    this.clearTimers();
    await this.serial.disconnect();
  }

  protected async executeCommand(command: ActuatorCommand<boolean>): Promise<void> {
    switch (command.command) {
      case 'set_state':
        if (command.value) {
          await this.turnOn(command.duration);
        } else {
          await this.turnOff();
        }
        break;
        
      case 'enable':
        await this.turnOn(command.duration);
        break;
        
      case 'disable':
        await this.turnOff();
        break;
        
      case 'stop':
        await this.turnOff();
        break;
        
      default:
        throw new Error(`Unknown command: ${command.command}`);
    }
  }

  protected async readState(): Promise<ActuatorState> {
    await this.serial.writeLine(`READ ${this.relayConfig.channel}`);
    
    return {
      actuatorId: this.config.id,
      actuatorType: 'relay',
      enabled: this.enabled,
      position: this.relayState === 'on' ? 1 : 0,
      timestamp: Date.now(),
    };
  }

  protected async performEmergencyStop(): Promise<void> {
    await this.turnOffImmediate();
  }

  protected async enableHardware(): Promise<void> {
    await this.turnOn();
  }

  protected async disableHardware(): Promise<void> {
    await this.turnOff();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Relay Control
  // ─────────────────────────────────────────────────────────────────────────

  private async turnOn(duration?: number): Promise<void> {
    this.clearTimers();
    
    const level = this.relayConfig.activeHigh ? 'HIGH' : 'LOW';
    await this.serial.writeLine(`SET ${this.relayConfig.channel} ${level}`);
    
    this.relayState = 'on';
    this.stateChangedAt = Date.now();
    
    this.emit('state_changed', { state: 'on' });
    this.log('debug', `Relay ${this.relayConfig.channel} ON`);
    
    const autoOffTime = duration ?? this.relayConfig.maxOnTime;
    if (autoOffTime && autoOffTime > 0) {
      this.autoOffTimer = setTimeout(() => {
        this.turnOff();
        this.log('info', `Relay ${this.relayConfig.channel} auto-off after ${autoOffTime}ms`);
      }, autoOffTime);
    }
  }

  private async turnOff(): Promise<void> {
    this.clearTimers();
    
    const level = this.relayConfig.activeHigh ? 'LOW' : 'HIGH';
    await this.serial.writeLine(`SET ${this.relayConfig.channel} ${level}`);
    
    this.relayState = 'off';
    this.stateChangedAt = Date.now();
    
    this.emit('state_changed', { state: 'off' });
    this.log('debug', `Relay ${this.relayConfig.channel} OFF`);
  }

  private async turnOffImmediate(): Promise<void> {
    this.clearTimers();
    const level = this.relayConfig.activeHigh ? 'LOW' : 'HIGH';
    await this.serial.writeLine(`SET ${this.relayConfig.channel} ${level}`);
    this.relayState = 'off';
    this.stateChangedAt = Date.now();
  }

  private clearTimers(): void {
    if (this.autoOffTimer) {
      clearTimeout(this.autoOffTimer);
      this.autoOffTimer = undefined;
    }
    if (this.scheduledTimer) {
      clearTimeout(this.scheduledTimer);
      this.scheduledTimer = undefined;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Response Handling
  // ─────────────────────────────────────────────────────────────────────────

  private handleSerialResponse(response: string): void {
    const parts = response.trim().split(' ');
    
    if (parts[0] === 'STATE' && parseInt(parts[1]) === this.relayConfig.channel) {
      const isHigh = parts[2] === 'HIGH';
      this.relayState = (isHigh === this.relayConfig.activeHigh) ? 'on' : 'off';
    } else if (parts[0] === 'OK') {
      this.log('debug', `Command acknowledged: ${response}`);
    } else if (parts[0] === 'ERR') {
      this.log('error', `Controller error: ${response}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API Extensions
  // ─────────────────────────────────────────────────────────────────────────

  isOn(): boolean {
    return this.relayState === 'on';
  }

  isOff(): boolean {
    return this.relayState === 'off';
  }

  getRelayState(): RelayState {
    return this.relayState;
  }

  getOnDuration(): number | undefined {
    if (this.relayState !== 'on' || !this.stateChangedAt) return undefined;
    return Date.now() - this.stateChangedAt;
  }

  async toggle(): Promise<CommandResult> {
    if (this.relayState === 'on') {
      return this.command('set_state', false);
    } else {
      return this.command('set_state', true);
    }
  }

  async pulse(durationMs: number): Promise<CommandResult> {
    return this.command('set_state', true, { duration: durationMs });
  }

  async scheduleOn(delayMs: number, duration?: number): Promise<void> {
    if (!this.relayConfig.allowScheduled) {
      throw new Error('Scheduled operations not allowed for this relay');
    }

    this.clearTimers();
    this.scheduledTimer = setTimeout(() => {
      this.turnOn(duration);
    }, delayMs);
    
    this.log('info', `Scheduled ON in ${delayMs}ms`);
  }

  async scheduleOff(delayMs: number): Promise<void> {
    if (!this.relayConfig.allowScheduled) {
      throw new Error('Scheduled operations not allowed for this relay');
    }

    this.clearTimers();
    this.scheduledTimer = setTimeout(() => {
      this.turnOff();
    }, delayMs);
    
    this.log('info', `Scheduled OFF in ${delayMs}ms`);
  }

  cancelScheduled(): void {
    if (this.scheduledTimer) {
      clearTimeout(this.scheduledTimer);
      this.scheduledTimer = undefined;
      this.log('info', 'Scheduled operation cancelled');
    }
  }
}
