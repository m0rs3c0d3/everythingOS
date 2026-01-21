interface MetricPoint {
    value: number;
    timestamp: number;
    labels?: Record<string, string>;
}
export declare class MetricsCollector {
    private metrics;
    private histogramBuckets;
    private defaultMaxPoints;
    registerCounter(name: string, description: string): void;
    registerGauge(name: string, description: string): void;
    registerHistogram(name: string, description: string, buckets?: number[]): void;
    increment(name: string, value?: number, labels?: Record<string, string>): void;
    set(name: string, value: number, labels?: Record<string, string>): void;
    observe(name: string, value: number, labels?: Record<string, string>): void;
    private addPoint;
    getValue(name: string): number | undefined;
    getSeries(name: string, since?: number): MetricPoint[];
    getPercentile(name: string, percentile: number): number | undefined;
    getAverage(name: string, windowMs?: number): number | undefined;
    getMinMax(name: string, windowMs?: number): {
        min: number;
        max: number;
    } | undefined;
    getMetricNames(): string[];
    getMetricInfo(name: string): {
        type: string;
        description: string;
        pointCount: number;
    } | undefined;
    exportPrometheus(): string;
    exportJSON(): Record<string, unknown>;
    clear(): void;
    time<T>(metricName: string, fn: () => Promise<T>): Promise<T>;
    startTimer(metricName: string): () => void;
}
export declare const metrics: MetricsCollector;
export {};
//# sourceMappingURL=MetricsCollector.d.ts.map