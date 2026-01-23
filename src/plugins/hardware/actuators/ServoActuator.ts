// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Servo Actuator
// PWM-based servo motor control
// Supports: Standard servos (SG90, MG996R), continuous rotation servos
// ═══════════════════════════════════════════════════════════════════════════════

import { ActuatorPlugin, ActuatorConfig, CommandResult } from '../../_base/ActuatorPlugin';
import { SerialProtocol } from '../../protocols/SerialProtocol';
import { ActuatorCommand, ActuatorState } from '../../_base/HardwareTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Servo Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface ServoConfig extends Omit<ActuatorConfig, 'actuatorType' | 'protocol'> {
  actuatorType: 'motor_servo';
  protocol: 'serial';
  
  // Serial to microcontroller
  port: string;
  baudRate?: number;
  
  // Servo settings
  channel: number;             // Servo channel (0-15 for PCA9685, or pin number)
  
  // PWM range (microseconds)
  minPulse?: number;           // Min pulse width (default: 500)
  maxPulse?: number;           // Max pulse width (default: 2500)
  
  // Angle range
  minAngle?: number;           // Min angle in degrees (default: 0)
  maxAngle?: number;           // Max angle in degrees (default: 180)
  
  // Behavior
  servoType?: 'standard' | 'continuous';
  invertDirection?: boolean;
  centerAngle?: number;        // Angle considered "center" (default: 90)
  
  // Speed control (if controller supports it)
  supportsSpeed?: boolean;
  defaultSpeed?: number;       // degrees per second
}

// ─────────────────────────────────────────────────────────────────────────────
// Servo Actuator Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class ServoActuator extends ActuatorPlugin<number> {
  private serial: SerialProtocol;
  private servoConfig: ServoConfig;
  
  // Current position tracking
  private currentAngle: number;
  private targetAngle: number;

  constructor(config: Omit<ServoConfig, 'type' | 'actuatorType' | 'protocol'> & {
    type?: 'actuator';
    actuatorType?: 'motor_servo';
    protocol?: 'serial';
  }) {
    // Build safety limits from angle range
    const minAngle = config.minAngle ?? 0;
    const maxAngle = config.maxAngle ?? 180;
    
    const fullConfig: ServoConfig = {
      ...config,
      type: 'actuator',
      actuatorType: 'motor_servo',
      protocol: 'serial',
      baudRate: config.baudRate ?? 115200,
      minPulse: config.minPulse ?? 500,
      maxPulse: config.maxPulse ?? 2500,
      minAngle,
      maxAngle,
      servoType: config.servoType ?? 'standard',
      centerAngle: config.centerAngle ?? 90,
      defaultSpeed: config.defaultSpeed ?? 60, // 60 deg/s default
      requiresApproval: config.requiresApproval ?? false, // Servos usually don't need approval
      safetyLimits: {
        minPosition: minAngle,
        maxPosition: maxAngle,
        ...config.safetyLimits,
      },
      connection: {
        port: config.port,
        baudRate: config.baudRate ?? 115200,
      },
    };

    super(fullConfig);
    this.servoConfig = fullConfig;
    
    this.currentAngle = fullConfig.centerAngle ?? 90;
    this.targetAngle = this.currentAngle;

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
    
    // Set up response handler
    this.serial.onMessage((message) => {
      this.handleSerialResponse(message.data.toString());
    });
    
    this.log('info', `Servo connected on ${this.servoConfig.port}, channel ${this.servoConfig.channel}`);
  }

  protected async disconnect(): Promise<void> {
    // Move to center before disconnect (safe position)
    try {
      await this.moveToAngle(this.servoConfig.centerAngle ?? 90);
    } catch (error) {
      this.log('warn', `Could not center servo before disconnect: ${error}`);
    }
    
    await this.serial.disconnect();
  }

  protected async executeCommand(command: ActuatorCommand<number>): Promise<void> {
    switch (command.command) {
      case 'set_position':
        await this.moveToAngle(command.value!, command.speed);
        break;
        
      case 'move_relative':
        await this.moveToAngle(this.currentAngle + (command.value ?? 0), command.speed);
        break;
        
      case 'home':
        await this.moveToAngle(this.servoConfig.centerAngle ?? 90, command.speed);
        break;
        
      case 'set_velocity':
        if (this.servoConfig.servoType === 'continuous') {
          await this.setContinuousSpeed(command.value ?? 0);
        } else {
          throw new Error('Velocity control only supported for continuous servos');
        }
        break;
        
      case 'stop':
        if (this.servoConfig.servoType === 'continuous') {
          await this.setContinuousSpeed(0);
        }
        // For standard servos, "stop" just means stay at current position
        break;
        
      case 'enable':
        await this.attachServo();
        break;
        
      case 'disable':
        await this.detachServo();
        break;
        
      default:
        throw new Error(`Unknown command: ${command.command}`);
    }
  }

  protected async readState(): Promise<ActuatorState> {
    return {
      actuatorId: this.config.id,
      actuatorType: 'motor_servo',
      enabled: this.enabled,
      position: this.currentAngle,
      timestamp: Date.now(),
    };
  }

  protected async performEmergencyStop(): Promise<void> {
    // For continuous servo: stop rotation
    if (this.servoConfig.servoType === 'continuous') {
      await this.setContinuousSpeed(0);
    }
    // For standard servo: detach to prevent holding torque
    await this.detachServo();
  }

  protected async enableHardware(): Promise<void> {
    await this.attachServo();
  }

  protected async disableHardware(): Promise<void> {
    await this.detachServo();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Servo Control
  // ─────────────────────────────────────────────────────────────────────────

  private async moveToAngle(angle: number, speed?: number): Promise<void> {
    // Clamp to valid range
    const minAngle = this.servoConfig.minAngle ?? 0;
    const maxAngle = this.servoConfig.maxAngle ?? 180;
    angle = Math.max(minAngle, Math.min(maxAngle, angle));
    
    // Invert if needed
    if (this.servoConfig.invertDirection) {
      angle = maxAngle - (angle - minAngle);
    }
    
    this.targetAngle = angle;
    
    // Calculate pulse width
    const pulse = this.angleToPulse(angle);
    
    // Send command to controller
    // Format depends on your microcontroller firmware
    // Common format: "SERVO <channel> <pulse> [speed]"
    let cmd = `SERVO ${this.servoConfig.channel} ${Math.round(pulse)}`;
    
    if (speed && this.servoConfig.supportsSpeed) {
      cmd += ` ${Math.round(speed)}`;
    }
    
    await this.serial.writeLine(cmd);
    
    // Update current angle (in reality, servo moves over time)
    this.currentAngle = angle;
    
    this.log('debug', `Servo ${this.servoConfig.channel} -> ${angle}° (pulse: ${pulse}µs)`);
  }

  private async setContinuousSpeed(speed: number): Promise<void> {
    // For continuous rotation servos:
    // -100 to +100 maps to full reverse to full forward
    // 0 = stop
    
    speed = Math.max(-100, Math.min(100, speed));
    
    // Map speed to pulse width
    // Typically: 1000µs = full reverse, 1500µs = stop, 2000µs = full forward
    const centerPulse = (this.servoConfig.minPulse! + this.servoConfig.maxPulse!) / 2;
    const range = (this.servoConfig.maxPulse! - this.servoConfig.minPulse!) / 2;
    
    const pulse = centerPulse + (speed / 100) * range;
    
    await this.serial.writeLine(`SERVO ${this.servoConfig.channel} ${Math.round(pulse)}`);
    
    this.log('debug', `Continuous servo ${this.servoConfig.channel} speed: ${speed}%`);
  }

  private async attachServo(): Promise<void> {
    await this.serial.writeLine(`ATTACH ${this.servoConfig.channel}`);
    this.log('debug', `Servo ${this.servoConfig.channel} attached`);
  }

  private async detachServo(): Promise<void> {
    await this.serial.writeLine(`DETACH ${this.servoConfig.channel}`);
    this.log('debug', `Servo ${this.servoConfig.channel} detached`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Conversion Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private angleToPulse(angle: number): number {
    const minAngle = this.servoConfig.minAngle ?? 0;
    const maxAngle = this.servoConfig.maxAngle ?? 180;
    const minPulse = this.servoConfig.minPulse ?? 500;
    const maxPulse = this.servoConfig.maxPulse ?? 2500;
    
    const ratio = (angle - minAngle) / (maxAngle - minAngle);
    return minPulse + ratio * (maxPulse - minPulse);
  }

  private pulseToAngle(pulse: number): number {
    const minAngle = this.servoConfig.minAngle ?? 0;
    const maxAngle = this.servoConfig.maxAngle ?? 180;
    const minPulse = this.servoConfig.minPulse ?? 500;
    const maxPulse = this.servoConfig.maxPulse ?? 2500;
    
    const ratio = (pulse - minPulse) / (maxPulse - minPulse);
    return minAngle + ratio * (maxAngle - minAngle);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Response Handling
  // ─────────────────────────────────────────────────────────────────────────

  private handleSerialResponse(response: string): void {
    // Parse responses from controller
    // Format depends on your firmware
    
    if (response.startsWith('OK')) {
      this.log('debug', `Command acknowledged: ${response}`);
    } else if (response.startsWith('ERR')) {
      this.log('error', `Controller error: ${response}`);
    } else if (response.startsWith('POS')) {
      // Position feedback: "POS <channel> <angle>"
      const parts = response.split(' ');
      if (parts.length >= 3 && parseInt(parts[1]) === this.servoConfig.channel) {
        this.currentAngle = parseFloat(parts[2]);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API Extensions
  // ─────────────────────────────────────────────────────────────────────────

  getCurrentAngle(): number {
    return this.currentAngle;
  }

  getTargetAngle(): number {
    return this.targetAngle;
  }

  async center(): Promise<CommandResult> {
    return this.command('home');
  }

  async sweep(fromAngle: number, toAngle: number, duration: number): Promise<void> {
    const steps = Math.abs(toAngle - fromAngle);
    const stepDelay = duration / steps;
    const direction = toAngle > fromAngle ? 1 : -1;

    for (let i = 0; i <= steps; i++) {
      if (!this.enabled || this.emergencyStopped) break;
      
      await this.moveToAngle(fromAngle + i * direction);
      await this.sleep(stepDelay);
    }
  }
}
