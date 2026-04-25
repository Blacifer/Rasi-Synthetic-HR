/**
 * ProviderAdapter — unified interface for all LLM providers.
 *
 * Every provider (OpenAI, Anthropic, OpenRouter/Gemini/Llama) implements
 * this interface. The gateway and any other caller uses the factory in
 * index.ts to get an adapter — it never needs to know which provider it's
 * talking to.
 *
 * Design constraints:
 *  - Streaming and non-streaming paths are separate so callers can choose.
 *  - Tool calls are passed through in normalised OpenAI format for both providers.
 *  - Fallback is handled by the factory (index.ts), not here.
 */

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  name?: string;
}

export interface ProviderTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ProviderToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ProviderResponse {
  content: string;
  model: string;
  provider: string;
  usage: { input: number; output: number; total: number };
  costUSD: number;
  latencyMs: number;
  toolCalls?: ProviderToolCall[];
}

export interface ProviderStreamChunk {
  delta: string;
  done: boolean;
  toolCalls?: ProviderToolCall[];
}

export interface ChatOptions {
  model: string;
  messages: ProviderMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: ProviderTool[];
  stream?: boolean;
}

export interface ProviderAdapter {
  readonly name: string;
  readonly supportedModels: string[];

  /** Non-streaming chat — returns when response is complete. */
  chat(options: ChatOptions): Promise<ProviderResponse>;

  /** Streaming chat — yields chunks as they arrive. */
  stream(options: ChatOptions): AsyncGenerator<ProviderStreamChunk>;

  /** True if this adapter can handle the given model ID. */
  supports(model: string): boolean;
}
