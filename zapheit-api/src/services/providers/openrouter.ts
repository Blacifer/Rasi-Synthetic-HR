/**
 * OpenRouter adapter — routes Gemini, Llama, Mistral, and all other
 * non-OpenAI/non-Anthropic models through api.openrouter.ai using the
 * OpenAI-compatible REST API.
 */
import OpenAI from 'openai';
import { checkCircuitBreaker, recordSuccess, recordFailure } from '../../lib/circuit-breaker';
import type {
  ProviderAdapter, ChatOptions, ProviderResponse, ProviderStreamChunk, ProviderToolCall,
} from './adapter';

const SYSTEM_ORG = 'system';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// Per-1M-token pricing for commonly used OpenRouter models (USD)
const PRICING: Record<string, { input: number; output: number }> = {
  'google/gemini-2.0-flash':              { input: 0.1,  output: 0.4 },
  'google/gemini-1.5-pro':               { input: 3.5,  output: 10.5 },
  'google/gemini-1.5-flash':             { input: 0.075,output: 0.3 },
  'meta-llama/llama-3.1-70b-instruct':   { input: 0.059,output: 0.079 },
  'meta-llama/llama-3.1-405b-instruct':  { input: 2.7,  output: 2.7 },
  'mistralai/mistral-7b-instruct':        { input: 0.055,output: 0.055 },
  'mistralai/mixtral-8x7b-instruct':      { input: 0.45, output: 0.7 },
};

function costUSD(model: string, input: number, output: number): number {
  const p = PRICING[model] || { input: 1, output: 1 };
  return ((input * p.input) + (output * p.output)) / 1_000_000;
}

export class OpenRouterAdapter implements ProviderAdapter {
  readonly name = 'openrouter';
  readonly supportedModels = Object.keys(PRICING);

  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE,
      defaultHeaders: {
        'HTTP-Referer': 'https://api.zapheit.com',
        'X-Title': 'Zapheit',
      },
    });
  }

  supports(model: string): boolean {
    // Accepts anything that contains a slash (provider/model-name format)
    // and isn't claimed by OpenAI or Anthropic prefixes.
    return (
      model.includes('/') &&
      !model.startsWith('openai/') &&
      !model.startsWith('anthropic/') &&
      !model.startsWith('claude-') &&
      !model.startsWith('gpt-') &&
      !model.startsWith('o1') &&
      !model.startsWith('o3')
    ) || model.startsWith('openrouter/');
  }

  async chat(options: ChatOptions): Promise<ProviderResponse> {
    const circuit = await checkCircuitBreaker(SYSTEM_ORG, 'openrouter');
    if (circuit === 'open') throw Object.assign(new Error('OpenRouter circuit breaker open'), { code: 'CIRCUIT_OPEN' });

    const start = Date.now();
    const model = options.model.replace('openrouter/', '');

    let resp: OpenAI.Chat.ChatCompletion;
    try {
      resp = await this.client.chat.completions.create({
        model,
        messages: options.messages.map((m) => ({
          role: m.role as any,
          content: m.content ?? '',
        })),
        temperature: options.temperature ?? 0.7,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      });
    } catch (err) {
      void recordFailure(SYSTEM_ORG, 'openrouter');
      throw err;
    }
    void recordSuccess(SYSTEM_ORG, 'openrouter');

    const choice = resp.choices[0];
    const usage = resp.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const toolCalls: ProviderToolCall[] = (choice.message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      type: 'function' as const,
      function: { name: tc.function.name, arguments: tc.function.arguments },
    }));

    return {
      content: choice.message.content ?? '',
      model,
      provider: 'openrouter',
      usage: { input: usage.prompt_tokens, output: usage.completion_tokens, total: usage.total_tokens },
      costUSD: costUSD(model, usage.prompt_tokens, usage.completion_tokens),
      latencyMs: Date.now() - start,
      ...(toolCalls.length ? { toolCalls } : {}),
    };
  }

  async *stream(options: ChatOptions): AsyncGenerator<ProviderStreamChunk> {
    const circuit = await checkCircuitBreaker(SYSTEM_ORG, 'openrouter');
    if (circuit === 'open') throw Object.assign(new Error('OpenRouter circuit breaker open'), { code: 'CIRCUIT_OPEN' });

    const model = options.model.replace('openrouter/', '');
    const stream = await this.client.chat.completions.create({
      model,
      messages: options.messages.map((m) => ({
        role: m.role as any,
        content: m.content ?? '',
      })),
      temperature: options.temperature ?? 0.7,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      const done = chunk.choices[0]?.finish_reason != null;
      yield { delta, done };
    }
    void recordSuccess(SYSTEM_ORG, 'openrouter');
  }
}
