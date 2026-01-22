// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Hardware Types
// Shared types for sensors, actuators, and protocols
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Hardware Status & Health
// ─────────────────────────────────────────────────────────────────────────────

export type HardwareStatus = 
  | 'disconnected'    // Not connected
  | 'connecting'      // Connection in progress
  | 'connected'       // Connected, not yet ready
  | 'initializing'    // Running initialization
  | 'ready'           // Ready for use
  | 'busy'            // Currently processing
  | 'error'           // Error state
  | 'disabled';       // Manually disabled

export interface HardwareHealth {
  status: HardwareStatus;
  lastSeen: number;
  errorCount: number;
  lastError?: string;
  uptime?: number;            // ms since connected
  temperature?: number;       // Celsius, if available
  voltage?: number;           // Volts, if available
  signalStrength?: number;    // 0-100%, for wireless
}

// ─────────────────────────────────────────────────────────────────────────────
// Hardware Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface HardwareConfig {
  id: string;
  name: string;
  type: HardwareType;
  protocol: ProtocolType;
  
  // Connection
  connection: ConnectionConfig;
  
  // Behavior
  pollRate?: number;          // ms between reads (sensors)
  timeout?: number;           // ms before connection timeout
  retryAttempts?: number;     // Connection retry attempts
  retryDelay?: number;        // ms between retries
  
  // Safety
  safetyLimits?: SafetyLimits;
  requiresApproval?: boolean; // Require approval for actions
  
  // Metadata
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
}

export type HardwareType = 
  | 'sensor'
  | 'actuator'
  | 'controller'
  | 'bridge';

export type ProtocolType =
  | 'serial'          // USB/UART
  | 'i2c'             // I2C bus
  | 'spi'             // SPI bus
  | 'gpio'            // Direct GPIO
  | 'mqtt'            // MQTT messaging
  | 'websocket'       // WebSocket
  | 'http'            // HTTP/REST
  | 'ros2'            // ROS2 topics
  | 'modbus'          // Modbus RTU/TCP
  | 'canbus'          // CAN bus
  | 'bluetooth'       // Bluetooth/BLE
  | 'custom';

export interface ConnectionConfig {
  // Serial
  port?: string;              // e.g., '/dev/ttyUSB0', 'COM3'
  baudRate?: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  
  // Network
  host?: string;
  portNumber?: number;
  path?: string;              // URL path or topic
  
  // I2C/SPI
  bus?: number;
  address?: number;
  
  // GPIO
  pin?: number;
  pins?: number[];
  
  // Authentication
  username?: string;
  password?: string;
  apiKey?: string;
  certificate?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Safety
// ─────────────────────────────────────────────────────────────────────────────

export interface SafetyLimits {
  // Position limits (for actuators)
  minPosition?: number;
  maxPosition?: number;
  
  // Speed limits
  maxSpeed?: number;
  maxAcceleration?: number;
  
  // Force/torque limits
  maxForce?: number;
  maxTorque?: number;
  
  // Temperature limits
  minTemperature?: number;
  maxTemperature?: number;
  
  // Voltage/current limits
  minVoltage?: number;
  maxVoltage?: number;
  maxCurrent?: number;
  
  // Custom limits
  custom?: Record<string, { min?: number; max?: number }>;
}

export interface SafetyViolation {
  hardwareId: string;
  limit: keyof SafetyLimits | string;
  expected: { min?: number; max?: number };
  actual: number;
  timestamp: number;
  action: 'warned' | 'blocked' | 'emergency_stop';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensor Types
// ─────────────────────────────────────────────────────────────────────────────

export type SensorType =
  | 'camera'          // Visual input
  | 'depth_camera'    // Depth sensing
  | 'lidar'           // Light detection and ranging
  | 'radar'           // Radio detection
  | 'ultrasonic'      // Ultrasonic distance
  | 'imu'             // Inertial measurement unit
  | 'gps'             // Global positioning
  | 'microphone'      // Audio input
  | 'temperature'     // Temperature sensing
  | 'humidity'        // Humidity sensing
  | 'pressure'        // Pressure/barometer
  | 'gas'             // Gas detection
  | 'light'           // Light/lux sensing
  | 'touch'           // Touch/pressure
  | 'encoder'         // Position encoder
  | 'current'         // Current sensing
  | 'voltage'         // Voltage sensing
  | 'force'           // Force/load cell
  | 'proximity'       // Proximity detection
  | 'custom';

export interface SensorReading<T = unknown> {
  sensorId: string;
  sensorType: SensorType;
  timestamp: number;
  data: T;
  unit?: string;
  confidence?: number;        // 0-1, quality of reading
  metadata?: Record<string, unknown>;
}

// Common sensor data types
export interface PositionData {
  x: number;
  y: number;
  z?: number;
  unit: 'meters' | 'centimeters' | 'millimeters' | 'degrees';
}

export interface OrientationData {
  roll: number;               // Rotation around X
  pitch: number;              // Rotation around Y
  yaw: number;                // Rotation around Z
  unit: 'radians' | 'degrees';
}

export interface VelocityData {
  linear: { x: number; y: number; z: number };
  angular: { x: number; y: number; z: number };
  unit: 'm/s' | 'rad/s';
}

export interface ImageData {
  width: number;
  height: number;
  channels: 1 | 3 | 4;        // Grayscale, RGB, RGBA
  encoding: 'raw' | 'jpeg' | 'png' | 'base64';
  data: Uint8Array | string;
}

export interface PointCloudData {
  points: Array<{ x: number; y: number; z: number; intensity?: number }>;
  frame: string;              // Reference frame
}

// ─────────────────────────────────────────────────────────────────────────────
// Actuator Types
// ─────────────────────────────────────────────────────────────────────────────

export type ActuatorType =
  | 'motor_dc'        // DC motor
  | 'motor_stepper'   // Stepper motor
  | 'motor_servo'     // Servo motor
  | 'motor_bldc'      // Brushless DC
  | 'linear'          // Linear actuator
  | 'pneumatic'       // Pneumatic actuator
  | 'hydraulic'       // Hydraulic actuator
  | 'relay'           // Relay/switch
  | 'led'             // LED/light
  | 'speaker'         // Audio output
  | 'display'         // Display output
  | 'gripper'         // Gripper/end effector
  | 'valve'           // Valve control
  | 'heater'          // Heating element
  | 'cooler'          // Cooling element
  | 'custom';

export interface ActuatorCommand<T = unknown> {
  actuatorId: string;
  actuatorType: ActuatorType;
  command: ActuatorCommandType;
  value?: T;
  duration?: number;          // ms, for timed commands
  speed?: number;             // For motion commands
  acceleration?: number;
  force?: number;
  metadata?: Record<string, unknown>;
}

export type ActuatorCommandType =
  | 'set_position'
  | 'set_velocity'
  | 'set_torque'
  | 'set_force'
  | 'set_state'       // On/off, open/close
  | 'move_relative'
  | 'move_absolute'
  | 'home'            // Return to home position
  | 'stop'            // Controlled stop
  | 'emergency_stop'  // Immediate stop
  | 'enable'
  | 'disable'
  | 'custom';

export interface ActuatorState {
  actuatorId: string;
  actuatorType: ActuatorType;
  enabled: boolean;
  position?: number;
  velocity?: number;
  torque?: number;
  temperature?: number;
  error?: string;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

export type HardwareEventType =
  | 'connected'
  | 'disconnected'
  | 'ready'
  | 'error'
  | 'data'            // Sensor data received
  | 'command_sent'    // Actuator command sent
  | 'command_completed'
  | 'command_failed'
  | 'safety_violation'
  | 'calibration_required'
  | 'firmware_update_available';

export interface HardwareEvent {
  type: HardwareEventType;
  hardwareId: string;
  timestamp: number;
  data?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Calibration
// ─────────────────────────────────────────────────────────────────────────────

export interface CalibrationData {
  hardwareId: string;
  calibratedAt: number;
  calibratedBy?: string;
  parameters: Record<string, number>;
  valid: boolean;
  expiresAt?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hardware Registry Entry
// ─────────────────────────────────────────────────────────────────────────────

export interface HardwareEntry {
  config: HardwareConfig;
  health: HardwareHealth;
  calibration?: CalibrationData;
  lastReading?: SensorReading;
  lastCommand?: ActuatorCommand;
  lastState?: ActuatorState;
}
