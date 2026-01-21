/**
 * Logger - Structured logging for agents
 */
export declare class Logger {
    private context;
    private minLevel;
    constructor(context: string);
    setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void;
    private shouldLog;
    private format;
    debug(message: string, data?: unknown): void;
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, error?: Error | unknown): void;
}
/**
 * Notification Service - Send notifications through various channels
 */
export declare class NotificationService {
    private webhooks;
    registerWebhook(name: string, url: string): void;
    sendWebhook(name: string, payload: unknown): Promise<boolean>;
    sendSlack(webhookUrl: string, message: string, options?: {
        channel?: string;
        username?: string;
        icon_emoji?: string;
        attachments?: unknown[];
    }): Promise<boolean>;
    sendDiscord(webhookUrl: string, message: string, options?: {
        username?: string;
        avatar_url?: string;
        embeds?: unknown[];
    }): Promise<boolean>;
}
/**
 * Rate Limiter - Prevent too many operations
 */
export declare class RateLimiter {
    private tokens;
    private maxTokens;
    private refillRate;
    private lastRefill;
    constructor(maxTokens: number, refillRate: number);
    private refill;
    tryAcquire(tokens?: number): boolean;
    acquire(tokens?: number): Promise<void>;
    getAvailableTokens(): number;
}
/**
 * Retry - Retry failed operations with backoff
 */
export declare class Retry {
    static execute<T>(fn: () => Promise<T>, options?: {
        maxAttempts?: number;
        initialDelay?: number;
        maxDelay?: number;
        backoffMultiplier?: number;
        retryIf?: (error: Error) => boolean;
    }): Promise<T>;
}
/**
 * Circuit Breaker - Prevent cascading failures
 */
export declare class CircuitBreaker {
    private state;
    private failures;
    private successes;
    private lastFailureTime;
    private readonly failureThreshold;
    private readonly successThreshold;
    private readonly timeout;
    constructor(options?: {
        failureThreshold?: number;
        successThreshold?: number;
        timeout?: number;
    });
    execute<T>(fn: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onFailure;
    getState(): 'closed' | 'open' | 'half-open';
    reset(): void;
}
/**
 * Debounce - Delay execution until activity stops
 */
export declare function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): (...args: Parameters<T>) => void;
/**
 * Throttle - Limit execution frequency
 */
export declare function throttle<T extends (...args: unknown[]) => unknown>(fn: T, limit: number): (...args: Parameters<T>) => void;
//# sourceMappingURL=index.d.ts.map