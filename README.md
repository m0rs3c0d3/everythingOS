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
┌─────────────────────────────────────────────────────────────────────────┐
│                           EVERYTHINGOS                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  EVENT   │  │ WORKFLOW │  │SUPERVISOR│  │  STATE   │  │  MEMORY  │ │
│  │   BUS    │  │ • Nodes  │  │ • Health │  │ • World  │  │ • Working│ │
│  │ • Pub/Sub│  │ • Trigger│  │ • Policy │  │ • Snapshot│ │ • Episod.│ │
│  │ • Priority│ └──────────┘  └──────────┘  └──────────┘  │ • LongTerm│ │
│  └──────────┘                                             └──────────┘ │
│       │                                                         │       │
│  ┌────┴─────────────────────────────────────────────────────────┴────┐ │
│  │                         LLM ROUTER                                 │ │
│  │   OpenAI │ Claude │ Gemini │ Ollama │ Custom                       │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                    │                                    │
│  ┌─────────────────────────────────┴─────────────────────────────────┐ │
│  │                           AGENTS                                   │ │
│  │   Perception │ Analysis │ Decision │ Execution │ Learning          │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                    │                                    │
│  ┌─────────────────────────────────┴─────────────────────────────────┐ │
│  │                          PLUGINS                                   │ │
│  │  Discord │ Slack │ X │ Email │ GitHub │ Calendar │ Crypto │ ...    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│                            REST API                                      │
└─────────────────────────────────────────────────────────────────────────┘
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
│   │   └── memory/          # Three-layer memory architecture
│   │       ├── WorkingMemory.ts      # Short-term scoped memory
│   │       ├── EpisodicMemory.ts     # Conversation history
│   │       ├── LongTermMemory.ts     # Persistent knowledge
│   │       ├── MemoryService.ts      # Unified memory interface
│   │       └── adapters/             # Storage backends
│   ├── runtime/
│   │   ├── Agent.ts         # Base agent class
│   │   ├── LLMRouter.ts     # LLM provider abstraction
│   │   └── providers/       # OpenAI, Claude, Gemini, Local providers
│   ├── agents/              # Built-in agent implementations
│   │   ├── perception/      # Monitoring and observation agents
│   │   ├── analysis/        # Data processing agents
│   │   ├── decision/        # Decision-making agents
│   │   ├── execution/       # Action-taking agents
│   │   └── learning/        # Learning and optimization agents
│   ├── workflows/           # Workflow definitions
│   ├── plugins/             # Platform integrations
│   │   ├── discord/
│   │   ├── slack/
│   │   ├── github/
│   │   └── ...
│   ├── api/                 # REST API server
│   └── config/              # System configuration
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
