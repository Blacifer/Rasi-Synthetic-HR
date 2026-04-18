import {
  inferWorkflowEntrySource,
  inferWorkflowSourceRef,
  normalizeApprovalStatus,
  mapJobStatusToGovernedStatus,
  extractCostStatus,
  buildApprovalSummaryFromApprovalRequest,
  buildApprovalSummaryFromJobApproval,
  buildGovernedExecutionSummary,
} from '../governed-workflow';

// ---------------------------------------------------------------------------
// inferWorkflowEntrySource
// ---------------------------------------------------------------------------
describe('inferWorkflowEntrySource', () => {
  it('returns "chat" from job input workflow.source', () => {
    const job: any = { input: { workflow: { source: 'chat' } } };
    expect(inferWorkflowEntrySource({ job })).toBe('chat');
  });

  it('returns "template" from job output workflow.source', () => {
    const job: any = { output: { workflow: { source: 'template' } } };
    expect(inferWorkflowEntrySource({ job })).toBe('template');
  });

  it('returns "apps" from approval action_payload workflow.source', () => {
    const approval: any = { action_payload: { workflow: { source: 'apps' } } };
    expect(inferWorkflowEntrySource({ approval })).toBe('apps');
  });

  it('falls back to job type "chat_turn" → "chat"', () => {
    expect(inferWorkflowEntrySource({ job: { type: 'chat_turn' } as any })).toBe('chat');
  });

  it('falls back to job type "workflow_run" → "template"', () => {
    expect(inferWorkflowEntrySource({ job: { type: 'workflow_run' } as any })).toBe('template');
  });

  it('falls back to job type "connector_action" → "apps"', () => {
    expect(inferWorkflowEntrySource({ job: { type: 'connector_action' } as any })).toBe('apps');
  });

  it('uses fallback arg when no hints present', () => {
    expect(inferWorkflowEntrySource({ fallback: 'template' })).toBe('template');
  });

  it('defaults to "apps" when no hints and no fallback', () => {
    expect(inferWorkflowEntrySource({})).toBe('apps');
  });

  it('ignores unrecognised source values', () => {
    const job: any = { input: { workflow: { source: 'unknown' } }, type: 'chat_turn' };
    expect(inferWorkflowEntrySource({ job })).toBe('chat');
  });
});

// ---------------------------------------------------------------------------
// inferWorkflowSourceRef
// ---------------------------------------------------------------------------
describe('inferWorkflowSourceRef', () => {
  it('returns source_ref from job input workflow', () => {
    const job: any = { input: { workflow: { source_ref: 'conv-123' } } };
    expect(inferWorkflowSourceRef({ job })).toBe('conv-123');
  });

  it('returns approval job_id when input source_ref is missing', () => {
    const approval: any = { job_id: 'job-456' };
    expect(inferWorkflowSourceRef({ approval })).toBe('job-456');
  });

  it('falls back to job.id as last resort', () => {
    const job: any = { id: 'job-789' };
    expect(inferWorkflowSourceRef({ job })).toBe('job-789');
  });

  it('returns null when no ref candidates exist', () => {
    expect(inferWorkflowSourceRef({})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeApprovalStatus
// ---------------------------------------------------------------------------
describe('normalizeApprovalStatus', () => {
  it.each([
    ['approved', 'approved'],
    ['rejected', 'denied'],
    ['denied', 'denied'],
    ['expired', 'expired'],
    ['cancelled', 'cancelled'],
    ['canceled', 'cancelled'],
    ['pending', 'pending'],
    ['anything_else', 'pending'],
    [null, 'pending'],
    [undefined, 'pending'],
    ['', 'pending'],
  ] as const)('normalizes %s → %s', (input, expected) => {
    expect(normalizeApprovalStatus(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// mapJobStatusToGovernedStatus
// ---------------------------------------------------------------------------
describe('mapJobStatusToGovernedStatus', () => {
  it('maps "running" → "executing"', () => {
    expect(mapJobStatusToGovernedStatus('running')).toBe('executing');
  });

  it('maps "succeeded" → "completed"', () => {
    expect(mapJobStatusToGovernedStatus('succeeded')).toBe('completed');
  });

  it('maps "failed" → "failed"', () => {
    expect(mapJobStatusToGovernedStatus('failed')).toBe('failed');
  });

  it('maps "canceled" → "cancelled"', () => {
    expect(mapJobStatusToGovernedStatus('canceled')).toBe('cancelled');
  });

  it('maps "cancelled" → "cancelled"', () => {
    expect(mapJobStatusToGovernedStatus('cancelled')).toBe('cancelled');
  });

  it('maps "pending_approval" → "pending_approval"', () => {
    expect(mapJobStatusToGovernedStatus('pending_approval')).toBe('pending_approval');
  });

  it('maps approved approval + queued job → "approved"', () => {
    expect(mapJobStatusToGovernedStatus('queued', 'approved')).toBe('approved');
  });

  it('maps approved approval + non-queued job → "policy_evaluated"', () => {
    expect(mapJobStatusToGovernedStatus('running', 'approved')).toBe('executing');
  });

  it('maps denied approval → "denied"', () => {
    expect(mapJobStatusToGovernedStatus('queued', 'denied')).toBe('denied');
  });

  it('maps "queued" with no approval → "policy_evaluated"', () => {
    expect(mapJobStatusToGovernedStatus('queued')).toBe('policy_evaluated');
  });

  it('maps unknown status → "initiated"', () => {
    expect(mapJobStatusToGovernedStatus('unknown')).toBe('initiated');
  });

  it('maps null → "initiated"', () => {
    expect(mapJobStatusToGovernedStatus(null)).toBe('initiated');
  });
});

// ---------------------------------------------------------------------------
// extractCostStatus
// ---------------------------------------------------------------------------
describe('extractCostStatus', () => {
  it('captures cost from job output cost_status.amount', () => {
    const job: any = { output: { cost_status: { amount: 0.05 } } };
    const result = extractCostStatus({ job });
    expect(result.state).toBe('captured');
    expect(result.amount).toBe(0.05);
    expect(result.currency).toBe('USD');
  });

  it('captures cost from job output usage.cost_usd', () => {
    const job: any = { output: { usage: { cost_usd: 0.02 } } };
    const result = extractCostStatus({ job });
    expect(result.state).toBe('captured');
    expect(result.amount).toBe(0.02);
  });

  it('captures cost from job output cost_usd', () => {
    const job: any = { output: { cost_usd: 0.01 } };
    expect(extractCostStatus({ job }).state).toBe('captured');
  });

  it('captures cost from execution result usage.cost_usd', () => {
    const execution: any = { result: { usage: { cost_usd: 0.03 } } };
    expect(extractCostStatus({ execution }).state).toBe('captured');
  });

  it('returns "outside_scope" for apps source with no cost', () => {
    const job: any = { type: 'connector_action' };
    const result = extractCostStatus({ job, source: 'apps' });
    expect(result.state).toBe('outside_scope');
    expect(result.amount).toBeNull();
  });

  it('returns "unavailable" for chat/template source with no cost', () => {
    const result = extractCostStatus({ source: 'chat' });
    expect(result.state).toBe('unavailable');
    expect(result.reason).toBeTruthy();
  });

  it('rejects negative amounts as invalid', () => {
    const job: any = { output: { cost_usd: -1 } };
    const result = extractCostStatus({ job, source: 'chat' });
    expect(result.state).toBe('unavailable');
  });

  it('accepts zero as a valid captured amount', () => {
    const job: any = { output: { cost_usd: 0 } };
    expect(extractCostStatus({ job }).state).toBe('captured');
    expect(extractCostStatus({ job }).amount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildApprovalSummaryFromApprovalRequest
// ---------------------------------------------------------------------------
describe('buildApprovalSummaryFromApprovalRequest', () => {
  it('builds summary from approval_request row', () => {
    const row: any = {
      id: 'ar-1',
      status: 'approved',
      required_role: 'manager',
      reviewed_at: '2024-01-01T12:00:00Z',
      reviewer_id: 'user-99',
      job_id: 'job-10',
      action_payload: { workflow: { source: 'chat', source_ref: 'conv-5' } },
    };
    const summary = buildApprovalSummaryFromApprovalRequest(row);
    expect(summary.approval_source).toBe('approval_request');
    expect(summary.approval_id).toBe('ar-1');
    expect(summary.status).toBe('approved');
    expect(summary.required_role).toBe('manager');
    expect(summary.decision_at).toBe('2024-01-01T12:00:00Z');
    expect(summary.approver).toBe('user-99');
    expect(summary.job_id).toBe('job-10');
    expect(summary.source).toBe('chat');
    expect(summary.source_ref).toBe('conv-5');
  });

  it('normalizes "rejected" status → "denied"', () => {
    const row: any = { id: 'ar-2', status: 'rejected' };
    expect(buildApprovalSummaryFromApprovalRequest(row).status).toBe('denied');
  });
});

// ---------------------------------------------------------------------------
// buildApprovalSummaryFromJobApproval
// ---------------------------------------------------------------------------
describe('buildApprovalSummaryFromJobApproval', () => {
  it('builds summary from job_approval row', () => {
    const row: any = {
      id: 'ja-1',
      status: 'approved',
      decided_at: '2024-02-01T10:00:00Z',
      approved_by: 'admin-1',
      job_id: 'job-20',
      policy_snapshot: { required_role: 'admin' },
    };
    const job: any = { id: 'job-20', type: 'connector_action' };
    const summary = buildApprovalSummaryFromJobApproval(row, job);
    expect(summary.approval_source).toBe('job_approval');
    expect(summary.approval_id).toBe('ja-1');
    expect(summary.status).toBe('approved');
    expect(summary.required_role).toBe('admin');
    expect(summary.decision_at).toBe('2024-02-01T10:00:00Z');
    expect(summary.approver).toBe('admin-1');
    expect(summary.job_id).toBe('job-20');
    expect(summary.source).toBe('apps');
  });
});

// ---------------------------------------------------------------------------
// buildGovernedExecutionSummary
// ---------------------------------------------------------------------------
describe('buildGovernedExecutionSummary', () => {
  it('builds a complete summary for a running job', () => {
    const job: any = { id: 'job-30', status: 'running', type: 'chat_turn', output: { cost_usd: 0.04 } };
    const result = buildGovernedExecutionSummary({ job });
    expect(result.job_id).toBe('job-30');
    expect(result.status).toBe('executing');
    expect(result.source).toBe('chat');
    expect(result.cost_status.state).toBe('captured');
    expect(result.cost_status.amount).toBe(0.04);
    expect(result.approval).toBeNull();
    expect(result.incident_ref).toBeNull();
  });

  it('includes audit_ref from execution policy_snapshot', () => {
    const execution: any = {
      policy_snapshot: { governed_action: { audit_ref: 'aud-xyz' } },
    };
    const result = buildGovernedExecutionSummary({ execution });
    expect(result.audit_ref).toBe('aud-xyz');
  });

  it('includes incident_ref from job output', () => {
    const job: any = { output: { incident_ref: 'inc-001' } };
    const result = buildGovernedExecutionSummary({ job });
    expect(result.incident_ref).toBe('inc-001');
  });

  it('surfaces approvalSummary passed in directly', () => {
    const approvalSummary: any = {
      approval_source: 'approval_request',
      approval_id: 'ar-99',
      status: 'pending',
      required_role: null,
      decision_at: null,
      approver: null,
      job_id: null,
      source: 'chat',
      source_ref: null,
    };
    const result = buildGovernedExecutionSummary({ approvalSummary });
    expect(result.approval).toBe(approvalSummary);
  });

  it('handles all-null args gracefully', () => {
    const result = buildGovernedExecutionSummary({});
    expect(result.status).toBe('initiated');
    expect(result.job_id).toBeNull();
    expect(result.source_ref).toBeNull();
    expect(result.audit_ref).toBeNull();
    expect(result.incident_ref).toBeNull();
    expect(result.approval).toBeNull();
  });
});
