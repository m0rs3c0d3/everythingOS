// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Episodic Memory
// Conversation history with automatic summarization
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../../core/event-bus/EventBus';
import { llmRouter } from '../../runtime/LLMRouter';
import {
  MemoryAdapter,
  MemoryEntry,
  ConversationTurn,
  ConversationSummary,
} from './MemoryTypes';
import { InMemoryAdapter } from './adapters/InMemoryAdapter';

export interface EpisodicMemoryConfig {
  adapter?: MemoryAdapter;
  maxTurnsBeforeSummary?: number;  // Summarize after this many turns
  maxStoredTurns?: number;         // Keep only this many recent turns
  summaryProvider?: string;        // LLM provider for summarization
  summaryModel?: string;           // LLM model for summarization
}

export interface Conversation {
  id: string;
  turns: ConversationTurn[];
  summaries: ConversationSummary[];
  metadata: {
    platform?: string;
    participants: string[];
    startedAt: number;
    lastActivityAt: number;
    tags?: string[];
  };
}

export class EpisodicMemory {
  private adapter: MemoryAdapter;
  private conversations: Map<string, Conversation> = new Map();
  private config: Required<EpisodicMemoryConfig>;

  constructor(config: EpisodicMemoryConfig = {}) {
    this.adapter = config.adapter ?? new InMemoryAdapter();
    this.config = {
      adapter: this.adapter,
      maxTurnsBeforeSummary: config.maxTurnsBeforeSummary ?? 20,
      maxStoredTurns: config.maxStoredTurns ?? 50,
      summaryProvider: config.summaryProvider ?? 'claude',
      summaryModel: config.summaryModel ?? 'claude-sonnet-4-20250514',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Conversation Management
  // ─────────────────────────────────────────────────────────────────────────────

  startConversation(id: string, metadata?: Partial<Conversation['metadata']>): Conversation {
    const conversation: Conversation = {
      id,
      turns: [],
      summaries: [],
      metadata: {
        participants: [],
        startedAt: Date.now(),
        lastActivityAt: Date.now(),
        ...metadata,
      },
    };
    
    this.conversations.set(id, conversation);
    eventBus.emit('memory:episodic:conversation:started', { conversationId: id });
    
    return conversation;
  }

  getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  async endConversation(id: string): Promise<ConversationSummary | null> {
    const conversation = this.conversations.get(id);
    if (!conversation) return null;
    
    // Generate final summary
    const summary = await this.summarizeConversation(conversation);
    
    // Store in long-term via adapter
    await this.adapter.store({
      content: JSON.stringify({
        summary,
        finalTurns: conversation.turns.slice(-10),
      }),
      metadata: {
        source: 'episodic-memory',
        type: 'conversation',
        tags: conversation.metadata.tags,
        conversationId: id,
      },
    });
    
    this.conversations.delete(id);
    eventBus.emit('memory:episodic:conversation:ended', { conversationId: id, summary });
    
    return summary;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Turn Management
  // ─────────────────────────────────────────────────────────────────────────────

  async addTurn(
    conversationId: string,
    role: ConversationTurn['role'],
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    let conversation = this.conversations.get(conversationId);
    
    // Auto-create conversation if it doesn't exist
    if (!conversation) {
      conversation = this.startConversation(conversationId);
    }
    
    const turn: ConversationTurn = {
      role,
      content,
      timestamp: Date.now(),
      metadata,
    };
    
    conversation.turns.push(turn);
    conversation.metadata.lastActivityAt = Date.now();
    
    // Track participants
    if (metadata?.userId && !conversation.metadata.participants.includes(metadata.userId as string)) {
      conversation.metadata.participants.push(metadata.userId as string);
    }
    
    eventBus.emit('memory:episodic:turn:added', { conversationId, role });
    
    // Check if we need to summarize
    if (conversation.turns.length >= this.config.maxTurnsBeforeSummary) {
      await this.compressConversation(conversation);
    }
  }

  getTurns(conversationId: string, limit?: number): ConversationTurn[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return [];
    
    if (limit) {
      return conversation.turns.slice(-limit);
    }
    return [...conversation.turns];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Context Building
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get context for LLM - includes summaries + recent turns
   */
  getContext(conversationId: string, maxTokens?: number): string {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return '';
    
    const parts: string[] = [];
    
    // Add summaries first
    if (conversation.summaries.length > 0) {
      parts.push('## Previous Context');
      for (const summary of conversation.summaries) {
        parts.push(summary.summary);
      }
      parts.push('');
    }
    
    // Add recent turns
    parts.push('## Recent Conversation');
    for (const turn of conversation.turns) {
      const roleLabel = turn.role === 'user' ? 'User' : turn.role === 'assistant' ? 'Assistant' : 'System';
      parts.push(`${roleLabel}: ${turn.content}`);
    }
    
    let context = parts.join('\n');
    
    // Simple token estimation and truncation
    if (maxTokens) {
      const estimatedTokens = context.length / 4; // Rough estimate
      if (estimatedTokens > maxTokens) {
        // Keep summaries, truncate turns
        const summaryPart = parts.slice(0, conversation.summaries.length + 2).join('\n');
        const remainingTokens = maxTokens - (summaryPart.length / 4);
        const turnsPart = parts.slice(conversation.summaries.length + 2).join('\n');
        const truncatedTurns = turnsPart.slice(-(remainingTokens * 4));
        context = summaryPart + '\n...\n' + truncatedTurns;
      }
    }
    
    return context;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Summarization
  // ─────────────────────────────────────────────────────────────────────────────

  private async compressConversation(conversation: Conversation): Promise<void> {
    // Take older turns for summarization, keep recent ones
    const turnsToSummarize = conversation.turns.slice(0, -10);
    const turnsToKeep = conversation.turns.slice(-10);
    
    if (turnsToSummarize.length < 5) return;
    
    // Generate summary
    const summary = await this.summarizeTurns(conversation.id, turnsToSummarize);
    
    // Update conversation
    conversation.summaries.push(summary);
    conversation.turns = turnsToKeep;
    
    eventBus.emit('memory:episodic:compressed', {
      conversationId: conversation.id,
      summarizedTurns: turnsToSummarize.length,
    });
  }

  private async summarizeTurns(
    conversationId: string,
    turns: ConversationTurn[]
  ): Promise<ConversationSummary> {
    const turnsText = turns
      .map(t => `${t.role}: ${t.content}`)
      .join('\n');
    
    const prompt = `Summarize this conversation segment concisely. Extract:
1. Main topics discussed
2. Key decisions or conclusions
3. Important information shared
4. Any action items or follow-ups

Conversation:
${turnsText}

Respond in JSON format:
{
  "summary": "Brief narrative summary",
  "keyPoints": ["point1", "point2", ...]
}`;

    try {
      const response = await llmRouter.generate(prompt, {
        provider: this.config.summaryProvider,
        model: this.config.summaryModel,
        temperature: 0.3,
      });
      
      const parsed = JSON.parse(response);
      
      return {
        conversationId,
        summary: parsed.summary,
        keyPoints: parsed.keyPoints || [],
        participants: [],
        startedAt: turns[0]?.timestamp || Date.now(),
        endedAt: turns[turns.length - 1]?.timestamp || Date.now(),
        turnCount: turns.length,
      };
    } catch (error) {
      // Fallback to simple summary
      return {
        conversationId,
        summary: `Conversation with ${turns.length} turns.`,
        keyPoints: [],
        participants: [],
        startedAt: turns[0]?.timestamp || Date.now(),
        endedAt: turns[turns.length - 1]?.timestamp || Date.now(),
        turnCount: turns.length,
      };
    }
  }

  private async summarizeConversation(conversation: Conversation): Promise<ConversationSummary> {
    // Combine all summaries + remaining turns
    const allContent: string[] = [];
    
    for (const summary of conversation.summaries) {
      allContent.push(summary.summary);
    }
    
    for (const turn of conversation.turns) {
      allContent.push(`${turn.role}: ${turn.content}`);
    }
    
    return this.summarizeTurns(conversation.id, conversation.turns);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Search Past Conversations
  // ─────────────────────────────────────────────────────────────────────────────

  async searchPastConversations(query: string, limit = 10): Promise<ConversationSummary[]> {
    const results = await this.adapter.search({
      text: query,
      filter: { type: 'conversation' },
      limit,
    });
    
    return results.map(r => {
      try {
        const data = JSON.parse(r.entry.content);
        return data.summary as ConversationSummary;
      } catch {
        return null;
      }
    }).filter((s): s is ConversationSummary => s !== null);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Stats
  // ─────────────────────────────────────────────────────────────────────────────

  stats(): {
    activeConversations: number;
    totalTurns: number;
    totalSummaries: number;
  } {
    let totalTurns = 0;
    let totalSummaries = 0;
    
    for (const conversation of this.conversations.values()) {
      totalTurns += conversation.turns.length;
      totalSummaries += conversation.summaries.length;
    }
    
    return {
      activeConversations: this.conversations.size,
      totalTurns,
      totalSummaries,
    };
  }
}

// Singleton export
export const episodicMemory = new EpisodicMemory();
