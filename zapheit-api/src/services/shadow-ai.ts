import { supabaseRestAsService } from '../lib/supabase-rest';
import { logger } from '../lib/logger';

export interface ShadowAiEventInput {
  organization_id: string;
  source_ip?: string;
  user_agent?: string;
  request_url: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'other';
  request_method?: string;
  request_size?: number;
  blocked?: boolean;
  metadata?: Record<string, unknown>;
}

const PROVIDER_PATTERNS: Array<{ pattern: RegExp; provider: ShadowAiEventInput['provider'] }> = [
  { pattern: /api\.openai\.com/i, provider: 'openai' },
  { pattern: /api\.anthropic\.com/i, provider: 'anthropic' },
  { pattern: /generativelanguage\.googleapis\.com/i, provider: 'gemini' },
  { pattern: /openrouter\.ai/i, provider: 'openai' },
];

export function detectProvider(url: string): ShadowAiEventInput['provider'] {
  for (const { pattern, provider } of PROVIDER_PATTERNS) {
    if (pattern.test(url)) return provider;
  }
  return 'other';
}

export async function logShadowAiEvent(event: ShadowAiEventInput): Promise<void> {
  try {
    await supabaseRestAsService('shadow_ai_events', '', {
      method: 'POST',
      body: {
        organization_id: event.organization_id,
        source_ip: event.source_ip ?? null,
        user_agent: event.user_agent ?? null,
        request_url: event.request_url,
        provider: event.provider,
        request_method: event.request_method ?? 'POST',
        request_size: event.request_size ?? null,
        blocked: event.blocked ?? false,
        metadata: event.metadata ?? {},
      },
    });
  } catch (err: any) {
    logger.warn('shadow-ai: failed to log event', { err: err?.message, url: event.request_url });
  }
}

/**
 * Returns shadow AI events for an org in the last N days, grouped by provider.
 */
export async function getShadowAiSummary(orgId: string, days = 30): Promise<{
  total: number;
  blocked: number;
  by_provider: Record<string, number>;
}> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  try {
    const rows = await supabaseRestAsService('shadow_ai_events', new URLSearchParams({
      select: 'provider,blocked',
      organization_id: `eq.${orgId}`,
      detected_at: `gte.${since}`,
    })) as Array<{ provider: string; blocked: boolean }>;

    const events = Array.isArray(rows) ? rows : [];
    const by_provider: Record<string, number> = {};
    let blocked = 0;
    for (const e of events) {
      by_provider[e.provider] = (by_provider[e.provider] ?? 0) + 1;
      if (e.blocked) blocked++;
    }
    return { total: events.length, blocked, by_provider };
  } catch (err: any) {
    logger.warn('shadow-ai: failed to fetch summary', { err: err?.message });
    return { total: 0, blocked: 0, by_provider: {} };
  }
}
