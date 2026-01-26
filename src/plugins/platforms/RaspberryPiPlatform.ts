// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Raspberry Pi Platform
// Hardware abstraction for Raspberry Pi (3, 4, 5, Zero 2)
// Provides: GPIO, I2C, SPI, PWM, Camera (picamera2/libcamera)
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../../../core/event-bus/EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RaspberryPiConfig {
  // GPIO library: 'pigpio' (recommended), 'rpi-gpio', 'onoff'
  gpioLibrary?: 'pigpio' | 'rpi-gpio' | 'onoff' | 'mock';
  
  // I2C bus (usually 1 on modern Pi)
  i2cBus?: number;
  
  // SPI settings
  spiDevice?: number;
  spiChannel?: number;
  
  // Camera
  cameraEnabled?: boolean;
  cameraResolution?: [number, number];
  cameraFps?: number;
}

export type GPIOMode = 'input' | 'output' | 'pwm' | 'servo';
export type GPIOPull = 'up' | 'down' | 'none';
export type GPIOEdge = 'rising' | 'falling' | 'both';

export interface GPIOPin {
  pin: number;
  mode: GPIOMode;
  value: number;
  pull?: GPIOPull;
  pwmFrequency?: number;
  pwmDutyCycle?: number;
}

export interface PlatformInfo {
  model: string;
  revision: string;
  serial: string;
  memory: number;
  cpuTemp: number;
  gpuTemp?: number;
  throttled: boolean;
  undervoltage: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Raspberry Pi Platform Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class RaspberryPiPlatform {
  private config: RaspberryPiConfig;
  private initialized = false;
  private pins: Map<number, GPIOPin> = new Map();
  private gpio: GPIOInterface | null = null;
  private i2c: I2CInterface | null = null;
  private spi: SPIInterface | null = null;
  private camera: CameraInterface | null = null;

  constructor(config?: RaspberryPiConfig) {
    this.config = {
      gpioLibrary: 'pigpio',
      i2cBus: 1,
      spiDevice: 0,
      spiChannel: 0,
      cameraEnabled: false,
      cameraResolution: [1920, 1080],
      cameraFps: 30,
      ...config,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.log('info', 'Initializing Raspberry Pi platform...');

    // Detect Pi model
    const info = await this.getPlatformInfo();
    this.log('info', `Detected: ${info.model} (${info.memory}MB RAM)`);

    // Initialize GPIO
    await this.initGPIO();

    // Initialize I2C
    await this.initI2C();

    // Initialize SPI
    await this.initSPI();

    // Initialize camera if enabled
    if (this.config.cameraEnabled) {
      await this.initCamera();
    }

    this.initialized = true;
    this.log('info', 'Raspberry Pi platform initialized');
    eventBus.emit('platform:raspberry_pi:ready', { info });
  }

  async shutdown(): Promise<void> {
    this.log('info', 'Shutting down Raspberry Pi platform...');

    // Release all pins
    for (const pin of this.pins.keys()) {
      await this.releasePin(pin);
    }

    // Close interfaces
    if (this.camera) await this.camera.close();
    if (this.spi) await this.spi.close();
    if (this.i2c) await this.i2c.close();
    if (this.gpio) await this.gpio.close();

    this.initialized = false;
    this.log('info', 'Platform shutdown complete');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GPIO
  // ─────────────────────────────────────────────────────────────────────────

  private async initGPIO(): Promise<void> {
    try {
      switch (this.config.gpioLibrary) {
        case 'pigpio':
          this.gpio = await this.initPigpio();
          break;
        case 'rpi-gpio':
          this.gpio = await this.initRpiGpio();
          break;
        case 'onoff':
          this.gpio = await this.initOnoff();
          break;
        default:
          this.gpio = new MockGPIO();
      }
      this.log('info', `GPIO initialized (${this.config.gpioLibrary})`);
    } catch (error) {
      this.log('warn', `GPIO init failed: ${error}. Using mock.`);
      this.gpio = new MockGPIO();
    }
  }

  async setupPin(pin: number, mode: GPIOMode, options?: { pull?: GPIOPull }): Promise<void> {
    if (!this.gpio) throw new Error('GPIO not initialized');

    await this.gpio.setup(pin, mode, options?.pull);
    
    this.pins.set(pin, {
      pin,
      mode,
      value: 0,
      pull: options?.pull,
    });

    this.log('debug', `Pin ${pin} configured as ${mode}`);
  }

  async releasePin(pin: number): Promise<void> {
    if (!this.gpio) return;
    
    await this.gpio.release(pin);
    this.pins.delete(pin);
  }

  async digitalWrite(pin: number, value: 0 | 1): Promise<void> {
    if (!this.gpio) throw new Error('GPIO not initialized');
    
    await this.gpio.write(pin, value);
    
    const pinState = this.pins.get(pin);
    if (pinState) pinState.value = value;
  }

  async digitalRead(pin: number): Promise<0 | 1> {
    if (!this.gpio) throw new Error('GPIO not initialized');
    return this.gpio.read(pin);
  }

  async pwmWrite(pin: number, dutyCycle: number, frequency = 1000): Promise<void> {
    if (!this.gpio) throw new Error('GPIO not initialized');
    
    await this.gpio.pwm(pin, dutyCycle, frequency);
    
    const pinState = this.pins.get(pin);
    if (pinState) {
      pinState.pwmDutyCycle = dutyCycle;
      pinState.pwmFrequency = frequency;
    }
  }

  async servoWrite(pin: number, pulseWidth: number): Promise<void> {
    if (!this.gpio) throw new Error('GPIO not initialized');
    await this.gpio.servo(pin, pulseWidth);
  }

  onPinChange(pin: number, edge: GPIOEdge, callback: (value: 0 | 1) => void): () => void {
    if (!this.gpio) throw new Error('GPIO not initialized');
    return this.gpio.watch(pin, edge, callback);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // I2C
  // ─────────────────────────────────────────────────────────────────────────

  private async initI2C(): Promise<void> {
    try {
      // Would use i2c-bus package
      this.i2c = new MockI2C(this.config.i2cBus!);
      this.log('info', `I2C bus ${this.config.i2cBus} initialized`);
    } catch (error) {
      this.log('warn', `I2C init failed: ${error}`);
    }
  }

  async i2cRead(address: number, length: number): Promise<Buffer> {
    if (!this.i2c) throw new Error('I2C not initialized');
    return this.i2c.read(address, length);
  }

  async i2cWrite(address: number, data: Buffer | number[]): Promise<void> {
    if (!this.i2c) throw new Error('I2C not initialized');
    await this.i2c.write(address, Buffer.from(data));
  }

  async i2cReadRegister(address: number, register: number): Promise<number> {
    if (!this.i2c) throw new Error('I2C not initialized');
    return this.i2c.readByte(address, register);
  }

  async i2cWriteRegister(address: number, register: number, value: number): Promise<void> {
    if (!this.i2c) throw new Error('I2C not initialized');
    await this.i2c.writeByte(address, register, value);
  }

  async i2cScan(): Promise<number[]> {
    if (!this.i2c) throw new Error('I2C not initialized');
    return this.i2c.scan();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SPI
  // ─────────────────────────────────────────────────────────────────────────

  private async initSPI(): Promise<void> {
    try {
      this.spi = new MockSPI(this.config.spiDevice!, this.config.spiChannel!);
      this.log('info', `SPI device ${this.config.spiDevice} initialized`);
    } catch (error) {
      this.log('warn', `SPI init failed: ${error}`);
    }
  }

  async spiTransfer(data: Buffer): Promise<Buffer> {
    if (!this.spi) throw new Error('SPI not initialized');
    return this.spi.transfer(data);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Camera
  // ─────────────────────────────────────────────────────────────────────────

  private async initCamera(): Promise<void> {
    try {
      // Would use picamera2 (Python) or libcamera bindings
      this.camera = new MockCamera(
        this.config.cameraResolution!,
        this.config.cameraFps!
      );
      await this.camera.open();
      this.log('info', 'Camera initialized');
    } catch (error) {
      this.log('warn', `Camera init failed: ${error}`);
    }
  }

  async captureImage(): Promise<Buffer> {
    if (!this.camera) throw new Error('Camera not initialized');
    return this.camera.capture();
  }

  async startVideoStream(callback: (frame: Buffer) => void): Promise<void> {
    if (!this.camera) throw new Error('Camera not initialized');
    await this.camera.startStream(callback);
  }

  async stopVideoStream(): Promise<void> {
    if (!this.camera) throw new Error('Camera not initialized');
    await this.camera.stopStream();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Platform Info
  // ─────────────────────────────────────────────────────────────────────────

  async getPlatformInfo(): Promise<PlatformInfo> {
    // Read from /proc/cpuinfo, /sys/class/thermal, vcgencmd
    return {
      model: await this.readFile('/proc/device-tree/model') || 'Raspberry Pi (Unknown)',
      revision: await this.getCpuInfoField('Revision') || 'unknown',
      serial: await this.getCpuInfoField('Serial') || 'unknown',
      memory: await this.getMemoryMB(),
      cpuTemp: await this.getCpuTemp(),
      throttled: await this.isThrottled(),
      undervoltage: await this.isUndervoltage(),
    };
  }

  async getCpuTemp(): Promise<number> {
    try {
      const temp = await this.readFile('/sys/class/thermal/thermal_zone0/temp');
      return parseInt(temp || '0') / 1000;
    } catch {
      return 0;
    }
  }

  async getMemoryMB(): Promise<number> {
    try {
      const meminfo = await this.readFile('/proc/meminfo');
      const match = meminfo?.match(/MemTotal:\s+(\d+)/);
      return match ? Math.round(parseInt(match[1]) / 1024) : 0;
    } catch {
      return 0;
    }
  }

  private async isThrottled(): Promise<boolean> {
    // vcgencmd get_throttled
    return false; // Would check throttle status
  }

  private async isUndervoltage(): Promise<boolean> {
    return false; // Would check undervoltage
  }

  private async getCpuInfoField(field: string): Promise<string | null> {
    try {
      const cpuinfo = await this.readFile('/proc/cpuinfo');
      const match = cpuinfo?.match(new RegExp(`${field}\\s*:\\s*(.+)`));
      return match ? match[1].trim() : null;
    } catch {
      return null;
    }
  }

  private async readFile(path: string): Promise<string | null> {
    try {
      // In real implementation: fs.readFileSync(path, 'utf8')
      return null;
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GPIO Library Initializers
  // ─────────────────────────────────────────────────────────────────────────

  private async initPigpio(): Promise<GPIOInterface> {
    // const pigpio = require('pigpio');
    // pigpio.initialize();
    throw new Error('pigpio not installed');
  }

  private async initRpiGpio(): Promise<GPIOInterface> {
    // const gpio = require('rpi-gpio');
    throw new Error('rpi-gpio not installed');
  }

  private async initOnoff(): Promise<GPIOInterface> {
    // const Gpio = require('onoff').Gpio;
    throw new Error('onoff not installed');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    eventBus.emit('platform:log', { platform: 'raspberry_pi', level, message, timestamp: Date.now() });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getPins(): GPIOPin[] {
    return Array.from(this.pins.values());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────

interface GPIOInterface {
  setup(pin: number, mode: GPIOMode, pull?: GPIOPull): Promise<void>;
  release(pin: number): Promise<void>;
  write(pin: number, value: 0 | 1): Promise<void>;
  read(pin: number): Promise<0 | 1>;
  pwm(pin: number, dutyCycle: number, frequency: number): Promise<void>;
  servo(pin: number, pulseWidth: number): Promise<void>;
  watch(pin: number, edge: GPIOEdge, callback: (value: 0 | 1) => void): () => void;
  close(): Promise<void>;
}

interface I2CInterface {
  read(address: number, length: number): Promise<Buffer>;
  write(address: number, data: Buffer): Promise<void>;
  readByte(address: number, register: number): Promise<number>;
  writeByte(address: number, register: number, value: number): Promise<void>;
  scan(): Promise<number[]>;
  close(): Promise<void>;
}

interface SPIInterface {
  transfer(data: Buffer): Promise<Buffer>;
  close(): Promise<void>;
}

interface CameraInterface {
  open(): Promise<void>;
  close(): Promise<void>;
  capture(): Promise<Buffer>;
  startStream(callback: (frame: Buffer) => void): Promise<void>;
  stopStream(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Implementations
// ─────────────────────────────────────────────────────────────────────────────

class MockGPIO implements GPIOInterface {
  private pins: Map<number, { mode: GPIOMode; value: number }> = new Map();
  private watchers: Map<number, Array<(value: 0 | 1) => void>> = new Map();

  async setup(pin: number, mode: GPIOMode, pull?: GPIOPull): Promise<void> {
    this.pins.set(pin, { mode, value: 0 });
    console.log(`[MockGPIO] Pin ${pin} setup as ${mode}`);
  }

  async release(pin: number): Promise<void> {
    this.pins.delete(pin);
    this.watchers.delete(pin);
  }

  async write(pin: number, value: 0 | 1): Promise<void> {
    const pinState = this.pins.get(pin);
    if (pinState) pinState.value = value;
    console.log(`[MockGPIO] Pin ${pin} = ${value}`);
  }

  async read(pin: number): Promise<0 | 1> {
    return (this.pins.get(pin)?.value ?? 0) as 0 | 1;
  }

  async pwm(pin: number, dutyCycle: number, frequency: number): Promise<void> {
    console.log(`[MockGPIO] Pin ${pin} PWM: ${dutyCycle}% @ ${frequency}Hz`);
  }

  async servo(pin: number, pulseWidth: number): Promise<void> {
    console.log(`[MockGPIO] Pin ${pin} Servo: ${pulseWidth}µs`);
  }

  watch(pin: number, edge: GPIOEdge, callback: (value: 0 | 1) => void): () => void {
    const callbacks = this.watchers.get(pin) ?? [];
    callbacks.push(callback);
    this.watchers.set(pin, callbacks);
    return () => {
      const idx = callbacks.indexOf(callback);
      if (idx > -1) callbacks.splice(idx, 1);
    };
  }

  async close(): Promise<void> {
    this.pins.clear();
    this.watchers.clear();
  }
}

class MockI2C implements I2CInterface {
  constructor(private bus: number) {}

  async read(address: number, length: number): Promise<Buffer> {
    return Buffer.alloc(length);
  }

  async write(address: number, data: Buffer): Promise<void> {
    console.log(`[MockI2C] Write to 0x${address.toString(16)}: ${data.length} bytes`);
  }

  async readByte(address: number, register: number): Promise<number> {
    return 0;
  }

  async writeByte(address: number, register: number, value: number): Promise<void> {
    console.log(`[MockI2C] 0x${address.toString(16)}[0x${register.toString(16)}] = 0x${value.toString(16)}`);
  }

  async scan(): Promise<number[]> {
    return [0x68, 0x76]; // Mock: MPU6050, BME280
  }

  async close(): Promise<void> {}
}

class MockSPI implements SPIInterface {
  constructor(private device: number, private channel: number) {}

  async transfer(data: Buffer): Promise<Buffer> {
    console.log(`[MockSPI] Transfer ${data.length} bytes`);
    return Buffer.alloc(data.length);
  }

  async close(): Promise<void> {}
}

class MockCamera implements CameraInterface {
  private streaming = false;
  private streamCallback?: (frame: Buffer) => void;
  private streamTimer?: ReturnType<typeof setInterval>;

  constructor(private resolution: [number, number], private fps: number) {}

  async open(): Promise<void> {
    console.log(`[MockCamera] Opened ${this.resolution[0]}x${this.resolution[1]} @ ${this.fps}fps`);
  }

  async close(): Promise<void> {
    await this.stopStream();
  }

  async capture(): Promise<Buffer> {
    // Return mock JPEG data
    return Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG magic bytes
  }

  async startStream(callback: (frame: Buffer) => void): Promise<void> {
    this.streaming = true;
    this.streamCallback = callback;
    this.streamTimer = setInterval(() => {
      if (this.streamCallback) {
        this.streamCallback(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]));
      }
    }, 1000 / this.fps);
  }

  async stopStream(): Promise<void> {
    this.streaming = false;
    if (this.streamTimer) {
      clearInterval(this.streamTimer);
      this.streamTimer = undefined;
    }
  }
}
