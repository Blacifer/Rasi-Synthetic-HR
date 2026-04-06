/**
 * Public employee chat portal routes — no JWT required, token-gated.
 *
 * GET  /portal/:token        → agent info for chat header
 * POST /portal/:token/chat   → streaming LLM proxy
 *
 * Mounted in index.ts BEFORE authenticateToken middleware.
 * Uses supabaseAdmin for DB lookups (no user session available).
 */

import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = express.Router();

// 30 requests per 10 minutes per IP — prevents abuse while allowing real conversations
const portalLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests — please slow down.' },
});

router.use(portalLimiter);

// CORS for embed iframes
router.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

router.options('*', (_req, res) => res.sendStatus(204));

// ─── Helper: resolve portal + agent ──────────────────────────────────────────

async function resolvePortal(token: string) {
  const { data: link, error: linkErr } = await supabaseAdmin
    .from('agent_portal_links')
    .select('id, is_enabled, agent_id')
    .eq('share_token', token)
    .single();

  if (linkErr || !link || !link.is_enabled) return null;

  const { data: agent, error: agentErr } = await supabaseAdmin
    .from('ai_agents')
    .select('id, name, description, agent_type, model_name, system_prompt, config, status')
    .eq('id', link.agent_id)
    .single();

  if (agentErr || !agent || agent.status === 'terminated') return null;

  return { link, agent };
}

// ─── GET /portal/:token ───────────────────────────────────────────────────────
// Returns agent name/description for the chat page header.

router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const resolved = await resolvePortal(token);
    if (!resolved) {
      return res.status(404).json({ success: false, error: 'Portal not found or disabled.' });
    }

    const { agent } = resolved;
    res.json({
      success: true,
      data: {
        name: agent.name,
        description: agent.description || '',
        agent_type: agent.agent_type || 'hr',
      },
    });
  } catch (err: any) {
    logger.error('Portal GET error', { error: String(err?.message || err) });
    res.status(500).json({ success: false, error: 'Internal error.' });
  }
});

// ─── POST /portal/:token/chat ─────────────────────────────────────────────────
// Streams an LLM response. Supports openai/, anthropic/, and openrouter/ models.

router.post('/:token/chat', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { message, history = [] } = req.body as {
      message: string;
      history?: Array<{ role: string; content: string }>;
    };

    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: 'message is required.' });
    }

    const resolved = await resolvePortal(token);
    if (!resolved) {
      return res.status(404).json({ success: false, error: 'Portal not found or disabled.' });
    }

    const { agent } = resolved;
    const knowledgeContext: string = agent.config?.knowledge_context || '';
    const systemContent = [
      agent.system_prompt || 'You are a helpful HR assistant.',
      knowledgeContext ? `\n\n--- KNOWLEDGE CONTEXT ---\n${knowledgeContext.slice(0, 30_000)}` : '',
    ].join('').trim();

    const messages = [
      { role: 'system', content: systemContent },
      ...((history as Array<{ role: string; content: string }>).slice(-10)),
      { role: 'user', content: message.trim() },
    ];

    const modelId: string = agent.model_name || 'openai/gpt-4o-mini';
    const isAnthropic = modelId.startsWith('anthropic/');
    const isOpenAI = modelId.startsWith('openai/');

    // Set SSE headers before any async work so the connection stays open
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (typeof (res as any).flushHeaders === 'function') (res as any).flushHeaders();

    if (isAnthropic) {
      await streamAnthropic(res, modelId.replace('anthropic/', ''), messages.slice(1), systemContent);
    } else {
      const upstreamModel = isOpenAI ? modelId.replace('openai/', '') : modelId;
      const baseUrl = isOpenAI
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';
      const apiKey = isOpenAI
        ? (process.env.RASI_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '')
        : (process.env.RASI_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '');

      await streamOpenAICompat(res, baseUrl, apiKey, upstreamModel, messages);
    }
  } catch (err: any) {
    logger.error('Portal chat error', { error: String(err?.message || err) });
    try {
      res.write(`data: [ERROR] ${err?.message || 'Internal error'}\n\n`);
      res.end();
    } catch {
      // response already ended
    }
  }
});

// ─── Streaming helpers ────────────────────────────────────────────────────────

async function streamOpenAICompat(
  res: Response,
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>
) {
  const upstream = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(baseUrl.includes('openrouter') ? { 'HTTP-Referer': 'https://rasi.ai', 'X-Title': 'Rasi Employee Portal' } : {}),
    },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 1024 }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '');
    logger.warn('Portal upstream error', { status: upstream.status, body: errText.slice(0, 200) });
    res.write(`data: [ERROR] Provider returned ${upstream.status}\n\n`);
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n');
    buf = parts.pop() ?? '';

    for (const line of parts) {
      const trimmed = line.replace(/^data: /, '').trim();
      if (!trimmed || trimmed === '[DONE]') continue;
      try {
        const chunk = JSON.parse(trimmed);
        const delta = chunk?.choices?.[0]?.delta?.content;
        if (delta) res.write(`data: ${delta}\n\n`);
      } catch {
        // malformed chunk — skip
      }
    }
  }

  res.write('data: [DONE]\n\n');
  res.end();
}

async function streamAnthropic(
  res: Response,
  model: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string
) {
  const apiKey = process.env.RASI_ANTHROPIC_API_KEY || process.env.RASI_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY || '';

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.filter((m) => m.role !== 'system'),
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '');
    logger.warn('Portal Anthropic error', { status: upstream.status, body: errText.slice(0, 200) });
    res.write(`data: [ERROR] Provider returned ${upstream.status}\n\n`);
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n');
    buf = parts.pop() ?? '';

    for (const line of parts) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const evt = JSON.parse(raw);
        // Anthropic streaming: content_block_delta with delta.text
        if (evt.type === 'content_block_delta' && evt.delta?.text) {
          res.write(`data: ${evt.delta.text}\n\n`);
        }
      } catch {
        // skip
      }
    }
  }

  res.write('data: [DONE]\n\n');
  res.end();
}

export default router;
