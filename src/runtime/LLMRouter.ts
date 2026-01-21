// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - LLM Router
// Provider-agnostic LLM interface
// ═══════════════════════════════════════════════════════════════════════════════

import { OpenAIProvider } from './providers/OpenAIProvider';
import { ClaudeProvider } from './providers/ClaudeProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { LocalProvider } from './providers/LocalProvider';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  provider: string;
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  tools?: LLMTool[];
}

export interface LLMResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'tool_call' | 'error';
  toolCalls?: LLMToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMProvider {
  name: string;
  complete(request: Omit<LLMRequest, 'provider'>): Promise<LLMResponse>;
  stream?(request: Omit<LLMRequest, 'provider'>): AsyncIterable<string>;
}

export class LLMRouter {
  private providers: Map<string, LLMProvider> = new Map();
  private defaultProvider: string | null = null;

  constructor() {
    this.registerBuiltInProviders();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Provider Management
  // ─────────────────────────────────────────────────────────────────────────────

  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider not found: ${name}`);
    }
    this.defaultProvider = name;
  }

  getProvider(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Completion
  // ─────────────────────────────────────────────────────────────────────────────

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const providerName = request.provider || this.defaultProvider;
    if (!providerName) {
      throw new Error('No provider specified and no default set');
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    return provider.complete(request);
  }

  async *stream(request: LLMRequest): AsyncIterable<string> {
    const providerName = request.provider || this.defaultProvider;
    if (!providerName) {
      throw new Error('No provider specified and no default set');
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    if (!provider.stream) {
      // Fallback to non-streaming
      const response = await provider.complete(request);
      yield response.content;
      return;
    }

    yield* provider.stream(request);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Convenience Methods
  // ─────────────────────────────────────────────────────────────────────────────

  async chat(
    messages: LLMMessage[],
    options?: { provider?: string; model?: string; temperature?: number }
  ): Promise<string> {
    const response = await this.complete({
      provider: options?.provider || this.defaultProvider || '',
      model: options?.model || 'default',
      messages,
      temperature: options?.temperature,
    });
    return response.content;
  }

  async generate(
    prompt: string,
    options?: { provider?: string; model?: string; systemPrompt?: string; temperature?: number }
  ): Promise<string> {
    const messages: LLMMessage[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    
    return this.chat(messages, options);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Built-in Providers
  // ─────────────────────────────────────────────────────────────────────────────

  private registerBuiltInProviders(): void {
    this.registerProvider(new OpenAIProvider());
    this.registerProvider(new ClaudeProvider());
    this.registerProvider(new GeminiProvider());
    this.registerProvider(new LocalProvider());
  }
}

export const llmRouter = new LLMRouter();
