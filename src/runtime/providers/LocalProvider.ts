// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Local Provider (Ollama compatible)
// ═══════════════════════════════════════════════════════════════════════════════

import type { LLMProvider, LLMRequest, LLMResponse } from '../LLMRouter';

export class LocalProvider implements LLMProvider {
  readonly name = 'local';
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';
  }

  async complete(request: Omit<LLMRequest, 'provider'>): Promise<LLMResponse> {
    const systemMessage = request.messages.find(m => m.role === 'system')?.content;
    const prompt = request.messages
      .filter(m => m.role !== 'system')
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model || 'llama2',
        prompt: systemMessage ? `${systemMessage}\n\n${prompt}` : prompt,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens,
          stop: request.stopSequences,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.response,
      finishReason: data.done ? 'stop' : 'length',
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };
  }

  async *stream(request: Omit<LLMRequest, 'provider'>): AsyncIterable<string> {
    const systemMessage = request.messages.find(m => m.role === 'system')?.content;
    const prompt = request.messages
      .filter(m => m.role !== 'system')
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model || 'llama2',
        prompt: systemMessage ? `${systemMessage}\n\n${prompt}` : prompt,
        stream: true,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.response) yield data.response;
            if (data.done) return;
          } catch {}
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Ollama-specific methods
  // ─────────────────────────────────────────────────────────────────────────────

  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) throw new Error('Failed to list models');
    const data = await response.json();
    return data.models?.map((m: { name: string }) => m.name) || [];
  }

  async pullModel(model: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model }),
    });
    if (!response.ok) throw new Error(`Failed to pull model: ${model}`);
  }
}
