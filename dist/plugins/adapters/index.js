"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Adapters
// Connect to external data sources
// ═══════════════════════════════════════════════════════════════════════════════
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryDatabaseAdapter = exports.FileSystemAdapter = exports.WebSocketAdapter = exports.HTTPAdapter = void 0;
/**
 * HTTP Client Adapter
 * Make HTTP requests to external APIs
 */
class HTTPAdapter {
    baseUrl;
    headers;
    constructor(baseUrl, headers = {}) {
        this.baseUrl = baseUrl;
        this.headers = {
            'Content-Type': 'application/json',
            ...headers,
        };
    }
    async get(endpoint) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'GET',
            headers: this.headers,
        });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
    }
    async post(endpoint, data) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(data),
        });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
    }
    async put(endpoint, data) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'PUT',
            headers: this.headers,
            body: JSON.stringify(data),
        });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
    }
    async delete(endpoint) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'DELETE',
            headers: this.headers,
        });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
    }
    setHeader(key, value) {
        this.headers[key] = value;
    }
}
exports.HTTPAdapter = HTTPAdapter;
/**
 * WebSocket Adapter
 * Real-time data streaming
 */
class WebSocketAdapter {
    url;
    ws = null;
    handlers = new Map();
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    reconnectDelay = 1000;
    constructor(url) {
        this.url = url;
    }
    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);
                this.ws.onopen = () => {
                    this.reconnectAttempts = 0;
                    resolve();
                };
                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        const type = data.type || 'message';
                        const handlers = this.handlers.get(type) || [];
                        handlers.forEach(h => h(data));
                    }
                    catch {
                        // Handle non-JSON messages
                        const handlers = this.handlers.get('message') || [];
                        handlers.forEach(h => h(event.data));
                    }
                };
                this.ws.onclose = () => {
                    this.handleDisconnect();
                };
                this.ws.onerror = (error) => {
                    reject(error);
                };
            }
            catch (error) {
                reject(error);
            }
        });
    }
    handleDisconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
        }
    }
    on(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
        }
        this.handlers.get(event).push(handler);
        return () => {
            const handlers = this.handlers.get(event);
            if (handlers) {
                const idx = handlers.indexOf(handler);
                if (idx > -1)
                    handlers.splice(idx, 1);
            }
        };
    }
    send(data) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
    disconnect() {
        this.maxReconnectAttempts = 0; // Prevent reconnection
        this.ws?.close();
        this.ws = null;
    }
    isConnected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}
exports.WebSocketAdapter = WebSocketAdapter;
/**
 * File System Adapter
 * Read/write local files (Node.js)
 */
class FileSystemAdapter {
    basePath;
    constructor(basePath = './data') {
        this.basePath = basePath;
    }
    async readJSON(filename) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        const fullPath = path.join(this.basePath, filename);
        const content = await fs.readFile(fullPath, 'utf-8');
        return JSON.parse(content);
    }
    async writeJSON(filename, data) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        const fullPath = path.join(this.basePath, filename);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, JSON.stringify(data, null, 2));
    }
    async append(filename, content) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        const fullPath = path.join(this.basePath, filename);
        await fs.appendFile(fullPath, content + '\n');
    }
    async exists(filename) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        try {
            await fs.access(path.join(this.basePath, filename));
            return true;
        }
        catch {
            return false;
        }
    }
    async list(directory = '') {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        const fullPath = path.join(this.basePath, directory);
        return fs.readdir(fullPath);
    }
    async delete(filename) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        await fs.unlink(path.join(this.basePath, filename));
    }
}
exports.FileSystemAdapter = FileSystemAdapter;
/**
 * In-Memory Database Adapter
 * Simple key-value store for testing/development
 */
class InMemoryDatabaseAdapter {
    data = new Map();
    async connect() {
        // No-op for in-memory
    }
    async disconnect() {
        this.data.clear();
    }
    async query(collection) {
        const col = this.data.get(collection);
        if (!col)
            return [];
        return Array.from(col.values());
    }
    async execute(collection, params) {
        // Simple insert
        if (!this.data.has(collection)) {
            this.data.set(collection, new Map());
        }
        const col = this.data.get(collection);
        const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        col.set(id, params?.[0] || {});
        return { affectedRows: 1 };
    }
    async transaction(fn) {
        // Simple pass-through (no real transaction support)
        return fn();
    }
    // Additional helpers
    set(collection, key, value) {
        if (!this.data.has(collection)) {
            this.data.set(collection, new Map());
        }
        this.data.get(collection).set(key, value);
    }
    get(collection, key) {
        return this.data.get(collection)?.get(key);
    }
    delete(collection, key) {
        return this.data.get(collection)?.delete(key) || false;
    }
}
exports.InMemoryDatabaseAdapter = InMemoryDatabaseAdapter;
//# sourceMappingURL=index.js.map