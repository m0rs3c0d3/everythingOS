// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Hardware Protocols
// Communication protocols for hardware devices
// ═══════════════════════════════════════════════════════════════════════════════

// Base
export {
  ProtocolBase,
  ProtocolConfig,
  ProtocolStatus,
  ProtocolStats,
  ProtocolMessage,
} from './ProtocolBase';

// Serial (USB/UART)
export {
  SerialProtocol,
  SerialConfig,
  SerialConnectionConfig,
  SerialPortInfo,
} from './SerialProtocol';

// I2C (Sensor bus)
export {
  I2CProtocol,
  I2CConfig,
  I2CConnectionConfig,
} from './I2CProtocol';

// MQTT (IoT messaging)
export {
  MQTTProtocol,
  MQTTConfig,
  MQTTConnectionConfig,
  MQTTSubscription,
  MQTTPacket,
  QoS,
} from './MQTTProtocol';

// WebSocket (Real-time streaming)
export {
  WebSocketProtocol,
  WebSocketConfig,
  WebSocketConnectionConfig,
  WebSocketReadyState,
} from './WebSocketProtocol';
