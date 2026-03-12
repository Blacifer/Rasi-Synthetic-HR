import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { AnthropicService } from '../services/ai-service';

describe('AnthropicService', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  it('does not throw when Anthropic returns empty content', async () => {
    (global as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [], model: 'claude-3-5-sonnet', usage: { input_tokens: 1, output_tokens: 0 } }),
    });

    const service = new AnthropicService('test-key');
    const result = await service.chat(
      [
        { role: 'system', content: 'You are SyntheticHR.' },
        { role: 'user', content: 'Hello' },
      ],
      'claude-3-5-sonnet',
      { maxTokens: 16, temperature: 0.2 }
    );

    expect(result.content).toBe('');
    expect(result.tokenCount.output).toBe(0);
  });

  it('concatenates multiple text blocks', async () => {
    (global as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'claude-3-5-sonnet',
        usage: { input_tokens: 10, output_tokens: 10 },
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'tool_use', id: 'toolu_1', name: 'x', input: {} },
          { type: 'text', text: ' world' },
        ],
      }),
    });

    const service = new AnthropicService('test-key');
    const result = await service.chat(
      [
        { role: 'system', content: 'You are SyntheticHR.' },
        { role: 'user', content: 'Say hi' },
      ],
      'claude-3-5-sonnet'
    );

    expect(result.content).toBe('Hello world');
    expect(result.tokenCount.output).toBeGreaterThan(0);
  });
});
