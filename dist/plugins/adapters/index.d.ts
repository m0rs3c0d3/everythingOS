/**
 * HTTP Client Adapter
 * Make HTTP requests to external APIs
 */
export declare class HTTPAdapter {
    private baseUrl;
    private headers;
    constructor(baseUrl: string, headers?: Record<string, string>);
    get<T>(endpoint: string): Promise<T>;
    post<T>(endpoint: string, data: unknown): Promise<T>;
    put<T>(endpoint: string, data: unknown): Promise<T>;
    delete<T>(endpoint: string): Promise<T>;
    setHeader(key: string, value: string): void;
}
/**
 * WebSocket Adapter
 * Real-time data streaming
 */
export declare class WebSocketAdapter {
    private url;
    private ws;
    private handlers;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelay;
    constructor(url: string);
    connect(): Promise<void>;
    private handleDisconnect;
    on(event: string, handler: (data: unknown) => void): () => void;
    send(data: unknown): void;
    disconnect(): void;
    isConnected(): boolean;
}
/**
 * File System Adapter
 * Read/write local files (Node.js)
 */
export declare class FileSystemAdapter {
    private basePath;
    constructor(basePath?: string);
    readJSON<T>(filename: string): Promise<T>;
    writeJSON(filename: string, data: unknown): Promise<void>;
    append(filename: string, content: string): Promise<void>;
    exists(filename: string): Promise<boolean>;
    list(directory?: string): Promise<string[]>;
    delete(filename: string): Promise<void>;
}
/**
 * Database Adapter Interface
 * Implement this for your database of choice
 */
export interface DatabaseAdapter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    query<T>(sql: string, params?: unknown[]): Promise<T[]>;
    execute(sql: string, params?: unknown[]): Promise<{
        affectedRows: number;
    }>;
    transaction<T>(fn: () => Promise<T>): Promise<T>;
}
/**
 * In-Memory Database Adapter
 * Simple key-value store for testing/development
 */
export declare class InMemoryDatabaseAdapter implements DatabaseAdapter {
    private data;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    query<T>(collection: string): Promise<T[]>;
    execute(collection: string, params?: unknown[]): Promise<{
        affectedRows: number;
    }>;
    transaction<T>(fn: () => Promise<T>): Promise<T>;
    set(collection: string, key: string, value: unknown): void;
    get<T>(collection: string, key: string): T | undefined;
    delete(collection: string, key: string): boolean;
}
//# sourceMappingURL=index.d.ts.map