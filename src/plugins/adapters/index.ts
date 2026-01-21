// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Adapters
// Connect to external data sources
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * HTTP Client Adapter
 * Make HTTP requests to external APIs
 */
export class HTTPAdapter {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string, headers: Record<string, string> = {}) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      ...headers,
    };
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.headers,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  }

  setHeader(key: string, value: string): void {
    this.headers[key] = value;
  }
}

/**
 * WebSocket Adapter
 * Real-time data streaming
 */
export class WebSocketAdapter {
  private url: string;
  private ws: WebSocket | null = null;
  private handlers: Map<string, ((data: unknown) => void)[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
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
          } catch {
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
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleDisconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
    }
  }

  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
    
    return () => {
      const handlers = this.handlers.get(event);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx > -1) handlers.splice(idx, 1);
      }
    };
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.maxReconnectAttempts = 0; // Prevent reconnection
    this.ws?.close();
    this.ws = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * File System Adapter
 * Read/write local files (Node.js)
 */
export class FileSystemAdapter {
  private basePath: string;

  constructor(basePath = './data') {
    this.basePath = basePath;
  }

  async readJSON<T>(filename: string): Promise<T> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const fullPath = path.join(this.basePath, filename);
    const content = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(content);
  }

  async writeJSON(filename: string, data: unknown): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const fullPath = path.join(this.basePath, filename);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, JSON.stringify(data, null, 2));
  }

  async append(filename: string, content: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const fullPath = path.join(this.basePath, filename);
    await fs.appendFile(fullPath, content + '\n');
  }

  async exists(filename: string): Promise<boolean> {
    const fs = await import('fs/promises');
    const path = await import('path');
    try {
      await fs.access(path.join(this.basePath, filename));
      return true;
    } catch {
      return false;
    }
  }

  async list(directory = ''): Promise<string[]> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const fullPath = path.join(this.basePath, directory);
    return fs.readdir(fullPath);
  }

  async delete(filename: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    await fs.unlink(path.join(this.basePath, filename));
  }
}

/**
 * Database Adapter Interface
 * Implement this for your database of choice
 */
export interface DatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ affectedRows: number }>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * In-Memory Database Adapter
 * Simple key-value store for testing/development
 */
export class InMemoryDatabaseAdapter implements DatabaseAdapter {
  private data: Map<string, Map<string, unknown>> = new Map();

  async connect(): Promise<void> {
    // No-op for in-memory
  }

  async disconnect(): Promise<void> {
    this.data.clear();
  }

  async query<T>(collection: string): Promise<T[]> {
    const col = this.data.get(collection);
    if (!col) return [];
    return Array.from(col.values()) as T[];
  }

  async execute(collection: string, params?: unknown[]): Promise<{ affectedRows: number }> {
    // Simple insert
    if (!this.data.has(collection)) {
      this.data.set(collection, new Map());
    }
    const col = this.data.get(collection)!;
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    col.set(id, params?.[0] || {});
    return { affectedRows: 1 };
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    // Simple pass-through (no real transaction support)
    return fn();
  }

  // Additional helpers
  set(collection: string, key: string, value: unknown): void {
    if (!this.data.has(collection)) {
      this.data.set(collection, new Map());
    }
    this.data.get(collection)!.set(key, value);
  }

  get<T>(collection: string, key: string): T | undefined {
    return this.data.get(collection)?.get(key) as T | undefined;
  }

  delete(collection: string, key: string): boolean {
    return this.data.get(collection)?.delete(key) || false;
  }
}
