// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Demo
// Run: npx tsx examples/demo.ts
// ═══════════════════════════════════════════════════════════════════════════════

import { createFullOS } from '../src';

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                           EVERYTHING OS - DEMO                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
  `);

  // Create OS with all features
  const os = await createFullOS();

  // Subscribe to various events
  os.on('price:update', (data: { symbol: string; price: number }) => {
    // console.log(`📈 ${data.symbol}: $${data.price.toFixed(2)}`);
  });

  os.on('signal:consensus', (signal: { symbol: string; direction: string; confidence: number }) => {
    console.log(`🎯 SIGNAL: ${signal.symbol} ${signal.direction.toUpperCase()} (${(signal.confidence * 100).toFixed(0)}% confidence)`);
  });

  os.on('anomaly:detected', (anomaly: { symbol: string; zscore: number }) => {
    console.log(`⚡ ANOMALY: ${anomaly.symbol} (z-score: ${anomaly.zscore.toFixed(2)})`);
  });

  os.on('alert:created', (alert: { level: string; title: string }) => {
    const icon = alert.level === 'critical' ? '🚨' : alert.level === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${icon} ALERT: ${alert.title}`);
  });

  os.on('healthcare:vital_alert', (alert: { patientId: string; type: string; value: number }) => {
    console.log(`🏥 VITAL ALERT: Patient ${alert.patientId} - ${alert.type}: ${alert.value}`);
  });

  os.on('order:filled', (order: { id: string; symbol: string; side: string }) => {
    console.log(`✅ ORDER FILLED: ${order.id} - ${order.side.toUpperCase()} ${order.symbol}`);
  });

  // Print status every 10 seconds
  setInterval(() => {
    const state = os.getState();
    console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              SYSTEM STATUS                                    ║
╠═══════════════════════════════════════════════════════════════════════════════╣
  Tick: ${state.tick}
  Agents: ${JSON.stringify(state.agents)}
  Events in queue: ${(state.eventBus as { queueLength: number }).queueLength}
╚═══════════════════════════════════════════════════════════════════════════════╝
    `);
  }, 10000);

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await os.stop();
    process.exit(0);
  });

  console.log('✅ EverythingOS is running! Press Ctrl+C to stop.\n');
}

main().catch(console.error);
