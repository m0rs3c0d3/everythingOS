# EverythingOS

```
███████╗██╗   ██╗███████╗██████╗ ██╗   ██╗████████╗██╗  ██╗██╗███╗   ██╗ ██████╗ 
██╔════╝██║   ██║██╔════╝██╔══██╗╚██╗ ██╔╝╚══██╔══╝██║  ██║██║████╗  ██║██╔════╝ 
█████╗  ██║   ██║█████╗  ██████╔╝ ╚████╔╝    ██║   ███████║██║██╔██╗ ██║██║  ███╗
██╔══╝  ╚██╗ ██╔╝██╔══╝  ██╔══██╗  ╚██╔╝     ██║   ██╔══██║██║██║╚██╗██║██║   ██║
███████╗ ╚████╔╝ ███████╗██║  ██║   ██║      ██║   ██║  ██║██║██║ ╚████║╚██████╔╝
╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝ 
                         ██████╗ ███████╗
                        ██╔═══██╗██╔════╝
                        ██║   ██║███████╗
                        ██║   ██║╚════██║
                        ╚██████╔╝███████║
                         ╚═════╝ ╚══════╝
```

## What is EverythingOS?

**EverythingOS** is a TypeScript framework for building autonomous multi-agent systems. Think of it as an operating system where instead of processes, you have **intelligent agents** that sense, decide, execute, and learn—all communicating through a central event bus.

Whether you're building trading bots, healthcare monitoring systems, IoT platforms, or any complex event-driven application, EverythingOS provides the infrastructure to orchestrate dozens (or hundreds) of specialized agents working together autonomously.

### Why Agents?

Traditional software is reactive—it waits for input and responds. Agent-based systems are **proactive**:

- **Autonomous**: Agents run continuously, making decisions without human intervention
- **Specialized**: Each agent has a single responsibility and does it well
- **Collaborative**: Agents communicate through events, forming emergent behaviors
- **Resilient**: If one agent fails, others continue operating
- **Scalable**: Add new agents without modifying existing ones

---

## Quick Start

```bash
npm install
npm run build
npm run demo
```

```typescript
import { createEverythingOS } from 'everything-os';

const os = await createEverythingOS({
  presets: ['trading'],  // Load trading agents
  autoStart: true
});

// React to agent signals
os.on('signal:consensus', (signal) => {
  console.log(`${signal.symbol}: ${signal.direction} (${signal.confidence * 100}% confidence)`);
});
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EVERYTHING OS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌────────────┐  │
│   │   EVENT BUS   │  │  WORLD STATE  │  │   REGISTRY    │  │  METRICS   │  │
│   │               │  │               │  │               │  │            │  │
│   │ • Pub/Sub     │  │ • Global State│  │ • Agent CRUD  │  │ • Counters │  │
│   │ • Priority Q  │  │ • Snapshots   │  │ • Dependencies│  │ • Gauges   │  │
│   │ • Dead Letter │  │ • Recovery    │  │ • Lifecycle   │  │ • Histos   │  │
│   └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └─────┬──────┘  │
│           │                  │                  │                │         │
│   ════════╪══════════════════╪══════════════════╪════════════════╪═══════  │
│           │                  │                  │                │         │
│   ┌───────┴──────────────────┴──────────────────┴────────────────┴───────┐ │
│   │                                                                      │ │
│   │                         A G E N T   T I E R S                        │ │
│   │                                                                      │ │
│   │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐          │ │
│   │  │FOUNDATION│ → │ SENSING  │ → │ DECISION │ → │EXECUTION │          │ │
│   │  │          │   │          │   │          │   │          │          │ │
│   │  │ Clock    │   │ Prices   │   │ RSI      │   │ Orders   │          │ │
│   │  │ Config   │   │ News     │   │ MACD     │   │ Stops    │          │ │
│   │  │ Snapshots│   │ Sentiment│   │ Signals  │   │ Risk     │          │ │
│   │  └──────────┘   └──────────┘   └──────────┘   └──────────┘          │ │
│   │        │                              │              │               │ │
│   │        │         ┌──────────┐         │              │               │ │
│   │        └────────→│ LEARNING │←────────┴──────────────┘               │ │
│   │                  │          │                                        │ │
│   │                  │ Patterns │                                        │ │
│   │                  │ Optimize │                                        │ │
│   │                  └────┬─────┘                                        │ │
│   │                       │                                              │ │
│   │              ┌────────┴────────┐                                     │ │
│   │              │  ORCHESTRATION  │                                     │ │
│   │              │                 │                                     │ │
│   │              │ Dashboard       │                                     │ │
│   │              │ Health Checks   │                                     │ │
│   │              │ Alerts          │                                     │ │
│   │              └─────────────────┘                                     │ │
│   │                                                                      │ │
│   │  ┌────────────────────────────────────────────────────────────────┐ │ │
│   │  │                    SPECIALIZED DOMAINS                         │ │ │
│   │  │  Healthcare │ E-Commerce │ Manufacturing │ Logistics │ Social  │ │ │
│   │  └────────────────────────────────────────────────────────────────┘ │ │
│   └──────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                              P L U G I N S                                  │
│                                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│   │   ADAPTERS   │  │   ACTIONS    │  │  ANALYZERS   │  │    MEMORY    │   │
│   │              │  │              │  │              │  │              │   │
│   │ • HTTP/WS    │  │ • Notify     │  │ • Technical  │  │ • Short-term │   │
│   │ • Database   │  │ • Log        │  │ • Statistics │  │ • Long-term  │   │
│   │ • Blockchain │  │ • Execute    │  │ • ML Models  │  │ • Persistent │   │
│   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### The Event Bus

The event bus is the nervous system of EverythingOS. Every agent communicates by publishing and subscribing to events.

```typescript
import { eventBus } from 'everything-os';

// Subscribe to events
eventBus.subscribe('price:update', (event) => {
  console.log(`${event.payload.symbol}: $${event.payload.price}`);
});

// Emit events
eventBus.emit('order:create', { symbol: 'BTC', side: 'buy', quantity: 1 });

// Pattern matching
eventBus.subscribe('signal:*', handler);  // All signals
eventBus.subscribe('*.error', handler);   // All errors
```

**Features:**
- Priority queues (critical, high, normal, low)
- Dead letter handling for failed events
- Event history and replay
- Correlation IDs for tracing

### World State

Global state management with automatic snapshots and recovery.

```typescript
import { worldState } from 'everything-os';

// Global state
worldState.setGlobal('market_regime', 'bullish');
const regime = worldState.getGlobal('market_regime');

// Agent-specific memory
worldState.setAgentMemory('rsi_agent', 'last_signal', { direction: 'long' });

// Snapshots for recovery
const snapshot = worldState.createSnapshot('before_trade');
// ... something goes wrong ...
worldState.restoreSnapshot(snapshot.tick);
```

### Agent Registry

Manages agent lifecycle, dependencies, and discovery.

```typescript
import { registry } from 'everything-os';

// Register custom agent
registry.register(new MyCustomAgent());

// Find agents
const tradingAgents = registry.find({ tier: 'decision' });
const runningAgents = registry.find({ status: 'running' });

// Start/stop all
await registry.startAll();
await registry.stopAll();
```

---

## Agent Tiers Explained

### Tier 1: Foundation Agents

**Purpose:** Core system services that all other agents depend on.

| Agent | What It Does |
|-------|--------------|
| `ClockAgent` | System time, scheduling, cron-like task execution |
| `EnvironmentSensorAgent` | Monitors CPU, memory, system resources |
| `ConfigWatcherAgent` | Hot-reload configuration, watch for changes |
| `SnapshotManagerAgent` | Automatic state snapshots, recovery points |
| `GarbageCollectorAgent` | Clean up old data, manage memory |
| `AuditTrailAgent` | Log all system activity for compliance |
| `EventBusMonitorAgent` | Track event throughput, detect bottlenecks |
| `InterAgentBridgeAgent` | Route messages between agents |
| `DeadLetterHandlerAgent` | Capture and retry failed events |
| `ShutdownCoordinatorAgent` | Graceful shutdown orchestration |

### Tier 2: Sensing Agents

**Purpose:** Collect data from the outside world and internal systems.

| Agent | What It Does |
|-------|--------------|
| `PriceTickerAgent` | Real-time price feeds for any asset |
| `VolatilityCalculatorAgent` | Calculate rolling volatility metrics |
| `AnomalyDetectorAgent` | Statistical anomaly detection (z-scores) |
| `SentimentAnalysisAgent` | Market sentiment from various sources |
| `NewsAggregatorAgent` | Aggregate and score news articles |
| `CorrelationAnalyzerAgent` | Track correlations between assets |

### Tier 3: Decision Agents

**Purpose:** Analyze data and generate trading/action signals.

| Agent | What It Does |
|-------|--------------|
| `RSIAgent` | Relative Strength Index signals |
| `MACDAgent` | MACD crossover signals |
| `BollingerBandAgent` | Bollinger Band breakout signals |
| `MovingAverageAgent` | Golden/death cross detection |
| `SignalEnsembleAgent` | **Combines all signals into consensus** |
| `FearGreedIndexAgent` | Market fear/greed sentiment index |

### Tier 4: Execution Agents

**Purpose:** Execute actions and manage risk.

| Agent | What It Does |
|-------|--------------|
| `OrderExecutorAgent` | Place and manage orders |
| `PositionSizerAgent` | Calculate optimal position sizes |
| `StopLossAgent` | Manage stop losses (fixed & trailing) |
| `ProfitTakerAgent` | Scale out at profit targets |
| `CircuitBreakerAgent` | Emergency halt on extreme conditions |
| `DrawdownLimiterAgent` | Prevent excessive losses |
| `VaRAgent` | Value at Risk calculations |

### Tier 5: Orchestration Agents

**Purpose:** Monitor, coordinate, and report on the system.

| Agent | What It Does |
|-------|--------------|
| `DashboardAgent` | Aggregate metrics for visualization |
| `HealthCheckAgent` | Monitor agent health status |
| `AlertingAgent` | Centralized alert management |
| `PerformanceTrackerAgent` | Track P&L, win rate, Sharpe ratio |
| `MetricsAggregatorAgent` | Aggregate metrics across all agents |

### Tier 6: Specialized Domain Agents

#### Healthcare
| Agent | What It Does |
|-------|--------------|
| `PatientQueueAgent` | Triage and prioritize patients |
| `StaffSchedulingAgent` | Optimize staff assignments |
| `VitalsMonitoringAgent` | Monitor patient vital signs |
| `ResourceAllocationAgent` | Track beds, equipment, rooms |
| `MedicationInventoryAgent` | Track medication stock levels |

---

## Plugins

Plugins extend agent capabilities without modifying core code.

### Adapters

Connect to external data sources:

```typescript
// plugins/adapters/CoinbaseAdapter.ts
export class CoinbaseAdapter {
  async getPrice(symbol: string): Promise<number> {
    // Fetch from Coinbase API
  }
  
  subscribeToTicker(symbol: string, callback: (price: number) => void): void {
    // WebSocket subscription
  }
}
```

### Actions

Reusable actions agents can perform:

```typescript
// plugins/actions/NotificationService.ts
export class NotificationService {
  async sendSlack(channel: string, message: string): Promise<void> { }
  async sendEmail(to: string, subject: string, body: string): Promise<void> { }
  async sendSMS(phone: string, message: string): Promise<void> { }
}
```

### Analyzers

Shared analysis functions:

```typescript
// plugins/analyzers/TechnicalIndicators.ts
export class TechnicalIndicators {
  static sma(prices: number[], period: number): number { }
  static ema(prices: number[], period: number): number { }
  static rsi(prices: number[], period: number): number { }
  static macd(prices: number[]): { macd: number; signal: number; histogram: number } { }
  static bollingerBands(prices: number[]): { upper: number; middle: number; lower: number } { }
}
```

### Memory

Agent memory and persistence:

```typescript
// plugins/memory/AgentMemory.ts
export class AgentMemory {
  private shortTerm: Map<string, unknown> = new Map();
  private longTerm: Map<string, unknown> = new Map();
  
  remember(key: string, value: unknown, persistent = false): void { }
  recall<T>(key: string): T | undefined { }
  forget(key: string): void { }
}
```

---

## Building Your Own Agents

### Basic Agent Template

```typescript
import { BaseAgent } from 'everything-os';

export class MyCustomAgent extends BaseAgent {
  constructor() {
    super({
      id: 'my_custom_agent',           // Unique identifier
      name: 'My Custom Agent',          // Human-readable name
      tier: 'specialized',              // Agent tier
      description: 'Does amazing things',
      version: '1.0.0',
      dependencies: ['price_ticker'],   // Optional: require other agents
    });
    
    this.tickRate = 5000; // Run onTick every 5 seconds (0 = disabled)
  }

  // Called when agent starts
  protected async onStart(): Promise<void> {
    console.log('Agent starting...');
    
    // Subscribe to events from other agents
    this.subscribe('price:update', (event) => {
      const { symbol, price } = event.payload;
      this.processPrice(symbol, price);
    });
  }

  // Called when agent stops
  protected async onStop(): Promise<void> {
    console.log('Agent stopping...');
  }

  // Called every tickRate milliseconds
  protected async onTick(): Promise<void> {
    // Do periodic work
    const data = this.analyze();
    
    // Emit events for other agents
    this.emit('my_agent:analysis', data);
  }

  // Custom methods
  private processPrice(symbol: string, price: number): void {
    // Store in agent memory
    this.setMemory(`last_price_${symbol}`, price);
  }

  private analyze(): unknown {
    // Read from memory
    const btcPrice = this.getMemory<number>('last_price_BTC');
    return { btcPrice, timestamp: Date.now() };
  }
}
```

### Register Your Agent

```typescript
import { registry } from 'everything-os';
import { MyCustomAgent } from './MyCustomAgent';

// Register
registry.register(new MyCustomAgent());

// Or add to AgentFactory in src/agents/index.ts:
export const AgentFactory = {
  // ... existing agents ...
  my_custom_agent: () => new MyCustomAgent(),
};
```

### Agent Communication Patterns

**Request-Response:**
```typescript
// Agent A: Request
this.emit('data:request', { type: 'historical_prices', symbol: 'BTC' });

// Agent B: Listen and respond
this.subscribe('data:request', (event) => {
  if (event.payload.type === 'historical_prices') {
    const data = this.fetchHistoricalPrices(event.payload.symbol);
    this.emit('data:response', { requestId: event.id, data });
  }
});
```

**Broadcast:**
```typescript
// Emit to all listeners
this.emit('market:regime_change', { from: 'bullish', to: 'bearish' });
```

**Targeted:**
```typescript
// Emit to specific agent
this.emit('order:execute', orderData, 'order_executor');
```

---

## Directory Structure

```
everything-os/
├── src/
│   ├── core/                      # Core infrastructure
│   │   ├── EventBus.ts            # Event system
│   │   ├── WorldStateManager.ts   # Global state
│   │   ├── AgentRegistry.ts       # Agent management
│   │   ├── MetricsCollector.ts    # Metrics system
│   │   └── types/                 # TypeScript types
│   │
│   ├── agents/                    # All agents
│   │   ├── BaseAgent.ts           # Abstract base class
│   │   ├── foundation/            # Tier 1: Core services
│   │   ├── sensing/               # Tier 2: Data collection
│   │   ├── decision/              # Tier 3: Signal generation
│   │   ├── execution/             # Tier 4: Order execution
│   │   ├── orchestration/         # Tier 5: System coordination
│   │   ├── specialized/           # Tier 6: Domain-specific
│   │   │   ├── healthcare/
│   │   │   ├── ecommerce/
│   │   │   ├── manufacturing/
│   │   │   └── logistics/
│   │   └── index.ts               # Agent exports & factory
│   │
│   ├── plugins/                   # Extensibility
│   │   ├── adapters/              # External data sources
│   │   ├── actions/               # Reusable actions
│   │   ├── analyzers/             # Analysis functions
│   │   └── memory/                # Persistence layers
│   │
│   └── index.ts                   # Main entry point
│
├── examples/                      # Example configurations
│   └── demo.ts
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## Presets

Load pre-configured agent combinations:

```typescript
// Trading system
const os = await createEverythingOS({ presets: ['trading'] });

// Healthcare system  
const os = await createEverythingOS({ presets: ['healthcare'] });

// Everything
const os = await createEverythingOS({ presets: ['full'] });

// Custom combination
const os = await createEverythingOS({
  presets: ['trading'],
  agents: ['patient_queue', 'vitals_monitoring']  // Add specific agents
});
```

---

## API Reference

### EverythingOS

```typescript
class EverythingOS {
  // Lifecycle
  initialize(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  
  // Agents
  loadAgent(name: AgentName): Promise<BaseAgent | null>
  loadPreset(preset: string): Promise<void>
  getAgent<T extends BaseAgent>(id: string): T | undefined
  
  // Events
  on(event: string, handler: (data: unknown) => void): () => void
  emit(event: string, data: unknown): void
  
  // State
  getState(): Record<string, unknown>
  getMetrics(): Record<string, unknown>
  isRunning(): boolean
}
```

### BaseAgent (extend this)

```typescript
abstract class BaseAgent {
  // Implemented by you
  protected abstract onStart(): Promise<void>
  protected abstract onStop(): Promise<void>
  protected abstract onTick(): Promise<void>
  
  // Available to use
  protected subscribe(pattern: string, handler: Function): void
  protected emit(type: string, payload: unknown, target?: string): void
  protected getMemory<T>(key: string): T | undefined
  protected setMemory(key: string, value: unknown): void
  protected getGlobal<T>(key: string): T | undefined
  protected setGlobal(key: string, value: unknown): void
  
  // Public
  getConfig(): AgentConfig
  getId(): string
  getStatus(): AgentStatus
  start(): Promise<void>
  stop(): Promise<void>
  pause(): void
  resume(): void
}
```

---

## Use Cases

### Algorithmic Trading
- Multiple technical analysis agents generate signals
- Ensemble agent combines signals into consensus
- Risk agents enforce position limits and stop losses
- Execution agents place orders

### Hospital Operations
- Monitor patient queues and prioritize by severity
- Track staff availability and optimize assignments
- Alert on abnormal vital signs
- Manage bed and equipment allocation

### IoT / Smart Factory
- Collect sensor data from hundreds of devices
- Detect anomalies in machine performance
- Predict maintenance needs
- Optimize production schedules

### Social Media Platform
- Content moderation agents
- Spam detection
- Engagement optimization
- Viral trend detection

---

## Contributing

1. Fork the repository
2. Create your agent in `src/agents/`
3. Add to `AgentFactory` in `src/agents/index.ts`
4. Submit a pull request

### Agent Guidelines
- Single responsibility per agent
- Use events for communication (never call other agents directly)
- Handle errors gracefully (don't crash the system)
- Include TypeScript types
- Document your agent's events

---

## License

MIT © m0rs3

---

## Roadmap

- [ ] WebSocket adapter for real-time data
- [ ] Database persistence plugin
- [ ] REST API for external control
- [ ] Web dashboard UI
- [ ] Agent marketplace
- [ ] Distributed agent deployment
- [ ] AI/LLM agent integration

---

**Built with ❤️ for autonomous systems**
