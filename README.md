# EverythingOS

**LLM-Agnostic Multi-Agent Operating System**

Build autonomous agent systems that work with any LLM provider (OpenAI, Claude, Gemini, Ollama, etc.)
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

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EVERYTHINGOS                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  EVENT BUS  │  │  WORKFLOW   │  │ SUPERVISOR  │  │   STATE     │   │
│  │ • Pub/Sub   │  │ • Nodes     │  │ • Health    │  │ • World     │   │
│  │ • Priority  │  │ • Triggers  │  │ • Policies  │  │ • Snapshots │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│         └─────────────────┴─────────────────┴─────────────────┘         │
│                                    │                                    │
│  ┌─────────────────────────────────┴─────────────────────────────────┐ │
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

```typescript
import { eventBus } from 'everythingos';

eventBus.on('user:message', async (event) => console.log(event.payload));
eventBus.emit('bot:reply', { content: 'Hello!' });
const response = await eventBus.request('data:fetch', { id: 123 });
```

### Workflows

```typescript
import { workflowRegistry } from 'everythingos';

workflowRegistry.register({
  id: 'my-workflow',
  name: 'My Workflow',
  status: 'active',
  nodes: [
    { id: 'trigger', type: 'trigger', name: 'Start', config: {} },
    { id: 'process', type: 'action', plugin: 'discord', action: 'send_message', config: {} },
  ],
  edges: [{ id: 'e1', from: 'trigger', to: 'process' }],
  triggers: [{ id: 't1', type: 'event', config: { pattern: 'user:*' }, enabled: true }],
});
```

### Agents

```typescript
import { Agent } from 'everythingos';

class MyAgent extends Agent {
  constructor() {
    super({
      id: 'my-agent',
      name: 'My Agent',
      type: 'decision',
      llm: { provider: 'claude', model: 'claude-sonnet-4-20250514' },
    });
  }

  protected async onStart() {
    this.subscribe('input:*', (event) => this.handleInput(event));
  }
  protected async onStop() {}
  protected async onTick() {}

  private async handleInput(event) {
    const response = await this.think('How should I respond?');
    this.emit('output:response', { content: response });
  }
}
```

### LLM Router

```typescript
import { llmRouter } from 'everythingos';

llmRouter.setDefaultProvider('claude');

const response = await llmRouter.generate('Hello!', {
  provider: 'openai',
  model: 'gpt-4o',
});

for await (const chunk of llmRouter.stream(request)) {
  process.stdout.write(chunk);
}
```

### Plugins

```typescript
import { pluginRegistry } from 'everythingos';

await pluginRegistry.register({
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  actions: [{
    name: 'do_something',
    handler: async (input) => ({ success: true }),
  }],
});
```

## Directory Structure

```
everythingos/
├── src/
│   ├── core/
│   │   ├── event-bus/       # Event system
│   │   ├── workflow/        # Workflow engine
│   │   ├── supervisor/      # Agent monitoring
│   │   ├── state/           # World state
│   │   └── registry/        # Agent & plugin registry
│   ├── runtime/
│   │   ├── Agent.ts         # Base agent class
│   │   ├── LLMRouter.ts     # LLM abstraction
│   │   └── providers/       # OpenAI, Claude, Gemini, Local
│   ├── agents/              # Agent implementations
│   ├── workflows/           # Workflow definitions
│   ├── plugins/             # Platform integrations
│   ├── api/                 # REST API
│   └── config/              # Configuration
├── package.json
└── tsconfig.json
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/workflows` | List workflows |
| POST | `/api/workflows/:id/execute` | Execute workflow |
| GET | `/api/agents` | List agents |
| POST | `/api/agents/:id/start` | Start agent |
| GET | `/api/plugins` | List plugins |
| POST | `/api/events` | Emit event |

## Environment Variables

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
DISCORD_BOT_TOKEN=...
PORT=3000
```

## License

MIT © m0rs3c0d3
