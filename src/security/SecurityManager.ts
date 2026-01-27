// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Security Module
// Authentication, authorization, rate limiting, input validation, audit logging
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../core/event-bus/EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// Input Validation (using simple schema validation)
// ─────────────────────────────────────────────────────────────────────────────

export type SchemaType = 
  | 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null'
  | { enum: readonly string[] }
  | { array: Schema }
  | { object: Record<string, Schema> };

export interface Schema {
  type: SchemaType;
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => boolean;
}

export class InputValidator {
  private schemas: Map<string, Record<string, Schema>> = new Map();

  registerSchema(name: string, schema: Record<string, Schema>): void {
    this.schemas.set(name, schema);
  }

  validate(schemaName: string, data: unknown): ValidationResult {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      return { valid: false, errors: [`Unknown schema: ${schemaName}`] };
    }

    return this.validateObject(data, schema);
  }

  validateObject(data: unknown, schema: Record<string, Schema>): ValidationResult {
    const errors: string[] = [];

    if (typeof data !== 'object' || data === null) {
      return { valid: false, errors: ['Expected object'] };
    }

    const obj = data as Record<string, unknown>;

    for (const [key, fieldSchema] of Object.entries(schema)) {
      const value = obj[key];

      // Required check
      if (fieldSchema.required && (value === undefined || value === null)) {
        errors.push(`Missing required field: ${key}`);
        continue;
      }

      if (value === undefined || value === null) continue;

      // Type check
      const typeResult = this.validateType(value, fieldSchema.type, key);
      if (!typeResult.valid) {
        errors.push(...typeResult.errors);
        continue;
      }

      // Range checks for numbers
      if (typeof value === 'number') {
        if (fieldSchema.min !== undefined && value < fieldSchema.min) {
          errors.push(`${key} must be >= ${fieldSchema.min}`);
        }
        if (fieldSchema.max !== undefined && value > fieldSchema.max) {
          errors.push(`${key} must be <= ${fieldSchema.max}`);
        }
      }

      // Length checks for strings
      if (typeof value === 'string') {
        if (fieldSchema.minLength !== undefined && value.length < fieldSchema.minLength) {
          errors.push(`${key} must be at least ${fieldSchema.minLength} characters`);
        }
        if (fieldSchema.maxLength !== undefined && value.length > fieldSchema.maxLength) {
          errors.push(`${key} must be at most ${fieldSchema.maxLength} characters`);
        }
        if (fieldSchema.pattern && !fieldSchema.pattern.test(value)) {
          errors.push(`${key} does not match required pattern`);
        }
      }

      // Custom validation
      if (fieldSchema.custom && !fieldSchema.custom(value)) {
        errors.push(`${key} failed custom validation`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private validateType(value: unknown, type: SchemaType, key: string): ValidationResult {
    if (typeof type === 'string') {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (type !== actualType) {
        return { valid: false, errors: [`${key} must be ${type}, got ${actualType}`] };
      }
    } else if ('enum' in type) {
      if (!type.enum.includes(value as string)) {
        return { valid: false, errors: [`${key} must be one of: ${type.enum.join(', ')}`] };
      }
    }
    return { valid: true, errors: [] };
  }

  // Sanitize string input
  sanitize(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML
      .replace(/[\x00-\x1f]/g, '') // Remove control characters
      .trim()
      .slice(0, 10000); // Max length
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiter
// ─────────────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  windowMs: number;        // Time window in ms
  maxRequests: number;     // Max requests per window
  keyGenerator?: (req: unknown) => string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private entries: Map<string, RateLimitEntry> = new Map();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(config: RateLimitConfig) {
    this.config = {
      keyGenerator: () => 'default',
      ...config,
    };

    // Cleanup old entries periodically
    this.cleanupTimer = setInterval(() => this.cleanup(), this.config.windowMs);
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    let entry = this.entries.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + this.config.windowMs };
      this.entries.set(key, entry);
    }

    entry.count++;

    const allowed = entry.count <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const resetIn = entry.resetAt - now;

    if (!allowed) {
      eventBus.emit('security:rate_limit', { key, count: entry.count });
    }

    return { allowed, remaining, resetIn };
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now > entry.resetAt) {
        this.entries.delete(key);
      }
    }
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Authentication Manager
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthConfig {
  type: 'apikey' | 'jwt' | 'none';
  apiKeys?: string[];
  jwtSecret?: string;
  jwtExpiry?: number;      // seconds
}

export interface AuthToken {
  id: string;
  subject: string;
  roles: string[];
  permissions: string[];
  issuedAt: number;
  expiresAt: number;
}

export class AuthManager {
  private config: AuthConfig;
  private apiKeys: Set<string>;
  private tokens: Map<string, AuthToken> = new Map();

  constructor(config: AuthConfig) {
    this.config = {
      jwtExpiry: 3600,
      ...config,
    };
    this.apiKeys = new Set(config.apiKeys ?? []);
  }

  // API Key authentication
  validateApiKey(key: string): boolean {
    if (this.config.type !== 'apikey') return false;
    const valid = this.apiKeys.has(key);
    
    if (!valid) {
      eventBus.emit('security:auth_failed', { method: 'apikey' });
    }
    
    return valid;
  }

  addApiKey(key: string): void {
    this.apiKeys.add(key);
  }

  removeApiKey(key: string): void {
    this.apiKeys.delete(key);
  }

  // JWT-like token generation (simplified, use real JWT in production)
  generateToken(subject: string, roles: string[], permissions: string[]): string {
    const now = Math.floor(Date.now() / 1000);
    const token: AuthToken = {
      id: this.generateId(),
      subject,
      roles,
      permissions,
      issuedAt: now,
      expiresAt: now + (this.config.jwtExpiry ?? 3600),
    };

    // Simple encoding (use real JWT library in production!)
    const tokenString = Buffer.from(JSON.stringify(token)).toString('base64');
    this.tokens.set(token.id, token);

    eventBus.emit('security:token_issued', { subject, roles });
    return tokenString;
  }

  validateToken(tokenString: string): AuthToken | null {
    try {
      const decoded = JSON.parse(Buffer.from(tokenString, 'base64').toString());
      const token = this.tokens.get(decoded.id);

      if (!token) {
        eventBus.emit('security:auth_failed', { method: 'token', reason: 'unknown' });
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      if (now > token.expiresAt) {
        this.tokens.delete(token.id);
        eventBus.emit('security:auth_failed', { method: 'token', reason: 'expired' });
        return null;
      }

      return token;
    } catch {
      eventBus.emit('security:auth_failed', { method: 'token', reason: 'invalid' });
      return null;
    }
  }

  revokeToken(tokenId: string): void {
    this.tokens.delete(tokenId);
  }

  hasPermission(token: AuthToken, permission: string): boolean {
    // Wildcard support: 'admin:*' matches 'admin:read', 'admin:write'
    return token.permissions.some(p => {
      if (p === '*') return true;
      if (p.endsWith(':*')) {
        const prefix = p.slice(0, -1);
        return permission.startsWith(prefix);
      }
      return p === permission;
    });
  }

  hasRole(token: AuthToken, role: string): boolean {
    return token.roles.includes(role) || token.roles.includes('admin');
  }

  private generateId(): string {
    return `tok_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Secrets Manager
// ─────────────────────────────────────────────────────────────────────────────

export interface SecretsConfig {
  provider: 'env' | 'memory';
  prefix?: string;
}

export class SecretsManager {
  private config: SecretsConfig;
  private memorySecrets: Map<string, string> = new Map();

  constructor(config: SecretsConfig) {
    this.config = {
      prefix: 'EVERYTHINGOS_',
      ...config,
    };
  }

  get(name: string): string | undefined {
    const key = `${this.config.prefix}${name}`;

    switch (this.config.provider) {
      case 'env':
        return process.env[key];
      case 'memory':
        return this.memorySecrets.get(key);
      default:
        return undefined;
    }
  }

  set(name: string, value: string): void {
    const key = `${this.config.prefix}${name}`;

    switch (this.config.provider) {
      case 'env':
        process.env[key] = value;
        break;
      case 'memory':
        this.memorySecrets.set(key, value);
        break;
    }
  }

  require(name: string): string {
    const value = this.get(name);
    if (!value) {
      throw new Error(`Missing required secret: ${this.config.prefix}${name}`);
    }
    return value;
  }

  has(name: string): boolean {
    return this.get(name) !== undefined;
  }

  // Never log secrets
  mask(value: string): string {
    if (value.length <= 4) return '****';
    return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit Log
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: number;
  actor: string;           // who: 'agent:motion', 'user:admin', 'system'
  action: string;          // what: 'actuator:command', 'config:change'
  target?: string;         // on what: 'servo:elbow', 'agent:rsi'
  params?: unknown;        // with what parameters
  result: 'success' | 'failure' | 'denied';
  reason?: string;         // why failed/denied
  approval?: {
    required: boolean;
    approved: boolean;
    approver?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface AuditConfig {
  maxEntries?: number;
  persistPath?: string;    // Would write to file
  emitEvents?: boolean;
}

export class AuditLog {
  private config: AuditConfig;
  private entries: AuditEntry[] = [];
  private entryCounter = 0;

  constructor(config?: AuditConfig) {
    this.config = {
      maxEntries: 10000,
      emitEvents: true,
      ...config,
    };
  }

  record(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const fullEntry: AuditEntry = {
      id: `audit_${++this.entryCounter}_${Date.now()}`,
      timestamp: Date.now(),
      ...entry,
    };

    this.entries.push(fullEntry);

    // Trim old entries
    if (this.entries.length > this.config.maxEntries!) {
      this.entries = this.entries.slice(-Math.floor(this.config.maxEntries! / 2));
    }

    // Emit event
    if (this.config.emitEvents) {
      eventBus.emit('security:audit', fullEntry);
    }

    return fullEntry;
  }

  // Query audit log
  query(filter: {
    actor?: string;
    action?: string;
    target?: string;
    result?: 'success' | 'failure' | 'denied';
    from?: number;
    to?: number;
    limit?: number;
  }): AuditEntry[] {
    let results = this.entries;

    if (filter.actor) {
      results = results.filter(e => e.actor === filter.actor || e.actor.startsWith(filter.actor + ':'));
    }
    if (filter.action) {
      results = results.filter(e => e.action === filter.action || e.action.startsWith(filter.action + ':'));
    }
    if (filter.target) {
      results = results.filter(e => e.target === filter.target);
    }
    if (filter.result) {
      results = results.filter(e => e.result === filter.result);
    }
    if (filter.from) {
      results = results.filter(e => e.timestamp >= filter.from!);
    }
    if (filter.to) {
      results = results.filter(e => e.timestamp <= filter.to!);
    }
    if (filter.limit) {
      results = results.slice(-filter.limit);
    }

    return results;
  }

  // Get recent entries
  recent(count = 100): AuditEntry[] {
    return this.entries.slice(-count);
  }

  // Get failed/denied entries (security incidents)
  getIncidents(): AuditEntry[] {
    return this.entries.filter(e => e.result === 'failure' || e.result === 'denied');
  }

  // Export for compliance
  export(): AuditEntry[] {
    return [...this.entries];
  }

  // Clear (should require admin permission in real system)
  clear(): void {
    eventBus.emit('security:audit_cleared', { count: this.entries.length });
    this.entries = [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Security Manager (unified interface)
// ─────────────────────────────────────────────────────────────────────────────

export interface SecurityConfig {
  auth?: AuthConfig;
  rateLimit?: RateLimitConfig;
  secrets?: SecretsConfig;
  audit?: AuditConfig;
}

export class SecurityManager {
  public readonly validator: InputValidator;
  public readonly auth: AuthManager;
  public readonly rateLimiter: RateLimiter;
  public readonly secrets: SecretsManager;
  public readonly audit: AuditLog;

  constructor(config: SecurityConfig = {}) {
    this.validator = new InputValidator();
    this.auth = new AuthManager(config.auth ?? { type: 'none' });
    this.rateLimiter = new RateLimiter(config.rateLimit ?? { windowMs: 60000, maxRequests: 100 });
    this.secrets = new SecretsManager(config.secrets ?? { provider: 'env' });
    this.audit = new AuditLog(config.audit);

    this.registerCommonSchemas();
  }

  private registerCommonSchemas(): void {
    // Hardware command schema
    this.validator.registerSchema('hardware_command', {
      command: { type: 'string', required: true, maxLength: 50 },
      value: { type: 'number', min: -10000, max: 10000 },
      speed: { type: 'number', min: 0, max: 1000 },
      target: { type: 'string', maxLength: 100 },
    });

    // Agent config schema
    this.validator.registerSchema('agent_config', {
      id: { type: 'string', required: true, pattern: /^[a-z0-9_-]+$/i, maxLength: 50 },
      name: { type: 'string', required: true, maxLength: 100 },
      enabled: { type: 'boolean' },
    });
  }

  // Convenience method for secure action execution
  async executeSecurely<T>(params: {
    actor: string;
    action: string;
    target?: string;
    data?: unknown;
    schema?: string;
    permission?: string;
    token?: string;
    rateKey?: string;
    execute: () => Promise<T>;
  }): Promise<{ success: boolean; result?: T; error?: string }> {
    // Rate limit check
    if (params.rateKey) {
      const rateResult = this.rateLimiter.check(params.rateKey);
      if (!rateResult.allowed) {
        this.audit.record({
          actor: params.actor,
          action: params.action,
          target: params.target,
          result: 'denied',
          reason: 'rate_limit',
        });
        return { success: false, error: 'Rate limit exceeded' };
      }
    }

    // Auth check
    if (params.permission && params.token) {
      const authToken = this.auth.validateToken(params.token);
      if (!authToken || !this.auth.hasPermission(authToken, params.permission)) {
        this.audit.record({
          actor: params.actor,
          action: params.action,
          target: params.target,
          result: 'denied',
          reason: 'unauthorized',
        });
        return { success: false, error: 'Unauthorized' };
      }
    }

    // Validation check
    if (params.schema && params.data) {
      const validation = this.validator.validate(params.schema, params.data);
      if (!validation.valid) {
        this.audit.record({
          actor: params.actor,
          action: params.action,
          target: params.target,
          params: params.data,
          result: 'denied',
          reason: `validation: ${validation.errors.join(', ')}`,
        });
        return { success: false, error: validation.errors.join(', ') };
      }
    }

    // Execute
    try {
      const result = await params.execute();
      
      this.audit.record({
        actor: params.actor,
        action: params.action,
        target: params.target,
        params: params.data,
        result: 'success',
      });

      return { success: true, result };
    } catch (error) {
      this.audit.record({
        actor: params.actor,
        action: params.action,
        target: params.target,
        params: params.data,
        result: 'failure',
        reason: (error as Error).message,
      });

      return { success: false, error: (error as Error).message };
    }
  }

  shutdown(): void {
    this.rateLimiter.stop();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Export
// ─────────────────────────────────────────────────────────────────────────────

export const security = new SecurityManager();
