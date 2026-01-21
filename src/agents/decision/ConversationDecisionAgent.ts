// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Conversation Decision Agent
// Decides whether and how to respond to messages
// ═══════════════════════════════════════════════════════════════════════════════

import { Agent, AgentConfig } from '../../runtime/Agent';
import { ConversationContext, ReplyDecision, Message } from '../../runtime/ActionTypes';

export interface ConversationDecisionConfig extends AgentConfig {
  personality?: string;
  replyProbability?: number;
  cooldownMs?: number;
  blacklistPatterns?: string[];
}

export class ConversationDecisionAgent extends Agent {
  private personality: string;
  private replyProbability: number;
  private cooldownMs: number;
  private blacklistPatterns: RegExp[];
  private lastReplyTime: Map<string, number> = new Map();

  constructor(config: ConversationDecisionConfig) {
    super({
      ...config,
      type: 'decision',
    });
    
    this.personality = config.personality || 'helpful and friendly';
    this.replyProbability = config.replyProbability ?? 0.8;
    this.cooldownMs = config.cooldownMs ?? 5000;
    this.blacklistPatterns = (config.blacklistPatterns || []).map(p => new RegExp(p, 'i'));
  }

  protected async onStart(): Promise<void> {
    this.subscribe<{ context: ConversationContext; message: Message }>('conversation:message', async (event) => {
      const { context, message } = event.payload;
      const decision = await this.decide(context, message);
      this.emit('conversation:decision', { context, message, decision });
    });
  }

  protected async onStop(): Promise<void> {
    this.lastReplyTime.clear();
  }

  protected async onTick(): Promise<void> {
    // Clean up old cooldown entries
    const now = Date.now();
    for (const [key, time] of this.lastReplyTime) {
      if (now - time > this.cooldownMs * 10) {
        this.lastReplyTime.delete(key);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Decision Logic
  // ─────────────────────────────────────────────────────────────────────────────

  async decide(context: ConversationContext, message: Message): Promise<ReplyDecision> {
    // Check blacklist
    if (this.isBlacklisted(message.content)) {
      return { shouldReply: false, reasoning: 'Message matches blacklist pattern' };
    }

    // Check cooldown
    if (this.isOnCooldown(context.conversationId)) {
      return { shouldReply: false, reasoning: 'Cooldown active' };
    }

    // Check if bot was mentioned or addressed
    const isMentioned = this.checkMention(message.content, context);
    
    // Random reply probability (if not mentioned)
    if (!isMentioned && Math.random() > this.replyProbability) {
      return { shouldReply: false, reasoning: 'Random skip' };
    }

    // Use LLM to generate response
    try {
      const response = await this.generateResponse(context, message);
      
      this.lastReplyTime.set(context.conversationId, Date.now());
      
      return {
        shouldReply: true,
        content: response.content,
        tone: response.tone,
        reasoning: response.reasoning,
        delay: this.calculateDelay(message.content),
      };
    } catch (error) {
      this.log('error', 'Failed to generate response', { error });
      return { shouldReply: false, reasoning: `Error: ${error}` };
    }
  }

  private isBlacklisted(content: string): boolean {
    return this.blacklistPatterns.some(p => p.test(content));
  }

  private isOnCooldown(conversationId: string): boolean {
    const lastReply = this.lastReplyTime.get(conversationId);
    if (!lastReply) return false;
    return Date.now() - lastReply < this.cooldownMs;
  }

  private checkMention(content: string, context: ConversationContext): boolean {
    // Check for common bot triggers
    const triggers = ['@bot', '@ai', 'hey bot', 'bot,', 'assistant'];
    const lowerContent = content.toLowerCase();
    return triggers.some(t => lowerContent.includes(t));
  }

  private calculateDelay(content: string): number {
    // Simulate typing time based on response length
    const wordsPerMinute = 80;
    const words = content.split(/\s+/).length;
    const baseDelay = (words / wordsPerMinute) * 60 * 1000;
    const randomFactor = 0.5 + Math.random();
    return Math.min(Math.max(baseDelay * randomFactor, 1000), 10000);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Response Generation
  // ─────────────────────────────────────────────────────────────────────────────

  private async generateResponse(
    context: ConversationContext,
    message: Message
  ): Promise<{ content: string; tone: string; reasoning: string }> {
    const historyContext = context.history
      .slice(-10)
      .map(m => `${m.type === 'text' ? m.content : '[media]'}`)
      .join('\n');

    const prompt = `You are a ${this.personality} participant in a ${context.platform} conversation.

Recent conversation:
${historyContext}

Latest message: ${message.content}

Respond naturally. Keep it brief and conversational.
Also determine the appropriate tone (casual, professional, humorous, supportive, etc).

Format your response as JSON:
{
  "content": "your response",
  "tone": "detected tone",
  "reasoning": "why you chose to respond this way"
}`;

    const response = await this.think(prompt, {
      systemPrompt: `You are a conversational AI with personality: ${this.personality}. Respond in JSON format only.`,
      temperature: 0.8,
    });

    try {
      return JSON.parse(response);
    } catch {
      // Fallback if JSON parsing fails
      return {
        content: response,
        tone: 'casual',
        reasoning: 'Direct response',
      };
    }
  }
}
