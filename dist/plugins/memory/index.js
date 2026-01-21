"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Memory
// Agent memory and state persistence
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventLog = exports.SlidingWindow = exports.TimeSeriesMemory = exports.AgentMemory = void 0;
/**
 * Agent Memory
 * Short-term and long-term memory for agents
 */
class AgentMemory {
    shortTerm = new Map();
    longTerm = new Map();
    maxShortTermSize = 1000;
    remember(key, value, ttlMs) {
        this.shortTerm.set(key, { value, timestamp: Date.now(), ttl: ttlMs });
        if (this.shortTerm.size > this.maxShortTermSize)
            this.pruneShortTerm();
    }
    rememberLongTerm(key, value) {
        this.longTerm.set(key, value);
    }
    recall(key) {
        const entry = this.shortTerm.get(key);
        if (entry) {
            if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
                this.shortTerm.delete(key);
            }
            else {
                return entry.value;
            }
        }
        return this.longTerm.get(key);
    }
    forget(key) {
        this.shortTerm.delete(key);
        this.longTerm.delete(key);
    }
    clearShortTerm() { this.shortTerm.clear(); }
    clearAll() { this.shortTerm.clear(); this.longTerm.clear(); }
    has(key) { return this.shortTerm.has(key) || this.longTerm.has(key); }
    pruneShortTerm() {
        const now = Date.now();
        for (const [key, entry] of this.shortTerm) {
            if (entry.ttl && now - entry.timestamp > entry.ttl)
                this.shortTerm.delete(key);
        }
    }
    export() {
        return {
            shortTerm: Object.fromEntries(this.shortTerm),
            longTerm: Object.fromEntries(this.longTerm),
        };
    }
}
exports.AgentMemory = AgentMemory;
/**
 * Time Series Memory
 */
class TimeSeriesMemory {
    data = [];
    maxSize;
    constructor(maxSize = 1000) { this.maxSize = maxSize; }
    add(value, timestamp = Date.now()) {
        this.data.push({ timestamp, value });
        this.data.sort((a, b) => a.timestamp - b.timestamp);
        if (this.data.length > this.maxSize)
            this.data = this.data.slice(-this.maxSize);
    }
    getAll() { return [...this.data]; }
    getValues() { return this.data.map(d => d.value); }
    getSince(timestamp) {
        return this.data.filter(d => d.timestamp >= timestamp);
    }
    getLast(n) { return this.data.slice(-n); }
    getLatest() { return this.data[this.data.length - 1]; }
    size() { return this.data.length; }
    clear() { this.data = []; }
}
exports.TimeSeriesMemory = TimeSeriesMemory;
/**
 * Sliding Window
 */
class SlidingWindow {
    data = [];
    windowSize;
    constructor(windowSize) { this.windowSize = windowSize; }
    push(value) {
        this.data.push(value);
        if (this.data.length > this.windowSize)
            this.data.shift();
    }
    getAll() { return [...this.data]; }
    getLast() { return this.data[this.data.length - 1]; }
    getFirst() { return this.data[0]; }
    isFull() { return this.data.length >= this.windowSize; }
    size() { return this.data.length; }
    clear() { this.data = []; }
    map(fn) { return this.data.map(fn); }
    reduce(fn, initial) { return this.data.reduce(fn, initial); }
}
exports.SlidingWindow = SlidingWindow;
/**
 * Event Log
 */
class EventLog {
    events = [];
    maxSize;
    idCounter = 0;
    constructor(maxSize = 10000) { this.maxSize = maxSize; }
    log(type, data) {
        const id = `evt_${++this.idCounter}`;
        this.events.push({ id, type, data, timestamp: Date.now() });
        if (this.events.length > this.maxSize)
            this.events.shift();
        return id;
    }
    getByType(type) { return this.events.filter(e => e.type === type); }
    getSince(timestamp) { return this.events.filter(e => e.timestamp >= timestamp); }
    getLast(n) { return this.events.slice(-n); }
    count(type) {
        return type ? this.events.filter(e => e.type === type).length : this.events.length;
    }
    clear() { this.events = []; }
}
exports.EventLog = EventLog;
//# sourceMappingURL=index.js.map