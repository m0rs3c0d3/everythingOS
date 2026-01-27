// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Metrics Collector
// Prometheus-compatible metrics for observability
// Supports: Counters, Gauges, Histograms
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../core/event-bus/EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricDefinition {
  name: string;
  type: MetricType;
  help: string;
  labelNames?: string[];
  buckets?: number[];        // For histograms
}

export interface MetricValue {
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Counter - only goes up
// ─────────────────────────────────────────────────────────────────────────────

class Counter {
  private values: Map<string, number> = new Map();

  constructor(public readonly definition: MetricDefinition) {}

  increment(labels: Record<string, string> = {}, value = 1): void {
    const key = this.labelsKey(labels);
    const current = this.values.get(key) ?? 0;
    this.values.set(key, current + value);
  }

  get(labels: Record<string, string> = {}): number {
    return this.values.get(this.labelsKey(labels)) ?? 0;
  }

  reset(): void {
    this.values.clear();
  }

  getAll(): Array<{ labels: Record<string, string>; value: number }> {
    const results: Array<{ labels: Record<string, string>; value: number }> = [];
    for (const [key, value] of this.values) {
      results.push({ labels: this.parseLabelsKey(key), value });
    }
    return results;
  }

  private labelsKey(labels: Record<string, string>): string {
    return Object.entries(labels).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}="${v}"`).join(',');
  }

  private parseLabelsKey(key: string): Record<string, string> {
    if (!key) return {};
    const labels: Record<string, string> = {};
    for (const part of key.split(',')) {
      const [k, v] = part.split('=');
      labels[k] = v.replace(/"/g, '');
    }
    return labels;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gauge - can go up or down
// ─────────────────────────────────────────────────────────────────────────────

class Gauge {
  private values: Map<string, number> = new Map();

  constructor(public readonly definition: MetricDefinition) {}

  set(value: number, labels: Record<string, string> = {}): void {
    this.values.set(this.labelsKey(labels), value);
  }

  increment(labels: Record<string, string> = {}, value = 1): void {
    const key = this.labelsKey(labels);
    const current = this.values.get(key) ?? 0;
    this.values.set(key, current + value);
  }

  decrement(labels: Record<string, string> = {}, value = 1): void {
    this.increment(labels, -value);
  }

  get(labels: Record<string, string> = {}): number {
    return this.values.get(this.labelsKey(labels)) ?? 0;
  }

  getAll(): Array<{ labels: Record<string, string>; value: number }> {
    const results: Array<{ labels: Record<string, string>; value: number }> = [];
    for (const [key, value] of this.values) {
      results.push({ labels: this.parseLabelsKey(key), value });
    }
    return results;
  }

  private labelsKey(labels: Record<string, string>): string {
    return Object.entries(labels).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}="${v}"`).join(',');
  }

  private parseLabelsKey(key: string): Record<string, string> {
    if (!key) return {};
    const labels: Record<string, string> = {};
    for (const part of key.split(',')) {
      const [k, v] = part.split('=');
      labels[k] = v.replace(/"/g, '');
    }
    return labels;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Histogram - measures distribution
// ─────────────────────────────────────────────────────────────────────────────

class Histogram {
  private buckets: number[];
  private bucketCounts: Map<string, number[]> = new Map();
  private sums: Map<string, number> = new Map();
  private counts: Map<string, number> = new Map();

  constructor(public readonly definition: MetricDefinition) {
    this.buckets = definition.buckets ?? [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  }

  observe(value: number, labels: Record<string, string> = {}): void {
    const key = this.labelsKey(labels);

    // Initialize if needed
    if (!this.bucketCounts.has(key)) {
      this.bucketCounts.set(key, new Array(this.buckets.length + 1).fill(0));
      this.sums.set(key, 0);
      this.counts.set(key, 0);
    }

    // Update sum and count
    this.sums.set(key, (this.sums.get(key) ?? 0) + value);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);

    // Update buckets
    const bucketCounts = this.bucketCounts.get(key)!;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        bucketCounts[i]++;
      }
    }
    bucketCounts[this.buckets.length]++; // +Inf bucket
  }

  getStats(labels: Record<string, string> = {}): { sum: number; count: number; buckets: Record<string, number> } {
    const key = this.labelsKey(labels);
    const bucketCounts = this.bucketCounts.get(key) ?? [];
    
    const buckets: Record<string, number> = {};
    for (let i = 0; i < this.buckets.length; i++) {
      buckets[String(this.buckets[i])] = bucketCounts[i] ?? 0;
    }
    buckets['+Inf'] = bucketCounts[this.buckets.length] ?? 0;

    return {
      sum: this.sums.get(key) ?? 0,
      count: this.counts.get(key) ?? 0,
      buckets,
    };
  }

  private labelsKey(labels: Record<string, string>): string {
    return Object.entries(labels).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}="${v}"`).join(',');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Metrics Collector
// ─────────────────────────────────────────────────────────────────────────────

export class MetricsCollector {
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private startTime = Date.now();

  constructor() {
    this.registerDefaultMetrics();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Registration
  // ─────────────────────────────────────────────────────────────────────────

  registerCounter(definition: MetricDefinition): Counter {
    if (this.counters.has(definition.name)) {
      return this.counters.get(definition.name)!;
    }
    const counter = new Counter(definition);
    this.counters.set(definition.name, counter);
    return counter;
  }

  registerGauge(definition: MetricDefinition): Gauge {
    if (this.gauges.has(definition.name)) {
      return this.gauges.get(definition.name)!;
    }
    const gauge = new Gauge(definition);
    this.gauges.set(definition.name, gauge);
    return gauge;
  }

  registerHistogram(definition: MetricDefinition): Histogram {
    if (this.histograms.has(definition.name)) {
      return this.histograms.get(definition.name)!;
    }
    const histogram = new Histogram(definition);
    this.histograms.set(definition.name, histogram);
    return histogram;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Convenience Methods
  // ─────────────────────────────────────────────────────────────────────────

  increment(name: string, value = 1, labels: Record<string, string> = {}): void {
    let counter = this.counters.get(name);
    if (!counter) {
      counter = this.registerCounter({ name, type: 'counter', help: 'Auto-registered counter' });
    }
    counter.increment(labels, value);
  }

  set(name: string, value: number, labels: Record<string, string> = {}): void {
    let gauge = this.gauges.get(name);
    if (!gauge) {
      gauge = this.registerGauge({ name, type: 'gauge', help: 'Auto-registered gauge' });
    }
    gauge.set(value, labels);
  }

  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    let histogram = this.histograms.get(name);
    if (!histogram) {
      histogram = this.registerHistogram({ name, type: 'histogram', help: 'Auto-registered histogram' });
    }
    histogram.observe(value, labels);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Timer Helper
  // ─────────────────────────────────────────────────────────────────────────

  startTimer(name: string, labels: Record<string, string> = {}): () => number {
    const start = performance.now();
    return () => {
      const duration = (performance.now() - start) / 1000; // seconds
      this.observe(name, duration, labels);
      return duration;
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Export
  // ─────────────────────────────────────────────────────────────────────────

  exportPrometheus(): string {
    const lines: string[] = [];

    // Counters
    for (const [name, counter] of this.counters) {
      lines.push(`# HELP ${name} ${counter.definition.help}`);
      lines.push(`# TYPE ${name} counter`);
      for (const { labels, value } of counter.getAll()) {
        const labelStr = Object.keys(labels).length > 0 
          ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}` 
          : '';
        lines.push(`${name}${labelStr} ${value}`);
      }
    }

    // Gauges
    for (const [name, gauge] of this.gauges) {
      lines.push(`# HELP ${name} ${gauge.definition.help}`);
      lines.push(`# TYPE ${name} gauge`);
      for (const { labels, value } of gauge.getAll()) {
        const labelStr = Object.keys(labels).length > 0 
          ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}` 
          : '';
        lines.push(`${name}${labelStr} ${value}`);
      }
    }

    // Histograms
    for (const [name, histogram] of this.histograms) {
      lines.push(`# HELP ${name} ${histogram.definition.help}`);
      lines.push(`# TYPE ${name} histogram`);
      // Note: Simplified - full Prometheus format would include all label combinations
      const stats = histogram.getStats();
      for (const [bucket, count] of Object.entries(stats.buckets)) {
        lines.push(`${name}_bucket{le="${bucket}"} ${count}`);
      }
      lines.push(`${name}_sum ${stats.sum}`);
      lines.push(`${name}_count ${stats.count}`);
    }

    return lines.join('\n');
  }

  exportJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      uptime: Date.now() - this.startTime,
      counters: {} as Record<string, unknown>,
      gauges: {} as Record<string, unknown>,
      histograms: {} as Record<string, unknown>,
    };

    for (const [name, counter] of this.counters) {
      (result.counters as Record<string, unknown>)[name] = counter.getAll();
    }

    for (const [name, gauge] of this.gauges) {
      (result.gauges as Record<string, unknown>)[name] = gauge.getAll();
    }

    for (const [name, histogram] of this.histograms) {
      (result.histograms as Record<string, unknown>)[name] = histogram.getStats();
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Default Metrics
  // ─────────────────────────────────────────────────────────────────────────

  private registerDefaultMetrics(): void {
    // Agent metrics
    this.registerCounter({
      name: 'everythingos_agent_events_processed_total',
      type: 'counter',
      help: 'Total events processed by agents',
      labelNames: ['agent'],
    });

    this.registerCounter({
      name: 'everythingos_agent_errors_total',
      type: 'counter',
      help: 'Total errors by agents',
      labelNames: ['agent', 'type'],
    });

    this.registerHistogram({
      name: 'everythingos_agent_tick_duration_seconds',
      type: 'histogram',
      help: 'Agent tick processing time',
      labelNames: ['agent'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    });

    this.registerGauge({
      name: 'everythingos_agents_active',
      type: 'gauge',
      help: 'Number of active agents',
    });

    // Event bus metrics
    this.registerCounter({
      name: 'everythingos_events_total',
      type: 'counter',
      help: 'Total events emitted',
      labelNames: ['type'],
    });

    this.registerGauge({
      name: 'everythingos_event_queue_size',
      type: 'gauge',
      help: 'Current event queue size',
    });

    // Hardware metrics
    this.registerCounter({
      name: 'everythingos_hardware_commands_total',
      type: 'counter',
      help: 'Hardware commands executed',
      labelNames: ['device', 'command'],
    });

    this.registerHistogram({
      name: 'everythingos_hardware_latency_seconds',
      type: 'histogram',
      help: 'Hardware command latency',
      labelNames: ['device'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
    });

    // Security metrics
    this.registerCounter({
      name: 'everythingos_auth_attempts_total',
      type: 'counter',
      help: 'Authentication attempts',
      labelNames: ['method', 'result'],
    });

    this.registerCounter({
      name: 'everythingos_rate_limit_hits_total',
      type: 'counter',
      help: 'Rate limit violations',
      labelNames: ['key'],
    });

    // Set up event listeners to auto-track
    this.setupAutoTracking();
  }

  private setupAutoTracking(): void {
    // Track all events
    eventBus.on('*', (event) => {
      this.increment('everythingos_events_total', 1, { type: event.type.split(':')[0] });
    });

    // Track security events
    eventBus.on('security:auth_failed', () => {
      this.increment('everythingos_auth_attempts_total', 1, { method: 'token', result: 'failure' });
    });

    eventBus.on('security:rate_limit', (event) => {
      this.increment('everythingos_rate_limit_hits_total', 1, { key: (event.payload as { key: string }).key });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Reset
  // ─────────────────────────────────────────────────────────────────────────

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.registerDefaultMetrics();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Export
// ─────────────────────────────────────────────────────────────────────────────

export const metrics = new MetricsCollector();
