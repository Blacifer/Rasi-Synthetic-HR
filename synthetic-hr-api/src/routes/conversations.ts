import express, { Request, Response } from 'express';
import { requirePermission } from '../middleware/rbac';
import { supabaseRestAsUser, eq, in_ } from '../lib/supabase-rest';
import { logger } from '../lib/logger';
import { errorResponse, getOrgId, getUserJwt } from '../lib/route-helpers';
import { parseCursorParams, buildCursorResponse, buildCursorFilter } from '../lib/pagination';

const router = express.Router();

// Get conversations list
router.get('/conversations', requirePermission('dashboard.read'), async (req: Request, res: Response) => {
  try {
    const { agent_id, status } = req.query;
    const orgId = getOrgId(req);
    if (!orgId) {
      return errorResponse(res, new Error('Organization not found'), 400);
    }

    logger.info('Fetching conversations', { org_id: orgId, agent_id, status });

    const { limit, cursorId, cursorCreatedAt } = parseCursorParams(req);
    const cursorFilter = buildCursorFilter(cursorId, cursorCreatedAt);

    const query = new URLSearchParams();
    query.set('organization_id', eq(orgId));
    query.set('order', 'created_at.desc,id.desc');
    query.set('limit', String(limit + 1));
    if (cursorFilter) query.set('or', cursorFilter);
    if (agent_id) query.set('agent_id', eq(String(agent_id)));
    if (status) query.set('status', eq(String(status)));

    const rows = await supabaseRestAsUser(
      getUserJwt(req),
      'conversations',
      query,
      { headers: { 'Prefer': 'return=representation' } }
    ) as any[];
    const paged = buildCursorResponse(rows || [], limit);

    logger.info('Conversations fetched successfully', { count: paged.data?.length, org_id: orgId });

    res.json({ success: true, data: paged.data, count: paged.data?.length || 0, next_cursor: paged.next_cursor, has_more: paged.has_more });
  } catch (error: any) {
    errorResponse(res, error);
  }
});

// CSAT aggregate summary for the org
router.get('/conversations/csat-summary', requirePermission('dashboard.read'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return errorResponse(res, new Error('Organization not found'), 400);

    const query = new URLSearchParams();
    query.set('organization_id', eq(orgId));
    query.set('rating', 'not.is.null');
    query.set('select', 'rating');

    const data: Array<{ rating: number }> = await supabaseRestAsUser(getUserJwt(req), 'conversations', query) || [];

    const thumbs_up = data.filter((r) => r.rating === 1).length;
    const thumbs_down = data.filter((r) => r.rating === -1).length;
    const total_rated = thumbs_up + thumbs_down;
    const satisfaction_pct = total_rated > 0 ? Math.round((thumbs_up / total_rated) * 100) : null;

    res.json({ success: true, data: { total_rated, thumbs_up, thumbs_down, satisfaction_pct } });
  } catch (error: any) {
    errorResponse(res, error);
  }
});

// Get single conversation with messages
router.get('/conversations/:id', requirePermission('dashboard.read'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = getOrgId(req);
    if (!orgId) {
      return errorResponse(res, new Error('Organization not found'), 400);
    }

    logger.info('Fetching conversation', { conversation_id: id, org_id: orgId });

    const conversationQuery = new URLSearchParams();
    conversationQuery.set('id', eq(id));
    conversationQuery.set('organization_id', eq(orgId));

    const conversationData = await supabaseRestAsUser(getUserJwt(req), 'conversations', conversationQuery);

    if (!conversationData?.length) {
      return errorResponse(res, new Error('Conversation not found'), 404);
    }

    const conversation = conversationData[0];

    const messagesQuery = new URLSearchParams();
    messagesQuery.set('conversation_id', eq(id));
    messagesQuery.set('order', 'created_at.asc');

    const messagesData = await supabaseRestAsUser(getUserJwt(req), 'messages', messagesQuery);

    logger.info('Conversation fetched successfully', { conversation_id: id, message_count: messagesData?.length });

    res.json({ success: true, data: { ...conversation, messages: messagesData || [] } });
  } catch (error: any) {
    errorResponse(res, error);
  }
});

// Get reasoning traces for a conversation
router.get('/conversations/:id/trace', requirePermission('dashboard.read'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = getOrgId(req);
    if (!orgId) {
      return errorResponse(res, new Error('Organization not found'), 400);
    }

    // Verify the conversation belongs to this org
    const convQuery = new URLSearchParams();
    convQuery.set('id', eq(id));
    convQuery.set('organization_id', eq(orgId));
    convQuery.set('select', 'id');
    const convData = await supabaseRestAsUser(getUserJwt(req), 'conversations', convQuery);
    if (!convData?.length) {
      return errorResponse(res, new Error('Conversation not found'), 404);
    }

    const traceQuery = new URLSearchParams();
    traceQuery.set('conversation_id', eq(id));
    traceQuery.set('organization_id', eq(orgId));
    traceQuery.set('order', 'created_at.asc');

    const traces = await supabaseRestAsUser(getUserJwt(req), 'gateway_reasoning_traces', traceQuery);

    res.json({ success: true, data: traces || [] });
  } catch (error: any) {
    errorResponse(res, error);
  }
});

// Rate a conversation (thumbs up / thumbs down)
router.post('/conversations/:id/rate', requirePermission('dashboard.read'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const jwt = getUserJwt(req);
    if (!orgId) return errorResponse(res, new Error('Organization not found'), 400);

    const { id } = req.params;
    const { rating, feedback_text } = req.body as { rating: 1 | -1; feedback_text?: string };

    if (rating !== 1 && rating !== -1) {
      return res.status(400).json({ success: false, error: 'rating must be 1 or -1' });
    }

    // Verify conversation belongs to this org
    const checkQ = new URLSearchParams();
    checkQ.set('id', eq(id));
    checkQ.set('organization_id', eq(orgId));
    checkQ.set('select', 'id');
    const existing = await supabaseRestAsUser(jwt, 'conversations', checkQ);
    if (!existing?.length) return res.status(404).json({ success: false, error: 'Conversation not found' });

    // PATCH rating + feedback_text
    const patchQ = new URLSearchParams();
    patchQ.set('id', eq(id));
    const updated = await supabaseRestAsUser(jwt, 'conversations', patchQ, {
      method: 'PATCH',
      body: { rating, feedback_text: feedback_text || null },
      headers: { 'Prefer': 'return=representation' },
    });

    res.json({ success: true, data: updated?.[0] });
  } catch (error: any) {
    errorResponse(res, error);
  }
});

// Trending topics: top keywords from last 500 user messages for the org
router.get('/analytics/trending-topics', requirePermission('dashboard.read'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const jwt = getUserJwt(req);
    if (!orgId) return errorResponse(res, new Error('Organization not found'), 400);

    // Step 1: get conversation IDs for this org
    const convQ = new URLSearchParams();
    convQ.set('organization_id', eq(orgId));
    convQ.set('select', 'id');
    convQ.set('limit', '500');
    const convRows: Array<{ id: string }> = await supabaseRestAsUser(jwt, 'conversations', convQ) || [];
    const convIds = convRows.map((c) => c.id);

    if (convIds.length === 0) {
      return res.json({ success: true, data: { topics: [] } });
    }

    // Step 2: fetch last 500 user messages from those conversations
    const msgQ = new URLSearchParams();
    msgQ.set('conversation_id', in_(convIds.slice(0, 200))); // cap to avoid URL length limits
    msgQ.set('role', eq('user'));
    msgQ.set('select', 'content');
    msgQ.set('order', 'created_at.desc');
    msgQ.set('limit', '500');
    const messages: Array<{ content: string }> = await supabaseRestAsUser(jwt, 'messages', msgQ) || [];

    // Step 3: tokenize and count word frequency
    const STOP_WORDS = new Set([
      'the','a','an','i','is','it','my','to','and','of','in','for','can','you','me','do',
      'we','he','she','they','this','that','with','on','at','by','from','or','not','but',
      'are','was','were','be','been','have','has','had','will','would','could','should',
      'what','how','when','where','who','why','which','there','their','your','our','its',
      'if','so','as','up','out','about','into','than','then','more','some','any','all',
      'just','also','no','yes','ok','hi','hello','thanks','please','help','need','want',
      'get','got','know','think','like','use','make','much','many','need','can','i\'m',
      'i\'ve','i\'ll','i\'d','don\'t','didn\'t','can\'t','won\'t','isn\'t','aren\'t',
    ]);

    const freq: Record<string, number> = {};
    for (const msg of messages) {
      const words = (msg.content || '')
        .toLowerCase()
        .replace(/[^a-z0-9'\s-]/g, ' ')
        .split(/\s+/);
      for (const word of words) {
        const clean = word.replace(/^'+|'+$/g, '');
        if (clean.length < 3) continue;
        if (STOP_WORDS.has(clean)) continue;
        freq[clean] = (freq[clean] || 0) + 1;
      }
    }

    const topics = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    res.json({ success: true, data: { topics } });
  } catch (error: any) {
    errorResponse(res, error);
  }
});

export default router;
