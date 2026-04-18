import { supabaseRestAsUser } from '../../lib/supabase-rest';

jest.mock('../../lib/supabase-rest', () => ({
  supabaseRestAsUser: jest.fn(),
  eq: (v: string | number) => `eq.${encodeURIComponent(String(v))}`,
  SupabaseRestError: class SupabaseRestError extends Error {
    status: number;
    responseBody: string;
    constructor(status: number, responseBody: string) {
      super(`Supabase REST error: ${status}`);
      this.status = status;
      this.responseBody = responseBody;
    }
  },
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {},
  supabaseAdmin: {},
  DEMO_ORG_ID: '00000000-0000-0000-0000-000000000000',
  __esModule: true,
  default: {},
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = req.user || {
      id: 'user-111',
      email: 'admin@example.com',
      organization_id: 'org-222',
      role: 'admin',
    };
    req.userJwt = req.userJwt || 'mock-jwt';
    next();
  },
}));

jest.mock('../../middleware/rbac', () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  hasPermission: () => true,
}));

jest.mock('../../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../lib/audit-logger', () => ({
  auditLog: { log: jest.fn() },
}));

jest.mock('../../lib/notification-service', () => ({
  notifyApprovalAssignedAsync: jest.fn(),
}));

jest.mock('../../lib/slack-approvals', () => ({
  notifySlackApprovalRequestAsync: jest.fn(),
}));

import jobsRouterImport from '../jobs';
const jobsRouter: any = jobsRouterImport;

const ORG_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const AGENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function invokeRouter(method: string, url: string, body: Record<string, any> = {}, roleOverride = 'admin') {
  const req: any = {
    method,
    url,
    originalUrl: url,
    params: {},
    headers: {},
    query: {},
    body,
    user: { id: USER_ID, email: 'admin@example.com', organization_id: ORG_ID, role: roleOverride },
    userJwt: 'mock-jwt',
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    get(_n: string) { return undefined; },
  };

  // Parse URL params from path like /:id
  const parts = url.split('/').filter(Boolean);
  if (parts.length >= 1 && parts[0] !== 'bulk') req.params.id = parts[0];

  let statusCode = 200;
  let responseBody: any = null;

  const res: any = {
    statusCode: 200,
    status(code: number) { this.statusCode = code; statusCode = code; return this; },
    json(b: any) { responseBody = b; return this; },
    setHeader() { return this; },
    end() {},
  };

  await new Promise<void>((resolve, reject) => {
    let resolved = false;
    const done = () => { if (!resolved) { resolved = true; resolve(); } };
    jobsRouter.handle(req, res, (err: any) => err ? reject(err) : done());
    // Poll until response written
    const check = setInterval(() => { if (responseBody !== null) { clearInterval(check); done(); } }, 5);
    setTimeout(() => { clearInterval(check); done(); }, 3000);
  });

  return { statusCode, body: responseBody };
}

const DEPLOYMENT = { id: 'dep-1', runtime_instance_id: 'rt-1', status: 'active', execution_policy: {} };

describe('POST /jobs — create job', () => {
  let mockRest: jest.MockedFunction<typeof supabaseRestAsUser>;

  beforeEach(() => {
    mockRest = supabaseRestAsUser as jest.MockedFunction<typeof supabaseRestAsUser>;
    mockRest.mockReset();
  });

  it('creates a chat_turn job with status queued', async () => {
    // 1) deployments query
    mockRest.mockResolvedValueOnce([DEPLOYMENT]);
    // 2) create job
    const job = { id: 'job-1', type: 'chat_turn', status: 'queued', input: {}, output: {} };
    mockRest.mockResolvedValueOnce([job]);
    // 3) create approval
    mockRest.mockResolvedValueOnce([{ id: 'apr-1', status: 'approved' }]);

    const { statusCode, body } = await invokeRouter('POST', '/', {
      agent_id: AGENT_ID,
      type: 'chat_turn',
      input: { messages: [] },
    });

    expect(statusCode).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.job.status).toBe('queued');
  });

  it('creates a connector_action job with pending_approval status when policy requires it', async () => {
    // 1) deployments
    mockRest.mockResolvedValueOnce([DEPLOYMENT]);
    // 2) action_policies — policy requires approval
    mockRest.mockResolvedValueOnce([{
      id: 'pol-1',
      enabled: true,
      require_approval: true,
      required_role: 'admin',
      routing_rules: [],
      policy_constraints: {},
    }]);
    // 3) create job
    const job = { id: 'job-2', type: 'connector_action', status: 'pending_approval', input: {}, output: {} };
    mockRest.mockResolvedValueOnce([job]);
    // 4) create approval
    mockRest.mockResolvedValueOnce([{ id: 'apr-2', status: 'pending' }]);

    const { statusCode, body } = await invokeRouter('POST', '/', {
      agent_id: AGENT_ID,
      type: 'connector_action',
      input: { connector: { service: 'stripe', action: 'refund', params: { amount: 100 } } },
    });

    expect(statusCode).toBe(201);
    expect(body.data.job.status).toBe('pending_approval');
  });

  it('rejects when agent has no deployment', async () => {
    mockRest.mockResolvedValueOnce([]); // no deployment

    const { statusCode, body } = await invokeRouter('POST', '/', {
      agent_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      type: 'chat_turn',
      input: {},
    });

    expect(statusCode).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error).toContain('not deployed');
  });

  it('rejects when deployment is not active', async () => {
    mockRest.mockResolvedValueOnce([{ ...DEPLOYMENT, status: 'stopped' }]);

    const { statusCode, body } = await invokeRouter('POST', '/', {
      agent_id: AGENT_ID,
      type: 'chat_turn',
      input: {},
    });

    expect(statusCode).toBe(409);
    expect(body.error).toContain('not active');
  });

  it('blocks connector_action when policy is disabled', async () => {
    mockRest.mockResolvedValueOnce([DEPLOYMENT]);
    // policy disabled
    mockRest.mockResolvedValueOnce([{
      id: 'pol-disabled',
      enabled: false,
      require_approval: false,
      required_role: 'admin',
      routing_rules: [],
      policy_constraints: {},
    }]);

    const { statusCode, body } = await invokeRouter('POST', '/', {
      agent_id: AGENT_ID,
      type: 'connector_action',
      input: { connector: { service: 'slack', action: 'send_message', params: {} } },
    });

    expect(statusCode).toBe(403);
    expect(body.error).toContain('disabled by policy');
  });

  it('blocks connector_action when constraint evaluation blocks (emergency_disabled)', async () => {
    mockRest.mockResolvedValueOnce([DEPLOYMENT]);
    // policy with emergency_disabled constraint
    mockRest.mockResolvedValueOnce([{
      id: 'pol-2',
      enabled: true,
      require_approval: false,
      required_role: 'admin',
      routing_rules: [],
      policy_constraints: { emergency_disabled: true },
    }]);

    const { statusCode, body } = await invokeRouter('POST', '/', {
      agent_id: AGENT_ID,
      type: 'connector_action',
      input: { connector: { service: 'quickbooks', action: 'create_invoice', params: {} } },
    });

    expect(statusCode).toBe(403);
    expect(body.policy_reasons).toContain('Connector action temporarily disabled by emergency policy');
  });

  it('returns 400 for invalid request body', async () => {
    const { statusCode, body } = await invokeRouter('POST', '/', { type: 'chat_turn' /* missing agent_id */ });
    expect(statusCode).toBe(400);
    expect(body.success).toBe(false);
  });
});

describe('GET /jobs — list jobs', () => {
  let mockRest: jest.MockedFunction<typeof supabaseRestAsUser>;

  beforeEach(() => {
    mockRest = supabaseRestAsUser as jest.MockedFunction<typeof supabaseRestAsUser>;
    mockRest.mockReset();
  });

  it('returns list of jobs', async () => {
    const jobs = [
      { id: 'job-a', type: 'chat_turn', status: 'completed', input: {}, output: {} },
      { id: 'job-b', type: 'connector_action', status: 'queued', input: {}, output: {} },
    ];
    mockRest.mockResolvedValueOnce(jobs);

    const { statusCode, body } = await invokeRouter('GET', '/');
    expect(statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.count).toBe(2);
  });

  it('returns empty array when no jobs', async () => {
    mockRest.mockResolvedValueOnce([]);

    const { body } = await invokeRouter('GET', '/');
    expect(body.data).toHaveLength(0);
    expect(body.count).toBe(0);
  });

  it('augments pending_approval connector jobs with approval data', async () => {
    const job = { id: 'job-c', type: 'connector_action', status: 'pending_approval', input: {}, output: {} };
    mockRest.mockResolvedValueOnce([job]);
    // loadJobApproval returns an approval
    mockRest.mockResolvedValueOnce([{
      id: 'apr-3',
      status: 'pending',
      required_approvals: 2,
      approval_history: [{ decision: 'approved', reviewer_id: 'u1', decided_at: '' }],
      policy_snapshot: { required_role: 'manager', workflow: { source: 'apps', source_ref: 'ref-1' } },
    }]);

    const { body } = await invokeRouter('GET', '/');
    expect(body.data[0].required_approvals).toBe(2);
    expect(body.data[0].approvals_recorded).toBe(1);
    expect(body.data[0].approvals_remaining).toBe(1);
  });
});

describe('GET /jobs/:id — get job by ID', () => {
  let mockRest: jest.MockedFunction<typeof supabaseRestAsUser>;

  beforeEach(() => {
    mockRest = supabaseRestAsUser as jest.MockedFunction<typeof supabaseRestAsUser>;
    mockRest.mockReset();
  });

  it('returns a job by ID', async () => {
    const job = { id: 'job-x', type: 'chat_turn', status: 'completed', input: {}, output: { cost_usd: 0.05 } };
    mockRest.mockResolvedValueOnce([job]);

    const { statusCode, body } = await invokeRouter('GET', '/job-x');
    expect(statusCode).toBe(200);
    expect(body.data.job.id).toBe('job-x');
    expect(body.data.job.cost_status.state).toBe('captured');
    expect(body.data.job.cost_status.amount).toBe(0.05);
  });

  it('returns 404 when job not found', async () => {
    mockRest.mockResolvedValueOnce([]);

    const { statusCode, body } = await invokeRouter('GET', '/job-missing');
    expect(statusCode).toBe(404);
    expect(body.error).toBe('Job not found');
  });

  it('augments connector_action job with approval metadata', async () => {
    const job = { id: 'job-y', type: 'connector_action', status: 'pending_approval', input: {}, output: {} };
    mockRest.mockResolvedValueOnce([job]);
    // loadJobApproval
    mockRest.mockResolvedValueOnce([{
      id: 'apr-y',
      status: 'pending',
      required_approvals: 1,
      approval_history: [],
      policy_snapshot: { required_role: 'admin', assigned_to: 'user-approver' },
    }]);

    const { body } = await invokeRouter('GET', '/job-y');
    expect(body.data.job.required_approvals).toBe(1);
    expect(body.data.job.required_role).toBe('admin');
    expect(body.data.job.assigned_to).toBe('user-approver');
  });
});

describe('POST /jobs/bulk — bulk create', () => {
  let mockRest: jest.MockedFunction<typeof supabaseRestAsUser>;

  beforeEach(() => {
    mockRest = supabaseRestAsUser as jest.MockedFunction<typeof supabaseRestAsUser>;
    mockRest.mockReset();
  });

  it('creates multiple jobs from rows array', async () => {
    // deployment query
    mockRest.mockResolvedValueOnce([DEPLOYMENT]);
    // job creation for row 1
    mockRest.mockResolvedValueOnce([{ id: 'job-b1', type: 'workflow_run', status: 'queued' }]);
    // approval for job 1
    mockRest.mockResolvedValueOnce([{ id: 'apr-b1' }]);
    // job creation for row 2
    mockRest.mockResolvedValueOnce([{ id: 'job-b2', type: 'workflow_run', status: 'queued' }]);
    // approval for job 2
    mockRest.mockResolvedValueOnce([{ id: 'apr-b2' }]);

    const req: any = {
      method: 'POST',
      url: '/bulk',
      originalUrl: '/bulk',
      params: {},
      headers: {},
      query: {},
      body: {
        agent_id: AGENT_ID,
        type: 'workflow_run',
        rows: [{ prompt: 'Run A' }, { prompt: 'Run B' }],
      },
      user: { id: USER_ID, email: 'admin@example.com', organization_id: ORG_ID, role: 'admin' },
      userJwt: 'mock-jwt',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      get() { return undefined; },
    };

    let statusCode = 200;
    let responseBody: any = null;
    const res: any = {
      status(c: number) { statusCode = c; return this; },
      json(b: any) { responseBody = b; return this; },
    };

    await new Promise<void>((resolve) => {
      jobsRouter.handle(req, res, () => resolve());
      const check = setInterval(() => { if (responseBody) { clearInterval(check); resolve(); } }, 5);
      setTimeout(() => { clearInterval(check); resolve(); }, 3000);
    });

    expect(statusCode).toBe(201);
    expect(responseBody.data.count).toBe(2);
    expect(responseBody.data.batch_id).toBeTruthy();
    expect(responseBody.data.jobs).toHaveLength(2);
  });

  it('rejects bulk create with more than 100 rows', async () => {
    const rows = Array.from({ length: 101 }, (_, i) => ({ prompt: `Row ${i}` }));

    const req: any = {
      method: 'POST',
      url: '/bulk',
      originalUrl: '/bulk',
      params: {},
      headers: {},
      query: {},
      body: { agent_id: AGENT_ID, type: 'workflow_run', rows },
      user: { id: USER_ID, email: 'admin@example.com', organization_id: ORG_ID, role: 'admin' },
      userJwt: 'mock-jwt',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      get() { return undefined; },
    };

    let statusCode = 200;
    let responseBody: any = null;
    const res: any = {
      status(c: number) { statusCode = c; return this; },
      json(b: any) { responseBody = b; return this; },
    };

    await new Promise<void>((resolve) => {
      jobsRouter.handle(req, res, () => resolve());
      const check = setInterval(() => { if (responseBody) { clearInterval(check); resolve(); } }, 5);
      setTimeout(() => { clearInterval(check); resolve(); }, 3000);
    });

    expect(statusCode).toBe(400);
    expect(responseBody.error).toContain('Maximum 100 rows');
  });

  it('rejects bulk create with missing required fields', async () => {
    const req: any = {
      method: 'POST',
      url: '/bulk',
      originalUrl: '/bulk',
      params: {},
      headers: {},
      query: {},
      body: { type: 'workflow_run', rows: [{}] }, // missing agent_id
      user: { id: USER_ID, email: 'admin@example.com', organization_id: ORG_ID, role: 'admin' },
      userJwt: 'mock-jwt',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      get() { return undefined; },
    };

    let statusCode = 200;
    let responseBody: any = null;
    const res: any = {
      status(c: number) { statusCode = c; return this; },
      json(b: any) { responseBody = b; return this; },
    };

    await new Promise<void>((resolve) => {
      jobsRouter.handle(req, res, () => resolve());
      const check = setInterval(() => { if (responseBody) { clearInterval(check); resolve(); } }, 5);
      setTimeout(() => { clearInterval(check); resolve(); }, 3000);
    });

    expect(statusCode).toBe(400);
  });
});
