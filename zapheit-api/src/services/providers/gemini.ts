/**
 * Gemini adapter — wraps Google's Gemini models through OpenRouter.
 *
 * Accepts shorthand model names (gemini-2.0-flash, gemini-1.5-pro, etc.) and
 * maps them to the canonical google/<name> OpenRouter identifiers before
 * delegating to OpenRouterAdapter.
 *
 * Usage:
 *   const adapter = new GeminiAdapter(openRouterApiKey);
 *   const response = await adapter.chat({ model: 'gemini-2.0-flash', messages });
 */

import { OpenRouterAdapter } from './openrouter';
import type { ProviderAdapter, ChatOptions, ProviderResponse, ProviderStreamChunk } from './adapter';

// Shorthand → full OpenRouter model name
const GEMINI_MODEL_MAP: Record<string, string> = {
  'gemini-2.0-flash':       'google/gemini-2.0-flash',
  'gemini-2.0-flash-exp':   'google/gemini-2.0-flash-exp',
  'gemini-1.5-pro':         'google/gemini-1.5-pro',
  'gemini-1.5-flash':       'google/gemini-1.5-flash',
  'gemini-1.5-flash-8b':    'google/gemini-1.5-flash-8b',
  'gemini-pro':             'google/gemini-pro',
};

function resolveModel(model: string): string {
  // Already fully qualified
  if (model.startsWith('google/')) return model;
  return GEMINI_MODEL_MAP[model] ?? `google/${model}`;
}

export class GeminiAdapter implements ProviderAdapter {
  readonly name = 'gemini';
  readonly supportedModels = Object.keys(GEMINI_MODEL_MAP);

  private openrouter: OpenRouterAdapter;

  constructor(openRouterApiKey: string) {
    this.openrouter = new OpenRouterAdapter(openRouterApiKey);
  }

  supports(model: string): boolean {
    return (
      model.startsWith('gemini-') ||
      model.startsWith('google/gemini') ||
      model.startsWith('gemini/')
    );
  }

  async chat(options: ChatOptions): Promise<ProviderResponse> {
    return this.openrouter.chat({ ...options, model: resolveModel(options.model) });
  }

  stream(options: ChatOptions): AsyncGenerator<ProviderStreamChunk> {
    return this.openrouter.stream({ ...options, model: resolveModel(options.model) });
  }
}
