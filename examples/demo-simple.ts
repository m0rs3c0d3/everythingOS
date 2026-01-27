import { eventBus, agentRegistry, ClockAgent, HealthMonitorAgent } from '../src';

console.log('EverythingOS Demo Starting...\n');

const clock = new ClockAgent({ tickRate: 2000 });
const health = new HealthMonitorAgent({ tickRate: 5000 });

agentRegistry.register(clock);
agentRegistry.register(health);

eventBus.on('world:tick', (e) => {
  const p = e.payload as any;
  console.log(`⏱  TICK #${p.tick}`);
});

eventBus.on('health:report', (e) => {
  const p = e.payload as any;
  console.log(`💚 HEALTH: ${p.status}`);
});

await clock.start();
await health.start();

console.log('Running! Press Ctrl+C to stop.\n');
