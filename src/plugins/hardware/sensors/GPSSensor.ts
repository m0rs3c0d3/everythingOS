// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - GPS Sensor
// GPS/GNSS location sensor via Serial (NMEA protocol)
// Supports: NEO-6M, NEO-7M, NEO-M8N, BN-220, and other NMEA-compatible modules
// ═══════════════════════════════════════════════════════════════════════════════

import { SensorPlugin, SensorConfig } from '../_base/SensorPlugin';
import { SerialProtocol } from '../../protocols/SerialProtocol';
import { PositionData } from '../_base/HardwareTypes';

// ─────────────────────────────────────────────────────────────────────────────
// GPS Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface GPSSensorConfig extends Omit<SensorConfig, 'sensorType' | 'protocol'> {
  sensorType: 'gps';
  protocol: 'serial';
  
  // Serial settings
  port: string;
  baudRate?: number;
  
  // GPS options
  minSatellites?: number;      // Minimum satellites for valid fix
  maxAge?: number;             // Max age of fix in ms before considered stale
}

export interface GPSReading {
  // Position
  latitude: number;            // Decimal degrees
  longitude: number;           // Decimal degrees
  altitude?: number;           // Meters above sea level
  
  // Accuracy
  horizontalAccuracy?: number; // Meters
  verticalAccuracy?: number;   // Meters
  hdop?: number;               // Horizontal dilution of precision
  
  // Movement
  speed?: number;              // m/s
  course?: number;             // Degrees from north
  
  // Fix info
  fixType: 'none' | '2d' | '3d' | 'dgps';
  satellites: number;
  
  // Time
  utcTime?: string;            // HH:MM:SS.sss
  utcDate?: string;            // DD/MM/YY
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// NMEA Sentence Types
// ─────────────────────────────────────────────────────────────────────────────

interface NMEAData {
  // From GGA (Fix data)
  latitude?: number;
  longitude?: number;
  altitude?: number;
  fixQuality?: number;
  satellites?: number;
  hdop?: number;
  utcTime?: string;
  
  // From RMC (Recommended minimum)
  speed?: number;              // Knots
  course?: number;             // Degrees
  utcDate?: string;
  valid?: boolean;
  
  // From GSA (DOP and active satellites)
  fixType?: number;            // 1=none, 2=2D, 3=3D
  pdop?: number;
  vdop?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// GPS Sensor Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class GPSSensor extends SensorPlugin<GPSReading> {
  private serial: SerialProtocol;
  private gpsConfig: GPSSensorConfig;
  
  // Current NMEA data (accumulated from multiple sentences)
  private nmeaData: NMEAData = {};
  private lastValidFix?: GPSReading;

  constructor(config: Omit<GPSSensorConfig, 'type' | 'sensorType' | 'protocol'> & {
    type?: 'sensor';
    sensorType?: 'gps';
    protocol?: 'serial';
  }) {
    const fullConfig: GPSSensorConfig = {
      ...config,
      type: 'sensor',
      sensorType: 'gps',
      protocol: 'serial',
      baudRate: config.baudRate ?? 9600,
      minSatellites: config.minSatellites ?? 4,
      maxAge: config.maxAge ?? 5000,
      pollRate: config.pollRate ?? 1000,
      connection: {
        port: config.port,
        baudRate: config.baudRate ?? 9600,
      },
    };

    super(fullConfig);
    this.gpsConfig = fullConfig;

    this.serial = new SerialProtocol({
      id: `${config.id}-serial`,
      type: 'serial',
      connection: {
        port: config.port,
        baudRate: config.baudRate ?? 9600,
      },
      parser: 'readline',
      lineEnding: '\r\n',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SensorPlugin Implementation
  // ─────────────────────────────────────────────────────────────────────────

  protected async connect(): Promise<void> {
    await this.serial.connect();
    
    // Set up NMEA sentence handler
    this.serial.onMessage((message) => {
      const line = message.data.toString().trim();
      if (line.startsWith('$')) {
        this.parseNMEA(line);
      }
    });
    
    this.log('info', `GPS connected on ${this.gpsConfig.port}`);
  }

  protected async disconnect(): Promise<void> {
    await this.serial.disconnect();
  }

  protected async readRaw(): Promise<GPSReading> {
    // GPS data comes asynchronously via NMEA sentences
    // This method returns the current accumulated state
    
    const fixType = this.getFixType();
    const satellites = this.nmeaData.satellites ?? 0;
    
    const reading: GPSReading = {
      latitude: this.nmeaData.latitude ?? 0,
      longitude: this.nmeaData.longitude ?? 0,
      altitude: this.nmeaData.altitude,
      hdop: this.nmeaData.hdop,
      speed: this.nmeaData.speed ? this.nmeaData.speed * 0.514444 : undefined, // Knots to m/s
      course: this.nmeaData.course,
      fixType,
      satellites,
      utcTime: this.nmeaData.utcTime,
      utcDate: this.nmeaData.utcDate,
      timestamp: Date.now(),
    };

    // Cache valid fix
    if (fixType !== 'none' && satellites >= (this.gpsConfig.minSatellites ?? 4)) {
      this.lastValidFix = reading;
    }

    return reading;
  }

  protected validateReading(data: GPSReading): boolean {
    // Consider valid if we have coordinates and minimum satellites
    return data.latitude !== 0 && 
           data.longitude !== 0 && 
           data.satellites >= (this.gpsConfig.minSatellites ?? 4);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NMEA Parsing
  // ─────────────────────────────────────────────────────────────────────────

  private parseNMEA(sentence: string): void {
    // Verify checksum
    if (!this.verifyChecksum(sentence)) {
      this.log('debug', `Invalid checksum: ${sentence}`);
      return;
    }

    // Remove checksum for parsing
    const data = sentence.split('*')[0];
    const parts = data.split(',');
    const type = parts[0];

    switch (type) {
      case '$GPGGA':
      case '$GNGGA':
        this.parseGGA(parts);
        break;
      case '$GPRMC':
      case '$GNRMC':
        this.parseRMC(parts);
        break;
      case '$GPGSA':
      case '$GNGSA':
        this.parseGSA(parts);
        break;
      case '$GPVTG':
      case '$GNVTG':
        this.parseVTG(parts);
        break;
    }
  }

  private parseGGA(parts: string[]): void {
    // $GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,47.0,M,,*47
    
    if (parts.length < 15) return;

    this.nmeaData.utcTime = this.parseTime(parts[1]);
    this.nmeaData.latitude = this.parseCoordinate(parts[2], parts[3]);
    this.nmeaData.longitude = this.parseCoordinate(parts[4], parts[5]);
    this.nmeaData.fixQuality = parseInt(parts[6]) || 0;
    this.nmeaData.satellites = parseInt(parts[7]) || 0;
    this.nmeaData.hdop = parseFloat(parts[8]) || undefined;
    this.nmeaData.altitude = parseFloat(parts[9]) || undefined;
  }

  private parseRMC(parts: string[]): void {
    // $GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A
    
    if (parts.length < 12) return;

    this.nmeaData.utcTime = this.parseTime(parts[1]);
    this.nmeaData.valid = parts[2] === 'A';
    this.nmeaData.latitude = this.parseCoordinate(parts[3], parts[4]);
    this.nmeaData.longitude = this.parseCoordinate(parts[5], parts[6]);
    this.nmeaData.speed = parseFloat(parts[7]) || undefined;
    this.nmeaData.course = parseFloat(parts[8]) || undefined;
    this.nmeaData.utcDate = this.parseDate(parts[9]);
  }

  private parseGSA(parts: string[]): void {
    // $GPGSA,A,3,04,05,,09,12,,,24,,,,,2.5,1.3,2.1*39
    
    if (parts.length < 18) return;

    this.nmeaData.fixType = parseInt(parts[2]) || 1;
    this.nmeaData.pdop = parseFloat(parts[15]) || undefined;
    this.nmeaData.hdop = parseFloat(parts[16]) || undefined;
    this.nmeaData.vdop = parseFloat(parts[17]?.split('*')[0]) || undefined;
  }

  private parseVTG(parts: string[]): void {
    // $GPVTG,054.7,T,034.4,M,005.5,N,010.2,K*48
    
    if (parts.length < 9) return;

    this.nmeaData.course = parseFloat(parts[1]) || undefined;
    
    // Speed in km/h (convert to knots for consistency)
    const speedKmh = parseFloat(parts[7]) || 0;
    this.nmeaData.speed = speedKmh / 1.852; // km/h to knots
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private parseCoordinate(value: string, direction: string): number {
    if (!value || !direction) return 0;

    // NMEA format: DDDMM.MMMM or DDMM.MMMM
    const isLongitude = value.length > 9;
    const degreeDigits = isLongitude ? 3 : 2;
    
    const degrees = parseInt(value.substring(0, degreeDigits));
    const minutes = parseFloat(value.substring(degreeDigits));
    
    let decimal = degrees + minutes / 60;
    
    if (direction === 'S' || direction === 'W') {
      decimal = -decimal;
    }

    return Math.round(decimal * 1000000) / 1000000; // 6 decimal places
  }

  private parseTime(value: string): string | undefined {
    if (!value || value.length < 6) return undefined;
    
    const hours = value.substring(0, 2);
    const minutes = value.substring(2, 4);
    const seconds = value.substring(4);
    
    return `${hours}:${minutes}:${seconds}`;
  }

  private parseDate(value: string): string | undefined {
    if (!value || value.length < 6) return undefined;
    
    const day = value.substring(0, 2);
    const month = value.substring(2, 4);
    const year = value.substring(4, 6);
    
    return `${day}/${month}/${year}`;
  }

  private verifyChecksum(sentence: string): boolean {
    const asteriskIndex = sentence.indexOf('*');
    if (asteriskIndex === -1) return false;

    const data = sentence.substring(1, asteriskIndex);
    const providedChecksum = sentence.substring(asteriskIndex + 1).trim();

    let calculated = 0;
    for (let i = 0; i < data.length; i++) {
      calculated ^= data.charCodeAt(i);
    }

    const calculatedHex = calculated.toString(16).toUpperCase().padStart(2, '0');
    return calculatedHex === providedChecksum.toUpperCase();
  }

  private getFixType(): GPSReading['fixType'] {
    if (!this.nmeaData.valid && this.nmeaData.fixQuality === 0) {
      return 'none';
    }
    
    if (this.nmeaData.fixQuality === 2) {
      return 'dgps';
    }
    
    if (this.nmeaData.fixType === 3) {
      return '3d';
    }
    
    if (this.nmeaData.fixType === 2) {
      return '2d';
    }
    
    return this.nmeaData.fixQuality && this.nmeaData.fixQuality > 0 ? '2d' : 'none';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API Extensions
  // ─────────────────────────────────────────────────────────────────────────

  getLastValidFix(): GPSReading | undefined {
    return this.lastValidFix;
  }

  hasFix(): boolean {
    return this.nmeaData.fixQuality !== undefined && this.nmeaData.fixQuality > 0;
  }

  getSatelliteCount(): number {
    return this.nmeaData.satellites ?? 0;
  }

  /**
   * Calculate distance to a point in meters using Haversine formula
   */
  distanceTo(lat: number, lon: number): number | null {
    if (!this.nmeaData.latitude || !this.nmeaData.longitude) return null;

    const R = 6371000; // Earth radius in meters
    const φ1 = this.nmeaData.latitude * Math.PI / 180;
    const φ2 = lat * Math.PI / 180;
    const Δφ = (lat - this.nmeaData.latitude) * Math.PI / 180;
    const Δλ = (lon - this.nmeaData.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Calculate bearing to a point in degrees
   */
  bearingTo(lat: number, lon: number): number | null {
    if (!this.nmeaData.latitude || !this.nmeaData.longitude) return null;

    const φ1 = this.nmeaData.latitude * Math.PI / 180;
    const φ2 = lat * Math.PI / 180;
    const λ1 = this.nmeaData.longitude * Math.PI / 180;
    const λ2 = lon * Math.PI / 180;

    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    
    const θ = Math.atan2(y, x);
    const bearing = (θ * 180 / Math.PI + 360) % 360;

    return Math.round(bearing * 10) / 10;
  }
}
