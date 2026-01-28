// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Temperature Sensor
// I2C-based temperature sensors (BME280, BMP280, TMP102, etc.)
// ═══════════════════════════════════════════════════════════════════════════════

import { SensorPlugin, SensorConfig } from '../_base/SensorPlugin';
import { I2CProtocol } from '../../protocols/I2CProtocol';

// ─────────────────────────────────────────────────────────────────────────────
// Temperature Sensor Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface TemperatureSensorConfig extends Omit<SensorConfig, 'sensorType' | 'protocol'> {
  sensorType: 'temperature';
  protocol: 'i2c';
  
  // I2C settings
  bus: number;
  address: number;
  
  // Chip type (determines register map)
  chip: 'bme280' | 'bmp280' | 'tmp102' | 'lm75' | 'generic';
  
  // Output
  unit?: 'celsius' | 'fahrenheit' | 'kelvin';
}

export interface TemperatureReading {
  temperature: number;
  unit: string;
  humidity?: number;      // If sensor supports it (BME280)
  pressure?: number;      // If sensor supports it (BME280/BMP280)
}

// ─────────────────────────────────────────────────────────────────────────────
// Chip Register Maps
// ─────────────────────────────────────────────────────────────────────────────

const CHIP_REGISTERS = {
  bme280: {
    chipId: 0xD0,
    chipIdValue: 0x60,
    ctrl_meas: 0xF4,
    ctrl_hum: 0xF2,
    config: 0xF5,
    temp_msb: 0xFA,
    temp_lsb: 0xFB,
    temp_xlsb: 0xFC,
    press_msb: 0xF7,
    hum_msb: 0xFD,
    calib00: 0x88,
    calib26: 0xE1,
  },
  bmp280: {
    chipId: 0xD0,
    chipIdValue: 0x58,
    ctrl_meas: 0xF4,
    config: 0xF5,
    temp_msb: 0xFA,
    temp_lsb: 0xFB,
    temp_xlsb: 0xFC,
    press_msb: 0xF7,
    calib00: 0x88,
  },
  tmp102: {
    temp: 0x00,
    config: 0x01,
    tlow: 0x02,
    thigh: 0x03,
  },
  lm75: {
    temp: 0x00,
    config: 0x01,
    thyst: 0x02,
    tos: 0x03,
  },
  generic: {
    temp: 0x00,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Temperature Sensor Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class TemperatureSensor extends SensorPlugin<TemperatureReading> {
  private i2c: I2CProtocol;
  private tempConfig: TemperatureSensorConfig;
  private calibrationData?: BME280Calibration;

  constructor(config: Omit<TemperatureSensorConfig, 'type' | 'sensorType' | 'protocol'> & { 
    type?: 'sensor';
    sensorType?: 'temperature';
    protocol?: 'i2c';
  }) {
    const fullConfig: TemperatureSensorConfig = {
      ...config,
      type: 'sensor',
      sensorType: 'temperature',
      protocol: 'i2c',
      unit: config.unit ?? 'celsius',
      pollRate: config.pollRate ?? 1000,
      connection: {
        bus: config.bus,
        address: config.address,
      },
    };

    super(fullConfig);
    this.tempConfig = fullConfig;

    this.i2c = new I2CProtocol({
      id: `${config.id}-i2c`,
      type: 'i2c',
      connection: {
        bus: config.bus,
        address: config.address,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SensorPlugin Implementation
  // ─────────────────────────────────────────────────────────────────────────

  protected async connect(): Promise<void> {
    await this.i2c.connect();
    
    // Verify chip ID
    const registers = CHIP_REGISTERS[this.tempConfig.chip];
    if ('chipId' in registers && 'chipIdValue' in registers) {
      const chipId = await this.i2c.readByte(registers.chipId);
      if (chipId !== registers.chipIdValue) {
        this.log('warn', `Unexpected chip ID: 0x${chipId.toString(16)} (expected 0x${registers.chipIdValue.toString(16)})`);
      }
    }

    // Initialize sensor
    await this.initializeSensor();
  }

  protected async disconnect(): Promise<void> {
    await this.i2c.disconnect();
  }

  protected async readRaw(): Promise<TemperatureReading> {
    switch (this.tempConfig.chip) {
      case 'bme280':
        return this.readBME280();
      case 'bmp280':
        return this.readBMP280();
      case 'tmp102':
        return this.readTMP102();
      case 'lm75':
        return this.readLM75();
      default:
        return this.readGeneric();
    }
  }

  protected applyCalibration(data: TemperatureReading): TemperatureReading {
    // Convert units if needed
    let temp = data.temperature;
    
    if (this.tempConfig.unit === 'fahrenheit') {
      temp = temp * 9/5 + 32;
    } else if (this.tempConfig.unit === 'kelvin') {
      temp = temp + 273.15;
    }

    return {
      ...data,
      temperature: Math.round(temp * 100) / 100,
      unit: this.tempConfig.unit ?? 'celsius',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sensor Initialization
  // ─────────────────────────────────────────────────────────────────────────

  private async initializeSensor(): Promise<void> {
    switch (this.tempConfig.chip) {
      case 'bme280':
        await this.initBME280();
        break;
      case 'bmp280':
        await this.initBMP280();
        break;
      case 'tmp102':
        await this.initTMP102();
        break;
      // LM75 and generic don't need special init
    }
  }

  private async initBME280(): Promise<void> {
    const reg = CHIP_REGISTERS.bme280;
    
    // Read calibration data
    this.calibrationData = await this.readBME280Calibration();
    
    // Set humidity oversampling (must be set before ctrl_meas)
    await this.i2c.writeByte(reg.ctrl_hum, 0x01); // 1x oversampling
    
    // Set temperature and pressure oversampling, normal mode
    // Bits 7-5: temp oversampling (001 = 1x)
    // Bits 4-2: pressure oversampling (001 = 1x)
    // Bits 1-0: mode (11 = normal)
    await this.i2c.writeByte(reg.ctrl_meas, 0x27);
    
    // Set config (standby time, filter)
    await this.i2c.writeByte(reg.config, 0x00);
    
    this.log('info', 'BME280 initialized');
  }

  private async initBMP280(): Promise<void> {
    const reg = CHIP_REGISTERS.bmp280;
    
    // Set temperature and pressure oversampling, normal mode
    await this.i2c.writeByte(reg.ctrl_meas, 0x27);
    await this.i2c.writeByte(reg.config, 0x00);
    
    this.log('info', 'BMP280 initialized');
  }

  private async initTMP102(): Promise<void> {
    const reg = CHIP_REGISTERS.tmp102;
    
    // Set 12-bit resolution, continuous conversion
    await this.i2c.writeWord(reg.config, 0x60A0);
    
    this.log('info', 'TMP102 initialized');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Chip-Specific Read Methods
  // ─────────────────────────────────────────────────────────────────────────

  private async readBME280(): Promise<TemperatureReading> {
    const reg = CHIP_REGISTERS.bme280;
    
    // Read all data registers at once (more efficient)
    const data = await this.i2c.readBlock(reg.press_msb, 8);
    
    // Parse raw values (20-bit ADC values)
    const adc_P = (data[0] << 12) | (data[1] << 4) | (data[2] >> 4);
    const adc_T = (data[3] << 12) | (data[4] << 4) | (data[5] >> 4);
    const adc_H = (data[6] << 8) | data[7];
    
    // Apply compensation formulas (simplified)
    // In production, use full Bosch compensation algorithms
    const temperature = this.compensateTemperatureBME280(adc_T);
    const pressure = this.compensatePressureBME280(adc_P);
    const humidity = this.compensateHumidityBME280(adc_H);

    return {
      temperature,
      unit: 'celsius',
      humidity,
      pressure,
    };
  }

  private async readBMP280(): Promise<TemperatureReading> {
    const reg = CHIP_REGISTERS.bmp280;
    
    const data = await this.i2c.readBlock(reg.press_msb, 6);
    
    const adc_P = (data[0] << 12) | (data[1] << 4) | (data[2] >> 4);
    const adc_T = (data[3] << 12) | (data[4] << 4) | (data[5] >> 4);
    
    // Simplified compensation (use full Bosch formulas in production)
    const temperature = (adc_T / 16384.0 - 0.5) * 100;
    const pressure = adc_P / 256.0;

    return {
      temperature,
      unit: 'celsius',
      pressure,
    };
  }

  private async readTMP102(): Promise<TemperatureReading> {
    const reg = CHIP_REGISTERS.tmp102;
    
    const raw = await this.i2c.readWord(reg.temp);
    
    // TMP102 returns 12-bit value, MSB first
    // Shift right by 4 to get 12-bit value, then multiply by 0.0625
    const temperature = ((raw >> 4) * 0.0625);

    return {
      temperature,
      unit: 'celsius',
    };
  }

  private async readLM75(): Promise<TemperatureReading> {
    const reg = CHIP_REGISTERS.lm75;
    
    const raw = await this.i2c.readWord(reg.temp);
    
    // LM75 returns 9-bit value in upper bits
    const temperature = ((raw >> 7) * 0.5);

    return {
      temperature,
      unit: 'celsius',
    };
  }

  private async readGeneric(): Promise<TemperatureReading> {
    // Generic sensor: assume single byte temperature register
    const raw = await this.i2c.readByte(CHIP_REGISTERS.generic.temp);
    
    return {
      temperature: raw,
      unit: 'celsius',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BME280 Compensation (Simplified)
  // ─────────────────────────────────────────────────────────────────────────

  private async readBME280Calibration(): Promise<BME280Calibration> {
    // Read calibration registers (simplified - real implementation reads all)
    return {
      dig_T1: 27504,
      dig_T2: 26435,
      dig_T3: -1000,
      dig_P1: 36477,
      dig_H1: 75,
      t_fine: 0,
    };
  }

  private compensateTemperatureBME280(adc_T: number): number {
    // Simplified Bosch formula
    if (!this.calibrationData) return adc_T / 5120.0;
    
    const var1 = (adc_T / 16384.0 - this.calibrationData.dig_T1 / 1024.0) * this.calibrationData.dig_T2;
    const var2 = ((adc_T / 131072.0 - this.calibrationData.dig_T1 / 8192.0) ** 2) * this.calibrationData.dig_T3;
    this.calibrationData.t_fine = var1 + var2;
    
    return this.calibrationData.t_fine / 5120.0;
  }

  private compensatePressureBME280(adc_P: number): number {
    // Simplified - returns hPa
    return adc_P / 256.0;
  }

  private compensateHumidityBME280(adc_H: number): number {
    // Simplified - returns %RH
    return Math.min(100, Math.max(0, adc_H / 1024.0 * 100));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface BME280Calibration {
  dig_T1: number;
  dig_T2: number;
  dig_T3: number;
  dig_P1: number;
  dig_H1: number;
  t_fine: number;
}
