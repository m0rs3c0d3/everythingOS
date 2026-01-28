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

# EverythingOS

**LLM-Agnostic Multi-Agent Operating System**

From chatbots to robot swarms — build autonomous agent systems that work with any LLM provider.

## Status

| Component | Status |
|-----------|--------|
| Core (EventBus, Agents, State) | ✅ Working |
| Foundation Agents (Clock, Health, Shutdown) | ✅ Working |
| Memory System | ✅ Working |
| Security (Auth, Rate Limiting, Audit) | ✅ Working |
| Observability (Metrics) | ✅ Working |
| Hardware Abstraction | ✅ Ready (needs hardware) |
| Raspberry Pi Platform | ✅ Ready (needs hardware) |
| Jetson Platform | ✅ Ready (needs hardware) |
| ROS2 Bridge | ✅ Ready (needs ROS2) |
| Swarm Coordination | ✅ Ready (needs multiple nodes) |
| REST API | 🔧 In Progress |
| Web Dashboard | 📋 Planned |
| Tests | 📋 Planned |

## Quick Start

**Requirements:** Node.js 20+ (recommend using [nvm](https://github.com/nvm-sh/nvm))

```bash
# Clone and install
git clone https://github.com/m0rs3c0d3/EverythingOS.git
cd EverythingOS
npm install

# Run the demo
npm run demo
```

You should see:
```
EverythingOS Demo Starting...

▶  STARTED clock
▶  STARTED health-monitor

Running! Press Ctrl+C to stop.

⏱  TICK #1
⏱  TICK #2
💚 HEALTH: healthy
⏱  TICK #3
```

### Interactive CLI

```bash
npm run demo:cli
```

| Key | Action |
|-----|--------|
| `s` | Show status |
| `e` | Emit test event |
| `q` | Quit |

## What is EverythingOS?

EverythingOS is a TypeScript framework for building autonomous AI agents that work together. Think of it as an operating system where instead of running programs, you run intelligent agents.

**Core Features:**
- **Event-Driven Architecture** — Agents communicate through pub/sub with priority queuing
- **LLM Abstraction** — Switch between OpenAI, Claude, Gemini, or local models
- **Agent Lifecycle** — Built-in supervision, health monitoring, automatic recovery
- **Three-Layer Memory** — Working, episodic, and long-term memory for learning
- **Hardware Ready** — Direct integration with Raspberry Pi, Jetson, ROS2

**Design Philosophy:**
> Most agent frameworks assume the world is safe, fast, and reversible. EverythingOS assumes the opposite.

## Creating Agents

```typescript
import { Agent } from 'everythingos';

class MyAgent extends Agent {
  constructor() {
    super({
      id: 'my-agent',
      name: 'My Agent',
      type: 'perception',
      tickRate: 5000,  // Run onTick every 5 seconds
    });
  }

  protected async onStart(): Promise<void> {
    this.subscribe('some:event', (e) => this.handleEvent(e));
  }

  protected async onStop(): Promise<void> {
    // Cleanup
  }

  protected async onTick(): Promise<void> {
    // Periodic work
    this.emit('my:event', { data: 'hello' });
  }

  private async handleEvent(event: Event) {
    console.log('Received:', event.payload);
  }
}
```

### Agent Types

| Type | Purpose | Example |
|------|---------|---------|
| **Perception** | Observe environment | Monitor sensors, watch APIs |
| **Analysis** | Process data | Sentiment analysis, pattern detection |
| **Decision** | Determine actions | Route requests, approve operations |
| **Execution** | Perform actions | Send messages, control hardware |
| **Learning** | Improve over time | Track outcomes, adjust parameters |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          EVERYTHINGOS                                │
├─────────────────────────────────────────────────────────────────────┤
│  EVENT BUS │ WORKFLOWS │ SUPERVISOR │ STATE │ MEMORY │ SECURITY     │
├─────────────────────────────────────────────────────────────────────┤
│                           LLM ROUTER                                 │
│              OpenAI │ Claude │ Gemini │ Ollama                       │
├─────────────────────────────────────────────────────────────────────┤
│                             AGENTS                                   │
│     Perception │ Analysis │ Decision │ Execution │ Learning          │
├─────────────────────────────────────────────────────────────────────┤
│                            PLUGINS                                   │
│              Discord │ Slack │ GitHub │ Hardware                     │
├─────────────────────────────────────────────────────────────────────┤
│                      ROBOTICS LAYER                                  │
│         ROS2 Bridge │ Motion Control │ Safety Monitor                │
├─────────────────────────────────────────────────────────────────────┤
│                       HARDWARE LAYER                                 │
│     Raspberry Pi │ Jetson │ Sensors │ Actuators │ Protocols          │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Event Bus

```typescript
import { eventBus } from 'everythingos';

// Subscribe (supports wildcards)
eventBus.on('user:*', (event) => console.log(event));

// Emit
eventBus.emit('user:login', { userId: '123' });

// Request-response
const result = await eventBus.request('data:fetch', { id: 123 });
```

### Memory System

```typescript
import { memoryService } from 'everythingos';

const memory = memoryService.forAgent('my-agent');

// Working memory (short-term)
memory.working.set('currentTask', { status: 'active' });

// Long-term memory
await memory.remember({
  content: 'User prefers dark mode',
  type: 'preference',
  importance: 0.8,
});

// Recall
const memories = await memory.recall('user preferences');
```

### Security

```typescript
import { security } from 'everythingos';

// Execute with full security checks
await security.executeSecurely({
  actor: 'agent:my-agent',
  action: 'send:email',
  permission: 'email:send',
  rateKey: 'my-agent',
  execute: async () => {
    // Your code here
  },
});
```

## Hardware Integration

### Raspberry Pi

```typescript
import { RaspberryPiPlatform } from 'everythingos';

const pi = new RaspberryPiPlatform({ gpioLibrary: 'pigpio' });
await pi.initialize();

// Blink an LED
await pi.setupPin(17, 'output');
await pi.digitalWrite(17, 1);
```

### Sensors & Actuators

```typescript
import { IMUSensor, ServoActuator } from 'everythingos';

const imu = new IMUSensor({ chip: 'MPU6050', i2cAddress: 0x68 });
await imu.initialize();
imu.on('data', (d) => console.log(d.accel));

const servo = new ServoActuator({ pin: 18 });
await servo.setAngle(90);
```

## Project Structure

```
src/
├── core/           # EventBus, State, Registry, Supervisor
├── runtime/        # Agent base class, LLM Router
├── services/       # Memory, Tools, Trust, Explainability
├── security/       # Auth, Rate Limiting, Audit
├── observability/  # Metrics
├── agents/         # Foundation + Decision agents
├── plugins/
│   ├── hardware/   # Sensors, Actuators, Protocols
│   ├── platforms/  # Pi, Jetson, Deployment
│   ├── robotics/   # ROS2, Motion, Safety
│   └── swarm/      # Coordination, Mesh, Formation
└── api/            # REST server
```

## Scripts

```bash
npm run demo        # Simple demo
npm run demo:cli    # Interactive CLI
npm run build       # Compile TypeScript
npm run test        # Run tests
npm run api         # Start REST API server
```

## Environment Variables

```bash
# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Integrations
DISCORD_BOT_TOKEN=...

# System
PORT=3000
LOG_LEVEL=info
```

## Roadmap

- [x] Core agent framework
- [x] Event bus with priority queuing
- [x] Three-layer memory system
- [x] Security (auth, rate limiting, audit)
- [x] Hardware abstraction layer
- [x] ROS2 bridge
- [x] Swarm coordination
- [ ] Comprehensive test suite
- [ ] Web dashboard
- [ ] Docker deployment
- [ ] Example robots

## Documentation

For detailed documentation on all features, see:

- [Hardware Setup Guide](HARDWARE.md) — Raspberry Pi setup and parts list
- [Bridge Architecture](BRIDGES.md) — How EverythingOS connects to physical systems

## Contributing

Contributions welcome! Please open an issue or PR.

## License

MIT © m0rs3c0d3
