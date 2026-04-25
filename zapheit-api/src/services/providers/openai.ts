import OpenAI from 'openai';
import { checkCircuitBreaker, recordSuccess, recordFailure } from '../../lib/circuit-breaker';
import type {
  ProviderAdapter, ChatOptions, ProviderResponse, ProviderStreamChunk, ProviderToolCall,
} from './adapter';

const SYSTEM_ORG = 'system';

const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o':       { input: 5,    output: 15 },
  'gpt-4o-mini':  { input: 0.15, output: 0.6 },
  'gpt-4-turbo':  { input: 10,   output: 30 },
  'gpt-4':        { input: 30,   output: 60 },
  'gpt-3.5-turbo':{ input: 0.5,  output: 1.5 },
  'o1-preview':   { input: 15,   output: 60 },
  'o1-mini':      { input: 3,    output: 12 },
  'o3-mini':      { input: 1.1,  output: 4.4 },
};

const MODEL_PREFIXES = ['gpt-', 'o1', 'o3', 'openai/'];

function costUSD(model: string, input: number, output: number): number {
  const bare = model.replace('openai/', '');
  const p = PRICING[bare] || { input: 5, output: 15 };
  return ((input * p.input) + (output * p.output)) / 1_000_000;
}

function toOpenAIMessages(messages: ChatOptions['messages']): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map((m) => ({
    role: m.role as any,
    content: m.content ?? '',
    ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
    ...(m.name ? { name: m.name } : {}),
  }));
}

export class OpenAIAdapter implements ProviderAdapter {
  readonly name = 'openai';
  readonly supportedModels = Object.keys(PRICING);

  private client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  }

  supports(model: string): boolean {
    return MODEL_PREFIXES.some((p) => model.startsWith(p));
  }

  async chat(options: ChatOptions): Promise<ProviderResponse> {
    const circuit = await checkCircuitBreaker(SYSTEM_ORG, 'openai');
    if (circuit === 'open') throw Object.assign(new Error('OpenAI circuit breaker open'), { code: 'CIRCUIT_OPEN' });

    const start = Date.now();
    const model = options.model.replace('openai/', '');

    let resp: OpenAI.Chat.ChatCompletion;
    try {
      resp = await this.client.chat.completions.create({
        model,
        messages: toOpenAIMessages(options.messages),
        temperature: options.temperature ?? 0.7,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        ...(options.tools?.length ? { tools: options.tools as any, tool_choice: 'auto' } : {}),
      });
    } catch (err) {
      void recordFailure(SYSTEM_ORG, 'openai');
      throw err;
    }
    void recordSuccess(SYSTEM_ORG, 'openai');

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
      provider: 'openai',
      usage: { input: usage.prompt_tokens, output: usage.completion_tokens, total: usage.total_tokens },
      costUSD: costUSD(model, usage.prompt_tokens, usage.completion_tokens),
      latencyMs: Date.now() - start,
      ...(toolCalls.length ? { toolCalls } : {}),
    };
  }

  async *stream(options: ChatOptions): AsyncGenerator<ProviderStreamChunk> {
    const circuit = await checkCircuitBreaker(SYSTEM_ORG, 'openai');
    if (circuit === 'open') throw Object.assign(new Error('OpenAI circuit breaker open'), { code: 'CIRCUIT_OPEN' });

    const model = options.model.replace('openai/', '');
    const stream = await this.client.chat.completions.create({
      model,
      messages: toOpenAIMessages(options.messages),
      temperature: options.temperature ?? 0.7,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      const done = chunk.choices[0]?.finish_reason != null;
      yield { delta, done };
    }
    void recordSuccess(SYSTEM_ORG, 'openai');
  }
}
