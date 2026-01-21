// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Core Type Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export type AgentTier = 'foundation' | 'sensing' | 'decision' | 'execution' | 'learning' | 'orchestration' | 'specialized';

export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'stopped';

export type EventPriority = 'critical' | 'high' | 'normal' | 'low';

export interface AgentConfig {
  id: string;
  name: string;
  tier: AgentTier;
  description: string;
  version: string;
  dependencies?: string[];
  settings?: Record<string, unknown>;
  enabled?: boolean;
}

export interface AgentState {
  status: AgentStatus;
  lastTick: number;
  tickCount: number;
  errors: AgentError[];
  metrics: AgentMetrics;
  memory: Map<string, unknown>;
}

export interface AgentError {
  timestamp: number;
  message: string;
  stack?: string;
  recoverable: boolean;
}

export interface AgentMetrics {
  eventsProcessed: number;
  eventsEmitted: number;
  avgProcessingTime: number;
  lastProcessingTime: number;
  uptime: number;
  memoryUsage: number;
}

export interface SystemEvent<T = unknown> {
  id: string;
  type: string;
  source: string;
  target?: string | string[];
  payload: T;
  timestamp: number;
  priority: EventPriority;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface WorldState {
  timestamp: number;
  tick: number;
  agents: Map<string, AgentState>;
  globals: Map<string, unknown>;
  snapshots: WorldSnapshot[];
}

export interface WorldSnapshot {
  tick: number;
  timestamp: number;
  state: Record<string, unknown>;
  checksum: string;
}

export interface AgentMessage<T = unknown> {
  from: string;
  to: string;
  type: string;
  payload: T;
  timestamp: number;
  replyTo?: string;
}

export interface SignalData {
  symbol: string;
  direction: 'long' | 'short' | 'neutral';
  strength: number; // 0-1
  confidence: number; // 0-1
  timeframe: string;
  expiry?: number;
  metadata?: Record<string, unknown>;
}

export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  change24h: number;
  timestamp: number;
}

export interface OHLCV {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  leverage: number;
  pnl: number;
  pnlPercent: number;
  openedAt: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: 'pending' | 'open' | 'filled' | 'cancelled' | 'rejected';
  filledQuantity: number;
  avgFillPrice?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Alert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  source: string;
  timestamp: number;
  acknowledged: boolean;
  data?: Record<string, unknown>;
}

export interface HealthCheck {
  agentId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  lastCheck: number;
  details?: Record<string, unknown>;
}

export interface PerformanceMetrics {
  period: string;
  returns: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgWin: number;
  avgLoss: number;
}

// Healthcare specific types
export interface Patient {
  id: string;
  name: string;
  priority: 'critical' | 'urgent' | 'standard' | 'routine';
  department: string;
  admittedAt: number;
  status: string;
  vitals?: VitalSigns;
}

export interface VitalSigns {
  heartRate: number;
  bloodPressure: { systolic: number; diastolic: number };
  temperature: number;
  oxygenSaturation: number;
  respiratoryRate: number;
  timestamp: number;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  shift: string;
  available: boolean;
}

// Logistics specific types
export interface Shipment {
  id: string;
  origin: Location;
  destination: Location;
  status: 'pending' | 'in_transit' | 'delivered' | 'delayed';
  estimatedArrival: number;
  actualArrival?: number;
  carrier: string;
  tracking: TrackingEvent[];
}

export interface Location {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

export interface TrackingEvent {
  timestamp: number;
  location: Location;
  status: string;
  description: string;
}

// E-commerce specific types
export interface Product {
  id: string;
  name: string;
  price: number;
  inventory: number;
  category: string;
  rating: number;
  reviews: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
}

// Manufacturing specific types
export interface Machine {
  id: string;
  name: string;
  status: 'running' | 'idle' | 'maintenance' | 'error';
  efficiency: number;
  output: number;
  lastMaintenance: number;
  nextMaintenance: number;
}

export interface ProductionOrder {
  id: string;
  product: string;
  quantity: number;
  completed: number;
  startedAt: number;
  estimatedCompletion: number;
  status: 'queued' | 'in_progress' | 'completed' | 'paused';
}
