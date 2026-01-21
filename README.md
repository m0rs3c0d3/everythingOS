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
- **Plugin System**: Extensible integrations with Discord, Slack, GitHub, and more

Think of it as an operating system where instead of running programs, you run intelligent agents that can perceive their environment, make decisions, take actions, and learn from the results.

## What's New in Latest Version

### Major Features Added

**Intent Contract System**
- Structured decision-making framework separating agent decisions from execution
- Built-in approval workflows and safety controls
- Confidence scoring and reasoning transparency

**Tool Registry & Built-in Tools**
- Centralized tool management with trust levels
- Automatic approval flows for dangerous operations
- Built-in calculator, file operations, and web search tools

**Three-Layer Memory Architecture**
- Working Memory: Short-term, scoped context for active tasks
- Episodic Memory: Conversation and event history with temporal indexing
- Long-Term Memory: Persistent knowledge base with semantic search

**Services Layer**
- Clean separation between runtime, services, and core
- Capability Discovery for dynamic system introspection
- Improved modularity and extensibility

**Enhanced Runtime**
- Updated Agent base class with context management
- Improved LLM Router with better provider support
- Action type system for structured agent outputs

## Why Use Agents?

Agents are autonomous entities that can operate independently to solve problems. Unlike traditional scripts or APIs, agents:

- **Adapt to changing conditions**: Agents can perceive their environment and adjust their behavior accordingly
- **Make intelligent decisions**: Using LLMs, agents can reason about complex situations and choose appropriate actions
- **Work asynchronously**: Agents run independently and communicate through events, enabling parallel execution
- **Specialize and collaborate**: Different agent types (perception, analysis, decision, execution, learning) can work together on complex tasks
- **Handle uncertainty**: Agents can deal with incomplete information and make probabilistic decisions
- **Scale naturally**: Add more agents to handle increased load or new capabilities without rewriting existing code

### Real-World Use Cases

- **Social Media Management**: Perception agents monitor mentions, decision agents determine responses, execution agents post replies
- **Customer Support**: Analysis agents understand queries, decision agents route to appropriate handlers, learning agents improve over time
- **DevOps Automation**: Monitoring agents detect issues, decision agents triage severity, execution agents apply fixes
- **Research Assistants**: Agents can search, summarize, synthesize information, and maintain context across long investigations

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
┌───────────────────────────────────────────────────────────────────────────┐
│                            EVERYTHINGOS                                    │
├───────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────── CORE LAYER ─────────────────────────────────┐ │
│  │                                                                       │ │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐   │ │
│  │  │EVENT BUS │  │ WORKFLOW │  │SUPERVISOR │  │      STATE       │   │ │
│  │  │• Pub/Sub │  │ • Engine │  │ • Health  │  │ • World State    │   │ │
│  │  │• Priority│  │ • Nodes  │  │ • Policies│  │ • Snapshots      │   │ │
│  │  │• Dead Ltr│  │ • Trigger│  │ • Approval│  │ • Time Travel    │   │ │
│  │  └──────────┘  └──────────┘  └───────────┘  └──────────────────┘   │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                     │                                      │
│  ┌──────────────────────── SERVICES LAYER ────────────────────────────┐ │
│  │                                                                       │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐    │ │
│  │  │   MEMORY    │  │    TOOLS    │  │   INTENT CONTRACT        │    │ │
│  │  │ • Working   │  │ • Registry  │  │ • Intent Bus             │    │ │
│  │  │ • Episodic  │  │ • Built-in  │  │ • Approval Flow          │    │ │
│  │  │ • Long-term │  │ • Trust     │  │ • Decision → Execution   │    │ │
│  │  └─────────────┘  └─────────────┘  └──────────────────────────┘    │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                     │                                      │
│  ┌──────────────────────── RUNTIME LAYER ─────────────────────────────┐ │
│  │                                                                       │ │
│  │  ┌────────────────────────────────────────────────────────────────┐ │ │
│  │  │                       LLM ROUTER                                │ │ │
│  │  │   OpenAI │ Claude │ Gemini │ Ollama │ Custom Providers         │ │ │
│  │  └────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  │  ┌────────────────────────────────────────────────────────────────┐ │ │
│  │  │                       AGENT RUNTIME                             │ │ │
│  │  │  Perception │ Analysis │ Decision │ Execution │ Learning        │ │ │
│  │  └────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                     │                                      │
│  ┌──────────────────────── PLUGIN LAYER ───────────────────────────────┐ │
│  │                                                                       │ │
│  │  Discord │ Slack │ X │ Email │ GitHub │ Calendar │ Crypto │ Custom   │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────────────┤
│                             REST API SERVER                                │
└───────────────────────────────────────────────────────────────────────────┘
```

## Recent Updates

### Intent Contract System (New!)

Agents now express their decisions through a structured Intent Contract system. Instead of directly taking actions, decision agents emit intents that are processed through an approval and execution pipeline.

```typescript
import { intentBus, Intent } from 'everythingos';

// Decision agent emits an intent
const intent: Intent = {
  id: crypto.randomUUID(),
  type: 'communicate',
  action: 'send_message',
  target: 'discord',
  payload: {
    channel: '#general',
    message: 'Hello!'
  },
  confidence: 0.85,
  reasoning: 'User requested a greeting',
  priority: 'normal',
  constraints: {
    maxRetries: 3,
    timeout: 5000
  }
};

intentBus.submit(intent);
```

**Intent Types:**
- `communicate` - Send messages to platforms
- `execute` - Run tools or actions
- `query` - Request information
- `store` - Save to memory
- `schedule` - Schedule future actions
- `delegate` - Hand off to another agent
- `escalate` - Escalate to human
- `wait` - Wait for conditions
- `cancel` - Cancel previous intent
- `compound` - Multiple intents

**Intent Lifecycle:**
1. **Pending** - Intent submitted by agent
2. **Approved** - Passed approval checks
3. **Executing** - Currently running
4. **Completed** - Successfully executed
5. **Failed/Denied/Cancelled** - Terminal states

### Tool Registry (New!)

The Tool Registry provides centralized management of all tools available to agents, with built-in approval workflows and safety controls.

```typescript
import { toolRegistry } from 'everythingos';

// Register a tool
toolRegistry.register({
  name: 'send_email',
  description: 'Send an email to a recipient',
  category: 'communication',
  trustLevel: 'sensitive',
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body' }
    },
    required: ['to', 'subject', 'body']
  },
  handler: async (params, context) => {
    // Send email logic
    return { success: true, messageId: 'msg-123' };
  }
});

// Execute a tool (with automatic approval flow)
const result = await toolRegistry.execute(
  'send_email',
  { to: 'user@example.com', subject: 'Hello', body: 'Hi there!' },
  { agentId: 'my-agent' }
);
```

**Trust Levels:**
- `trusted` - Pre-approved, no confirmation needed
- `standard` - Normal tools, logged but auto-approved
- `sensitive` - Requires approval for sensitive operations
- `dangerous` - Always requires explicit approval

**Built-in Tools:**
- `calculator` - Mathematical operations
- `file_read` / `file_write` - File operations
- `web_search` - Internet search
- More coming soon!

### Memory Services (New!)

EverythingOS now includes a comprehensive three-layer memory architecture:

#### Working Memory
Short-term, scoped memory for active tasks. Automatically managed per agent/context.

```typescript
import { memoryService } from 'everythingos';

// Get scoped working memory
const memory = memoryService.getWorkingMemory('my-agent');

// Store and retrieve
memory.set('user_preference', { theme: 'dark' });
const pref = memory.get('user_preference');

// Clear when done
memory.clear();
```

#### Episodic Memory
Stores conversations, events, and interactions with temporal context.

```typescript
// Start a conversation
const conversationId = await memoryService.startConversation({
  participants: ['user-123', 'agent-assistant'],
  metadata: { channel: 'discord' }
});

// Add turns to conversation
await memoryService.addConversationTurn(conversationId, {
  speaker: 'user-123',
  content: 'What is the weather today?',
  timestamp: new Date()
});

// Retrieve conversation history
const conversation = await memoryService.getConversation(conversationId);
```

#### Long-Term Memory
Persistent knowledge base with semantic search capabilities.

```typescript
// Store knowledge
await memoryService.rememberLongTerm({
  content: 'User prefers communication in the morning',
  type: 'fact',
  tags: ['user-preference', 'communication'],
  importance: 0.8
});

// Semantic search (when vector DB configured)
const memories = await memoryService.searchSemantic({
  query: 'user communication preferences',
  limit: 5,
  minRelevance: 0.7
});
```

**Memory Adapters:**
- `InMemoryAdapter` - Default, in-memory storage
- `RedisAdapter` - Redis-backed persistence (coming soon)
- `PostgresAdapter` - PostgreSQL storage (coming soon)
- Custom adapters - Implement `MemoryAdapter` interface

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

## Directory Structure

```
everythingos/
├── src/
│   ├── core/                          # Core OS components
│   │   ├── event-bus/                 # Event system
│   │   │   ├── EventBus.ts           # Main pub/sub implementation
│   │   │   ├── PriorityQueue.ts      # Priority queue for events
│   │   │   └── DeadLetterQueue.ts    # Failed event handling
│   │   ├── workflow/                  # Workflow engine
│   │   │   ├── WorkflowEngine.ts     # Workflow execution
│   │   │   ├── WorkflowRegistry.ts   # Workflow management
│   │   │   └── WorkflowTypes.ts      # Type definitions
│   │   ├── supervisor/                # Agent supervision
│   │   │   ├── SupervisorAgent.ts    # Health monitoring
│   │   │   └── PolicyEngine.ts       # Policy enforcement
│   │   ├── state/                     # State management
│   │   │   ├── WorldState.ts         # Global state
│   │   │   └── SnapshotManager.ts    # State snapshots
│   │   └── registry/                  # Registries
│   │       ├── AgentRegistry.ts      # Agent management
│   │       └── PluginRegistry.ts     # Plugin management
│   ├── runtime/                       # Agent runtime
│   │   ├── Agent.ts                  # Base agent class
│   │   ├── AgentContext.ts           # Agent execution context
│   │   ├── LLMRouter.ts              # LLM provider router
│   │   ├── IntentContract.ts         # Intent system (NEW!)
│   │   ├── ActionTypes.ts            # Action type definitions
│   │   └── providers/                # LLM providers
│   │       ├── OpenAIProvider.ts
│   │       ├── ClaudeProvider.ts
│   │       ├── GeminiProvider.ts
│   │       └── LocalProvider.ts
│   ├── services/                      # Service layer (NEW!)
│   │   ├── memory/                   # Memory services
│   │   │   ├── MemoryService.ts     # Unified memory interface
│   │   │   ├── WorkingMemory.ts     # Short-term memory
│   │   │   ├── EpisodicMemory.ts    # Conversation memory
│   │   │   ├── LongTermMemory.ts    # Knowledge base
│   │   │   ├── MemoryTypes.ts       # Type definitions
│   │   │   └── adapters/            # Storage adapters
│   │   │       └── InMemoryAdapter.ts
│   │   ├── tools/                    # Tool registry (NEW!)
│   │   │   ├── ToolRegistry.ts      # Tool management
│   │   │   ├── ToolTypes.ts         # Tool definitions
│   │   │   └── builtin/             # Built-in tools
│   │   │       ├── calculator.ts
│   │   │       ├── file-ops.ts
│   │   │       └── web-search.ts
│   │   └── capabilities/             # Capability discovery
│   │       └── CapabilityDiscovery.ts
│   ├── agents/                        # Agent implementations
│   │   └── decision/
│   │       └── ConversationDecisionAgent.ts
│   ├── workflows/                     # Workflow definitions
│   │   └── SocialReply.workflow.ts
│   ├── plugins/                       # Platform integrations
│   │   └── discord/
│   │       └── index.ts
│   ├── api/                           # REST API
│   │   └── server.ts
│   ├── config/                        # Configuration
│   │   └── system.ts
│   └── index.ts                       # Main exports
├── package.json
└── tsconfig.json
```

### Capability Discovery

The Capability Discovery service enables agents to understand and advertise their capabilities dynamically.

```typescript
import { capabilityDiscovery } from 'everythingos';

// Register agent capabilities
capabilityDiscovery.registerCapability({
  agentId: 'weather-agent',
  capability: 'weather_forecast',
  description: 'Provides weather forecasts for locations',
  inputSchema: {
    type: 'object',
    properties: {
      location: { type: 'string' },
      days: { type: 'number' }
    }
  },
  outputSchema: {
    type: 'object',
    properties: {
      forecast: { type: 'array' }
    }
  }
});

// Discover available capabilities
const weatherCapabilities = capabilityDiscovery.findCapabilities({
  capability: 'weather_forecast'
});

// Find agents that can handle a task
const agents = capabilityDiscovery.findAgentsForTask('get weather information');
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
| GET | `/api/memory/conversations` | List conversations (NEW) |
| POST | `/api/memory/conversations` | Create conversation (NEW) |
| GET | `/api/tools` | List available tools (NEW) |
| POST | `/api/tools/:name/execute` | Execute a tool (NEW) |
| POST | `/api/intents` | Submit an intent (NEW) |
| GET | `/api/intents/:id` | Get intent status (NEW) |

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

### Complete Multi-Agent Workflow with Intent System

This example shows how to build a complete social media reply system using the new Intent Contract system, Memory Services, and Tool Registry.

```typescript
import {
  Agent, AgentConfig, eventBus, memoryService,
  toolRegistry, intentBus, Intent
} from 'everythingos';

// ─────────────────────────────────────────────────────────────────────────────
// 1. PERCEPTION AGENT - Detects mentions
// ─────────────────────────────────────────────────────────────────────────────
class MentionDetectorAgent extends Agent {
  constructor() {
    super({
      id: 'mention-detector',
      name: 'Mention Detector',
      type: 'perception',
      description: 'Monitors Discord for mentions'
    });
  }

  protected async onStart(): Promise<void> {
    this.subscribe('discord:message', async (event) => {
      const { message, author, channel } = event.payload;

      if (message.mentions.includes(this.config.botId)) {
        // Store in episodic memory
        const convId = await memoryService.findOrCreateConversation({
          participants: [author, 'bot'],
          channel
        });

        await memoryService.addConversationTurn(convId, {
          speaker: author,
          content: message.content,
          timestamp: new Date()
        });

        // Emit for analysis
        this.emit('mention:detected', {
          conversationId: convId,
          message,
          author,
          channel
        });
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ANALYSIS AGENT - Analyzes sentiment and context
// ─────────────────────────────────────────────────────────────────────────────
class SentimentAnalysisAgent extends Agent {
  constructor() {
    super({
      id: 'sentiment-analyzer',
      name: 'Sentiment Analyzer',
      type: 'analysis',
      description: 'Analyzes message sentiment and context',
      llm: {
        provider: 'claude',
        model: 'claude-sonnet-4-20250514',
        temperature: 0.3
      }
    });
  }

  protected async onStart(): Promise<void> {
    this.subscribe('mention:detected', async (event) => {
      const { conversationId, message } = event.payload;

      // Get conversation history from memory
      const history = await memoryService.getConversation(conversationId);

      // Analyze with LLM
      const analysis = await this.think(
        `Analyze this message sentiment and intent:\n\n${message.content}\n\nConversation history: ${JSON.stringify(history)}`,
        {
          systemPrompt: 'You are a sentiment analyzer. Return JSON with: sentiment, intent, urgency (0-1), topics.'
        }
      );

      const parsed = JSON.parse(analysis);

      // Emit analyzed data
      this.emit('mention:analyzed', {
        ...event.payload,
        sentiment: parsed.sentiment,
        intent: parsed.intent,
        urgency: parsed.urgency,
        topics: parsed.topics
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DECISION AGENT - Decides how to respond
// ─────────────────────────────────────────────────────────────────────────────
class ReplyDecisionAgent extends Agent {
  constructor() {
    super({
      id: 'reply-decider',
      name: 'Reply Decision Agent',
      type: 'decision',
      description: 'Decides if and how to respond',
      llm: {
        provider: 'claude',
        model: 'claude-sonnet-4-20250514',
        temperature: 0.7
      }
    });
  }

  protected async onStart(): Promise<void> {
    this.subscribe('mention:analyzed', async (event) => {
      const { conversationId, message, sentiment, intent, urgency, topics } = event.payload;

      // Check user preferences from long-term memory
      const prefs = await memoryService.searchSemantic({
        query: `user ${event.payload.author} preferences communication style`,
        limit: 3
      });

      // Make decision with LLM
      const decision = await this.think(
        `Should we reply to this message? Consider sentiment: ${sentiment}, intent: ${intent}, urgency: ${urgency}\n\nMessage: ${message.content}\n\nUser preferences: ${JSON.stringify(prefs)}`,
        {
          systemPrompt: 'Decide if we should reply. Return JSON: { shouldReply: boolean, responseType: string, tone: string, confidence: number, reasoning: string }'
        }
      );

      const parsed = JSON.parse(decision);

      if (parsed.shouldReply) {
        // Generate response content
        const response = await this.think(
          `Generate a ${parsed.tone} response to: ${message.content}`,
          {
            systemPrompt: `You are a helpful assistant. Be ${parsed.tone}. Keep it concise.`
          }
        );

        // Create intent for execution
        const replyIntent: Intent = {
          id: crypto.randomUUID(),
          type: 'communicate',
          action: 'send_discord_message',
          target: 'discord',
          payload: {
            channel: event.payload.channel,
            message: response,
            replyTo: message.id
          },
          confidence: parsed.confidence,
          reasoning: parsed.reasoning,
          priority: urgency > 0.7 ? 'high' : 'normal',
          constraints: {
            maxRetries: 3,
            timeout: 5000
          },
          context: {
            conversationId,
            sentiment,
            topics
          }
        };

        // Submit intent (will go through approval if needed)
        intentBus.submit(replyIntent);

        // Store decision in working memory
        const memory = memoryService.getWorkingMemory(this.id);
        memory.set(`decision:${conversationId}`, parsed);
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. EXECUTION AGENT - Executes approved intents
// ─────────────────────────────────────────────────────────────────────────────
class MessageExecutionAgent extends Agent {
  constructor() {
    super({
      id: 'message-executor',
      name: 'Message Executor',
      type: 'execution',
      description: 'Executes approved communication intents'
    });
  }

  protected async onStart(): Promise<void> {
    // Subscribe to approved communicate intents
    intentBus.onApproved('communicate', async (intent) => {
      try {
        // Update intent status
        intentBus.updateStatus(intent.id, 'executing');

        // Execute using tool registry
        const result = await toolRegistry.execute(
          intent.action,
          intent.payload,
          { agentId: this.id, intentId: intent.id }
        );

        // Mark as completed
        intentBus.updateStatus(intent.id, 'completed', result);

        // Store in episodic memory
        if (intent.context?.conversationId) {
          await memoryService.addConversationTurn(
            intent.context.conversationId,
            {
              speaker: 'bot',
              content: intent.payload.message,
              timestamp: new Date(),
              metadata: { intentId: intent.id }
            }
          );
        }

        this.emit('message:sent', {
          intentId: intent.id,
          result
        });

      } catch (error) {
        intentBus.updateStatus(intent.id, 'failed', { error: String(error) });
        this.log('error', 'Failed to execute intent', { intent, error });
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. LEARNING AGENT - Learns from outcomes
// ─────────────────────────────────────────────────────────────────────────────
class ResponseLearningAgent extends Agent {
  constructor() {
    super({
      id: 'response-learner',
      name: 'Response Learning Agent',
      type: 'learning',
      description: 'Learns from response effectiveness'
    });
  }

  protected async onStart(): Promise<void> {
    this.subscribe('message:sent', async (event) => {
      // Track in working memory for short-term analysis
      const memory = memoryService.getWorkingMemory(this.id);
      const responses = memory.get('recent_responses') || [];
      responses.push({
        intentId: event.payload.intentId,
        timestamp: new Date(),
        ...event.payload.result
      });
      memory.set('recent_responses', responses.slice(-100));
    });

    // Listen for user reactions (likes, replies, etc.)
    this.subscribe('discord:reaction', async (event) => {
      // Find the original intent and learn from the outcome
      // Store insights in long-term memory
      await memoryService.rememberLongTerm({
        content: `User reacted ${event.payload.reaction} to bot message`,
        type: 'feedback',
        tags: ['learning', 'user-feedback'],
        importance: 0.7,
        metadata: event.payload
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// USAGE: Start the system
// ─────────────────────────────────────────────────────────────────────────────
import { agentRegistry } from 'everythingos';

async function startReplySystem() {
  // Register all agents
  const agents = [
    new MentionDetectorAgent(),
    new SentimentAnalysisAgent(),
    new ReplyDecisionAgent(),
    new MessageExecutionAgent(),
    new ResponseLearningAgent()
  ];

  for (const agent of agents) {
    await agentRegistry.register(agent);
    await agent.start();
  }

  console.log('✅ Social reply system is running');
}

startReplySystem();
```

## Migration Guide

### Upgrading from Previous Versions

If you're upgrading from an earlier version of EverythingOS, here are the key changes:

#### Agent Base Class Updates

**Before:**
```typescript
import { Agent } from 'everythingos';

class MyAgent extends Agent {
  protected async onStart(): Promise<void> {
    this.setState('key', 'value');
  }
}
```

**After:**
```typescript
import { Agent, AgentConfig } from 'everythingos';

class MyAgent extends Agent {
  constructor(config: AgentConfig) {
    super(config);
  }

  protected async onStart(): Promise<void> {
    // Use context for state management
    this.context.state.set('key', 'value');
  }
}
```

#### Memory System

**Before:**
```typescript
// Direct state management
this.setState('user_data', data);
```

**After:**
```typescript
// Use Memory Service
import { memoryService } from 'everythingos';

// Working memory for temporary data
const memory = memoryService.getWorkingMemory(this.id);
memory.set('user_data', data);

// Long-term for persistent data
await memoryService.rememberLongTerm({
  content: 'User preference',
  type: 'fact',
  tags: ['user']
});
```

#### Tool Usage

**Before:**
```typescript
// Direct plugin calls
const result = await somePlugin.execute(params);
```

**After:**
```typescript
// Use Tool Registry
import { toolRegistry } from 'everythingos';

const result = await toolRegistry.execute(
  'tool_name',
  params,
  { agentId: this.id }
);
```

#### Decision Making

**Before:**
```typescript
// Direct action execution
this.emit('action:execute', { action: 'send_message' });
```

**After:**
```typescript
// Use Intent Contract
import { intentBus } from 'everythingos';

const intent = {
  id: crypto.randomUUID(),
  type: 'communicate',
  action: 'send_message',
  payload: { message: 'Hello' },
  confidence: 0.9,
  reasoning: 'User requested greeting',
  priority: 'normal'
};

intentBus.submit(intent);
```

## Best Practices

1. **Single Responsibility**: Each agent should have one clear purpose
2. **Event-Driven**: Use events for agent communication, not direct calls
3. **Use Memory Service**: Always access memory through MemoryService, not direct state
4. **Intent-Based Actions**: Decision agents should emit intents, not execute actions directly
5. **Tool Registry**: Register and use tools through the centralized registry
6. **Error Handling**: Always handle errors and emit error events
7. **Logging**: Use the built-in logging for debugging and monitoring
8. **Type Safety**: Leverage TypeScript for type-safe event payloads and intents
9. **Testing**: Test agents in isolation before integration
10. **Resource Cleanup**: Always clean up resources in `onStop()`
11. **Confidence Scoring**: Include confidence and reasoning in all decisions
12. **Monitoring**: Use the supervisor and health checks

## Contributing

Contributions are welcome. Please open an issue or pull request.

## License

MIT © m0rs3c0d3
