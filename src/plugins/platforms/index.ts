// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Platform Plugins
// Hardware platform support for deployment targets
// ═══════════════════════════════════════════════════════════════════════════════

// Raspberry Pi (3, 4, 5, Zero 2)
export {
  RaspberryPiPlatform,
  RaspberryPiConfig,
  GPIOPin,
  GPIOMode,
  GPIOPull,
  GPIOEdge,
  PlatformInfo,
} from './RaspberryPiPlatform';

// NVIDIA Jetson (Nano, Xavier, Orin)
export {
  JetsonPlatform,
  JetsonConfig,
  JetsonInfo,
  CUDAInfo,
} from './JetsonPlatform';

// Deployment Manager
export {
  DeploymentManager,
  DeploymentConfig,
  DeploymentStatus,
  DeviceHealth,
  UpdateInfo,
  PlatformType,
} from './DeploymentManager';
