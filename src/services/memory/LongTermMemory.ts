// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Long-Term Memory
// Persistent memory with vector search
// Agents access this through MemoryService, never directly
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../../core/event-bus/EventBus';
import {
  MemoryAdapter,
  MemoryEntry,
  MemoryQuery,
  MemoryResult,
  MemoryFilter,
  MemoryType,
  EmbeddingProvider,
} from './MemoryTypes';
import { InMemoryAdapter } from './adapters/InMemoryAdapter';

export interface LongTermMemoryConfig {
  adapter?: MemoryAdapter;
  embedding?: EmbeddingProvider;
  maxEntries?: number;
  pruneThreshold?: number;     // Prune when importance below this
  autoConsolidate?: boolean;   // Merge similar memories
}

export class LongTermMemory {
  private adapter: MemoryAdapter;
  private embedding: EmbeddingProvider | null;
  private config: Required<Omit<LongTermMemoryConfig, 'adapter' | 'embedding'>>;

  constructor(config: LongTermMemoryConfig = {}) {
    this.adapter = config.adapter ?? new InMemoryAdapter();
    this.embedding = config.embedding ?? null;
    this.config = {
      maxEntries: config.maxEntries ?? 10000,
      pruneThreshold: config.pruneThreshold ?? 0.1,
      autoConsolidate: config.autoConsolidate ?? false,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Storage
  // ─────────────────────────────────────────────────────────────────────────────

  async store(
    content: string,
    options: {
      source: string;
      type: MemoryType;
      importance?: number;
      tags?: string[];
      associations?: string[];
      ttl?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<MemoryEntry> {
    // Generate embedding if provider available
    let embedding: number[] | undefined;
    if (this.embedding) {
      try {
        embedding = await this.embedding.embed(content);
      } catch (error) {
        // Continue without embedding
        eventBus.emit('memory:longterm:embedding:failed', { error: String(error) });
      }
    }
    
    const entry = await this.adapter.store({
      content,
      embedding,
      metadata: {
        source: options.source,
        type: options.type,
        importance: options.importance ?? 0.5,
        tags: options.tags,
        associations: options.associations,
        ...options.metadata,
      },
      expiresAt: options.ttl ? Date.now() + options.ttl : undefined,
    });
    
    eventBus.emit('memory:longterm:stored', { id: entry.id, type: options.type });
    
    // Check if we need to prune
    const count = await this.adapter.count();
    if (count > this.config.maxEntries) {
      await this.prune();
    }
    
    return entry;
  }

  async storeFact(content: string, source: string, tags?: string[]): Promise<MemoryEntry> {
    return this.store(content, { source, type: 'fact', tags, importance: 0.7 });
  }

  async storeEvent(content: string, source: string, tags?: string[]): Promise<MemoryEntry> {
    return this.store(content, { source, type: 'event', tags, importance: 0.5 });
  }

  async storeDecision(
    content: string,
    source: string,
    context: { reasoning?: string; confidence?: number; outcome?: string }
  ): Promise<MemoryEntry> {
    return this.store(content, {
      source,
      type: 'decision',
      importance: 0.8,
      metadata: context,
    });
  }

  async storePattern(content: string, source: string, frequency: number): Promise<MemoryEntry> {
    return this.store(content, {
      source,
      type: 'pattern',
      importance: Math.min(0.5 + (frequency * 0.1), 1),
      metadata: { frequency },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Retrieval
  // ─────────────────────────────────────────────────────────────────────────────

  async get(id: string): Promise<MemoryEntry | null> {
    return this.adapter.get(id);
  }

  async search(query: MemoryQuery): Promise<MemoryResult[]> {
    // If semantic search requested and we have embedding provider
    if (query.text && this.embedding) {
      return this.semanticSearch(query.text, query);
    }
    
    return this.adapter.search(query);
  }

  private async semanticSearch(text: string, query: MemoryQuery): Promise<MemoryResult[]> {
    if (!this.embedding) {
      return this.adapter.search(query);
    }
    
    try {
      const queryEmbedding = await this.embedding.embed(text);
      
      // Get all potentially matching entries
      const candidates = await this.adapter.search({
        ...query,
        text: undefined, // Remove text, we'll do vector comparison
        limit: (query.limit || 10) * 5, // Get more candidates for re-ranking
      });
      
      // Calculate vector similarity and re-rank
      const ranked = candidates
        .map(result => {
          const distance = result.entry.embedding
            ? this.cosineSimilarity(queryEmbedding, result.entry.embedding)
            : 0;
          return {
            ...result,
            relevance: distance,
            distance: 1 - distance,
          };
        })
        .filter(r => !query.minRelevance || r.relevance >= query.minRelevance)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, query.limit || 10);
      
      return ranked;
    } catch (error) {
      // Fallback to text search
      return this.adapter.search(query);
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Recall Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  async recall(query: string, limit = 5): Promise<string[]> {
    const results = await this.search({ text: query, limit });
    return results.map(r => r.entry.content);
  }

  async recallByType(type: MemoryType, limit = 10): Promise<MemoryEntry[]> {
    const results = await this.search({ filter: { type }, limit });
    return results.map(r => r.entry);
  }

  async recallRecent(limit = 10): Promise<MemoryEntry[]> {
    const results = await this.search({ limit });
    return results
      .map(r => r.entry)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  async recallBySource(source: string, limit = 10): Promise<MemoryEntry[]> {
    const results = await this.search({ filter: { source }, limit });
    return results.map(r => r.entry);
  }

  async recallRelated(entryId: string, limit = 5): Promise<MemoryEntry[]> {
    const entry = await this.get(entryId);
    if (!entry) return [];
    
    // Search by content similarity
    const results = await this.search({ text: entry.content, limit: limit + 1 });
    
    // Filter out the original entry
    return results
      .filter(r => r.entry.id !== entryId)
      .slice(0, limit)
      .map(r => r.entry);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Update & Delete
  // ─────────────────────────────────────────────────────────────────────────────

  async update(id: string, updates: { content?: string; importance?: number; tags?: string[] }): Promise<MemoryEntry | null> {
    const entry = await this.adapter.get(id);
    if (!entry) return null;
    
    const updateData: Partial<MemoryEntry> = {};
    
    if (updates.content) {
      updateData.content = updates.content;
      // Re-embed if content changed
      if (this.embedding) {
        try {
          updateData.embedding = await this.embedding.embed(updates.content);
        } catch {}
      }
    }
    
    if (updates.importance !== undefined || updates.tags) {
      updateData.metadata = {
        ...entry.metadata,
        ...(updates.importance !== undefined && { importance: updates.importance }),
        ...(updates.tags && { tags: updates.tags }),
      };
    }
    
    return this.adapter.update(id, updateData);
  }

  async reinforce(id: string, amount = 0.1): Promise<void> {
    const entry = await this.adapter.get(id);
    if (!entry) return;
    
    const newImportance = Math.min((entry.metadata.importance || 0.5) + amount, 1);
    await this.adapter.update(id, {
      metadata: { ...entry.metadata, importance: newImportance },
    });
    
    eventBus.emit('memory:longterm:reinforced', { id, importance: newImportance });
  }

  async forget(id: string): Promise<boolean> {
    const deleted = await this.adapter.delete(id);
    if (deleted) {
      eventBus.emit('memory:longterm:forgotten', { id });
    }
    return deleted;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Maintenance
  // ─────────────────────────────────────────────────────────────────────────────

  async prune(): Promise<number> {
    const pruned = await this.adapter.prune({
      minImportance: this.config.pruneThreshold,
    });
    
    eventBus.emit('memory:longterm:pruned', { count: pruned });
    return pruned;
  }

  async consolidate(): Promise<number> {
    // TODO: Implement memory consolidation
    // Find similar memories and merge them
    // This is complex and requires careful implementation
    return 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Stats
  // ─────────────────────────────────────────────────────────────────────────────

  async stats(): Promise<{
    total: number;
    byType: Record<MemoryType, number>;
    bySource: Record<string, number>;
  }> {
    const total = await this.adapter.count();
    
    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    
    const allResults = await this.adapter.search({ limit: 10000 });
    
    for (const result of allResults) {
      const type = result.entry.metadata.type;
      const source = result.entry.metadata.source;
      
      byType[type] = (byType[type] || 0) + 1;
      bySource[source] = (bySource[source] || 0) + 1;
    }
    
    return { total, byType: byType as Record<MemoryType, number>, bySource };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Embedding Provider Management
  // ─────────────────────────────────────────────────────────────────────────────

  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embedding = provider;
  }

  hasEmbedding(): boolean {
    return this.embedding !== null;
  }
}

// Singleton export
export const longTermMemory = new LongTermMemory();
