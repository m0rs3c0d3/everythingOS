// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Metrics Collector
// System-wide metrics collection and aggregation
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from './EventBus';

interface MetricPoint {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

interface MetricSeries {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  description: string;
  points: MetricPoint[];
  maxPoints: number;
}

interface HistogramBucket {
  le: number; // less than or equal
  count: number;
}

export class MetricsCollector {
  private metrics: Map<string, MetricSeries> = new Map();
  private histogramBuckets: Map<string, HistogramBucket[]> = new Map();
  private defaultMaxPoints = 1000;

  // Register a counter metric
  registerCounter(name: string, description: string): void {
    this.metrics.set(name, {
      name,
      type: 'counter',
      description,
      points: [{ value: 0, timestamp: Date.now() }],
      maxPoints: this.defaultMaxPoints,
    });
  }

  // Register a gauge metric
  registerGauge(name: string, description: string): void {
    this.metrics.set(name, {
      name,
      type: 'gauge',
      description,
      points: [],
      maxPoints: this.defaultMaxPoints,
    });
  }

  // Register a histogram metric
  registerHistogram(
    name: string,
    description: string,
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  ): void {
    this.metrics.set(name, {
      name,
      type: 'histogram',
      description,
      points: [],
      maxPoints: this.defaultMaxPoints,
    });

    this.histogramBuckets.set(
      name,
      buckets.map((le) => ({ le, count: 0 }))
    );
  }

  // Increment a counter
  increment(name: string, value = 1, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'counter') {
      return;
    }

    const lastPoint = metric.points[metric.points.length - 1];
    const newValue = (lastPoint?.value || 0) + value;

    this.addPoint(name, newValue, labels);
  }

  // Set a gauge value
  set(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') {
      return;
    }

    this.addPoint(name, value, labels);
  }

  // Observe a histogram value
  observe(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram') {
      return;
    }

    // Update buckets
    const buckets = this.histogramBuckets.get(name);
    if (buckets) {
      for (const bucket of buckets) {
        if (value <= bucket.le) {
          bucket.count++;
        }
      }
    }

    this.addPoint(name, value, labels);
  }

  // Add a point to a metric series
  private addPoint(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    const metric = this.metrics.get(name);
    if (!metric) return;

    metric.points.push({
      value,
      timestamp: Date.now(),
      labels,
    });

    // Trim old points
    if (metric.points.length > metric.maxPoints) {
      metric.points.shift();
    }
  }

  // Get current value for a metric
  getValue(name: string): number | undefined {
    const metric = this.metrics.get(name);
    if (!metric || metric.points.length === 0) {
      return undefined;
    }

    return metric.points[metric.points.length - 1].value;
  }

  // Get metric series
  getSeries(name: string, since?: number): MetricPoint[] {
    const metric = this.metrics.get(name);
    if (!metric) return [];

    if (since) {
      return metric.points.filter((p) => p.timestamp >= since);
    }

    return [...metric.points];
  }

  // Get histogram percentile
  getPercentile(name: string, percentile: number): number | undefined {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram' || metric.points.length === 0) {
      return undefined;
    }

    const sorted = metric.points.map((p) => p.value).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // Get metric average
  getAverage(name: string, windowMs?: number): number | undefined {
    const metric = this.metrics.get(name);
    if (!metric || metric.points.length === 0) {
      return undefined;
    }

    let points = metric.points;
    if (windowMs) {
      const since = Date.now() - windowMs;
      points = points.filter((p) => p.timestamp >= since);
    }

    if (points.length === 0) return undefined;

    const sum = points.reduce((acc, p) => acc + p.value, 0);
    return sum / points.length;
  }

  // Get metric min/max
  getMinMax(name: string, windowMs?: number): { min: number; max: number } | undefined {
    const metric = this.metrics.get(name);
    if (!metric || metric.points.length === 0) {
      return undefined;
    }

    let points = metric.points;
    if (windowMs) {
      const since = Date.now() - windowMs;
      points = points.filter((p) => p.timestamp >= since);
    }

    if (points.length === 0) return undefined;

    const values = points.map((p) => p.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  // Get all metric names
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  // Get metric info
  getMetricInfo(name: string): {
    type: string;
    description: string;
    pointCount: number;
  } | undefined {
    const metric = this.metrics.get(name);
    if (!metric) return undefined;

    return {
      type: metric.type,
      description: metric.description,
      pointCount: metric.points.length,
    };
  }

  // Export all metrics in Prometheus format
  exportPrometheus(): string {
    const lines: string[] = [];

    for (const [name, metric] of this.metrics) {
      lines.push(`# HELP ${name} ${metric.description}`);
      lines.push(`# TYPE ${name} ${metric.type}`);

      if (metric.type === 'histogram') {
        const buckets = this.histogramBuckets.get(name);
        if (buckets) {
          for (const bucket of buckets) {
            lines.push(`${name}_bucket{le="${bucket.le}"} ${bucket.count}`);
          }
        }
        lines.push(`${name}_count ${metric.points.length}`);
        const sum = metric.points.reduce((acc, p) => acc + p.value, 0);
        lines.push(`${name}_sum ${sum}`);
      } else {
        const value = this.getValue(name) ?? 0;
        lines.push(`${name} ${value}`);
      }
    }

    return lines.join('\n');
  }

  // Export metrics as JSON
  exportJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [name, metric] of this.metrics) {
      result[name] = {
        type: metric.type,
        description: metric.description,
        current: this.getValue(name),
        pointCount: metric.points.length,
        ...(metric.type === 'histogram' && {
          p50: this.getPercentile(name, 50),
          p95: this.getPercentile(name, 95),
          p99: this.getPercentile(name, 99),
        }),
      };
    }

    return result;
  }

  // Clear all metrics
  clear(): void {
    this.metrics.clear();
    this.histogramBuckets.clear();
  }

  // Time a function execution
  async time<T>(
    metricName: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = (performance.now() - start) / 1000; // seconds
      this.observe(metricName, duration);
    }
  }

  // Create a timer
  startTimer(metricName: string): () => void {
    const start = performance.now();
    return () => {
      const duration = (performance.now() - start) / 1000;
      this.observe(metricName, duration);
    };
  }
}

// Singleton instance
export const metrics = new MetricsCollector();

// Register default system metrics
metrics.registerGauge('system_uptime_seconds', 'System uptime in seconds');
metrics.registerCounter('system_events_total', 'Total system events processed');
metrics.registerGauge('system_agents_active', 'Number of active agents');
metrics.registerHistogram('agent_processing_duration_seconds', 'Agent processing duration');
metrics.registerCounter('agent_errors_total', 'Total agent errors');
