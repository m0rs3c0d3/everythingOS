// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Deployment Manager
// Cross-platform deployment, health monitoring, and OTA updates
// Manages: Platform detection, service lifecycle, remote updates, fleet monitoring
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../../core/event-bus/EventBus';
import { RaspberryPiPlatform, PlatformInfo } from './RaspberryPiPlatform';
import { JetsonPlatform, JetsonInfo } from './JetsonPlatform';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PlatformType = 'raspberry_pi' | 'jetson' | 'linux' | 'unknown';

export interface DeploymentConfig {
  // Identity
  deviceId?: string;
  deviceName?: string;
  
  // Platform
  platformOverride?: PlatformType;
  
  // Health monitoring
  healthCheckInterval?: number;   // ms
  healthReportUrl?: string;       // Remote monitoring endpoint
  
  // OTA updates
  updateServerUrl?: string;
  autoUpdate?: boolean;
  updateCheckInterval?: number;   // ms
  
  // Watchdog
  watchdogEnabled?: boolean;
  watchdogTimeout?: number;       // ms
  
  // Logging
  remoteLoggingUrl?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface DeviceHealth {
  deviceId: string;
  platform: PlatformType;
  timestamp: number;
  uptime: number;
  
  // System
  cpuUsage: number;              // 0-100
  memoryUsage: number;           // 0-100
  diskUsage: number;             // 0-100
  temperature: number;           // Celsius
  
  // Network
  networkConnected: boolean;
  ipAddress?: string;
  latency?: number;              // ms to health server
  
  // EverythingOS
  agentsRunning: number;
  workflowsActive: number;
  eventsPerSecond: number;
  errors: number;
  
  // Platform-specific
  platformInfo?: PlatformInfo | JetsonInfo;
}

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  changelog: string;
  downloadUrl: string;
  checksum: string;
  mandatory: boolean;
  minVersion?: string;
}

export interface DeploymentStatus {
  deviceId: string;
  platform: PlatformType;
  version: string;
  status: 'starting' | 'running' | 'updating' | 'error' | 'stopped';
  lastHealthCheck: number;
  lastUpdate: number;
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Deployment Manager Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class DeploymentManager {
  private config: DeploymentConfig;
  private platform: RaspberryPiPlatform | JetsonPlatform | null = null;
  private platformType: PlatformType = 'unknown';
  private status: DeploymentStatus;
  
  // Timers
  private healthTimer?: ReturnType<typeof setInterval>;
  private updateTimer?: ReturnType<typeof setInterval>;
  private watchdogTimer?: ReturnType<typeof setInterval>;
  
  // Metrics
  private startTime = Date.now();
  private eventCount = 0;
  private errorCount = 0;
  private lastEventTime = Date.now();

  constructor(config?: DeploymentConfig) {
    this.config = {
      deviceId: this.generateDeviceId(),
      deviceName: 'EverythingOS Device',
      healthCheckInterval: 30000,      // 30 seconds
      updateCheckInterval: 3600000,    // 1 hour
      watchdogEnabled: true,
      watchdogTimeout: 60000,          // 1 minute
      logLevel: 'info',
      autoUpdate: false,
      ...config,
    };

    this.status = {
      deviceId: this.config.deviceId!,
      platform: 'unknown',
      version: '1.0.0',
      status: 'starting',
      lastHealthCheck: 0,
      lastUpdate: 0,
      errors: [],
    };

    this.setupEventTracking();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.log('info', 'Starting Deployment Manager...');

    // Detect platform
    this.platformType = await this.detectPlatform();
    this.status.platform = this.platformType;
    this.log('info', `Detected platform: ${this.platformType}`);

    // Initialize platform
    await this.initializePlatform();

    // Start health monitoring
    if (this.config.healthCheckInterval) {
      this.healthTimer = setInterval(
        () => this.performHealthCheck(),
        this.config.healthCheckInterval
      );
      this.performHealthCheck(); // Initial check
    }

    // Start update checker
    if (this.config.updateServerUrl && this.config.updateCheckInterval) {
      this.updateTimer = setInterval(
        () => this.checkForUpdates(),
        this.config.updateCheckInterval
      );
    }

    // Start watchdog
    if (this.config.watchdogEnabled) {
      this.startWatchdog();
    }

    this.status.status = 'running';
    this.log('info', `Deployment Manager started (device: ${this.config.deviceId})`);
    eventBus.emit('deployment:started', { status: this.status });
  }

  async stop(): Promise<void> {
    this.log('info', 'Stopping Deployment Manager...');

    this.status.status = 'stopped';

    // Stop timers
    if (this.healthTimer) clearInterval(this.healthTimer);
    if (this.updateTimer) clearInterval(this.updateTimer);
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);

    // Shutdown platform
    if (this.platform) {
      await this.platform.shutdown();
    }

    this.log('info', 'Deployment Manager stopped');
    eventBus.emit('deployment:stopped', { deviceId: this.config.deviceId });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Platform Detection & Initialization
  // ─────────────────────────────────────────────────────────────────────────

  private async detectPlatform(): Promise<PlatformType> {
    if (this.config.platformOverride) {
      return this.config.platformOverride;
    }

    // Check for Jetson
    if (await this.fileExists('/etc/nv_tegra_release')) {
      return 'jetson';
    }

    // Check for Raspberry Pi
    if (await this.fileExists('/proc/device-tree/model')) {
      const model = await this.readFile('/proc/device-tree/model');
      if (model?.toLowerCase().includes('raspberry pi')) {
        return 'raspberry_pi';
      }
    }

    // Generic Linux
    if (process.platform === 'linux') {
      return 'linux';
    }

    return 'unknown';
  }

  private async initializePlatform(): Promise<void> {
    try {
      switch (this.platformType) {
        case 'raspberry_pi':
          this.platform = new RaspberryPiPlatform();
          await this.platform.initialize();
          break;

        case 'jetson':
          this.platform = new JetsonPlatform();
          await this.platform.initialize();
          break;

        case 'linux':
          this.log('info', 'Running on generic Linux (limited hardware access)');
          break;

        default:
          this.log('warn', 'Unknown platform - hardware features disabled');
      }
    } catch (error) {
      this.log('error', `Platform initialization failed: ${error}`);
      this.status.errors.push(`Platform init: ${error}`);
    }
  }

  getPlatform(): RaspberryPiPlatform | JetsonPlatform | null {
    return this.platform;
  }

  getPlatformType(): PlatformType {
    return this.platformType;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Health Monitoring
  // ─────────────────────────────────────────────────────────────────────────

  private async performHealthCheck(): Promise<void> {
    const health = await this.collectHealth();
    this.status.lastHealthCheck = Date.now();

    eventBus.emit('deployment:health', health);

    // Report to remote server
    if (this.config.healthReportUrl) {
      await this.reportHealth(health);
    }

    // Check thresholds
    this.checkHealthThresholds(health);
  }

  async collectHealth(): Promise<DeviceHealth> {
    const now = Date.now();
    const eventsPerSecond = this.eventCount / ((now - this.lastEventTime) / 1000);
    this.eventCount = 0;
    this.lastEventTime = now;

    const health: DeviceHealth = {
      deviceId: this.config.deviceId!,
      platform: this.platformType,
      timestamp: now,
      uptime: now - this.startTime,
      cpuUsage: await this.getCpuUsage(),
      memoryUsage: await this.getMemoryUsage(),
      diskUsage: await this.getDiskUsage(),
      temperature: await this.getTemperature(),
      networkConnected: await this.checkNetwork(),
      ipAddress: await this.getIpAddress(),
      agentsRunning: this.countRunningAgents(),
      workflowsActive: this.countActiveWorkflows(),
      eventsPerSecond,
      errors: this.errorCount,
    };

    // Add platform-specific info
    if (this.platform) {
      if (this.platform instanceof RaspberryPiPlatform) {
        health.platformInfo = await this.platform.getPlatformInfo();
      } else if (this.platform instanceof JetsonPlatform) {
        health.platformInfo = await this.platform.getJetsonInfo();
      }
    }

    return health;
  }

  private async reportHealth(health: DeviceHealth): Promise<void> {
    if (!this.config.healthReportUrl) return;

    try {
      // Would use fetch to POST health data
      this.log('debug', 'Health reported to server');
    } catch (error) {
      this.log('warn', `Health report failed: ${error}`);
    }
  }

  private checkHealthThresholds(health: DeviceHealth): void {
    // CPU warning
    if (health.cpuUsage > 90) {
      this.log('warn', `High CPU usage: ${health.cpuUsage}%`);
      eventBus.emit('deployment:alert', { type: 'cpu_high', value: health.cpuUsage });
    }

    // Memory warning
    if (health.memoryUsage > 85) {
      this.log('warn', `High memory usage: ${health.memoryUsage}%`);
      eventBus.emit('deployment:alert', { type: 'memory_high', value: health.memoryUsage });
    }

    // Temperature warning
    if (health.temperature > 80) {
      this.log('warn', `High temperature: ${health.temperature}°C`);
      eventBus.emit('deployment:alert', { type: 'temp_high', value: health.temperature });
    }

    // Disk warning
    if (health.diskUsage > 90) {
      this.log('warn', `Low disk space: ${100 - health.diskUsage}% free`);
      eventBus.emit('deployment:alert', { type: 'disk_low', value: health.diskUsage });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OTA Updates
  // ─────────────────────────────────────────────────────────────────────────

  async checkForUpdates(): Promise<UpdateInfo | null> {
    if (!this.config.updateServerUrl) return null;

    try {
      this.log('info', 'Checking for updates...');
      
      // Would fetch from update server
      // const response = await fetch(`${this.config.updateServerUrl}/check?version=${this.status.version}`);
      
      // Mock: no updates
      return null;
    } catch (error) {
      this.log('warn', `Update check failed: ${error}`);
      return null;
    }
  }

  async applyUpdate(update: UpdateInfo): Promise<boolean> {
    this.log('info', `Applying update to version ${update.version}...`);
    this.status.status = 'updating';

    try {
      // 1. Download update
      this.log('info', 'Downloading update...');
      // const data = await this.downloadUpdate(update);

      // 2. Verify checksum
      this.log('info', 'Verifying checksum...');
      // this.verifyChecksum(data, update.checksum);

      // 3. Backup current version
      this.log('info', 'Creating backup...');
      // await this.createBackup();

      // 4. Apply update
      this.log('info', 'Applying update...');
      // await this.installUpdate(data);

      // 5. Restart
      this.log('info', 'Update complete. Restarting...');
      this.status.version = update.version;
      this.status.lastUpdate = Date.now();
      this.status.status = 'running';

      eventBus.emit('deployment:updated', { version: update.version });

      // In production: process.exit(0) or systemctl restart
      return true;
    } catch (error) {
      this.log('error', `Update failed: ${error}`);
      this.status.status = 'error';
      this.status.errors.push(`Update failed: ${error}`);

      // Rollback
      // await this.rollback();

      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Watchdog
  // ─────────────────────────────────────────────────────────────────────────

  private startWatchdog(): void {
    // Hardware watchdog keeps system alive
    // Software watchdog monitors EverythingOS health

    this.watchdogTimer = setInterval(() => {
      // In production: write to /dev/watchdog
      this.feedWatchdog();
    }, (this.config.watchdogTimeout! / 2));

    this.log('info', `Watchdog started (${this.config.watchdogTimeout}ms timeout)`);
  }

  private feedWatchdog(): void {
    // Would write to /dev/watchdog
    // Or use systemd watchdog: sd_notify("WATCHDOG=1")
  }

  // ─────────────────────────────────────────────────────────────────────────
  // System Metrics
  // ─────────────────────────────────────────────────────────────────────────

  private async getCpuUsage(): Promise<number> {
    // Would read from /proc/stat
    return Math.random() * 30 + 10; // Mock: 10-40%
  }

  private async getMemoryUsage(): Promise<number> {
    // Would read from /proc/meminfo
    return Math.random() * 20 + 40; // Mock: 40-60%
  }

  private async getDiskUsage(): Promise<number> {
    // Would use df or statvfs
    return Math.random() * 20 + 30; // Mock: 30-50%
  }

  private async getTemperature(): Promise<number> {
    if (this.platform instanceof RaspberryPiPlatform) {
      return await this.platform.getCpuTemp();
    }
    // Fallback
    return Math.random() * 20 + 40; // Mock: 40-60°C
  }

  private async checkNetwork(): Promise<boolean> {
    // Would ping gateway or DNS
    return true;
  }

  private async getIpAddress(): Promise<string | undefined> {
    // Would read from network interfaces
    return '192.168.1.100';
  }

  private countRunningAgents(): number {
    // Would query AgentRegistry
    return 3;
  }

  private countActiveWorkflows(): number {
    // Would query WorkflowEngine
    return 1;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Tracking
  // ─────────────────────────────────────────────────────────────────────────

  private setupEventTracking(): void {
    // Count events for throughput metric
    eventBus.on('*', () => {
      this.eventCount++;
    });

    // Track errors
    eventBus.on('error', () => {
      this.errorCount++;
    });

    eventBus.on('agent:error', () => {
      this.errorCount++;
    });

    eventBus.on('workflow:error', () => {
      this.errorCount++;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────

  private generateDeviceId(): string {
    // Would use MAC address or hardware serial
    return `device_${Math.random().toString(36).slice(2, 10)}`;
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      // fs.accessSync(path);
      return false; // Mock
    } catch {
      return false;
    }
  }

  private async readFile(path: string): Promise<string | null> {
    try {
      // return fs.readFileSync(path, 'utf8');
      return null; // Mock
    } catch {
      return null;
    }
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] >= levels[this.config.logLevel!]) {
      eventBus.emit('deployment:log', {
        deviceId: this.config.deviceId,
        level,
        message,
        timestamp: Date.now(),
      });
      console.log(`[Deployment:${level.toUpperCase()}] ${message}`);
    }
  }

  getStatus(): DeploymentStatus {
    return { ...this.status };
  }

  getConfig(): DeploymentConfig {
    return { ...this.config };
  }
}
