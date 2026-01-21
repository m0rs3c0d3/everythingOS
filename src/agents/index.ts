// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Agent Registry Index
// Central export for all agents
// ═══════════════════════════════════════════════════════════════════════════════

// Base Agent
export { BaseAgent } from './BaseAgent';

// Foundation Agents
export {
  ClockAgent,
  EnvironmentSensorAgent,
  ConfigWatcherAgent,
  SnapshotManagerAgent,
  GarbageCollectorAgent,
  AuditTrailAgent,
  EventBusMonitorAgent,
  InterAgentBridgeAgent,
  DeadLetterHandlerAgent,
  ShutdownCoordinatorAgent,
} from './foundation';

// Sensing Agents
export {
  PriceTickerAgent,
  VolatilityCalculatorAgent,
  AnomalyDetectorAgent,
  SentimentAnalysisAgent,
  NewsAggregatorAgent,
  CorrelationAnalyzerAgent,
} from './sensing';

// Decision Agents
export {
  RSIAgent,
  MACDAgent,
  BollingerBandAgent,
  MovingAverageAgent,
  SignalEnsembleAgent,
  FearGreedIndexAgent,
} from './decision';

// Execution Agents
export {
  OrderExecutorAgent,
  PositionSizerAgent,
  StopLossAgent,
  ProfitTakerAgent,
  CircuitBreakerAgent,
  DrawdownLimiterAgent,
  VaRAgent,
} from './execution';

// Orchestration Agents
export {
  DashboardAgent,
  HealthCheckAgent,
  AlertingAgent,
  PerformanceTrackerAgent,
  MetricsAggregatorAgent,
} from './orchestration';

// Healthcare Agents
export {
  PatientQueueAgent,
  StaffSchedulingAgent,
  VitalsMonitoringAgent,
  ResourceAllocationAgent,
  MedicationInventoryAgent,
} from './specialized/healthcare';

// ═══════════════════════════════════════════════════════════════════════════════
// Agent Factory - Create agents by name
// ═══════════════════════════════════════════════════════════════════════════════

import { ClockAgent, EnvironmentSensorAgent, ConfigWatcherAgent, SnapshotManagerAgent, GarbageCollectorAgent, AuditTrailAgent, EventBusMonitorAgent, InterAgentBridgeAgent, DeadLetterHandlerAgent, ShutdownCoordinatorAgent } from './foundation';
import { PriceTickerAgent, VolatilityCalculatorAgent, AnomalyDetectorAgent, SentimentAnalysisAgent, NewsAggregatorAgent, CorrelationAnalyzerAgent } from './sensing';
import { RSIAgent, MACDAgent, BollingerBandAgent, MovingAverageAgent, SignalEnsembleAgent, FearGreedIndexAgent } from './decision';
import { OrderExecutorAgent, PositionSizerAgent, StopLossAgent, ProfitTakerAgent, CircuitBreakerAgent, DrawdownLimiterAgent, VaRAgent } from './execution';
import { DashboardAgent, HealthCheckAgent, AlertingAgent, PerformanceTrackerAgent, MetricsAggregatorAgent } from './orchestration';
import { PatientQueueAgent, StaffSchedulingAgent, VitalsMonitoringAgent, ResourceAllocationAgent, MedicationInventoryAgent } from './specialized/healthcare';

export const AgentFactory = {
  // Foundation
  clock: () => new ClockAgent(),
  environment_sensor: () => new EnvironmentSensorAgent(),
  config_watcher: () => new ConfigWatcherAgent(),
  snapshot_manager: () => new SnapshotManagerAgent(),
  garbage_collector: () => new GarbageCollectorAgent(),
  audit_trail: () => new AuditTrailAgent(),
  event_bus_monitor: () => new EventBusMonitorAgent(),
  inter_agent_bridge: () => new InterAgentBridgeAgent(),
  dead_letter_handler: () => new DeadLetterHandlerAgent(),
  shutdown_coordinator: () => new ShutdownCoordinatorAgent(),
  
  // Sensing
  price_ticker: () => new PriceTickerAgent(),
  volatility_calculator: () => new VolatilityCalculatorAgent(),
  anomaly_detector: () => new AnomalyDetectorAgent(),
  sentiment_analysis: () => new SentimentAnalysisAgent(),
  news_aggregator: () => new NewsAggregatorAgent(),
  correlation_analyzer: () => new CorrelationAnalyzerAgent(),
  
  // Decision
  rsi_agent: () => new RSIAgent(),
  macd_agent: () => new MACDAgent(),
  bollinger_band_agent: () => new BollingerBandAgent(),
  moving_average_agent: () => new MovingAverageAgent(),
  signal_ensemble: () => new SignalEnsembleAgent(),
  fear_greed_index: () => new FearGreedIndexAgent(),
  
  // Execution
  order_executor: () => new OrderExecutorAgent(),
  position_sizer: () => new PositionSizerAgent(),
  stop_loss_agent: () => new StopLossAgent(),
  profit_taker: () => new ProfitTakerAgent(),
  circuit_breaker: () => new CircuitBreakerAgent(),
  drawdown_limiter: () => new DrawdownLimiterAgent(),
  var_agent: () => new VaRAgent(),
  
  // Orchestration
  dashboard: () => new DashboardAgent(),
  health_check: () => new HealthCheckAgent(),
  alerting: () => new AlertingAgent(),
  performance_tracker: () => new PerformanceTrackerAgent(),
  metrics_aggregator: () => new MetricsAggregatorAgent(),
  
  // Healthcare
  patient_queue: () => new PatientQueueAgent(),
  staff_scheduling: () => new StaffSchedulingAgent(),
  vitals_monitoring: () => new VitalsMonitoringAgent(),
  resource_allocation: () => new ResourceAllocationAgent(),
  medication_inventory: () => new MedicationInventoryAgent(),
};

export type AgentName = keyof typeof AgentFactory;
