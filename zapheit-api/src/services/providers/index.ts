/**
 * ProviderFactory — creates and caches ProviderAdapter instances, and
 * implements primary → secondary fallback when the primary provider fails
 * (circuit breaker open or transient error).
 *
 * Usage:
 *   const factory = ProviderFactory.getInstance();
 *   const response = await factory.chat({ model: 'claude-sonnet-4-6', messages });
 *   // If Anthropic is down, automatically retries with gpt-4o-mini.
 */

import { logger } from '../../lib/logger';
import { OpenAIAdapter } from './openai';
import { AnthropicAdapter } from './anthropic';
import { OpenRouterAdapter } from './openrouter';
import { GeminiAdapter } from './gemini';
import type { ProviderAdapter, ChatOptions, ProviderResponse, ProviderStreamChunk } from './adapter';

export type { ProviderAdapter, ChatOptions, ProviderResponse, ProviderStreamChunk };
export type { ProviderMessage, ProviderTool, ProviderToolCall } from './adapter';

// Fallback chain: when a provider fails, try these in order.
const FALLBACK_MODELS: Record<string, string> = {
  // Anthropic → OpenAI
  'anthropic': 'gpt-4o-mini',
  'claude-':   'gpt-4o-mini',
  // OpenAI → Anthropic
  'openai':    'claude-haiku-4-5',
  'gpt-':      'claude-haiku-4-5',
  // OpenRouter / Gemini → OpenAI
  'openrouter': 'gpt-4o-mini',
  'gemini-':    'gpt-4o-mini',
  'google/':    'gpt-4o-mini',
};

function getFallbackModel(failedModel: string): string | null {
  for (const [prefix, fallback] of Object.entries(FALLBACK_MODELS)) {
    if (failedModel.startsWith(prefix)) return fallback;
  }
  return null;
}

export class ProviderFactory {
  private static instance: ProviderFactory;
  private adapters: ProviderAdapter[] = [];

  private constructor() {
    const openaiKey = process.env.RASI_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.RASI_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
    const openrouterKey = process.env.RASI_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;

    if (anthropicKey) this.adapters.push(new AnthropicAdapter(anthropicKey));
    if (openaiKey) this.adapters.push(new OpenAIAdapter(openaiKey));
    if (openrouterKey) {
      this.adapters.push(new OpenRouterAdapter(openrouterKey));
      // GeminiAdapter is a named wrapper over OpenRouter; register after so
      // the supports() check for 'gemini-*' shorthand resolves to it first.
      this.adapters.push(new GeminiAdapter(openrouterKey));
    }
  }

  static getInstance(): ProviderFactory {
    if (!ProviderFactory.instance) ProviderFactory.instance = new ProviderFactory();
    return ProviderFactory.instance;
  }

  /** Reset singleton (useful in tests). */
  static reset(): void {
    ProviderFactory.instance = undefined as any;
  }

  getAdapter(model: string): ProviderAdapter | null {
    return this.adapters.find((a) => a.supports(model)) ?? null;
  }

  /**
   * Chat with automatic primary → secondary fallback.
   * If the primary adapter throws (circuit open, 5xx, timeout), tries the
   * fallback model on a different adapter. Never silently swallows errors on
   * the fallback — callers get the fallback error if both fail.
   */
  async chat(options: ChatOptions): Promise<ProviderResponse> {
    const primary = this.getAdapter(options.model);
    if (!primary) throw new Error(`No adapter found for model: ${options.model}`);

    try {
      return await primary.chat(options);
    } catch (err: any) {
      const fallbackModel = getFallbackModel(options.model);
      if (!fallbackModel) throw err;

      const fallbackAdapter = this.getAdapter(fallbackModel);
      if (!fallbackAdapter) throw err;

      logger.warn('provider-factory: primary failed, falling back', {
        primary: options.model,
        fallback: fallbackModel,
        error: err?.message,
      });

      return fallbackAdapter.chat({ ...options, model: fallbackModel });
    }
  }

  /**
   * Streaming chat — no fallback (stream cannot be retried mid-stream).
   * Throws immediately if primary fails.
   */
  stream(options: ChatOptions): AsyncGenerator<ProviderStreamChunk> {
    const adapter = this.getAdapter(options.model);
    if (!adapter) throw new Error(`No adapter found for model: ${options.model}`);
    return adapter.stream(options);
  }
}

/** Convenience singleton accessor. */
export const providerFactory = {
  chat: (opts: ChatOptions) => ProviderFactory.getInstance().chat(opts),
  stream: (opts: ChatOptions) => ProviderFactory.getInstance().stream(opts),
  getAdapter: (model: string) => ProviderFactory.getInstance().getAdapter(model),
};
