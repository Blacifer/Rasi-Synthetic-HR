// ---------------------------------------------------------------------------
// Connector Action Executor
// Makes real HTTP calls to third-party APIs using stored credentials.
// Handles token refresh, rate limiting, and structured error returns.
// ---------------------------------------------------------------------------

import { logger } from '../logger';

export type ActionResult = {
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
};

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter: max N calls per window per (org, connector)
// ---------------------------------------------------------------------------
const RATE_LIMITS: Record<string, { count: number; resetAt: number }> = {};
const RATE_LIMIT_MAX = 30;        // requests
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(orgId: string, connectorId: string): boolean {
  const key = `${orgId}:${connectorId}`;
  const now = Date.now();
  const bucket = RATE_LIMITS[key];

  if (!bucket || now > bucket.resetAt) {
    RATE_LIMITS[key] = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    return true;
  }

  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export async function executeConnectorAction(
  connectorId: string,
  action: string,
  params: Record<string, any>,
  credentials: Record<string, string>,
  orgId?: string,
): Promise<ActionResult> {
  // Rate limiting (best-effort; in-memory only, resets on restart)
  if (orgId && !checkRateLimit(orgId, connectorId)) {
    return { success: false, error: 'Rate limit exceeded — try again in a minute', statusCode: 429 };
  }

  try {
    switch (connectorId) {
      case 'zendesk': return await zendeskAction(action, params, credentials);
      case 'slack': return await slackAction(action, params, credentials);
      case 'salesforce': return await salesforceAction(action, params, credentials);
      case 'hubspot': return await hubspotAction(action, params, credentials);
      case 'razorpay': return await razorpayAction(action, params, credentials);
      default:
        return { success: false, error: `Connector "${connectorId}" actions are not yet supported`, statusCode: 501 };
    }
  } catch (err: any) {
    logger.error('Connector action failed', { connectorId, action, error: err.message });
    return { success: false, error: err.message || 'Unknown error', statusCode: 500 };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function jsonFetch(url: string, opts: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  const resp = await fetch(url, opts);
  let data: any;
  try { data = await resp.json(); } catch { data = {}; }
  return { ok: resp.ok, status: resp.status, data };
}

function bearerHeaders(token: string, extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra };
}

// ---------------------------------------------------------------------------
// Zendesk
// ---------------------------------------------------------------------------
async function zendeskAction(
  action: string,
  params: Record<string, any>,
  creds: Record<string, string>,
): Promise<ActionResult> {
  const subdomain = creds.subdomain;
  const email = creds.email;
  const apiToken = creds.api_token;

  if (!subdomain || !email || !apiToken) {
    return { success: false, error: 'Zendesk credentials missing: subdomain, email, api_token required' };
  }

  const base = `https://${subdomain}.zendesk.com/api/v2`;
  const basicAuth = Buffer.from(`${email}/token:${apiToken}`).toString('base64');
  const headers = { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/json' };

  switch (action) {
    case 'get_ticket': {
      const r = await jsonFetch(`${base}/tickets/${params.ticket_id}.json`, { headers });
      if (!r.ok) return { success: false, error: r.data?.error || `HTTP ${r.status}`, statusCode: r.status };
      return { success: true, data: r.data.ticket };
    }
    case 'update_ticket': {
      const update: Record<string, any> = {};
      if (params.status) update.status = params.status;
      if (params.priority) update.priority = params.priority;
      if (params.assignee_id) update.assignee_id = params.assignee_id;
      const r = await jsonFetch(`${base}/tickets/${params.ticket_id}.json`, {
        method: 'PUT', headers, body: JSON.stringify({ ticket: update }),
      });
      if (!r.ok) return { success: false, error: r.data?.error || `HTTP ${r.status}`, statusCode: r.status };
      return { success: true, data: r.data.ticket };
    }
    case 'create_ticket': {
      const r = await jsonFetch(`${base}/tickets.json`, {
        method: 'POST', headers,
        body: JSON.stringify({
          ticket: {
            subject: params.subject,
            comment: { body: params.body },
            requester: { email: params.requester_email },
            priority: params.priority || 'normal',
          },
        }),
      });
      if (!r.ok) return { success: false, error: r.data?.error || `HTTP ${r.status}`, statusCode: r.status };
      return { success: true, data: r.data.ticket };
    }
    case 'add_comment': {
      const isPublic = params.public !== 'false';
      const r = await jsonFetch(`${base}/tickets/${params.ticket_id}.json`, {
        method: 'PUT', headers,
        body: JSON.stringify({ ticket: { comment: { body: params.comment, public: isPublic } } }),
      });
      if (!r.ok) return { success: false, error: r.data?.error || `HTTP ${r.status}`, statusCode: r.status };
      return { success: true, data: { ticket_id: params.ticket_id, comment_added: true } };
    }
    case 'search_tickets': {
      const qs = new URLSearchParams({ query: params.query, per_page: String(params.limit || 10) });
      if (params.status) qs.set('query', `${params.query} status:${params.status}`);
      const r = await jsonFetch(`${base}/search.json?${qs}`, { headers });
      if (!r.ok) return { success: false, error: r.data?.error || `HTTP ${r.status}`, statusCode: r.status };
      return { success: true, data: r.data.results };
    }
    default:
      return { success: false, error: `Unknown Zendesk action: ${action}`, statusCode: 400 };
  }
}

// ---------------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------------
async function slackAction(
  action: string,
  params: Record<string, any>,
  creds: Record<string, string>,
): Promise<ActionResult> {
  const token = creds.access_token || creds.bot_token || creds.token;
  if (!token) return { success: false, error: 'Slack credentials missing: access_token required' };

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  switch (action) {
    case 'send_message': {
      const r = await jsonFetch('https://slack.com/api/chat.postMessage', {
        method: 'POST', headers,
        body: JSON.stringify({ channel: params.channel, text: params.text }),
      });
      if (!r.data.ok) return { success: false, error: r.data.error || 'Slack API error' };
      return { success: true, data: { ts: r.data.ts, channel: r.data.channel } };
    }
    case 'get_channel_history': {
      // First resolve channel name to ID if needed
      let channelId = params.channel;
      if (channelId.startsWith('#')) {
        const listR = await jsonFetch(`https://slack.com/api/conversations.list?limit=200`, { headers: { Authorization: `Bearer ${token}` } });
        const found = listR.data?.channels?.find((c: any) => c.name === channelId.slice(1));
        if (!found) return { success: false, error: `Channel ${channelId} not found` };
        channelId = found.id;
      }
      const r = await jsonFetch(`https://slack.com/api/conversations.history?channel=${channelId}&limit=${params.limit || 10}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.data.ok) return { success: false, error: r.data.error || 'Slack API error' };
      return { success: true, data: r.data.messages };
    }
    case 'get_user_info': {
      if (params.email) {
        const r = await jsonFetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(params.email)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.data.ok) return { success: false, error: r.data.error || 'Slack API error' };
        return { success: true, data: r.data.user };
      }
      if (params.user_id) {
        const r = await jsonFetch(`https://slack.com/api/users.info?user=${params.user_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.data.ok) return { success: false, error: r.data.error || 'Slack API error' };
        return { success: true, data: r.data.user };
      }
      return { success: false, error: 'email or user_id required' };
    }
    case 'list_channels': {
      const r = await jsonFetch(`https://slack.com/api/conversations.list?limit=${params.limit || 20}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.data.ok) return { success: false, error: r.data.error || 'Slack API error' };
      return { success: true, data: r.data.channels?.map((c: any) => ({ id: c.id, name: c.name, is_private: c.is_private })) };
    }
    default:
      return { success: false, error: `Unknown Slack action: ${action}`, statusCode: 400 };
  }
}

// ---------------------------------------------------------------------------
// Salesforce
// ---------------------------------------------------------------------------
async function salesforceAction(
  action: string,
  params: Record<string, any>,
  creds: Record<string, string>,
): Promise<ActionResult> {
  const accessToken = creds.access_token;
  const instanceUrl = creds.instance_url;

  if (!accessToken || !instanceUrl) {
    return { success: false, error: 'Salesforce credentials missing: access_token and instance_url required' };
  }

  const base = `${instanceUrl}/services/data/v59.0`;
  const headers = bearerHeaders(accessToken);

  switch (action) {
    case 'get_lead': {
      const r = await jsonFetch(`${base}/sobjects/Lead/${params.lead_id}`, { headers });
      if (!r.ok) return { success: false, error: r.data?.message || `HTTP ${r.status}`, statusCode: r.status };
      return { success: true, data: r.data };
    }
    case 'update_lead': {
      const update: Record<string, any> = {};
      if (params.status) update.Status = params.status;
      if (params.rating) update.Rating = params.rating;
      if (params.description) update.Description = params.description;
      const r = await jsonFetch(`${base}/sobjects/Lead/${params.lead_id}`, {
        method: 'PATCH', headers, body: JSON.stringify(update),
      });
      if (!r.ok) return { success: false, error: r.data?.[0]?.message || `HTTP ${r.status}`, statusCode: r.status };
      return { success: true, data: { lead_id: params.lead_id, updated: true } };
    }
    case 'create_task': {
      const task: Record<string, any> = { Subject: params.subject };
      if (params.who_id) task.WhoId = params.who_id;
      if (params.what_id) task.WhatId = params.what_id;
      if (params.due_date) task.ActivityDate = params.due_date;
      if (params.description) task.Description = params.description;
      const r = await jsonFetch(`${base}/sobjects/Task`, {
        method: 'POST', headers, body: JSON.stringify(task),
      });
      if (!r.ok) return { success: false, error: r.data?.[0]?.message || `HTTP ${r.status}`, statusCode: r.status };
      return { success: true, data: r.data };
    }
    case 'search_records': {
      const objectType = params.object_type || 'Lead';
      const sosl = `FIND {${params.query}} IN ALL FIELDS RETURNING ${objectType}(Id,Name,Email) LIMIT ${params.limit || 10}`;
      const r = await jsonFetch(`${base}/search/?q=${encodeURIComponent(sosl)}`, { headers });
      if (!r.ok) return { success: false, error: r.data?.message || `HTTP ${r.status}`, statusCode: r.status };
      return { success: true, data: r.data.searchRecords };
    }
    default:
      return { success: false, error: `Unknown Salesforce action: ${action}`, statusCode: 400 };
  }
}

// ---------------------------------------------------------------------------
// HubSpot
// ---------------------------------------------------------------------------
async function hubspotAction(
  action: string,
  params: Record<string, any>,
  creds: Record<string, string>,
): Promise<ActionResult> {
  const accessToken = creds.access_token;
  if (!accessToken) return { success: false, error: 'HubSpot credentials missing: access_token required' };

  const base = 'https://api.hubapi.com';
  const headers = bearerHeaders(accessToken);

  switch (action) {
    case 'get_contact': {
      if (params.email) {
        const r = await jsonFetch(`${base}/contacts/v1/contact/email/${encodeURIComponent(params.email)}/profile`, { headers });
        if (!r.ok) return { success: false, error: `HTTP ${r.status}` };
        return { success: true, data: r.data };
      }
      const r = await jsonFetch(`${base}/crm/v3/objects/contacts/${params.contact_id}`, { headers });
      if (!r.ok) return { success: false, error: r.data?.message || `HTTP ${r.status}` };
      return { success: true, data: r.data };
    }
    case 'create_contact': {
      const props: Record<string, string> = { email: params.email };
      if (params.firstname) props.firstname = params.firstname;
      if (params.lastname) props.lastname = params.lastname;
      if (params.company) props.company = params.company;
      if (params.phone) props.phone = params.phone;
      const r = await jsonFetch(`${base}/crm/v3/objects/contacts`, {
        method: 'POST', headers, body: JSON.stringify({ properties: props }),
      });
      if (!r.ok) return { success: false, error: r.data?.message || `HTTP ${r.status}` };
      return { success: true, data: r.data };
    }
    case 'update_deal': {
      const props: Record<string, string> = {};
      if (params.dealstage) props.dealstage = params.dealstage;
      if (params.amount) props.amount = params.amount;
      if (params.closedate) props.closedate = new Date(params.closedate).getTime().toString();
      const r = await jsonFetch(`${base}/crm/v3/objects/deals/${params.deal_id}`, {
        method: 'PATCH', headers, body: JSON.stringify({ properties: props }),
      });
      if (!r.ok) return { success: false, error: r.data?.message || `HTTP ${r.status}` };
      return { success: true, data: r.data };
    }
    case 'search_contacts': {
      const r = await jsonFetch(`${base}/crm/v3/objects/contacts/search`, {
        method: 'POST', headers,
        body: JSON.stringify({
          query: params.query,
          limit: Number(params.limit) || 10,
          properties: ['email', 'firstname', 'lastname', 'company'],
        }),
      });
      if (!r.ok) return { success: false, error: r.data?.message || `HTTP ${r.status}` };
      return { success: true, data: r.data.results };
    }
    default:
      return { success: false, error: `Unknown HubSpot action: ${action}`, statusCode: 400 };
  }
}

// ---------------------------------------------------------------------------
// Razorpay
// ---------------------------------------------------------------------------
async function razorpayAction(
  action: string,
  params: Record<string, any>,
  creds: Record<string, string>,
): Promise<ActionResult> {
  const keyId = creds.key_id;
  const keySecret = creds.key_secret;

  if (!keyId || !keySecret) {
    return { success: false, error: 'Razorpay credentials missing: key_id and key_secret required' };
  }

  const base = 'https://api.razorpay.com/v1';
  const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const headers = { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/json' };

  switch (action) {
    case 'get_order': {
      const r = await jsonFetch(`${base}/orders/${params.order_id}`, { headers });
      if (!r.ok) return { success: false, error: r.data?.error?.description || `HTTP ${r.status}`, statusCode: r.status };
      return { success: true, data: r.data };
    }
    case 'initiate_refund': {
      const body: Record<string, any> = {};
      if (params.amount) body.amount = Number(params.amount);
      if (params.notes) body.notes = { reason: params.notes };
      const r = await jsonFetch(`${base}/payments/${params.payment_id}/refund`, {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      if (!r.ok) return { success: false, error: r.data?.error?.description || `HTTP ${r.status}`, statusCode: r.status };
      return { success: true, data: r.data };
    }
    case 'list_payments': {
      const qs = new URLSearchParams({ count: String(params.count || 10) });
      if (params.from) qs.set('from', params.from);
      const r = await jsonFetch(`${base}/payments?${qs}`, { headers });
      if (!r.ok) return { success: false, error: r.data?.error?.description || `HTTP ${r.status}`, statusCode: r.status };
      return { success: true, data: r.data.items };
    }
    case 'get_settlement': {
      const r = await jsonFetch(`${base}/settlements/${params.settlement_id}`, { headers });
      if (!r.ok) return { success: false, error: r.data?.error?.description || `HTTP ${r.status}`, statusCode: r.status };
      return { success: true, data: r.data };
    }
    default:
      return { success: false, error: `Unknown Razorpay action: ${action}`, statusCode: 400 };
  }
}
