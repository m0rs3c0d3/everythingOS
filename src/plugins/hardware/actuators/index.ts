// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Hardware Actuators
// Output devices that affect the physical world
// ═══════════════════════════════════════════════════════════════════════════════

// Servo Motors (PWM)
export {
  ServoActuator,
  ServoConfig,
} from './ServoActuator';

// DC and Stepper Motors
export {
  MotorActuator,
  MotorConfig,
  MotorState,
} from './MotorActuator';

// Relays (On/Off switching)
export {
  RelayActuator,
  RelayConfig,
  RelayState,
} from './RelayActuator';
