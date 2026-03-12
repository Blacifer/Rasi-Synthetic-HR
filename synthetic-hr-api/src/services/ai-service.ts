import OpenAI from 'openai';

// OpenAI Pricing (per 1M tokens)
export const OPENAI_PRICING = {
  'gpt-4': { input: 30, output: 60 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4o': { input: 5, output: 15 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
};

// Anthropic Pricing (per 1M tokens)
export const ANTHROPIC_PRICING = {
  'claude-3-opus': { input: 15, output: 75 },
  'claude-3-sonnet': { input: 3, output: 15 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet': { input: 3, output: 15 },
  'claude-sonnet-4-0': { input: 3, output: 15 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
};

export interface AIResponse {
  content: string;
  tokenCount: {
    input: number;
    output: number;
    total: number;
  };
  costUSD: number;
  model: string;
  latency: number;
}

export interface AIConfig {
  apiKey: string;
  model: string;
  platform: 'openai' | 'anthropic';
}

interface AIChatOptions {
  temperature?: number;
  maxTokens?: number;
}

// OpenAI Service
export class OpenAIService {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async chat(
    messages: { role: string; content: string }[],
    model: string = 'gpt-4o',
    options: AIChatOptions = {}
  ): Promise<AIResponse> {
    const startTime = Date.now();

    const response = await this.client.chat.completions.create({
      model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: options.temperature ?? 0.7,
      ...(typeof options.maxTokens === 'number' ? { max_tokens: options.maxTokens } : {}),
    });

    const latency = Date.now() - startTime;
    const completion = response.choices[0].message;

    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const totalTokens = response.usage?.total_tokens || 0;

    // Calculate cost
    const pricing = OPENAI_PRICING[model as keyof typeof OPENAI_PRICING] || OPENAI_PRICING['gpt-4o'];
    const costUSD = ((inputTokens * pricing.input) + (outputTokens * pricing.output)) / 1000000;

    return {
      content: completion.content || '',
      tokenCount: { input: inputTokens, output: outputTokens, total: totalTokens },
      costUSD,
      model: response.model,
      latency,
    };
  }
}

// Anthropic Service
export class AnthropicService {
  private apiKey: string;
  private baseUrl: string;
  private version: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
    this.version = process.env.ANTHROPIC_VERSION || '2023-06-01';
  }

  private static extractTextBlocks(content: any): string {
    if (!Array.isArray(content)) return '';
    return content
      .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('');
  }

  async chat(
    messages: { role: string; content: string }[],
    model: string = 'claude-3-sonnet',
    options: AIChatOptions = {}
  ): Promise<AIResponse> {
    const startTime = Date.now();

    // Convert messages format for Anthropic
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';

    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': this.version,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: anthropicMessages,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      const err: any = new Error(`Anthropic messages API failed: ${response.status} ${body}`);
      err.status = response.status;
      err.responseBody = body;
      throw err;
    }

    const data = (await response.json()) as any;

    const latency = Date.now() - startTime;

    const outputText = AnthropicService.extractTextBlocks(data?.content);

    // Token counts (fallback to heuristic if missing)
    const inputTokens = Number.isFinite(data?.usage?.input_tokens)
      ? Number(data.usage.input_tokens)
      : Math.ceil(messages.reduce((acc, m) => acc + m.content.length / 4, 0));
    const outputTokens = Number.isFinite(data?.usage?.output_tokens)
      ? Number(data.usage.output_tokens)
      : Math.ceil(outputText.length / 4);
    const totalTokens = inputTokens + outputTokens;

    // Calculate cost
    const pricing = ANTHROPIC_PRICING[model as keyof typeof ANTHROPIC_PRICING] || ANTHROPIC_PRICING['claude-3-sonnet'];
    const costUSD = ((inputTokens * pricing.input) + (outputTokens * pricing.output)) / 1000000;

    return {
      content: outputText,
      tokenCount: { input: inputTokens, output: outputTokens, total: totalTokens },
      costUSD,
      model: data?.model || model,
      latency,
    };
  }
}

// Cost Calculator Utility
export function calculateTokenCost(
  platform: 'openai' | 'anthropic',
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  let pricing: { input: number; output: number };

  if (platform === 'openai') {
    pricing = OPENAI_PRICING[model as keyof typeof OPENAI_PRICING] || OPENAI_PRICING['gpt-4o'];
  } else {
    pricing = ANTHROPIC_PRICING[model as keyof typeof ANTHROPIC_PRICING] || ANTHROPIC_PRICING['claude-3-sonnet'];
  }

  return ((inputTokens * pricing.input) + (outputTokens * pricing.output)) / 1000000;
}
