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

**LLM-Agnostic Multi-Agent Operating System**

Build autonomous agent systems that work with any LLM provider (OpenAI, Claude, Gemini, Ollama, etc.)

## What is EverythingOS?

EverythingOS is a framework for building and orchestrating autonomous AI agents that can work together to accomplish complex tasks. It provides a complete operating system for multi-agent workflows, including:

- **Event-Driven Architecture**: Agents communicate through a robust pub/sub event bus with priority queuing and dead letter handling
- **LLM Abstraction**: Switch between OpenAI, Claude, Gemini, or local models without changing agent code
- **Agent Lifecycle Management**: Built-in supervision, health monitoring, and automatic recovery
- **Workflow Engine**: Define complex multi-step workflows with triggers, actions, and decision nodes
- **State Management**: Persistent world state with snapshots and time-travel debugging
- **Memory System**: Three-layer memory architecture enabling agents to learn and retain knowledge across sessions
- **Plugin System**: Extensible integrations with Discord, Slack, GitHub, and more

Think of it as an operating system where instead of running programs, you run intelligent agents that can perceive their environment, make decisions, take actions, and learn from the results. Most agent frameworks assume the world is safe, fast, and reversible. EverythingOS assumes the opposite.

## Why Use Agents?

Agents are autonomous entities that can operate independently to solve problems. Unlike traditional scripts or APIs, agents:

- **Adapt to changing conditions**: Agents can perceive their environment and adjust their behavior accordingly
- **Make intelligent decisions**: Using LLMs, agents can reason about complex situations and choose appropriate actions
- **Learn and remember**: Three-layer memory system enables agents to retain knowledge across sessions and improve over time
- **Work asynchronously**: Agents run independently and communicate through events, enabling parallel execution
- **Specialize and collaborate**: Different agent types (perception, analysis, decision, execution, learning) can work together on complex tasks
- **Handle uncertainty**: Agents can deal with incomplete information and make probabilistic decisions
- **Scale naturally**: Add more agents to handle increased load or new capabilities without rewriting existing code

### Real-World Use Cases

- **Social Media Management**: Perception agents monitor mentions, decision agents determine responses, execution agents post replies
- **Customer Support**: Analysis agents understand queries, decision agents route to appropriate handlers, learning agents improve over time
- **DevOps Automation**: Monitoring agents detect issues, decision agents triage severity, execution agents apply fixes
- **Research Assistants**: Agents can search, summarize, synthesize information, and maintain context across long investigations
- **Autonomous Robotics**: EverythingOS is designed to bridge high-level decision systems with physical control layers (e.g. ROS2) while preserving human oversight and safety guarantees.

## Quick Start

```bash
npm install
npm run build
npm run api
```

```typescript
import { createEverythingOS } from 'everythingos';

const os = await createEverythingOS({
  autoStart: true,
  apiServer: true,
});

// Listen to events
os.events.on('workflow:completed', (event) => {
  console.log('Workflow completed:', event.payload);
});
```

## Creating Your Own Agents

Creating custom agents is straightforward. Every agent extends the base `Agent` class and implements three lifecycle methods.

### Basic Agent Structure

```typescript
import { Agent, AgentConfig } from 'everythingos';

class MyCustomAgent extends Agent {
  constructor(config: AgentConfig) {
    super(config);
  }

  // Called when agent starts - setup subscriptions and initialize
  protected async onStart(): Promise<void> {
    this.subscribe('my:event', (event) => this.handleEvent(event));
  }

  // Called when agent stops - cleanup resources
  protected async onStop(): Promise<void> {
    // Clean up resources
  }

  // Called periodically if tickRate is set - background tasks
  protected async onTick(): Promise<void> {
    // Periodic processing
  }

  private async handleEvent(event) {
    // Your agent logic here
  }
}
```

### Step-by-Step: Creating a Monitoring Agent

Let's build a practical agent that monitors system health and sends alerts.

```typescript
import { Agent, AgentType } from 'everythingos';

interface HealthMetrics {
  cpu: number;
  memory: number;
  errors: number;
}

class SystemMonitorAgent extends Agent {
  private readonly thresholds = {
    cpu: 80,
    memory: 90,
    errors: 10,
  };

  constructor() {
    super({
      id: 'system-monitor',
      name: 'System Monitor',
      type: 'perception',  // This agent perceives system state
      description: 'Monitors system health and emits alerts',
      tickRate: 5000,  // Check every 5 seconds
      llm: {
        provider: 'claude',
        model: 'claude-sonnet-4-20250514',
        temperature: 0.3,
      },
    });
  }

  protected async onStart(): Promise<void> {
    this.log('info', 'System monitor started');

    // Subscribe to error events
    this.subscribe<{ error: string }>('system:error', async (event) => {
      const errorCount = this.getState<number>('errorCount') || 0;
      this.setState('errorCount', errorCount + 1);
    });
  }

  protected async onStop(): Promise<void> {
    this.log('info', 'System monitor stopped');
  }

  protected async onTick(): Promise<void> {
    // Collect metrics
    const metrics = await this.collectMetrics();

    // Check thresholds
    const issues = this.checkThresholds(metrics);

    if (issues.length > 0) {
      // Use LLM to generate alert message
      const alert = await this.generateAlert(metrics, issues);

      // Emit alert event
      this.emit('system:alert', {
        severity: this.calculateSeverity(issues),
        message: alert,
        metrics,
      }, { priority: 'high' });
    }

    // Store metrics in state
    this.setState('lastMetrics', metrics);
  }

  private async collectMetrics(): Promise<HealthMetrics> {
    // Get metrics from various sources
    const errorCount = this.getState<number>('errorCount') || 0;

    return {
      cpu: await this.getCPUUsage(),
      memory: await this.getMemoryUsage(),
      errors: errorCount,
    };
  }

  private checkThresholds(metrics: HealthMetrics): string[] {
    const issues: string[] = [];

    if (metrics.cpu > this.thresholds.cpu) {
      issues.push(`CPU usage (${metrics.cpu}%) exceeds threshold`);
    }
    if (metrics.memory > this.thresholds.memory) {
      issues.push(`Memory usage (${metrics.memory}%) exceeds threshold`);
    }
    if (metrics.errors > this.thresholds.errors) {
      issues.push(`Error count (${metrics.errors}) exceeds threshold`);
    }

    return issues;
  }

  private async generateAlert(metrics: HealthMetrics, issues: string[]): Promise<string> {
    const prompt = `System health issues detected:
${issues.map(i => `- ${i}`).join('\n')}

Current metrics:
- CPU: ${metrics.cpu}%
- Memory: ${metrics.memory}%
- Errors: ${metrics.errors}

Generate a concise alert message for the operations team.`;

    return await this.think(prompt, {
      systemPrompt: 'You are a system monitoring assistant. Generate clear, actionable alerts.',
    });
  }

  private calculateSeverity(issues: string[]): 'low' | 'medium' | 'high' | 'critical' {
    if (issues.length >= 3) return 'critical';
    if (issues.length === 2) return 'high';
    if (issues.length === 1) return 'medium';
    return 'low';
  }

  private async getCPUUsage(): Promise<number> {
    // Implementation depends on your environment
    return Math.random() * 100;
  }

  private async getMemoryUsage(): Promise<number> {
    // Implementation depends on your environment
    return Math.random() * 100;
  }
}
```

### Using Your Agent

```typescript
import { agentRegistry } from 'everythingos';

// Create and register the agent
const monitor = new SystemMonitorAgent();
await agentRegistry.register(monitor);

// Start the agent
await monitor.start();

// Listen for alerts
eventBus.on('system:alert', (event) => {
  const { severity, message, metrics } = event.payload;
  console.log(`[${severity.toUpperCase()}] ${message}`);
  console.log('Metrics:', metrics);
});
```

### Agent Types and When to Use Them

EverythingOS defines five agent types, each suited for different roles:

#### 1. Perception Agents
**Purpose**: Observe and collect information from the environment

**Examples**:
- Monitor social media mentions
- Watch file systems for changes
- Track API endpoints for status changes
- Listen to chat messages

**Key characteristics**:
- High tick rate for continuous monitoring
- Emit events when patterns are detected
- Usually don't need LLM capabilities

#### 2. Analysis Agents
**Purpose**: Process and understand data

**Examples**:
- Sentiment analysis of messages
- Log analysis and pattern detection
- Data aggregation and summarization
- Trend identification

**Key characteristics**:
- Subscribe to perception agent events
- Use LLMs for complex analysis
- Emit analyzed/structured data

#### 3. Decision Agents
**Purpose**: Determine what actions to take

**Examples**:
- Decide whether to respond to a message
- Choose between multiple action paths
- Triage and route requests
- Determine priority levels

**Key characteristics**:
- Heavy LLM usage for reasoning
- State-aware decision making
- Emit decision events with reasoning

#### 4. Execution Agents
**Purpose**: Perform actions in the world

**Examples**:
- Send messages to platforms
- Create GitHub issues
- Deploy code
- Update databases

**Key characteristics**:
- Subscribe to decision agent events
- Interface with external systems
- Handle retries and error recovery

#### 5. Learning Agents
**Purpose**: Improve system performance over time

**Examples**:
- Track response effectiveness
- A/B test different strategies
- Adjust agent parameters
- Build knowledge bases

**Key characteristics**:
- Long-running state accumulation
- Periodic analysis of outcomes
- Emit improvement recommendations

### Advanced Agent Features

#### Agent Communication

```typescript
// Emit events to other agents
this.emit('data:processed', {
  results: processedData
}, {
  priority: 'high',
  target: 'specific-agent-id'  // Optional: target specific agent
});

// Request-response pattern
const response = await this.request<QueryData, ResultData>(
  'database:query',
  { table: 'users', id: 123 },
  5000  // timeout
);
```

#### State Management

```typescript
// Agent-specific state
this.setState('userPreferences', preferences);
const prefs = this.getState<Preferences>('userPreferences');

// Global shared state
this.setGlobal('systemStatus', 'healthy');
const status = this.getGlobal<string>('systemStatus');
```

#### LLM Integration

```typescript
// Simple completion
const response = await this.think('What should I do next?');

// With system prompt and temperature
const analysis = await this.think(
  'Analyze this data: ' + JSON.stringify(data),
  {
    systemPrompt: 'You are a data analyst. Be concise and quantitative.',
    temperature: 0.2,  // More deterministic
  }
);
```

#### Error Handling and Logging

```typescript
protected async onTick(): Promise<void> {
  try {
    await this.performTask();
  } catch (error) {
    this.log('error', 'Task failed', { error, context: this.getState('context') });
    this.emit('agent:task-failed', {
      agentId: this.id,
      error: String(error)
    });
  }
}
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                      EVERYTHINGOS                                         │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │  EVENT   │  │ WORKFLOW │  │SUPERVISOR│  │  STATE   │  │  MEMORY  │  │    TRUST    │  │
│  │   BUS    │  │ • Nodes  │  │ • Health │  │ • World  │  │ • Working│  │ • Permissions│ │
│  │ • Pub/Sub│  │ • Trigger│  │ • Policy │  │ • Snapshot│ │ • Episod.│  │ • Sandboxing│  │
│  │ • Priority│ └──────────┘  └──────────┘  └──────────┘  │ • LongTerm│ │ • Audit     │  │
│  └──────────┘                                             └──────────┘  └─────────────┘  │
│       │                                                         │               │         │
│  ┌────┴─────────────────────────────────────────────────────────┴───────────────┴──────┐ │
│  │                              LLM ROUTER                                              │ │
│  │        OpenAI │ Claude │ Gemini │ Ollama │ Custom                                    │ │
│  └─────────────────────────────────────────────────────────────────────────────────────┘ │
│                                         │                                                 │
│  ┌──────────────────────────────────────┴──────────────────────────────────────────────┐ │
│  │                                    AGENTS                                            │ │
│  │   Perception │ Analysis │ Decision │ Execution │ Learning │ ApprovalGate             │ │
│  └─────────────────────────────────────────────────────────────────────────────────────┘ │
│         │                               │                               │                 │
│  ┌──────┴───────┐  ┌───────────────────┴───────────────────┐  ┌────────┴──────────────┐ │
│  │ EXPLAINABILITY│ │           INTENT & TOOLS               │  │     TOOL REGISTRY     │ │
│  │ • Decisions   │ │ • IntentContract                       │  │ • Registration        │ │
│  │ • Reasoning   │ │ • Constraints                          │  │ • Permissions         │ │
│  │ • Audit Trail │ │ • Dependencies                         │  │ • Execution           │ │
│  └───────────────┘ └────────────────────────────────────────┘  └───────────────────────┘ │
│                                         │                                                 │
│  ┌──────────────────────────────────────┴──────────────────────────────────────────────┐ │
│  │                                   PLUGINS                                            │ │
│  │   Discord │ Slack │ X │ Email │ GitHub │ Calendar │ Crypto │ ...                     │ │
│  └─────────────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                      BRIDGES                                              │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────────────────┐    │
│  │                              ROBOTICS LAYER                                       │    │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │    │
│  │  │   ROS2 BRIDGE  │  │MOTION CONTROLLER│ │ SAFETY MONITOR │  │ FORMATION CTRL │  │    │
│  │  │ • Topics       │  │ • Trajectories │  │ • Zones        │  │ • Swarm        │  │    │
│  │  │ • Services     │  │ • Profiles     │  │ • Watchdogs    │  │ • Consensus    │  │    │
│  │  │ • Actions      │  │ • E-Stop       │  │ • E-Stop       │  │ • Leader       │  │    │
│  │  └────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐    │
│  │                              HARDWARE LAYER                                       │    │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │    │
│  │  │   PLATFORMS    │  │    SENSORS     │  │   ACTUATORS    │  │   PROTOCOLS    │  │    │
│  │  │ • Jetson       │  │ • IMU          │  │ • Motors       │  │ • I2C          │  │    │
│  │  │ • Raspberry Pi │  │ • GPS          │  │ • Servos       │  │ • SPI          │  │    │
│  │  │ • Deployment   │  │ • Temperature  │  │ • Relays       │  │ • Serial       │  │    │
│  │  └────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                       REST API                                            │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Event Bus

The event bus is the nervous system of EverythingOS. All agent communication flows through it.

```typescript
import { eventBus } from 'everythingos';

// Subscribe to events (supports wildcards)
eventBus.on('user:message', async (event) => {
  console.log('Message:', event.payload);
});

eventBus.on('user:*', async (event) => {
  console.log('Any user event:', event.type);
});

// Emit events
eventBus.emit('bot:reply', { content: 'Hello!' });

// Request-response pattern
const response = await eventBus.request('data:fetch', { id: 123 });
```

### Workflows

Workflows define multi-step processes as directed graphs of nodes.

```typescript
import { workflowRegistry } from 'everythingos';

workflowRegistry.register({
  id: 'social-reply',
  name: 'Social Media Reply Workflow',
  status: 'active',
  nodes: [
    {
      id: 'trigger',
      type: 'trigger',
      name: 'New Mention',
      config: {}
    },
    {
      id: 'analyze',
      type: 'action',
      plugin: 'sentiment',
      action: 'analyze',
      config: {}
    },
    {
      id: 'decide',
      type: 'action',
      plugin: 'decision',
      action: 'should_reply',
      config: {}
    },
    {
      id: 'reply',
      type: 'action',
      plugin: 'discord',
      action: 'send_message',
      config: {}
    },
  ],
  edges: [
    { id: 'e1', from: 'trigger', to: 'analyze' },
    { id: 'e2', from: 'analyze', to: 'decide' },
    { id: 'e3', from: 'decide', to: 'reply' },
  ],
  triggers: [
    {
      id: 't1',
      type: 'event',
      config: { pattern: 'discord:mention' },
      enabled: true
    }
  ],
});
```

### LLM Router

Switch between LLM providers seamlessly.

```typescript
import { llmRouter } from 'everythingos';

// Set default provider
llmRouter.setDefaultProvider('claude');

// Generate completion
const response = await llmRouter.complete({
  provider: 'openai',
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ],
  temperature: 0.7,
});

// Stream responses
for await (const chunk of llmRouter.stream(request)) {
  process.stdout.write(chunk);
}
```

### Plugins

Extend EverythingOS with custom integrations.

```typescript
import { pluginRegistry } from 'everythingos';

await pluginRegistry.register({
  id: 'my-plugin',
  name: 'My Custom Plugin',
  version: '1.0.0',
  description: 'Does something useful',
  actions: [
    {
      name: 'do_something',
      description: 'Performs an action',
      parameters: {
        param1: { type: 'string', required: true },
        param2: { type: 'number', required: false },
      },
      handler: async (input) => {
        // Your logic here
        return { success: true, result: 'done' };
      },
    }
  ],
});
```

### Memory System

EverythingOS provides a three-layer memory architecture that enables agents to learn and retain knowledge across sessions.

#### Memory Layers

**Working Memory** - Short-term, scoped storage for active tasks
- Per-agent and per-workflow scopes
- Automatic cleanup with TTL support
- Fast access for current context

**Episodic Memory** - Conversation history and interactions
- Tracks conversation turns with role and content
- Automatic summarization for context windows
- Searchable conversation history

**Long-Term Memory** - Persistent knowledge base
- Semantic search using embeddings
- Multiple memory types (facts, events, decisions, patterns, etc.)
- Importance-based pruning and retention

#### Using Memory in Agents

```typescript
import { memoryService } from 'everythingos';

class LearningAgent extends Agent {
  private memory: AgentMemory;

  constructor() {
    super({
      id: 'learning-agent',
      name: 'Learning Agent',
      type: 'learning',
    });

    // Get scoped memory for this agent
    this.memory = memoryService.forAgent(this.id);
  }

  protected async onStart(): Promise<void> {
    // Working memory - temporary context
    this.memory.working.set('sessionStarted', Date.now());

    // Long-term memory - recall past learnings
    const pastPatterns = await this.memory.recall('user interaction patterns');

    this.subscribe('user:message', async (event) => {
      await this.handleMessage(event.payload);
    });
  }

  private async handleMessage(message: any): Promise<void> {
    // Store in episodic memory for conversation context
    await this.memory.conversationTurn(
      message.conversationId,
      'user',
      message.content
    );

    // Retrieve relevant context from long-term memory
    const relevantMemories = await this.memory.recall(
      message.content,
      { limit: 5, minRelevance: 0.7 }
    );

    // Use LLM with memory context
    const response = await this.think(
      `Message: ${message.content}\n\nRelevant context: ${JSON.stringify(relevantMemories)}`,
      { systemPrompt: 'You have access to past interactions. Use them to provide personalized responses.' }
    );

    // Store the response in episodic memory
    await this.memory.conversationTurn(
      message.conversationId,
      'assistant',
      response
    );

    // Learn from the interaction
    await this.memory.remember({
      content: `User prefers ${this.extractPreference(message.content)}`,
      type: 'preference',
      importance: 0.8,
      tags: ['user-preference', 'interaction']
    });

    this.emit('bot:reply', { content: response });
  }

  protected async onTick(): Promise<void> {
    // Periodic consolidation of learnings
    const recentMemories = await this.memory.recall('', {
      filter: { since: Date.now() - 3600000 },  // Last hour
      limit: 100
    });

    if (recentMemories.length > 50) {
      // Summarize and create a pattern
      const summary = await this.think(
        `Summarize these interactions into key patterns: ${JSON.stringify(recentMemories)}`
      );

      await this.memory.remember({
        content: summary,
        type: 'pattern',
        importance: 0.9,
        tags: ['consolidated', 'pattern']
      });
    }
  }
}
```

#### Memory API

```typescript
// Agent memory instance
const agentMemory = memoryService.forAgent('my-agent-id');

// Working memory - short-term context
agentMemory.working.set('currentTask', { status: 'processing' });
const task = agentMemory.working.get('currentTask');

// Store in long-term memory
await agentMemory.remember({
  content: 'User prefers concise responses',
  type: 'preference',
  importance: 0.8,
  tags: ['user-preference']
});

// Semantic recall from long-term memory
const memories = await agentMemory.recall(
  'user communication style',
  {
    limit: 5,
    minRelevance: 0.7,
    filter: { type: 'preference' }
  }
);

// Conversation tracking
await agentMemory.conversationTurn('conv-123', 'user', 'Hello!');
await agentMemory.conversationTurn('conv-123', 'assistant', 'Hi there!');
const context = agentMemory.getConversationContext('conv-123', 2000);

// Decision context - includes relevant memories and conversation
const decisionCtx = await agentMemory.getDecisionContext(
  'Should I send a notification?',
  'conv-123'
);
```

#### Memory Types

- **fact**: Discrete pieces of information
- **event**: Things that happened
- **conversation**: Message history
- **decision**: Decisions that were made
- **outcome**: Results of actions
- **preference**: User or system preferences
- **pattern**: Learned patterns from data
- **summary**: Compressed information

## Hardware Platform Integration

EverythingOS supports direct integration with physical hardware platforms for edge deployment and robotics applications.

### Supported Platforms

#### NVIDIA Jetson (Nano, Xavier, Orin)

```typescript
import { JetsonPlatform } from 'everythingos/plugins/platforms';

const jetson = new JetsonPlatform({
  gpioEnabled: true,
  i2cEnabled: true,
  spiEnabled: true,
  cameraEnabled: true,
  cudaEnabled: true,
});

await jetson.initialize();

// Access GPIO
const gpio = jetson.getGPIO();
await gpio.setMode(18, 'output');
await gpio.write(18, true);

// Monitor system resources
const metrics = await jetson.getMetrics();
console.log(`GPU Utilization: ${metrics.gpuUtilization}%`);
console.log(`Power Mode: ${metrics.powerMode}`);

// Use CUDA acceleration
if (jetson.isCudaAvailable()) {
  const result = await jetson.runCudaKernel(myKernel, data);
}
```

**Features:**
- GPIO, I2C, SPI, CSI Camera support
- CUDA acceleration for ML inference
- Power management (MAXN, 15W, 10W, 5W modes)
- GPU memory and utilization monitoring
- TensorRT inference capability

#### Raspberry Pi (3, 4, 5, Zero 2)

```typescript
import { RaspberryPiPlatform } from 'everythingos/plugins/platforms';

const rpi = new RaspberryPiPlatform({
  gpioLibrary: 'pigpio', // or 'rpi-gpio', 'onoff'
  i2cEnabled: true,
  spiEnabled: true,
  cameraEnabled: true,
});

await rpi.initialize();

// Read sensor via I2C
const i2c = rpi.getI2C();
const sensorData = await i2c.readRegister(0x68, 0x3B, 6);

// Monitor temperature and throttling
const health = await rpi.getHealth();
console.log(`Temperature: ${health.temperature}°C`);
console.log(`Throttled: ${health.throttled}`);
```

**Features:**
- Multiple GPIO library support (pigpio, rpi-gpio, onoff)
- I2C, SPI, camera (picamera2/libcamera) interfaces
- Real-time temperature and throttle monitoring
- Hardware watchdog support

### Deployment Manager

Manage fleets of devices with cross-platform deployment capabilities.

```typescript
import { DeploymentManager } from 'everythingos/plugins/platforms';

const deploymentManager = new DeploymentManager();

// Auto-detect platform
const platform = await deploymentManager.detectPlatform();
console.log(`Detected: ${platform.type} - ${platform.model}`);

// Deploy agent configuration
await deploymentManager.deploy({
  deviceId: 'robot-001',
  config: agentConfig,
  watchdogEnabled: true,
  healthCheckInterval: 30000,
});

// OTA updates with rollback
await deploymentManager.update({
  deviceId: 'robot-001',
  version: '2.1.0',
  rollbackOnFailure: true,
});

// Monitor fleet health
const fleetStatus = await deploymentManager.getFleetHealth();
for (const device of fleetStatus) {
  console.log(`${device.id}: ${device.status} (${device.uptime}s uptime)`);
}
```

## Swarm Coordination

Coordinate multiple agents or robots working together as a swarm.

### Swarm Coordinator

```typescript
import { SwarmCoordinator } from 'everythingos/plugins/swarm';

const coordinator = new SwarmCoordinator({
  heartbeatInterval: 1000,
  taskTimeout: 30000,
  consensusThreshold: 0.6,
});

await coordinator.start();

// Agents automatically discovered via heartbeat
coordinator.on('agent:discovered', (agent) => {
  console.log(`Agent ${agent.id} joined swarm`);
});

// Distribute tasks based on capabilities and battery
await coordinator.assignTask({
  id: 'explore-zone-a',
  type: 'exploration',
  requirements: {
    capabilities: ['camera', 'lidar'],
    minBattery: 30,
  },
  priority: 'high',
});

// Achieve distributed consensus
const decision = await coordinator.requestConsensus({
  topic: 'return-to-base',
  options: ['now', 'in-5-minutes', 'continue'],
  timeout: 5000,
});
console.log(`Swarm decided: ${decision.result}`);

// Leader election for coordinated actions
const leader = await coordinator.electLeader();
console.log(`New swarm leader: ${leader.id}`);
```

### Formation Controller

Control multi-robot formations with collision avoidance.

```typescript
import { FormationController } from 'everythingos/plugins/swarm';

const formation = new FormationController({
  positionTolerance: 0.5, // meters
  headingTolerance: 5,    // degrees
  collisionRadius: 1.0,
});

// Define robot positions
formation.addRobot('robot-1', { x: 0, y: 0, heading: 0 });
formation.addRobot('robot-2', { x: 0, y: 2, heading: 0 });
formation.addRobot('robot-3', { x: 0, y: 4, heading: 0 });

// Create formation (line, column, wedge, diamond, circle, grid)
await formation.setFormation('wedge', {
  leaderId: 'robot-1',
  spacing: 2.0,
});

// Follow path as a group
await formation.followPath([
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
]);

// Check formation status
const status = formation.getFormationStatus();
console.log(`Formation achieved: ${status.achieved}`);
console.log(`Max deviation: ${status.maxDeviation}m`);
```

## ROS2 Bridge & Robotics

Full integration with ROS2 for advanced robotics applications.

### ROS2 Bridge

```typescript
import { ROS2Bridge } from 'everythingos/plugins/robotics';

const ros = new ROS2Bridge({
  url: 'ws://localhost:9090',
  namespace: '/robot1',
});

await ros.connect();

// Subscribe to ROS topics
ros.subscribe('/scan', 'sensor_msgs/LaserScan', (msg) => {
  console.log(`Received ${msg.ranges.length} range readings`);
});

// Publish to ROS topics
ros.publish('/cmd_vel', 'geometry_msgs/Twist', {
  linear: { x: 0.5, y: 0, z: 0 },
  angular: { x: 0, y: 0, z: 0.1 },
});

// Call ROS services
const mapData = await ros.callService(
  '/map_server/get_map',
  'nav_msgs/GetMap',
  {},
  5000 // timeout
);

// Send navigation goals with feedback
const goal = ros.sendNavigationGoal({
  x: 5.0, y: 3.0, theta: 1.57
});

goal.on('feedback', (feedback) => {
  console.log(`Distance remaining: ${feedback.distance_remaining}m`);
});

goal.on('result', (result) => {
  console.log(`Navigation ${result.success ? 'succeeded' : 'failed'}`);
});

// Map EverythingOS events to ROS topics
ros.mapEventToTopic('robot:move', '/cmd_vel', (event) => ({
  linear: { x: event.payload.speed, y: 0, z: 0 },
  angular: { x: 0, y: 0, z: event.payload.turn },
}));
```

### Motion Controller

Coordinated multi-joint motion with trajectory planning.

```typescript
import { MotionController } from 'everythingos/plugins/robotics';

const motion = new MotionController({
  joints: ['base', 'shoulder', 'elbow', 'wrist', 'gripper'],
  limits: {
    base: { min: -180, max: 180, maxVelocity: 60 },
    shoulder: { min: -90, max: 90, maxVelocity: 45 },
    elbow: { min: 0, max: 135, maxVelocity: 60 },
    wrist: { min: -90, max: 90, maxVelocity: 90 },
    gripper: { min: 0, max: 100, maxVelocity: 100 },
  },
});

// Move to position with synchronized joints
await motion.moveTo({
  base: 45,
  shoulder: -30,
  elbow: 90,
  wrist: 0,
  gripper: 50,
}, {
  profile: 's-curve', // or 'trapezoidal', 'linear'
  duration: 2000,
});

// Execute trajectory with waypoints
await motion.executeTrajectory([
  { positions: { base: 0, shoulder: 0, elbow: 0 }, time: 0 },
  { positions: { base: 45, shoulder: -30, elbow: 90 }, time: 1000 },
  { positions: { base: 90, shoulder: -45, elbow: 120 }, time: 2000 },
]);

// Home all joints
await motion.home();

// Emergency stop
await motion.emergencyStop();
```

### Safety Monitor

Real-time safety enforcement with zone monitoring and emergency responses.

```typescript
import { SafetyMonitor } from 'everythingos/plugins/robotics';

const safety = new SafetyMonitor({
  updateRate: 20, // Hz
  defaultResponse: 'stop',
});

// Define safety zones
safety.addZone({
  id: 'workspace',
  type: 'box',
  bounds: { x: [-2, 2], y: [-2, 2], z: [0, 2] },
  response: 'warn',
});

safety.addZone({
  id: 'keep-out',
  type: 'sphere',
  center: { x: 0, y: 1, z: 1 },
  radius: 0.5,
  response: 'e-stop',
});

// Add safety rules
safety.addRule({
  id: 'velocity-limit',
  condition: (state) => state.velocity > 1.0,
  response: 'slow',
  message: 'Velocity exceeds safe limit',
});

// Set watchdog timer
safety.setWatchdog('heartbeat', 500, () => {
  console.log('Communication timeout - stopping robot');
  motion.emergencyStop();
});

// Monitor violations
safety.on('violation', (violation) => {
  console.log(`Safety violation: ${violation.rule} - ${violation.message}`);
  console.log(`Response: ${violation.response}`);
});

// Start monitoring
await safety.start();
```

## Sensors & Actuators

Hardware abstraction layer for common sensors and actuators.

### Sensors

```typescript
import { IMUSensor, GPSSensor, TemperatureSensor } from 'everythingos/plugins/hardware';

// IMU Sensor (MPU6050, MPU9250, LSM6DS3, BNO055)
const imu = new IMUSensor({
  chip: 'MPU9250',
  i2cAddress: 0x68,
  accelRange: '4g',
  gyroRange: '500dps',
  sampleRate: 100,
});

await imu.initialize();
await imu.calibrate();

imu.on('data', (data) => {
  console.log(`Accel: ${data.accel.x}, ${data.accel.y}, ${data.accel.z}`);
  console.log(`Gyro: ${data.gyro.x}, ${data.gyro.y}, ${data.gyro.z}`);
  console.log(`Mag: ${data.mag.x}, ${data.mag.y}, ${data.mag.z}`);
});

// GPS Sensor (NEO-6M, NEO-7M, NEO-M8N, BN-220)
const gps = new GPSSensor({
  chip: 'NEO-M8N',
  serialPort: '/dev/ttyUSB0',
  baudRate: 9600,
});

await gps.initialize();

gps.on('fix', (position) => {
  console.log(`Position: ${position.lat}, ${position.lon}`);
  console.log(`Altitude: ${position.altitude}m`);
  console.log(`Satellites: ${position.satellites}`);
  console.log(`Fix type: ${position.fixType}`); // none, 2D, 3D, DGPS
});

// Calculate distance and bearing
const distance = gps.distanceTo(targetLat, targetLon);
const bearing = gps.bearingTo(targetLat, targetLon);
```

### Actuators

```typescript
import { MotorActuator, ServoActuator, RelayActuator } from 'everythingos/plugins/hardware';

// DC Motor with encoder (L298N, TB6612)
const motor = new MotorActuator({
  driver: 'L298N',
  pins: { pwm: 18, dir1: 23, dir2: 24, encoder: 25 },
  type: 'dc',
  maxRPM: 200,
});

await motor.initialize();
await motor.setSpeed(0.5);  // 50% forward
await motor.setSpeed(-0.3); // 30% reverse
await motor.stop();

// Stepper Motor (A4988, DRV8825, TMC2209)
const stepper = new MotorActuator({
  driver: 'TMC2209',
  pins: { step: 18, dir: 23, enable: 24 },
  type: 'stepper',
  stepsPerRevolution: 200,
  microstepping: 16,
});

await stepper.initialize();
await stepper.moveSteps(1600); // One full revolution at 16x microstepping
await stepper.home({ endstopPin: 22, direction: -1 });

// Servo Motor
const servo = new ServoActuator({
  pin: 18,
  minPulse: 500,
  maxPulse: 2500,
  range: 180,
});

await servo.initialize();
await servo.setAngle(90);  // Move to center
await servo.setAngle(0);   // Move to minimum
await servo.setAngle(180); // Move to maximum

// Relay for digital switching
const relay = new RelayActuator({
  pin: 17,
  activeHigh: true,
});

await relay.initialize();
await relay.on();
await relay.off();
await relay.toggle();
```

## Trust Management

Control what plugins and agents can do with fine-grained permissions.

```typescript
import { PluginTrustManager } from 'everythingos/services/trust';

const trustManager = new PluginTrustManager();

// Set trust level for a plugin (trusted, restricted, sandboxed)
trustManager.setTrustLevel('my-plugin', 'restricted');

// Grant specific permissions
trustManager.grantPermission('my-plugin', {
  permission: 'network',
  scope: 'api.example.com',
  expiresAt: Date.now() + 86400000, // 24 hours
});

trustManager.grantPermission('my-plugin', {
  permission: 'filesystem',
  scope: '/data/plugin-storage',
});

// Set restrictions
trustManager.setRestrictions('my-plugin', {
  rateLimit: 100,        // requests per minute
  timeout: 5000,         // max execution time
  maxMemory: 50,         // MB
  maxCpu: 25,            // percentage
  blockedPatterns: ['/etc/*', '/root/*'],
});

// Check permissions before operations
if (trustManager.checkPermission('my-plugin', 'network', 'api.example.com')) {
  // Allowed to make network request
}

// View audit trail
const violations = trustManager.getViolations('my-plugin');
for (const v of violations) {
  console.log(`${v.timestamp}: ${v.permission} - ${v.details}`);
}
```

**Permission Types:**
- `network`: HTTP/WebSocket connections
- `filesystem`: File read/write
- `state`: World state access
- `events`: Event bus pub/sub
- `agents`: Agent communication
- `hardware`: GPIO/I2C/SPI access
- `execute`: Shell command execution
- `memory`: Long-term memory access
- `llm`: LLM API calls
- `secrets`: Environment variables
- `spawn`: Child process creation
- `scheduler`: Cron/timer creation
- `plugins`: Other plugin invocation
- `admin`: System administration
- `audit`: Audit log access
- `trust`: Trust level modification

## Explainability

Audit and explain every decision made by agents.

```typescript
import { DecisionExplainability } from 'everythingos/services/explainability';

const explainability = new DecisionExplainability();

// Record a decision
await explainability.recordDecision({
  agentId: 'decision-agent-1',
  decisionType: 'action-approval',
  input: {
    action: 'send-notification',
    target: 'user@example.com',
  },
  output: {
    approved: true,
    confidence: 0.87,
  },
  reasoning: 'User preferences indicate notifications are enabled',
  keyFactors: [
    { factor: 'user-preference', value: 'notifications-enabled', weight: 0.6 },
    { factor: 'time-of-day', value: 'business-hours', weight: 0.3 },
    { factor: 'urgency', value: 'medium', weight: 0.1 },
  ],
  alternatives: [
    { option: 'delay-notification', confidence: 0.65 },
    { option: 'suppress-notification', confidence: 0.23 },
  ],
});

// Record outcome after execution
await explainability.recordOutcome(decisionId, {
  success: true,
  effects: ['notification-sent', 'user-acknowledged'],
  executionTime: 245,
});

// Query decisions
const decisions = await explainability.queryDecisions({
  agentId: 'decision-agent-1',
  type: 'action-approval',
  status: 'approved',
  minConfidence: 0.8,
  since: Date.now() - 86400000, // Last 24 hours
});

// Generate human-readable explanation
const explanation = await explainability.explain(decisionId);
console.log(explanation);
// Output:
// ## Decision: action-approval
// **Agent:** decision-agent-1
// **Time:** 2024-01-15 14:32:00
//
// **Input:** Send notification to user@example.com
// **Decision:** Approved (87% confidence)
//
// **Key Factors:**
// - User preference: notifications enabled (60% weight)
// - Time of day: business hours (30% weight)
// - Urgency: medium (10% weight)
//
// **Alternatives Considered:**
// - Delay notification (65% confidence)
// - Suppress notification (23% confidence)
//
// **Outcome:** Success (245ms execution)

// Get statistics
const stats = explainability.getStatistics();
console.log(`Approval rate: ${stats.approvalRate}%`);
console.log(`Avg confidence: ${stats.avgConfidence}`);
console.log(`Success rate: ${stats.successRate}%`);
```

## Approval Gate & Intent System

Human-in-the-loop approval for sensitive operations.

### Approval Gate Agent

```typescript
import { ApprovalGateAgent } from 'everythingos/agents/decision';

const approvalGate = new ApprovalGateAgent({
  defaultTimeout: 300000, // 5 minutes
  notificationChannels: ['cli', 'slack', 'webhook'],
  autoApproveRules: [
    { riskLevel: 'low', autoApprove: true },
    { agentId: 'trusted-agent', autoApprove: true },
  ],
});

await approvalGate.start();

// Request approval for an action
const approval = await approvalGate.requestApproval({
  action: 'deploy-production',
  agentId: 'deployment-agent',
  riskLevel: 'high',
  details: {
    version: '2.1.0',
    environment: 'production',
    rollbackPlan: 'automatic',
  },
  requiredApprovers: 1,
});

if (approval.approved) {
  console.log(`Approved by ${approval.approver}`);
  // Proceed with deployment
} else {
  console.log(`Denied: ${approval.reason}`);
}

// View pending approvals
const pending = approvalGate.getPendingApprovals();
for (const request of pending) {
  console.log(`${request.id}: ${request.action} (${request.riskLevel})`);
}

// View approval history
const history = approvalGate.getApprovalHistory({ limit: 50 });
const stats = approvalGate.getStatistics();
console.log(`Approval rate: ${stats.approvalRate}%`);
```

### Intent Contracts

Declare agent intentions with constraints and dependencies.

```typescript
import { IntentManager, IntentBuilder } from 'everythingos/runtime';

const intentManager = new IntentManager();

// Build an intent with fluent API
const intent = new IntentBuilder()
  .communicate('notify-user', {
    channel: 'email',
    recipient: 'user@example.com',
    message: 'Task completed',
  })
  .withPriority('high')
  .requiresApproval()
  .withTimeout(30000)
  .withRetry({ maxAttempts: 3, backoff: 'exponential' })
  .dependsOn('task-complete')
  .excludes('silent-mode')
  .build();

// Submit intent for execution
const result = await intentManager.submit(intent);

// Compound intents for multi-step operations
const workflow = new IntentBuilder()
  .compound([
    IntentBuilder.query('get-user-data', { userId: '123' }),
    IntentBuilder.execute('process-data', { transform: 'normalize' }),
    IntentBuilder.store('save-results', { destination: 'database' }),
  ])
  .withPriority('medium')
  .build();

await intentManager.submit(workflow);

// Query intent history
const history = intentManager.getHistory({
  status: 'completed',
  type: 'execute',
  since: Date.now() - 3600000,
});
```

### Tool Registry

Central registry for agent tools with permission controls.

```typescript
import { ToolRegistry } from 'everythingos/services/tools';

const toolRegistry = new ToolRegistry();

// Register a tool
toolRegistry.register({
  name: 'send-email',
  description: 'Send an email to a recipient',
  trustLevel: 'moderate', // safe, moderate, sensitive, dangerous
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'string', format: 'email' },
      subject: { type: 'string', maxLength: 200 },
      body: { type: 'string' },
    },
    required: ['to', 'subject', 'body'],
  },
  handler: async (params, context) => {
    // Validate and execute
    await sendEmail(params.to, params.subject, params.body);
    return { success: true, messageId: '...' };
  },
  requiresApproval: true,
  timeout: 10000,
});

// Grant tool access to an agent
toolRegistry.grantAccess('my-agent', 'send-email');

// Execute tool (with approval if required)
const result = await toolRegistry.execute('send-email', {
  to: 'user@example.com',
  subject: 'Hello',
  body: 'World',
}, {
  agentId: 'my-agent',
  requestId: 'req-123',
});

// Generate tool prompts for LLM
const toolPrompt = toolRegistry.generatePrompt('my-agent');

// View execution audit log
const auditLog = toolRegistry.getAuditLog({ tool: 'send-email', limit: 100 });
```

## Directory Structure

```
everythingos/
├── src/
│   ├── core/
│   │   ├── event-bus/       # Event system with priority and dead letter queues
│   │   ├── workflow/        # Workflow engine and node execution
│   │   ├── supervisor/      # Agent health monitoring and policies
│   │   ├── state/           # World state and snapshot management
│   │   └── registry/        # Agent and plugin registration
│   ├── services/
│   │   ├── memory/          # Three-layer memory architecture
│   │   │   ├── WorkingMemory.ts      # Short-term scoped memory
│   │   │   ├── EpisodicMemory.ts     # Conversation history
│   │   │   ├── LongTermMemory.ts     # Persistent knowledge
│   │   │   ├── MemoryService.ts      # Unified memory interface
│   │   │   └── adapters/             # Storage backends
│   │   ├── trust/           # Trust management
│   │   │   └── PluginTrustManager.ts # Permission and sandbox control
│   │   ├── explainability/  # Decision audit and explanation
│   │   │   └── DecisionExplainability.ts
│   │   └── tools/           # Tool registry and execution
│   │       └── ToolRegistry.ts       # Centralized tool management
│   ├── runtime/
│   │   ├── Agent.ts         # Base agent class
│   │   ├── LLMRouter.ts     # LLM provider abstraction
│   │   ├── IntentContract.ts # Intent declaration and management
│   │   └── providers/       # OpenAI, Claude, Gemini, Local providers
│   ├── agents/              # Built-in agent implementations
│   │   ├── perception/      # Monitoring and observation agents
│   │   ├── analysis/        # Data processing agents
│   │   ├── decision/        # Decision-making agents
│   │   │   └── ApprovalGateAgent.ts  # Human-in-the-loop approval
│   │   ├── execution/       # Action-taking agents
│   │   └── learning/        # Learning and optimization agents
│   ├── workflows/           # Workflow definitions
│   ├── plugins/             # Platform integrations
│   │   ├── discord/
│   │   ├── slack/
│   │   ├── github/
│   │   ├── platforms/       # Hardware platform support
│   │   │   ├── JetsonPlatform.ts     # NVIDIA Jetson integration
│   │   │   ├── RaspberryPiPlatform.ts # Raspberry Pi integration
│   │   │   └── DeploymentManager.ts  # Fleet management & OTA
│   │   ├── robotics/        # Robotics integration
│   │   │   ├── ROS2Bridge.ts         # ROS2 communication
│   │   │   ├── MotionController.ts   # Multi-joint motion
│   │   │   └── SafetyMonitor.ts      # Real-time safety
│   │   ├── swarm/           # Multi-agent coordination
│   │   │   ├── SwarmCoordinator.ts   # Task allocation & consensus
│   │   │   ├── FormationController.ts # Multi-robot formations
│   │   │   └── MeshNetwork.ts        # Distributed networking
│   │   └── hardware/        # Sensors and actuators
│   │       ├── _base/               # Base classes
│   │       │   ├── SensorPlugin.ts
│   │       │   └── ActuatorPlugin.ts
│   │       ├── sensors/
│   │       │   ├── IMUSensor.ts
│   │       │   ├── GPSSensor.ts
│   │       │   └── TemperatureSensor.ts
│   │       ├── actuators/
│   │       │   ├── MotorActuator.ts
│   │       │   ├── ServoActuator.ts
│   │       │   └── RelayActuator.ts
│   │       └── protocols/           # Communication protocols
│   │           ├── I2CProtocol.ts
│   │           ├── SerialProtocol.ts
│   │           └── MQTTProtocol.ts
│   ├── api/                 # REST API server
│   └── config/              # System configuration
├── BRIDGES.md               # Bridge architecture documentation
├── package.json
└── tsconfig.json
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/workflows` | List all workflows |
| POST | `/api/workflows/:id/execute` | Execute a workflow |
| GET | `/api/agents` | List all agents |
| POST | `/api/agents/:id/start` | Start an agent |
| POST | `/api/agents/:id/stop` | Stop an agent |
| GET | `/api/plugins` | List all plugins |
| POST | `/api/events` | Emit an event |
| GET | `/api/state` | Get world state |
| POST | `/api/state/snapshot` | Create state snapshot |
| POST | `/api/memory/remember` | Store in long-term memory |
| POST | `/api/memory/recall` | Semantic search memory |
| GET | `/api/memory/conversation/:id` | Get conversation history |
| GET | `/api/memory/stats` | Get memory statistics |
| GET | `/api/trust/:pluginId` | Get plugin trust level |
| PUT | `/api/trust/:pluginId` | Set plugin trust level |
| GET | `/api/trust/:pluginId/permissions` | List plugin permissions |
| POST | `/api/trust/:pluginId/permissions` | Grant permission |
| GET | `/api/trust/:pluginId/violations` | Get violation audit log |
| GET | `/api/decisions` | Query decision history |
| GET | `/api/decisions/:id` | Get decision details |
| GET | `/api/decisions/:id/explain` | Generate decision explanation |
| GET | `/api/decisions/stats` | Get decision statistics |
| GET | `/api/approvals` | List pending approvals |
| POST | `/api/approvals/:id/approve` | Approve a request |
| POST | `/api/approvals/:id/deny` | Deny a request |
| GET | `/api/approvals/history` | Get approval history |
| GET | `/api/tools` | List registered tools |
| POST | `/api/tools/:name/execute` | Execute a tool |
| GET | `/api/tools/audit` | Get tool execution audit log |
| POST | `/api/intents` | Submit an intent |
| GET | `/api/intents/:id` | Get intent status |
| GET | `/api/swarm/agents` | List swarm agents |
| POST | `/api/swarm/task` | Assign a task to swarm |
| POST | `/api/swarm/consensus` | Request swarm consensus |
| GET | `/api/hardware/platforms` | List detected platforms |
| GET | `/api/hardware/sensors` | List available sensors |
| GET | `/api/hardware/actuators` | List available actuators |
| POST | `/api/ros2/publish` | Publish to ROS2 topic |
| POST | `/api/ros2/service` | Call ROS2 service |
| GET | `/api/safety/zones` | List safety zones |
| GET | `/api/safety/violations` | Get safety violation log |

## Environment Variables

```bash
# LLM Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Platform Integrations
DISCORD_BOT_TOKEN=...
SLACK_BOT_TOKEN=...
GITHUB_TOKEN=...

# System Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

## Examples

### Multi-Agent Collaboration

```typescript
// Perception agent detects mentions
class MentionDetector extends Agent {
  protected async onStart() {
    this.subscribe('discord:message', async (event) => {
      if (event.payload.mentions.includes(this.config.botId)) {
        this.emit('mention:detected', event.payload);
      }
    });
  }
  // ...
}

// Analysis agent determines sentiment
class SentimentAnalyzer extends Agent {
  protected async onStart() {
    this.subscribe('mention:detected', async (event) => {
      const sentiment = await this.analyzeSentiment(event.payload);
      this.emit('mention:analyzed', { ...event.payload, sentiment });
    });
  }
  // ...
}

// Decision agent decides on response
class ReplyDecider extends Agent {
  protected async onStart() {
    this.subscribe('mention:analyzed', async (event) => {
      const decision = await this.decideResponse(event.payload);
      if (decision.shouldReply) {
        this.emit('reply:approved', { ...event.payload, ...decision });
      }
    });
  }
  // ...
}

// Execution agent sends the reply
class ReplyExecutor extends Agent {
  protected async onStart() {
    this.subscribe('reply:approved', async (event) => {
      await this.sendReply(event.payload);
      this.emit('reply:sent', event.payload);
    });
  }
  // ...
}
```

## Best Practices

1. **Single Responsibility**: Each agent should have one clear purpose
2. **Event-Driven**: Use events for agent communication, not direct calls
3. **Stateless When Possible**: Store state only when necessary
4. **Error Handling**: Always handle errors and emit error events
5. **Logging**: Use the built-in logging for debugging and monitoring
6. **Type Safety**: Leverage TypeScript for type-safe event payloads
7. **Testing**: Test agents in isolation before integration
8. **Resource Cleanup**: Always clean up resources in `onStop()`
9. **LLM Efficiency**: Cache LLM responses when appropriate
10. **Monitoring**: Use the supervisor and health checks

## Contributing

Contributions are welcome. Please open an issue or pull request.

## License

MIT © m0rs3c0d3
