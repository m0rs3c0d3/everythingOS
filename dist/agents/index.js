"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Agent Registry Index
// Central export for all agents
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentFactory = exports.MedicationInventoryAgent = exports.ResourceAllocationAgent = exports.VitalsMonitoringAgent = exports.StaffSchedulingAgent = exports.PatientQueueAgent = exports.MetricsAggregatorAgent = exports.PerformanceTrackerAgent = exports.AlertingAgent = exports.HealthCheckAgent = exports.DashboardAgent = exports.VaRAgent = exports.DrawdownLimiterAgent = exports.CircuitBreakerAgent = exports.ProfitTakerAgent = exports.StopLossAgent = exports.PositionSizerAgent = exports.OrderExecutorAgent = exports.FearGreedIndexAgent = exports.SignalEnsembleAgent = exports.MovingAverageAgent = exports.BollingerBandAgent = exports.MACDAgent = exports.RSIAgent = exports.CorrelationAnalyzerAgent = exports.NewsAggregatorAgent = exports.SentimentAnalysisAgent = exports.AnomalyDetectorAgent = exports.VolatilityCalculatorAgent = exports.PriceTickerAgent = exports.ShutdownCoordinatorAgent = exports.DeadLetterHandlerAgent = exports.InterAgentBridgeAgent = exports.EventBusMonitorAgent = exports.AuditTrailAgent = exports.GarbageCollectorAgent = exports.SnapshotManagerAgent = exports.ConfigWatcherAgent = exports.EnvironmentSensorAgent = exports.ClockAgent = exports.BaseAgent = void 0;
// Base Agent
var BaseAgent_1 = require("./BaseAgent");
Object.defineProperty(exports, "BaseAgent", { enumerable: true, get: function () { return BaseAgent_1.BaseAgent; } });
// Foundation Agents
var foundation_1 = require("./foundation");
Object.defineProperty(exports, "ClockAgent", { enumerable: true, get: function () { return foundation_1.ClockAgent; } });
Object.defineProperty(exports, "EnvironmentSensorAgent", { enumerable: true, get: function () { return foundation_1.EnvironmentSensorAgent; } });
Object.defineProperty(exports, "ConfigWatcherAgent", { enumerable: true, get: function () { return foundation_1.ConfigWatcherAgent; } });
Object.defineProperty(exports, "SnapshotManagerAgent", { enumerable: true, get: function () { return foundation_1.SnapshotManagerAgent; } });
Object.defineProperty(exports, "GarbageCollectorAgent", { enumerable: true, get: function () { return foundation_1.GarbageCollectorAgent; } });
Object.defineProperty(exports, "AuditTrailAgent", { enumerable: true, get: function () { return foundation_1.AuditTrailAgent; } });
Object.defineProperty(exports, "EventBusMonitorAgent", { enumerable: true, get: function () { return foundation_1.EventBusMonitorAgent; } });
Object.defineProperty(exports, "InterAgentBridgeAgent", { enumerable: true, get: function () { return foundation_1.InterAgentBridgeAgent; } });
Object.defineProperty(exports, "DeadLetterHandlerAgent", { enumerable: true, get: function () { return foundation_1.DeadLetterHandlerAgent; } });
Object.defineProperty(exports, "ShutdownCoordinatorAgent", { enumerable: true, get: function () { return foundation_1.ShutdownCoordinatorAgent; } });
// Sensing Agents
var sensing_1 = require("./sensing");
Object.defineProperty(exports, "PriceTickerAgent", { enumerable: true, get: function () { return sensing_1.PriceTickerAgent; } });
Object.defineProperty(exports, "VolatilityCalculatorAgent", { enumerable: true, get: function () { return sensing_1.VolatilityCalculatorAgent; } });
Object.defineProperty(exports, "AnomalyDetectorAgent", { enumerable: true, get: function () { return sensing_1.AnomalyDetectorAgent; } });
Object.defineProperty(exports, "SentimentAnalysisAgent", { enumerable: true, get: function () { return sensing_1.SentimentAnalysisAgent; } });
Object.defineProperty(exports, "NewsAggregatorAgent", { enumerable: true, get: function () { return sensing_1.NewsAggregatorAgent; } });
Object.defineProperty(exports, "CorrelationAnalyzerAgent", { enumerable: true, get: function () { return sensing_1.CorrelationAnalyzerAgent; } });
// Decision Agents
var decision_1 = require("./decision");
Object.defineProperty(exports, "RSIAgent", { enumerable: true, get: function () { return decision_1.RSIAgent; } });
Object.defineProperty(exports, "MACDAgent", { enumerable: true, get: function () { return decision_1.MACDAgent; } });
Object.defineProperty(exports, "BollingerBandAgent", { enumerable: true, get: function () { return decision_1.BollingerBandAgent; } });
Object.defineProperty(exports, "MovingAverageAgent", { enumerable: true, get: function () { return decision_1.MovingAverageAgent; } });
Object.defineProperty(exports, "SignalEnsembleAgent", { enumerable: true, get: function () { return decision_1.SignalEnsembleAgent; } });
Object.defineProperty(exports, "FearGreedIndexAgent", { enumerable: true, get: function () { return decision_1.FearGreedIndexAgent; } });
// Execution Agents
var execution_1 = require("./execution");
Object.defineProperty(exports, "OrderExecutorAgent", { enumerable: true, get: function () { return execution_1.OrderExecutorAgent; } });
Object.defineProperty(exports, "PositionSizerAgent", { enumerable: true, get: function () { return execution_1.PositionSizerAgent; } });
Object.defineProperty(exports, "StopLossAgent", { enumerable: true, get: function () { return execution_1.StopLossAgent; } });
Object.defineProperty(exports, "ProfitTakerAgent", { enumerable: true, get: function () { return execution_1.ProfitTakerAgent; } });
Object.defineProperty(exports, "CircuitBreakerAgent", { enumerable: true, get: function () { return execution_1.CircuitBreakerAgent; } });
Object.defineProperty(exports, "DrawdownLimiterAgent", { enumerable: true, get: function () { return execution_1.DrawdownLimiterAgent; } });
Object.defineProperty(exports, "VaRAgent", { enumerable: true, get: function () { return execution_1.VaRAgent; } });
// Orchestration Agents
var orchestration_1 = require("./orchestration");
Object.defineProperty(exports, "DashboardAgent", { enumerable: true, get: function () { return orchestration_1.DashboardAgent; } });
Object.defineProperty(exports, "HealthCheckAgent", { enumerable: true, get: function () { return orchestration_1.HealthCheckAgent; } });
Object.defineProperty(exports, "AlertingAgent", { enumerable: true, get: function () { return orchestration_1.AlertingAgent; } });
Object.defineProperty(exports, "PerformanceTrackerAgent", { enumerable: true, get: function () { return orchestration_1.PerformanceTrackerAgent; } });
Object.defineProperty(exports, "MetricsAggregatorAgent", { enumerable: true, get: function () { return orchestration_1.MetricsAggregatorAgent; } });
// Healthcare Agents
var healthcare_1 = require("./specialized/healthcare");
Object.defineProperty(exports, "PatientQueueAgent", { enumerable: true, get: function () { return healthcare_1.PatientQueueAgent; } });
Object.defineProperty(exports, "StaffSchedulingAgent", { enumerable: true, get: function () { return healthcare_1.StaffSchedulingAgent; } });
Object.defineProperty(exports, "VitalsMonitoringAgent", { enumerable: true, get: function () { return healthcare_1.VitalsMonitoringAgent; } });
Object.defineProperty(exports, "ResourceAllocationAgent", { enumerable: true, get: function () { return healthcare_1.ResourceAllocationAgent; } });
Object.defineProperty(exports, "MedicationInventoryAgent", { enumerable: true, get: function () { return healthcare_1.MedicationInventoryAgent; } });
// ═══════════════════════════════════════════════════════════════════════════════
// Agent Factory - Create agents by name
// ═══════════════════════════════════════════════════════════════════════════════
const foundation_2 = require("./foundation");
const sensing_2 = require("./sensing");
const decision_2 = require("./decision");
const execution_2 = require("./execution");
const orchestration_2 = require("./orchestration");
const healthcare_2 = require("./specialized/healthcare");
exports.AgentFactory = {
    // Foundation
    clock: () => new foundation_2.ClockAgent(),
    environment_sensor: () => new foundation_2.EnvironmentSensorAgent(),
    config_watcher: () => new foundation_2.ConfigWatcherAgent(),
    snapshot_manager: () => new foundation_2.SnapshotManagerAgent(),
    garbage_collector: () => new foundation_2.GarbageCollectorAgent(),
    audit_trail: () => new foundation_2.AuditTrailAgent(),
    event_bus_monitor: () => new foundation_2.EventBusMonitorAgent(),
    inter_agent_bridge: () => new foundation_2.InterAgentBridgeAgent(),
    dead_letter_handler: () => new foundation_2.DeadLetterHandlerAgent(),
    shutdown_coordinator: () => new foundation_2.ShutdownCoordinatorAgent(),
    // Sensing
    price_ticker: () => new sensing_2.PriceTickerAgent(),
    volatility_calculator: () => new sensing_2.VolatilityCalculatorAgent(),
    anomaly_detector: () => new sensing_2.AnomalyDetectorAgent(),
    sentiment_analysis: () => new sensing_2.SentimentAnalysisAgent(),
    news_aggregator: () => new sensing_2.NewsAggregatorAgent(),
    correlation_analyzer: () => new sensing_2.CorrelationAnalyzerAgent(),
    // Decision
    rsi_agent: () => new decision_2.RSIAgent(),
    macd_agent: () => new decision_2.MACDAgent(),
    bollinger_band_agent: () => new decision_2.BollingerBandAgent(),
    moving_average_agent: () => new decision_2.MovingAverageAgent(),
    signal_ensemble: () => new decision_2.SignalEnsembleAgent(),
    fear_greed_index: () => new decision_2.FearGreedIndexAgent(),
    // Execution
    order_executor: () => new execution_2.OrderExecutorAgent(),
    position_sizer: () => new execution_2.PositionSizerAgent(),
    stop_loss_agent: () => new execution_2.StopLossAgent(),
    profit_taker: () => new execution_2.ProfitTakerAgent(),
    circuit_breaker: () => new execution_2.CircuitBreakerAgent(),
    drawdown_limiter: () => new execution_2.DrawdownLimiterAgent(),
    var_agent: () => new execution_2.VaRAgent(),
    // Orchestration
    dashboard: () => new orchestration_2.DashboardAgent(),
    health_check: () => new orchestration_2.HealthCheckAgent(),
    alerting: () => new orchestration_2.AlertingAgent(),
    performance_tracker: () => new orchestration_2.PerformanceTrackerAgent(),
    metrics_aggregator: () => new orchestration_2.MetricsAggregatorAgent(),
    // Healthcare
    patient_queue: () => new healthcare_2.PatientQueueAgent(),
    staff_scheduling: () => new healthcare_2.StaffSchedulingAgent(),
    vitals_monitoring: () => new healthcare_2.VitalsMonitoringAgent(),
    resource_allocation: () => new healthcare_2.ResourceAllocationAgent(),
    medication_inventory: () => new healthcare_2.MedicationInventoryAgent(),
};
//# sourceMappingURL=index.js.map