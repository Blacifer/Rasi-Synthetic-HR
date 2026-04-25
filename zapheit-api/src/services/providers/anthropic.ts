import Anthropic from '@anthropic-ai/sdk';
import { checkCircuitBreaker, recordSuccess, recordFailure } from '../../lib/circuit-breaker';
import type {
  ProviderAdapter, ChatOptions, ProviderResponse, ProviderStreamChunk, ProviderToolCall,
} from './adapter';

const SYSTEM_ORG = 'system';

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-7':         { input: 15,  output: 75 },
  'claude-sonnet-4-6':       { input: 3,   output: 15 },
  'claude-haiku-4-5':        { input: 0.8, output: 4 },
  'claude-3-5-sonnet':       { input: 3,   output: 15 },
  'claude-sonnet-4-0':       { input: 3,   output: 15 },
  'claude-3-haiku':          { input: 0.25,output: 1.25 },
};

const MODEL_PREFIXES = ['claude-', 'anthropic/'];

function costUSD(model: string, input: number, output: number): number {
  const bare = model.replace('anthropic/', '');
  const p = PRICING[bare] || { input: 3, output: 15 };
  return ((input * p.input) + (output * p.output)) / 1_000_000;
}

function splitSystemAndMessages(messages: ChatOptions['messages']): {
  system: string;
  turns: Anthropic.MessageParam[];
} {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content ?? '')
    .join('\n')
    .trim();

  const turns: Anthropic.MessageParam[] = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content ?? '',
    }));

  return { system, turns };
}

export class AnthropicAdapter implements ProviderAdapter {
  readonly name = 'anthropic';
  readonly supportedModels = Object.keys(PRICING);

  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  supports(model: string): boolean {
    return MODEL_PREFIXES.some((p) => model.startsWith(p));
  }

  async chat(options: ChatOptions): Promise<ProviderResponse> {
    const circuit = await checkCircuitBreaker(SYSTEM_ORG, 'anthropic');
    if (circuit === 'open') throw Object.assign(new Error('Anthropic circuit breaker open'), { code: 'CIRCUIT_OPEN' });

    const start = Date.now();
    const model = options.model.replace('anthropic/', '');
    const { system, turns } = splitSystemAndMessages(options.messages);

    let data: Anthropic.Message;
    try {
      data = await this.client.messages.create({
        model,
        ...(system ? { system } : {}),
        messages: turns,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
      });
    } catch (err) {
      void recordFailure(SYSTEM_ORG, 'anthropic');
      throw err;
    }
    void recordSuccess(SYSTEM_ORG, 'anthropic');

    const text = data.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const toolCalls: ProviderToolCall[] = data.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map((b) => ({
        id: b.id,
        type: 'function' as const,
        function: { name: b.name, arguments: JSON.stringify(b.input) },
      }));

    return {
      content: text,
      model: data.model,
      provider: 'anthropic',
      usage: { input: data.usage.input_tokens, output: data.usage.output_tokens, total: data.usage.input_tokens + data.usage.output_tokens },
      costUSD: costUSD(model, data.usage.input_tokens, data.usage.output_tokens),
      latencyMs: Date.now() - start,
      ...(toolCalls.length ? { toolCalls } : {}),
    };
  }

  async *stream(options: ChatOptions): AsyncGenerator<ProviderStreamChunk> {
    const circuit = await checkCircuitBreaker(SYSTEM_ORG, 'anthropic');
    if (circuit === 'open') throw Object.assign(new Error('Anthropic circuit breaker open'), { code: 'CIRCUIT_OPEN' });

    const model = options.model.replace('anthropic/', '');
    const { system, turns } = splitSystemAndMessages(options.messages);

    const stream = this.client.messages.stream({
      model,
      ...(system ? { system } : {}),
      messages: turns,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { delta: event.delta.text, done: false };
      }
    }
    yield { delta: '', done: true };
    void recordSuccess(SYSTEM_ORG, 'anthropic');
  }
}
