/**
 * Canonical model definitions for the Rasi platform.
 *
 * These are used as:
 * 1. Fallback when the live /api/models endpoint is unavailable
 * 2. The source of truth for model selectors, policy dropdowns, and cost calculators
 *
 * The live catalog fetched from the backend includes 350+ OpenRouter models on top of these.
 */

export interface ModelDefinition {
  id: string;
  name: string;
  provider: string;
  context_length?: number;
  pricing?: {
    prompt: string;     // cost per token in USD (as string, e.g. "0.000005")
    completion: string;
  };
  capabilities?: string[]; // e.g. ['vision', 'function_calling', 'audio', 'embeddings']
}

/** Provider display names */
export const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  'meta-llama': 'Meta',
  mistralai: 'Mistral',
  deepseek: 'DeepSeek',
  cohere: 'Cohere',
  'x-ai': 'xAI',
  xai: 'xAI',
  perplexity: 'Perplexity',
  groq: 'Groq',
  nousresearch: 'Nous Research',
  qwen: 'Alibaba',
  openrouter: 'OpenRouter',
};

export function getProviderLabel(id: string): string {
  const prefix = id.split('/')[0] || '';
  return PROVIDER_LABELS[prefix] || prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

/** Cost tier based on price-per-1M-input-tokens */
export function getCostTier(pricing?: ModelDefinition['pricing']): 'economy' | 'standard' | 'premium' {
  if (!pricing) return 'standard';
  const inputPer1M = parseFloat(pricing.prompt) * 1_000_000;
  if (inputPer1M < 0.5) return 'economy';
  if (inputPer1M < 5) return 'standard';
  return 'premium';
}

/** Format pricing for display */
export function formatPricing(pricing?: ModelDefinition['pricing']): string {
  if (!pricing) return '—';
  const inp = parseFloat(pricing.prompt) * 1_000_000;
  const out = parseFloat(pricing.completion) * 1_000_000;
  const fmt = (n: number) => n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
  return `${fmt(inp)} / ${fmt(out)} per 1M tokens`;
}

/**
 * Fallback model list — used when the live API is unavailable.
 * Covers the major models users are most likely to choose.
 */
export const FALLBACK_MODELS: ModelDefinition[] = [
  // ── OpenAI ──────────────────────────────────────────────────────────────
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    context_length: 128000,
    pricing: { prompt: '0.000005', completion: '0.000015' },
    capabilities: ['vision', 'function_calling'],
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    context_length: 128000,
    pricing: { prompt: '0.00000015', completion: '0.0000006' },
    capabilities: ['vision', 'function_calling'],
  },
  {
    id: 'openai/gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    context_length: 128000,
    pricing: { prompt: '0.00001', completion: '0.00003' },
    capabilities: ['vision', 'function_calling'],
  },
  {
    id: 'openai/gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    context_length: 16385,
    pricing: { prompt: '0.0000005', completion: '0.0000015' },
    capabilities: ['function_calling'],
  },
  // ── Anthropic ────────────────────────────────────────────────────────────
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    context_length: 200000,
    pricing: { prompt: '0.000003', completion: '0.000015' },
    capabilities: ['vision', 'function_calling'],
  },
  {
    id: 'anthropic/claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    context_length: 200000,
    pricing: { prompt: '0.000003', completion: '0.000015' },
    capabilities: ['vision', 'function_calling'],
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    context_length: 200000,
    pricing: { prompt: '0.00000025', completion: '0.00000125' },
    capabilities: ['function_calling'],
  },
  // ── Google ───────────────────────────────────────────────────────────────
  {
    id: 'google/gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    context_length: 1048576,
    pricing: { prompt: '0.0000001', completion: '0.0000004' },
    capabilities: ['vision', 'function_calling'],
  },
  {
    id: 'google/gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    context_length: 1048576,
    pricing: { prompt: '0.00000125', completion: '0.000005' },
    capabilities: ['vision', 'function_calling'],
  },
  // ── Meta ─────────────────────────────────────────────────────────────────
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B',
    provider: 'meta-llama',
    context_length: 128000,
    pricing: { prompt: '0.000000059', completion: '0.000000079' },
    capabilities: ['function_calling'],
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B',
    provider: 'meta-llama',
    context_length: 128000,
    pricing: { prompt: '0.000000018', completion: '0.000000018' },
    capabilities: [],
  },
  // ── Mistral ──────────────────────────────────────────────────────────────
  {
    id: 'mistralai/mistral-large',
    name: 'Mistral Large',
    provider: 'mistralai',
    context_length: 128000,
    pricing: { prompt: '0.000002', completion: '0.000006' },
    capabilities: ['function_calling'],
  },
  // ── DeepSeek ─────────────────────────────────────────────────────────────
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'deepseek',
    context_length: 65536,
    pricing: { prompt: '0.00000055', completion: '0.00000219' },
    capabilities: [],
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    context_length: 65536,
    pricing: { prompt: '0.00000014', completion: '0.00000028' },
    capabilities: [],
  },
];

/** Default model used when nothing is configured */
export const DEFAULT_MODEL_ID = 'openai/gpt-4o-mini';
