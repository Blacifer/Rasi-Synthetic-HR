// ---------------------------------------------------------------------------
// GitLab Connector Adapter
//
// Reads:  list_projects, list_mrs, list_issues, get_mr, get_issue
// Writes: create_issue, create_comment, merge_mr, close_issue
// ---------------------------------------------------------------------------

import type { ActionResult } from '../action-executor';
import {
  ConnectorAdapter,
  HealthResult,
  jsonFetch,
  registerAdapter,
} from '../adapter';

const BASE = 'https://gitlab.com/api/v4';

function resolveAuth(creds: Record<string, string>) {
  const token = creds.access_token || creds.token || creds.pat;
  return { token };
}

function gitlabHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const gitlabAdapter: ConnectorAdapter = {
  connectorId: 'gitlab',
  displayName: 'GitLab',
  requiredCredentials: ['access_token'],

  validateCredentials(creds) {
    const { token } = resolveAuth(creds);
    return { valid: Boolean(token), missing: token ? [] : ['access_token'] };
  },

  async testConnection(creds): Promise<HealthResult> {
    const { token } = resolveAuth(creds);
    if (!token) return { healthy: false, error: 'Missing credential: access_token' };
    const start = Date.now();
    try {
      const r = await jsonFetch(`${BASE}/user`, { headers: gitlabHeaders(token) });
      const latencyMs = Date.now() - start;
      if (!r.ok) return { healthy: false, latencyMs, error: r.data?.message || `HTTP ${r.status}` };
      return {
        healthy: true,
        latencyMs,
        accountLabel: `${r.data.name} (@${r.data.username})`,
        details: { id: r.data.id, username: r.data.username },
      };
    } catch (err: any) {
      return { healthy: false, latencyMs: Date.now() - start, error: err.message };
    }
  },

  async executeRead(action, params, creds): Promise<ActionResult> {
    const { token } = resolveAuth(creds);
    if (!token) return { success: false, error: 'GitLab credentials missing: access_token required' };
    const h = gitlabHeaders(token);

    switch (action) {
      case 'list_projects': {
        const limit = params.limit || 30;
        const r = await jsonFetch(
          `${BASE}/projects?membership=true&order_by=last_activity_at&sort=desc&per_page=${limit}`,
          { headers: h },
        );
        if (!r.ok) return { success: false, error: r.data?.message || `HTTP ${r.status}`, statusCode: r.status };
        return {
          success: true,
          data: (r.data as any[]).map((p: any) => ({
            id: p.id,
            name: p.name,
            name_with_namespace: p.name_with_namespace,
            path_with_namespace: p.path_with_namespace,
            description: p.description,
            visibility: p.visibility,
            language: null,
            star_count: p.star_count,
            open_issues_count: p.open_issues_count,
            last_activity_at: p.last_activity_at,
            web_url: p.web_url,
            default_branch: p.default_branch,
          })),
        };
      }

      case 'list_mrs': {
        if (!params.project_id) return { success: false, error: 'list_mrs requires: project_id' };
        const state = params.state || 'opened';
        const r = await jsonFetch(
          `${BASE}/projects/${encodeURIComponent(params.project_id)}/merge_requests?state=${state}&per_page=${params.limit || 30}&order_by=updated_at`,
          { headers: h },
        );
        if (!r.ok) return { success: false, error: r.data?.message || `HTTP ${r.status}`, statusCode: r.status };
        return {
          success: true,
          data: (r.data as any[]).map((mr: any) => ({
            iid: mr.iid,
            title: mr.title,
            state: mr.state,
            author: mr.author?.username,
            created_at: mr.created_at,
            updated_at: mr.updated_at,
            draft: mr.draft,
            source_branch: mr.source_branch,
            target_branch: mr.target_branch,
            web_url: mr.web_url,
            labels: mr.labels || [],
            reviewers: (mr.reviewers || []).map((r: any) => r.username),
          })),
        };
      }

      case 'list_issues': {
        if (!params.project_id) return { success: false, error: 'list_issues requires: project_id' };
        const state = params.state || 'opened';
        const r = await jsonFetch(
          `${BASE}/projects/${encodeURIComponent(params.project_id)}/issues?state=${state}&per_page=${params.limit || 30}&order_by=updated_at`,
          { headers: h },
        );
        if (!r.ok) return { success: false, error: r.data?.message || `HTTP ${r.status}`, statusCode: r.status };
        return {
          success: true,
          data: (r.data as any[]).map((i: any) => ({
            iid: i.iid,
            title: i.title,
            state: i.state,
            author: i.author?.username,
            assignee: i.assignees?.[0]?.username,
            labels: i.labels || [],
            created_at: i.created_at,
            updated_at: i.updated_at,
            user_notes_count: i.user_notes_count,
            web_url: i.web_url,
          })),
        };
      }

      case 'get_mr': {
        if (!params.project_id || !params.mr_iid) return { success: false, error: 'get_mr requires: project_id, mr_iid' };
        const r = await jsonFetch(
          `${BASE}/projects/${encodeURIComponent(params.project_id)}/merge_requests/${params.mr_iid}`,
          { headers: h },
        );
        if (!r.ok) return { success: false, error: r.data?.message || `HTTP ${r.status}`, statusCode: r.status };
        return { success: true, data: r.data };
      }

      case 'get_issue': {
        if (!params.project_id || !params.issue_iid) return { success: false, error: 'get_issue requires: project_id, issue_iid' };
        const r = await jsonFetch(
          `${BASE}/projects/${encodeURIComponent(params.project_id)}/issues/${params.issue_iid}`,
          { headers: h },
        );
        if (!r.ok) return { success: false, error: r.data?.message || `HTTP ${r.status}`, statusCode: r.status };
        return { success: true, data: r.data };
      }

      default:
        return { success: false, error: `Unknown GitLab read action: ${action}`, statusCode: 400 };
    }
  },

  async executeWrite(action, params, creds): Promise<ActionResult> {
    const { token } = resolveAuth(creds);
    if (!token) return { success: false, error: 'GitLab credentials missing: access_token required' };
    const h = gitlabHeaders(token);

    switch (action) {
      case 'create_issue': {
        if (!params.project_id || !params.title) return { success: false, error: 'create_issue requires: project_id, title' };
        const body: Record<string, any> = { title: params.title };
        if (params.description) body.description = params.description;
        if (params.labels) body.labels = Array.isArray(params.labels) ? params.labels.join(',') : params.labels;
        if (params.assignee_ids) body.assignee_ids = params.assignee_ids;

        const r = await jsonFetch(
          `${BASE}/projects/${encodeURIComponent(params.project_id)}/issues`,
          { method: 'POST', headers: h, body: JSON.stringify(body) },
        );
        if (!r.ok) return { success: false, error: r.data?.message || `HTTP ${r.status}`, statusCode: r.status };
        return { success: true, data: { iid: r.data.iid, web_url: r.data.web_url } };
      }

      case 'create_comment': {
        if (!params.project_id || !params.issue_iid || !params.body) {
          return { success: false, error: 'create_comment requires: project_id, issue_iid, body' };
        }
        const r = await jsonFetch(
          `${BASE}/projects/${encodeURIComponent(params.project_id)}/issues/${params.issue_iid}/notes`,
          { method: 'POST', headers: h, body: JSON.stringify({ body: params.body }) },
        );
        if (!r.ok) return { success: false, error: r.data?.message || `HTTP ${r.status}`, statusCode: r.status };
        return { success: true, data: { id: r.data.id } };
      }

      case 'merge_mr': {
        if (!params.project_id || !params.mr_iid) return { success: false, error: 'merge_mr requires: project_id, mr_iid' };
        const body: Record<string, any> = {};
        if (params.commit_message) body.merge_commit_message = params.commit_message;
        if (params.squash != null) body.squash = params.squash;

        const r = await jsonFetch(
          `${BASE}/projects/${encodeURIComponent(params.project_id)}/merge_requests/${params.mr_iid}/merge`,
          { method: 'PUT', headers: h, body: JSON.stringify(body) },
        );
        if (!r.ok) return { success: false, error: r.data?.message || `HTTP ${r.status}`, statusCode: r.status };
        return { success: true, data: { state: r.data.state, sha: r.data.merge_commit_sha } };
      }

      case 'close_issue': {
        if (!params.project_id || !params.issue_iid) return { success: false, error: 'close_issue requires: project_id, issue_iid' };
        const r = await jsonFetch(
          `${BASE}/projects/${encodeURIComponent(params.project_id)}/issues/${params.issue_iid}`,
          { method: 'PUT', headers: h, body: JSON.stringify({ state_event: 'close' }) },
        );
        if (!r.ok) return { success: false, error: r.data?.message || `HTTP ${r.status}`, statusCode: r.status };
        return { success: true, data: { iid: r.data.iid, state: r.data.state } };
      }

      default:
        return { success: false, error: `Unknown GitLab write action: ${action}`, statusCode: 400 };
    }
  },
};

registerAdapter(gitlabAdapter);
