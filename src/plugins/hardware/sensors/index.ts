// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Hardware Sensors
// Input devices that read from the physical world
// ═══════════════════════════════════════════════════════════════════════════════

// Temperature (I2C)
export {
  TemperatureSensor,
  TemperatureSensorConfig,
  TemperatureReading,
} from './TemperatureSensor';

// IMU - Accelerometer/Gyroscope (I2C)
export {
  IMUSensor,
  IMUSensorConfig,
  IMUReading,
} from './IMUSensor';

// GPS (Serial/NMEA)
export {
  GPSSensor,
  GPSSensorConfig,
  GPSReading,
} from './GPSSensor';
