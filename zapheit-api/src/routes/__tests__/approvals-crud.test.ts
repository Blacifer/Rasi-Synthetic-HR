import { supabaseRestAsUser, supabaseRestAsService } from '../../lib/supabase-rest';

jest.mock('../../lib/supabase-rest', () => ({
  supabaseRestAsUser: jest.fn(),
  supabaseRestAsService: jest.fn(),
  eq: (v: string | number) => `eq.${encodeURIComponent(String(v))}`,
  in_: (values: Array<string | number>) => `in.(${values.map(v => encodeURIComponent(String(v))).join(',')})`,
  SupabaseRestError: class SupabaseRestError extends Error {
    status: number; responseBody: string;
    constructor(s: number, b: string) { super(`REST ${s}`); this.status = s; this.responseBody = b; }
  },
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {}, supabaseAdmin: {}, DEMO_ORG_ID: '00000000-0000-0000-0000-000000000000',
  __esModule: true, default: {},
}));

jest.mock('../../middleware/rbac', () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = req.user || { id: USER_ID, email: 'admin@test.com', organization_id: ORG_ID, role: 'admin' };
    req.userJwt = 'mock-jwt';
    next();
  },
}));

jest.mock('../../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../lib/audit-logger', () => ({
  auditLog: { log: jest.fn() },
}));

jest.mock('../../lib/webhook-relay', () => ({
  fireAndForgetWebhookEvent: jest.fn(),
}));

jest.mock('../../lib/slack-notify', () => ({
  notifySlackApproval: jest.fn(),
}));

jest.mock('../../lib/notification-service', () => ({
  notifyApprovalAssignedAsync: jest.fn(),
}));

jest.mock('../../lib/correction-memory', () => ({
  storeCorrection: jest.fn(),
}));

jest.mock('../../lib/agentic-tool-execution', () => ({
  resumeApprovedToolCall: jest.fn().mockResolvedValue({ connectorId: 'stripe', action: 'refund', result: { success: true }, auditRef: 'aud-1' }),
  markApprovalDeniedExecution: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/email', () => ({
  sendTransactionalEmail: jest.fn().mockResolvedValue(undefined),
}));

// Forward-declare constants so middleware mock can reference them
const USER_ID = '11111111-1111-4111-8111-111111111111';
const ORG_ID = '22222222-2222-4222-8222-222222222222';

import approvalsRouterImport from '../approvals';
const approvalsRouter: any = approvalsRouterImport;

async function invokeApprovals(method: string, url: string, body: Record<string, any> = {}, role = 'admin') {
  const req: any = {
    method,
    url,
    originalUrl: url,
    params: {},
    headers: {},
    query: {},
    body,
    user: { id: USER_ID, email: 'admin@test.com', organization_id: ORG_ID, role },
    userJwt: 'mock-jwt',
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    get(_n: string) { return undefined; },
  };

  // Parse /:id from URL
  const segments = url.split('/').filter(Boolean);
  if (segments.length >= 1 && !['approve', 'deny', 'cancel', 'escalate'].includes(segments[0])) {
    req.params.id = segments[0];
  }
  if (segments.length >= 2) {
    req.params.id = segments[0];
  }

  let statusCode = 200;
  let responseBody: any = null;

  const res: any = {
    statusCode: 200,
    status(c: number) { this.statusCode = c; statusCode = c; return this; },
    json(b: any) { responseBody = b; return this; },
    setHeader() { return this; },
  };

  await new Promise<void>((resolve) => {
    approvalsRouter.handle(req, res, () => resolve());
    const check = setInterval(() => { if (responseBody !== null) { clearInterval(check); resolve(); } }, 5);
    setTimeout(() => { clearInterval(check); resolve(); }, 3000);
  });

  return { statusCode, body: responseBody };
}

const NOW = new Date(Date.now() + 86400000).toISOString(); // 24h in future

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------
describe('GET /approvals', () => {
  let mockUserRest: jest.MockedFunction<typeof supabaseRestAsUser>;
  let mockServiceRest: jest.MockedFunction<typeof supabaseRestAsService>;

  beforeEach(() => {
    mockUserRest = supabaseRestAsUser as jest.MockedFunction<typeof supabaseRestAsUser>;
    mockServiceRest = supabaseRestAsService as jest.MockedFunction<typeof supabaseRestAsService>;
    mockUserRest.mockReset();
    mockServiceRest.mockReset();
    mockServiceRest.mockResolvedValue([]);
  });

  it('returns merged list of approval_requests and job approvals', async () => {
    const approvalRow = {
      id: 'ar-1',
      organization_id: ORG_ID,
      status: 'pending',
      service: 'stripe',
      action: 'refund',
      action_payload: {},
      required_role: 'admin',
      expires_at: NOW,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
    // GET / → approval_requests query
    mockUserRest.mockResolvedValueOnce([approvalRow]);
    // loadApprovalExecutions → connector_action_executions (via serviceRest, already mocked to [])
    // loadJobApprovalsForOrg → agent_jobs query
    mockUserRest.mockResolvedValueOnce([]);

    const { statusCode, body } = await invokeApprovals('GET', '/');
    expect(statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].id).toBe('ar-1');
  });

  it('returns empty list when no approvals exist', async () => {
    mockUserRest.mockResolvedValueOnce([]); // approval_requests
    mockUserRest.mockResolvedValueOnce([]); // agent_jobs for job approvals

    const { body } = await invokeApprovals('GET', '/');
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(0);
    expect(body.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /:id
// ---------------------------------------------------------------------------
describe('GET /approvals/:id', () => {
  let mockUserRest: jest.MockedFunction<typeof supabaseRestAsUser>;
  let mockServiceRest: jest.MockedFunction<typeof supabaseRestAsService>;

  beforeEach(() => {
    mockUserRest = supabaseRestAsUser as jest.MockedFunction<typeof supabaseRestAsUser>;
    mockServiceRest = supabaseRestAsService as jest.MockedFunction<typeof supabaseRestAsService>;
    mockUserRest.mockReset();
    mockServiceRest.mockReset();
    mockServiceRest.mockResolvedValue([]);
  });

  it('returns an approval_request by ID', async () => {
    const row = {
      id: 'ar-10',
      organization_id: ORG_ID,
      status: 'pending',
      service: 'zendesk',
      action: 'close_ticket',
      action_payload: {},
      required_role: 'manager',
      expires_at: NOW,
      created_at: '2024-01-01T00:00:00Z',
    };
    mockUserRest.mockResolvedValueOnce([row]); // approval_requests query
    // loadApprovalExecutions

    const { statusCode, body } = await invokeApprovals('GET', '/ar-10');
    expect(statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('ar-10');
    expect(body.data.governance_status).toBeTruthy();
  });

  it('falls back to job_approval lookup when approval_request not found', async () => {
    mockUserRest.mockResolvedValueOnce([]); // approval_requests → not found
    // agent_job_approvals lookup
    mockUserRest.mockResolvedValueOnce([{
      id: 'ja-10',
      job_id: 'job-10',
      status: 'pending',
      required_approvals: 1,
      approval_history: [],
      policy_snapshot: { required_role: 'admin' },
      created_at: '2024-01-01T00:00:00Z',
    }]);
    // agent_jobs lookup
    mockUserRest.mockResolvedValueOnce([{
      id: 'job-10',
      organization_id: ORG_ID,
      type: 'connector_action',
      status: 'pending_approval',
      input: { connector: { service: 'stripe', action: 'refund', params: { amount: 500 } } },
      created_at: '2024-01-01T00:00:00Z',
    }]);

    const { statusCode, body } = await invokeApprovals('GET', '/ja-10');
    expect(statusCode).toBe(200);
    expect(body.data.id).toBe('ja-10');
    expect(body.data.service).toBe('stripe');
  });

  it('returns 404 when neither approval_request nor job_approval found', async () => {
    mockUserRest.mockResolvedValueOnce([]); // approval_requests
    mockUserRest.mockResolvedValueOnce([]); // agent_job_approvals

    const { statusCode, body } = await invokeApprovals('GET', '/nonexistent-id');
    expect(statusCode).toBe(404);
    expect(body.error).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// POST / — create approval request
// ---------------------------------------------------------------------------
describe('POST /approvals', () => {
  let mockUserRest: jest.MockedFunction<typeof supabaseRestAsUser>;
  let mockServiceRest: jest.MockedFunction<typeof supabaseRestAsService>;

  beforeEach(() => {
    mockUserRest = supabaseRestAsUser as jest.MockedFunction<typeof supabaseRestAsUser>;
    mockServiceRest = supabaseRestAsService as jest.MockedFunction<typeof supabaseRestAsService>;
    mockUserRest.mockReset();
    mockServiceRest.mockReset();
    mockServiceRest.mockResolvedValue([]);
  });

  it('creates an approval request successfully', async () => {
    // no action_policy_id → no policy lookup
    const newRow = {
      id: 'ar-new',
      organization_id: ORG_ID,
      status: 'pending',
      service: 'github',
      action: 'merge_pr',
      action_payload: { pr: 42 },
      required_role: 'manager',
      expires_at: NOW,
      created_at: new Date().toISOString(),
    };
    mockUserRest.mockResolvedValueOnce([newRow]); // INSERT approval_requests

    const { statusCode, body } = await invokeApprovals('POST', '/', {
      service: 'github',
      action: 'merge_pr',
      action_payload: { pr: 42 },
      required_role: 'manager',
    });

    expect(statusCode).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('ar-new');
  });

  it('returns 400 for invalid body (missing required service field)', async () => {
    const { statusCode, body } = await invokeApprovals('POST', '/', {
      action: 'merge_pr',
      // missing service
    });

    expect(statusCode).toBe(400);
    expect(body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /:id/approve — approval_requests path
// ---------------------------------------------------------------------------
describe('POST /approvals/:id/approve (approval_request path)', () => {
  let mockUserRest: jest.MockedFunction<typeof supabaseRestAsUser>;
  let mockServiceRest: jest.MockedFunction<typeof supabaseRestAsService>;

  beforeEach(() => {
    mockUserRest = supabaseRestAsUser as jest.MockedFunction<typeof supabaseRestAsUser>;
    mockServiceRest = supabaseRestAsService as jest.MockedFunction<typeof supabaseRestAsService>;
    mockUserRest.mockReset();
    mockServiceRest.mockReset();
    mockServiceRest.mockResolvedValue([]);
    const { resumeApprovedToolCall } = require('../../lib/agentic-tool-execution');
    resumeApprovedToolCall.mockResolvedValue({ connectorId: 'stripe', action: 'refund', result: { success: true }, auditRef: 'aud-1' });
  });

  it('approves an approval_request and resumes connector execution', async () => {
    const pendingRow = {
      id: 'ar-approve-1',
      organization_id: ORG_ID,
      status: 'pending',
      service: 'stripe',
      action: 'refund',
      action_payload: { amount: 100 },
      required_role: 'admin',
      assigned_to: null,
      expires_at: NOW,
      created_at: '2024-01-01T00:00:00Z',
    };
    // fetch approval_requests
    mockUserRest.mockResolvedValueOnce([pendingRow]);
    // PATCH to approved
    const updatedRow = { ...pendingRow, status: 'approved', reviewer_id: USER_ID, reviewed_at: new Date().toISOString() };
    mockUserRest.mockResolvedValueOnce([updatedRow]);

    const { statusCode, body } = await invokeApprovals('POST', '/ar-approve-1/approve', { note: 'LGTM' });
    expect(statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.execution.resumed).toBe(true);
  });

  it('returns 409 when trying to approve an already-approved request', async () => {
    const approvedRow = {
      id: 'ar-already',
      organization_id: ORG_ID,
      status: 'approved',
      service: 'stripe',
      action: 'refund',
      action_payload: {},
      required_role: 'admin',
      expires_at: NOW,
      created_at: '2024-01-01T00:00:00Z',
    };
    mockUserRest.mockResolvedValueOnce([approvedRow]);

    const { statusCode } = await invokeApprovals('POST', '/ar-already/approve');
    expect(statusCode).toBe(409);
  });

  it('returns 404 when approval not found', async () => {
    mockUserRest.mockResolvedValueOnce([]); // approval_requests not found
    mockUserRest.mockResolvedValueOnce([]); // agent_job_approvals not found

    const { statusCode } = await invokeApprovals('POST', '/nonexistent/approve');
    expect(statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /:id/approve — job_approval path
// ---------------------------------------------------------------------------
describe('POST /approvals/:id/approve (job_approval path)', () => {
  let mockUserRest: jest.MockedFunction<typeof supabaseRestAsUser>;
  let mockServiceRest: jest.MockedFunction<typeof supabaseRestAsService>;

  beforeEach(() => {
    mockUserRest = supabaseRestAsUser as jest.MockedFunction<typeof supabaseRestAsUser>;
    mockServiceRest = supabaseRestAsService as jest.MockedFunction<typeof supabaseRestAsService>;
    mockUserRest.mockReset();
    mockServiceRest.mockReset();
    mockServiceRest.mockResolvedValue([]);
  });

  it('approves a job_approval and transitions job to queued', async () => {
    // approval_requests → not found → falls to job_approval path
    mockUserRest.mockResolvedValueOnce([]);
    // agent_job_approvals
    mockUserRest.mockResolvedValueOnce([{
      id: 'ja-20',
      job_id: 'job-20',
      status: 'pending',
      required_approvals: 1,
      approval_history: [],
      policy_snapshot: { required_role: 'admin' },
      created_at: '2024-01-01T00:00:00Z',
    }]);
    // agent_jobs
    mockUserRest.mockResolvedValueOnce([{
      id: 'job-20',
      organization_id: ORG_ID,
      type: 'connector_action',
      status: 'pending_approval',
      input: { connector: { service: 'stripe', action: 'refund', params: { amount: 200 } } },
      created_at: '2024-01-01T00:00:00Z',
    }]);
    // PATCH agent_job_approvals → approved
    mockUserRest.mockResolvedValueOnce([{
      id: 'ja-20',
      status: 'approved',
      approval_history: [{ reviewer_id: USER_ID, decision: 'approved', decided_at: new Date().toISOString() }],
      decided_at: new Date().toISOString(),
    }]);
    // PATCH agent_jobs → queued
    mockUserRest.mockResolvedValueOnce([{ id: 'job-20', status: 'queued' }]);

    const { statusCode, body } = await invokeApprovals('POST', '/ja-20/approve');
    expect(statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.execution.resumed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /:id/deny — denial flow
// ---------------------------------------------------------------------------
describe('POST /approvals/:id/deny', () => {
  let mockUserRest: jest.MockedFunction<typeof supabaseRestAsUser>;
  let mockServiceRest: jest.MockedFunction<typeof supabaseRestAsService>;

  beforeEach(() => {
    mockUserRest = supabaseRestAsUser as jest.MockedFunction<typeof supabaseRestAsUser>;
    mockServiceRest = supabaseRestAsService as jest.MockedFunction<typeof supabaseRestAsService>;
    mockUserRest.mockReset();
    mockServiceRest.mockReset();
    mockServiceRest.mockResolvedValue([]);
  });

  it('denies an approval_request', async () => {
    const pendingRow = {
      id: 'ar-deny-1',
      organization_id: ORG_ID,
      status: 'pending',
      service: 'stripe',
      action: 'refund',
      action_payload: {},
      required_role: 'admin',
      assigned_to: null,
      expires_at: NOW,
      created_at: '2024-01-01T00:00:00Z',
    };
    mockUserRest.mockResolvedValueOnce([pendingRow]);
    // PATCH to denied
    mockUserRest.mockResolvedValueOnce([{ ...pendingRow, status: 'denied' }]);

    const { statusCode, body } = await invokeApprovals('POST', '/ar-deny-1/deny', { note: 'Policy violation' });
    expect(statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('denied');
  });

  it('returns 409 when trying to deny an already-denied request', async () => {
    mockUserRest.mockResolvedValueOnce([{
      id: 'ar-denied-already',
      organization_id: ORG_ID,
      status: 'denied',
      service: 'stripe',
      action: 'refund',
      required_role: 'admin',
      expires_at: NOW,
      created_at: '2024-01-01T00:00:00Z',
    }]);

    const { statusCode } = await invokeApprovals('POST', '/ar-denied-already/deny');
    expect(statusCode).toBe(409);
  });

  it('returns 404 when neither approval_request nor job_approval found on deny', async () => {
    mockUserRest.mockResolvedValueOnce([]); // approval_requests
    mockUserRest.mockResolvedValueOnce([]); // job_approvals

    const { statusCode } = await invokeApprovals('POST', '/nonexistent/deny');
    expect(statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /:id/deny — job_approval path
// ---------------------------------------------------------------------------
describe('POST /approvals/:id/deny (job_approval path)', () => {
  let mockUserRest: jest.MockedFunction<typeof supabaseRestAsUser>;
  let mockServiceRest: jest.MockedFunction<typeof supabaseRestAsService>;

  beforeEach(() => {
    mockUserRest = supabaseRestAsUser as jest.MockedFunction<typeof supabaseRestAsUser>;
    mockServiceRest = supabaseRestAsService as jest.MockedFunction<typeof supabaseRestAsService>;
    mockUserRest.mockReset();
    mockServiceRest.mockReset();
    mockServiceRest.mockResolvedValue([]);
  });

  it('denies a job_approval and cancels the job', async () => {
    // approval_requests → not found
    mockUserRest.mockResolvedValueOnce([]);
    // agent_job_approvals
    mockUserRest.mockResolvedValueOnce([{
      id: 'ja-deny',
      job_id: 'job-deny',
      status: 'pending',
      required_approvals: 1,
      approval_history: [],
      policy_snapshot: { required_role: 'admin', assigned_to: null },
      created_at: '2024-01-01T00:00:00Z',
    }]);
    // agent_jobs
    mockUserRest.mockResolvedValueOnce([{
      id: 'job-deny',
      organization_id: ORG_ID,
      type: 'connector_action',
      status: 'pending_approval',
      input: { connector: { service: 'stripe', action: 'charge', params: { amount: 300 } } },
      created_at: '2024-01-01T00:00:00Z',
    }]);
    // PATCH agent_job_approvals → rejected
    mockUserRest.mockResolvedValueOnce([{ id: 'ja-deny', status: 'rejected' }]);
    // PATCH agent_jobs → canceled
    mockUserRest.mockResolvedValueOnce([{ id: 'job-deny', status: 'canceled' }]);

    const { statusCode, body } = await invokeApprovals('POST', '/ja-deny/deny', { note: 'Rejected by policy' });
    expect(statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.execution.state).toBe('denied');
    expect(body.execution.resumed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /:id/cancel
// ---------------------------------------------------------------------------
describe('POST /approvals/:id/cancel', () => {
  let mockUserRest: jest.MockedFunction<typeof supabaseRestAsUser>;
  let mockServiceRest: jest.MockedFunction<typeof supabaseRestAsService>;

  beforeEach(() => {
    mockUserRest = supabaseRestAsUser as jest.MockedFunction<typeof supabaseRestAsUser>;
    mockServiceRest = supabaseRestAsService as jest.MockedFunction<typeof supabaseRestAsService>;
    mockUserRest.mockReset();
    mockServiceRest.mockReset();
    mockServiceRest.mockResolvedValue([]);
  });

  it('cancels a pending approval request', async () => {
    const pendingRow = {
      id: 'ar-cancel-1',
      organization_id: ORG_ID,
      status: 'pending',
      service: 'jira',
      action: 'close_issue',
      action_payload: {},
      required_role: 'manager',
      expires_at: NOW,
      created_at: '2024-01-01T00:00:00Z',
    };
    mockUserRest.mockResolvedValueOnce([pendingRow]);
    // PATCH to cancelled
    mockUserRest.mockResolvedValueOnce([{ ...pendingRow, status: 'cancelled' }]);

    const { statusCode, body } = await invokeApprovals('POST', '/ar-cancel-1/cancel');
    expect(statusCode).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 409 when trying to cancel a non-pending request', async () => {
    mockUserRest.mockResolvedValueOnce([{
      id: 'ar-approved',
      organization_id: ORG_ID,
      status: 'approved',
      service: 'stripe',
      action: 'refund',
      expires_at: NOW,
      created_at: '2024-01-01T00:00:00Z',
    }]);

    const { statusCode } = await invokeApprovals('POST', '/ar-approved/cancel');
    expect(statusCode).toBe(409);
  });

  it('returns 404 when approval request not found for cancel', async () => {
    mockUserRest.mockResolvedValueOnce([]); // not found

    const { statusCode } = await invokeApprovals('POST', '/nonexistent/cancel');
    expect(statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /:id/snooze
// ---------------------------------------------------------------------------
describe('POST /approvals/:id/snooze', () => {
  let mockUserRest: jest.MockedFunction<typeof supabaseRestAsUser>;

  beforeEach(() => {
    mockUserRest = supabaseRestAsUser as jest.MockedFunction<typeof supabaseRestAsUser>;
    const mockServiceRest = supabaseRestAsService as jest.MockedFunction<typeof supabaseRestAsService>;
    mockUserRest.mockReset();
    mockServiceRest.mockReset();
    mockServiceRest.mockResolvedValue([]);
  });

  it('snoozes a pending approval for 4 hours', async () => {
    const pendingRow = {
      id: 'ar-snooze',
      organization_id: ORG_ID,
      status: 'pending',
      expires_at: NOW,
      created_at: '2024-01-01T00:00:00Z',
    };
    mockUserRest.mockResolvedValueOnce([pendingRow]); // approval_requests query
    mockUserRest.mockResolvedValueOnce([{ ...pendingRow, expires_at: new Date(Date.now() + 4 * 3600000).toISOString() }]); // PATCH

    const { statusCode, body } = await invokeApprovals('POST', '/ar-snooze/snooze', { hours: 4 });
    expect(statusCode).toBe(200);
    expect(body.success).toBe(true);
  });

  it('rejects snooze with invalid hours value', async () => {
    const { statusCode, body } = await invokeApprovals('POST', '/ar-snooze/snooze', { hours: 8 });
    expect(statusCode).toBe(400);
    expect(body.error).toContain('hours must be 1, 4, or 24');
  });

  it('returns 404 when pending approval not found for snooze', async () => {
    mockUserRest.mockResolvedValueOnce([]); // not found
    const { statusCode } = await invokeApprovals('POST', '/nonexistent/snooze', { hours: 1 });
    expect(statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /:id/escalate
// ---------------------------------------------------------------------------
describe('POST /approvals/:id/escalate', () => {
  let mockUserRest: jest.MockedFunction<typeof supabaseRestAsUser>;

  beforeEach(() => {
    mockUserRest = supabaseRestAsUser as jest.MockedFunction<typeof supabaseRestAsUser>;
    const mockServiceRest = supabaseRestAsService as jest.MockedFunction<typeof supabaseRestAsService>;
    mockUserRest.mockReset();
    mockServiceRest.mockReset();
    mockServiceRest.mockResolvedValue([]);
  });

  it('escalates approval from manager to admin', async () => {
    const row = {
      id: 'ar-esc',
      organization_id: ORG_ID,
      required_role: 'manager',
      status: 'pending',
      created_at: '2024-01-01T00:00:00Z',
    };
    mockUserRest.mockResolvedValueOnce([row]); // lookup
    mockUserRest.mockResolvedValueOnce([{ ...row, required_role: 'admin' }]); // PATCH

    const { statusCode, body } = await invokeApprovals('POST', '/ar-esc/escalate');
    expect(statusCode).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 404 when approval not found for escalation', async () => {
    mockUserRest.mockResolvedValueOnce([]);
    const { statusCode } = await invokeApprovals('POST', '/nonexistent/escalate');
    expect(statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /:id/comments
// ---------------------------------------------------------------------------
describe('GET /approvals/:id/comments', () => {
  let mockUserRest: jest.MockedFunction<typeof supabaseRestAsUser>;

  beforeEach(() => {
    mockUserRest = supabaseRestAsUser as jest.MockedFunction<typeof supabaseRestAsUser>;
    const mockServiceRest = supabaseRestAsService as jest.MockedFunction<typeof supabaseRestAsService>;
    mockUserRest.mockReset();
    mockServiceRest.mockReset();
    mockServiceRest.mockResolvedValue([]);
  });

  it('returns comments for an approval', async () => {
    const comments = [
      { id: 'c-1', content: 'LGTM', author_id: USER_ID, created_at: '2024-01-01T00:00:00Z' },
    ];
    mockUserRest.mockResolvedValueOnce(comments);

    const { statusCode, body } = await invokeApprovals('GET', '/ar-10/comments');
    expect(statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].content).toBe('LGTM');
  });

  it('returns empty array when no comments', async () => {
    mockUserRest.mockResolvedValueOnce([]);
    const { body } = await invokeApprovals('GET', '/ar-10/comments');
    expect(body.data).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// POST /:id/comments
// ---------------------------------------------------------------------------
describe('POST /approvals/:id/comments', () => {
  let mockUserRest: jest.MockedFunction<typeof supabaseRestAsUser>;

  beforeEach(() => {
    mockUserRest = supabaseRestAsUser as jest.MockedFunction<typeof supabaseRestAsUser>;
    const mockServiceRest = supabaseRestAsService as jest.MockedFunction<typeof supabaseRestAsService>;
    mockUserRest.mockReset();
    mockServiceRest.mockReset();
    mockServiceRest.mockResolvedValue([]);
  });

  it('adds a comment to an approval', async () => {
    // approval_requests ownership check
    mockUserRest.mockResolvedValueOnce([{ id: 'ar-10' }]);
    // INSERT comment
    const created = { id: 'c-new', content: 'Approved after review', author_id: USER_ID };
    mockUserRest.mockResolvedValueOnce([created]);

    const { statusCode, body } = await invokeApprovals('POST', '/ar-10/comments', {
      content: 'Approved after review',
    });
    expect(statusCode).toBe(201);
    expect(body.data.content).toBe('Approved after review');
  });

  it('returns 404 when approval not found for comment', async () => {
    mockUserRest.mockResolvedValueOnce([]); // approval not found
    const { statusCode } = await invokeApprovals('POST', '/nonexistent/comments', { content: 'Hello' });
    expect(statusCode).toBe(404);
  });
});
