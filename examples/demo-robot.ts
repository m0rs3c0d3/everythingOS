#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Robot Simulation Demo
// Control a virtual robot in a 2D world
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus, agentRegistry } from '../src';
import { SimulatedWorld, createDefaultWorld, SimulatedRobot, RobotAgent } from '../src/simulation';

// Colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

console.log(`${c.cyan}${c.bold}
╔═══════════════════════════════════════════════════════════╗
║          EVERYTHINGOS - Robot Simulation                  ║
╚═══════════════════════════════════════════════════════════╝
${c.reset}`);

// Create world
const world = createDefaultWorld();
console.log(`${c.green}✓${c.reset} World created (10x10 with obstacles)`);

// Create robot
const robot = new SimulatedRobot({
  id: 'bot-1',
  name: 'Explorer',
  startPosition: { x: 1, y: 1 },
  startHeading: 45,
  maxVelocity: 2,
}, world);
console.log(`${c.green}✓${c.reset} Robot created at (1, 1)`);

// Create agent
const agent = new RobotAgent({
  robot,
  avoidDanger: true,
  patrolPoints: [
    { x: 2, y: 2 },
    { x: 8, y: 2 },
    { x: 8, y: 7 },
    { x: 2, y: 7 },
  ],
});
agentRegistry.register(agent);
console.log(`${c.green}✓${c.reset} Robot agent created`);

// Event logging
let eventCount = 0;
const recentEvents: string[] = [];

const logEvent = (type: string, data: string) => {
  eventCount++;
  const entry = `${c.dim}${new Date().toLocaleTimeString()}${c.reset} ${type}: ${data}`;
  recentEvents.push(entry);
  if (recentEvents.length > 5) recentEvents.shift();
};

// Subscribe to interesting events
eventBus.on('robot:position', (e) => {
  const { position, heading } = e.payload as { position: { x: number; y: number }; heading: number };
  // Only log occasionally to reduce noise
  if (eventCount % 10 === 0) {
    logEvent(`${c.blue}📍 POS${c.reset}`, `(${position.x.toFixed(1)}, ${position.y.toFixed(1)}) @ ${heading.toFixed(0)}°`);
  }
});

eventBus.on('robot:collision', (e) => {
  const { reason } = e.payload as { reason: string };
  logEvent(`${c.red}💥 COLLISION${c.reset}`, reason);
});

eventBus.on('robot:danger:zone', () => {
  logEvent(`${c.yellow}⚠️  DANGER${c.reset}`, 'Entered danger zone!');
});

eventBus.on('robot:goal:reached', () => {
  logEvent(`${c.green}🎯 GOAL${c.reset}`, 'Reached goal zone!');
});

eventBus.on('robot:navigation:complete', () => {
  logEvent(`${c.green}✓ NAV${c.reset}`, 'Navigation complete');
});

eventBus.on('robot:patrol:waypoint', (e) => {
  const { index, target } = e.payload as { index: number; target: { x: number; y: number } };
  logEvent(`${c.magenta}🔄 PATROL${c.reset}`, `Waypoint ${index} → (${target.x}, ${target.y})`);
});

eventBus.on('robot:battery:low', (e) => {
  const { battery } = e.payload as { battery: number };
  logEvent(`${c.yellow}🔋 BATTERY${c.reset}`, `Low: ${battery.toFixed(0)}%`);
});

// Start agent
await agent.start();
console.log(`${c.green}✓${c.reset} Agent started\n`);

// Print help
const printHelp = () => {
  console.log(`
${c.bold}Commands:${c.reset}
  ${c.cyan}w/a/s/d${c.reset}  - Move forward/left/back/right
  ${c.cyan}x${c.reset}        - Stop
  ${c.cyan}g${c.reset}        - Go to goal (8, 9)
  ${c.cyan}p${c.reset}        - Start patrol
  ${c.cyan}o${c.reset}        - Stop patrol
  ${c.cyan}m${c.reset}        - Show map
  ${c.cyan}i${c.reset}        - Show robot info
  ${c.cyan}e${c.reset}        - Show recent events
  ${c.cyan}r${c.reset}        - Recharge battery
  ${c.cyan}q${c.reset}        - Quit
`);
};

printHelp();

// Render map
const renderMap = () => {
  console.log(`\n${c.bold}World Map:${c.reset}`);
  console.log(world.render());
  console.log(`${c.dim}Legend: ◉ = Robot, █ = Obstacle, · = Empty${c.reset}\n`);
};

// Show robot info
const showInfo = () => {
  const state = robot.getState();
  console.log(`
${c.bold}Robot Status:${c.reset}
  Position:  (${state.position.x.toFixed(2)}, ${state.position.y.toFixed(2)})
  Heading:   ${state.heading.toFixed(1)}°
  Velocity:  ${state.velocity.toFixed(2)} units/s
  Status:    ${state.status}
  Battery:   ${state.battery.toFixed(1)}%
  Obstacle:  ${robot.getDistanceToObstacle().toFixed(2)} units away
`);
};

// Show events
const showEvents = () => {
  console.log(`\n${c.bold}Recent Events (${eventCount} total):${c.reset}`);
  if (recentEvents.length === 0) {
    console.log('  (none yet)');
  } else {
    for (const e of recentEvents) {
      console.log(`  ${e}`);
    }
  }
  console.log('');
};

// Input handling
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', async (key: string) => {
  switch (key.toLowerCase()) {
    case 'w':
      eventBus.emit('robot:command:move', { direction: 'forward' });
      console.log(`${c.cyan}→ Forward${c.reset}`);
      break;
    case 'a':
      eventBus.emit('robot:command:move', { direction: 'left' });
      console.log(`${c.cyan}↺ Turn left${c.reset}`);
      break;
    case 's':
      eventBus.emit('robot:command:move', { direction: 'backward' });
      console.log(`${c.cyan}← Backward${c.reset}`);
      break;
    case 'd':
      eventBus.emit('robot:command:move', { direction: 'right' });
      console.log(`${c.cyan}↻ Turn right${c.reset}`);
      break;
    case 'x':
      eventBus.emit('robot:command:move', { direction: 'stop' });
      console.log(`${c.yellow}■ Stop${c.reset}`);
      break;
    case 'g':
      eventBus.emit('robot:command:goto', { position: { x: 9, y: 9 } });
      console.log(`${c.green}🎯 Going to goal (9, 9)${c.reset}`);
      break;
    case 'p':
      eventBus.emit('robot:command:patrol', {});
      console.log(`${c.magenta}🔄 Starting patrol${c.reset}`);
      break;
    case 'o':
      agent.stopPatrol();
      console.log(`${c.yellow}■ Patrol stopped${c.reset}`);
      break;
    case 'm':
      renderMap();
      break;
    case 'i':
      showInfo();
      break;
    case 'e':
      showEvents();
      break;
    case 'r':
      robot.recharge();
      console.log(`${c.green}🔋 Battery recharged to 100%${c.reset}`);
      break;
    case 'h':
    case '?':
      printHelp();
      break;
    case 'q':
    case '\u0003':
      console.log(`\n${c.yellow}Shutting down...${c.reset}`);
      await agent.stop();
      console.log(`${c.green}Goodbye!${c.reset}`);
      process.exit(0);
  }
});

// Periodic map update (every 3 seconds)
let showMapTimer = setInterval(() => {
  const state = robot.getState();
  if (state.status === 'moving' || state.status === 'rotating') {
    // Show mini status when moving
    process.stdout.write(`\r${c.dim}[${state.position.x.toFixed(1)}, ${state.position.y.toFixed(1)}] ${state.status} 🔋${state.battery.toFixed(0)}%${c.reset}  `);
  }
}, 500);

// Cleanup on exit
process.on('SIGINT', async () => {
  clearInterval(showMapTimer);
  await agent.stop();
  process.exit(0);
});
