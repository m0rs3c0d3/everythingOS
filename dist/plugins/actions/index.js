"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Actions
// Reusable actions that agents can perform
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.Retry = exports.RateLimiter = exports.NotificationService = exports.Logger = void 0;
exports.debounce = debounce;
exports.throttle = throttle;
/**
 * Logger - Structured logging for agents
 */
class Logger {
    context;
    minLevel = 'info';
    constructor(context) {
        this.context = context;
    }
    setLevel(level) {
        this.minLevel = level;
    }
    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        return levels.indexOf(level) >= levels.indexOf(this.minLevel);
    }
    format(level, message, data) {
        const timestamp = new Date().toISOString();
        const dataStr = data ? ` ${JSON.stringify(data)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}${dataStr}`;
    }
    debug(message, data) {
        if (this.shouldLog('debug')) {
            console.debug(this.format('debug', message, data));
        }
    }
    info(message, data) {
        if (this.shouldLog('info')) {
            console.info(this.format('info', message, data));
        }
    }
    warn(message, data) {
        if (this.shouldLog('warn')) {
            console.warn(this.format('warn', message, data));
        }
    }
    error(message, error) {
        if (this.shouldLog('error')) {
            const errorData = error instanceof Error
                ? { message: error.message, stack: error.stack }
                : error;
            console.error(this.format('error', message, errorData));
        }
    }
}
exports.Logger = Logger;
/**
 * Notification Service - Send notifications through various channels
 */
class NotificationService {
    webhooks = new Map();
    registerWebhook(name, url) {
        this.webhooks.set(name, url);
    }
    async sendWebhook(name, payload) {
        const url = this.webhooks.get(name);
        if (!url)
            return false;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            return response.ok;
        }
        catch {
            return false;
        }
    }
    // Slack-style notification
    async sendSlack(webhookUrl, message, options) {
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: message,
                    ...options,
                }),
            });
            return response.ok;
        }
        catch {
            return false;
        }
    }
    // Discord-style notification
    async sendDiscord(webhookUrl, message, options) {
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: message,
                    ...options,
                }),
            });
            return response.ok;
        }
        catch {
            return false;
        }
    }
}
exports.NotificationService = NotificationService;
/**
 * Rate Limiter - Prevent too many operations
 */
class RateLimiter {
    tokens;
    maxTokens;
    refillRate; // tokens per second
    lastRefill;
    constructor(maxTokens, refillRate) {
        this.maxTokens = maxTokens;
        this.tokens = maxTokens;
        this.refillRate = refillRate;
        this.lastRefill = Date.now();
    }
    refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
    }
    tryAcquire(tokens = 1) {
        this.refill();
        if (this.tokens >= tokens) {
            this.tokens -= tokens;
            return true;
        }
        return false;
    }
    async acquire(tokens = 1) {
        while (!this.tryAcquire(tokens)) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    getAvailableTokens() {
        this.refill();
        return this.tokens;
    }
}
exports.RateLimiter = RateLimiter;
/**
 * Retry - Retry failed operations with backoff
 */
class Retry {
    static async execute(fn, options = {}) {
        const { maxAttempts = 3, initialDelay = 1000, maxDelay = 30000, backoffMultiplier = 2, retryIf = () => true, } = options;
        let lastError;
        let delay = initialDelay;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            }
            catch (error) {
                lastError = error;
                if (attempt === maxAttempts || !retryIf(lastError)) {
                    throw lastError;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                delay = Math.min(maxDelay, delay * backoffMultiplier);
            }
        }
        throw lastError;
    }
}
exports.Retry = Retry;
/**
 * Circuit Breaker - Prevent cascading failures
 */
class CircuitBreaker {
    state = 'closed';
    failures = 0;
    successes = 0;
    lastFailureTime = 0;
    failureThreshold;
    successThreshold;
    timeout;
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.successThreshold = options.successThreshold || 2;
        this.timeout = options.timeout || 30000;
    }
    async execute(fn) {
        if (this.state === 'open') {
            if (Date.now() - this.lastFailureTime >= this.timeout) {
                this.state = 'half-open';
            }
            else {
                throw new Error('Circuit breaker is open');
            }
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    onSuccess() {
        this.failures = 0;
        if (this.state === 'half-open') {
            this.successes++;
            if (this.successes >= this.successThreshold) {
                this.state = 'closed';
                this.successes = 0;
            }
        }
    }
    onFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.failures >= this.failureThreshold) {
            this.state = 'open';
        }
    }
    getState() {
        return this.state;
    }
    reset() {
        this.state = 'closed';
        this.failures = 0;
        this.successes = 0;
    }
}
exports.CircuitBreaker = CircuitBreaker;
/**
 * Debounce - Delay execution until activity stops
 */
function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}
/**
 * Throttle - Limit execution frequency
 */
function throttle(fn, limit) {
    let inThrottle = false;
    return (...args) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}
//# sourceMappingURL=index.js.map