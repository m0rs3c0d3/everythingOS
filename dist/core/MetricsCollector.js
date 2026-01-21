"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Metrics Collector
// System-wide metrics collection and aggregation
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = exports.MetricsCollector = void 0;
class MetricsCollector {
    metrics = new Map();
    histogramBuckets = new Map();
    defaultMaxPoints = 1000;
    // Register a counter metric
    registerCounter(name, description) {
        this.metrics.set(name, {
            name,
            type: 'counter',
            description,
            points: [{ value: 0, timestamp: Date.now() }],
            maxPoints: this.defaultMaxPoints,
        });
    }
    // Register a gauge metric
    registerGauge(name, description) {
        this.metrics.set(name, {
            name,
            type: 'gauge',
            description,
            points: [],
            maxPoints: this.defaultMaxPoints,
        });
    }
    // Register a histogram metric
    registerHistogram(name, description, buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]) {
        this.metrics.set(name, {
            name,
            type: 'histogram',
            description,
            points: [],
            maxPoints: this.defaultMaxPoints,
        });
        this.histogramBuckets.set(name, buckets.map((le) => ({ le, count: 0 })));
    }
    // Increment a counter
    increment(name, value = 1, labels) {
        const metric = this.metrics.get(name);
        if (!metric || metric.type !== 'counter') {
            return;
        }
        const lastPoint = metric.points[metric.points.length - 1];
        const newValue = (lastPoint?.value || 0) + value;
        this.addPoint(name, newValue, labels);
    }
    // Set a gauge value
    set(name, value, labels) {
        const metric = this.metrics.get(name);
        if (!metric || metric.type !== 'gauge') {
            return;
        }
        this.addPoint(name, value, labels);
    }
    // Observe a histogram value
    observe(name, value, labels) {
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
    addPoint(name, value, labels) {
        const metric = this.metrics.get(name);
        if (!metric)
            return;
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
    getValue(name) {
        const metric = this.metrics.get(name);
        if (!metric || metric.points.length === 0) {
            return undefined;
        }
        return metric.points[metric.points.length - 1].value;
    }
    // Get metric series
    getSeries(name, since) {
        const metric = this.metrics.get(name);
        if (!metric)
            return [];
        if (since) {
            return metric.points.filter((p) => p.timestamp >= since);
        }
        return [...metric.points];
    }
    // Get histogram percentile
    getPercentile(name, percentile) {
        const metric = this.metrics.get(name);
        if (!metric || metric.type !== 'histogram' || metric.points.length === 0) {
            return undefined;
        }
        const sorted = metric.points.map((p) => p.value).sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }
    // Get metric average
    getAverage(name, windowMs) {
        const metric = this.metrics.get(name);
        if (!metric || metric.points.length === 0) {
            return undefined;
        }
        let points = metric.points;
        if (windowMs) {
            const since = Date.now() - windowMs;
            points = points.filter((p) => p.timestamp >= since);
        }
        if (points.length === 0)
            return undefined;
        const sum = points.reduce((acc, p) => acc + p.value, 0);
        return sum / points.length;
    }
    // Get metric min/max
    getMinMax(name, windowMs) {
        const metric = this.metrics.get(name);
        if (!metric || metric.points.length === 0) {
            return undefined;
        }
        let points = metric.points;
        if (windowMs) {
            const since = Date.now() - windowMs;
            points = points.filter((p) => p.timestamp >= since);
        }
        if (points.length === 0)
            return undefined;
        const values = points.map((p) => p.value);
        return {
            min: Math.min(...values),
            max: Math.max(...values),
        };
    }
    // Get all metric names
    getMetricNames() {
        return Array.from(this.metrics.keys());
    }
    // Get metric info
    getMetricInfo(name) {
        const metric = this.metrics.get(name);
        if (!metric)
            return undefined;
        return {
            type: metric.type,
            description: metric.description,
            pointCount: metric.points.length,
        };
    }
    // Export all metrics in Prometheus format
    exportPrometheus() {
        const lines = [];
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
            }
            else {
                const value = this.getValue(name) ?? 0;
                lines.push(`${name} ${value}`);
            }
        }
        return lines.join('\n');
    }
    // Export metrics as JSON
    exportJSON() {
        const result = {};
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
    clear() {
        this.metrics.clear();
        this.histogramBuckets.clear();
    }
    // Time a function execution
    async time(metricName, fn) {
        const start = performance.now();
        try {
            return await fn();
        }
        finally {
            const duration = (performance.now() - start) / 1000; // seconds
            this.observe(metricName, duration);
        }
    }
    // Create a timer
    startTimer(metricName) {
        const start = performance.now();
        return () => {
            const duration = (performance.now() - start) / 1000;
            this.observe(metricName, duration);
        };
    }
}
exports.MetricsCollector = MetricsCollector;
// Singleton instance
exports.metrics = new MetricsCollector();
// Register default system metrics
exports.metrics.registerGauge('system_uptime_seconds', 'System uptime in seconds');
exports.metrics.registerCounter('system_events_total', 'Total system events processed');
exports.metrics.registerGauge('system_agents_active', 'Number of active agents');
exports.metrics.registerHistogram('agent_processing_duration_seconds', 'Agent processing duration');
exports.metrics.registerCounter('agent_errors_total', 'Total agent errors');
//# sourceMappingURL=MetricsCollector.js.map