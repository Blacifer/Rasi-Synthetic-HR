import { evaluatePolicyConstraints, type PolicyConstraints } from '../action-policy-constraints';

describe('evaluatePolicyConstraints', () => {
  const basePayload: Record<string, any> = {};
  const noConstraints: PolicyConstraints = {};

  // -------------------------------------------------------------------------
  // No constraints → clean pass
  // -------------------------------------------------------------------------
  it('returns no block/approval for empty constraints', () => {
    const result = evaluatePolicyConstraints(basePayload, null);
    expect(result.blocked).toBe(false);
    expect(result.approvalRequired).toBe(false);
    expect(result.blockReasons).toHaveLength(0);
    expect(result.approvalReasons).toHaveLength(0);
    expect(result.requiredRole).toBeNull();
    expect(result.dualApproval).toBe(false);
  });

  // -------------------------------------------------------------------------
  // emergency_disabled
  // -------------------------------------------------------------------------
  describe('emergency_disabled', () => {
    it('blocks when emergency_disabled is true', () => {
      const result = evaluatePolicyConstraints({}, { emergency_disabled: true });
      expect(result.blocked).toBe(true);
      expect(result.blockReasons).toContain('Connector action temporarily disabled by emergency policy');
    });

    it('does not block when emergency_disabled is false', () => {
      const result = evaluatePolicyConstraints({}, { emergency_disabled: false });
      expect(result.blocked).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // entity_field / allowed_entities
  // -------------------------------------------------------------------------
  describe('entity allowlist', () => {
    const constraints: PolicyConstraints = {
      entity_field: 'department',
      allowed_entities: ['Engineering', 'Finance'],
    };

    it('does not block when entity is in allowlist', () => {
      const result = evaluatePolicyConstraints({ department: 'Engineering' }, constraints);
      expect(result.blocked).toBe(false);
    });

    it('blocks when entity is not in allowlist', () => {
      const result = evaluatePolicyConstraints({ department: 'Sales' }, constraints);
      expect(result.blocked).toBe(true);
      expect(result.blockReasons[0]).toContain('"Sales"');
      expect(result.blockReasons[0]).toContain('outside the allowed policy scope');
    });

    it('skips check when entity_field is missing', () => {
      const result = evaluatePolicyConstraints({ department: 'Sales' }, { allowed_entities: ['Engineering'] });
      expect(result.blocked).toBe(false);
    });

    it('skips check when allowed_entities is empty', () => {
      const result = evaluatePolicyConstraints({ department: 'Sales' }, { entity_field: 'department', allowed_entities: [] });
      expect(result.blocked).toBe(false);
    });

    it('skips check when entity_field value is null in payload', () => {
      const result = evaluatePolicyConstraints({ department: null }, constraints);
      expect(result.blocked).toBe(false);
    });

    it('resolves nested field paths with dot notation', () => {
      const c: PolicyConstraints = { entity_field: 'user.role', allowed_entities: ['admin'] };
      expect(evaluatePolicyConstraints({ user: { role: 'admin' } }, c).blocked).toBe(false);
      expect(evaluatePolicyConstraints({ user: { role: 'viewer' } }, c).blocked).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // amount_field / amount_threshold
  // -------------------------------------------------------------------------
  describe('amount threshold', () => {
    const constraints: PolicyConstraints = {
      amount_field: 'amount',
      amount_threshold: 1000,
      threshold_required_role: 'admin',
    };

    it('does not require approval when amount is below threshold', () => {
      const result = evaluatePolicyConstraints({ amount: 500 }, constraints);
      expect(result.approvalRequired).toBe(false);
    });

    it('does not require approval when amount equals threshold', () => {
      const result = evaluatePolicyConstraints({ amount: 1000 }, constraints);
      expect(result.approvalRequired).toBe(false);
    });

    it('requires approval when amount exceeds threshold', () => {
      const result = evaluatePolicyConstraints({ amount: 1500 }, constraints);
      expect(result.approvalRequired).toBe(true);
      expect(result.requiredRole).toBe('admin');
      expect(result.approvalReasons[0]).toContain('1500');
      expect(result.approvalReasons[0]).toContain('1000');
    });

    it('defaults required role to admin when threshold_required_role is missing', () => {
      const c: PolicyConstraints = { amount_field: 'amount', amount_threshold: 100 };
      const result = evaluatePolicyConstraints({ amount: 200 }, c);
      expect(result.requiredRole).toBe('admin');
    });

    it('skips check when amount_field is missing', () => {
      const result = evaluatePolicyConstraints({ amount: 9999 }, { amount_threshold: 100 });
      expect(result.approvalRequired).toBe(false);
    });

    it('skips check when amount is not a number', () => {
      const result = evaluatePolicyConstraints({ amount: 'not-a-number' }, constraints);
      expect(result.approvalRequired).toBe(false);
    });

    it('resolves nested amount paths', () => {
      const c: PolicyConstraints = { amount_field: 'order.total', amount_threshold: 500 };
      const result = evaluatePolicyConstraints({ order: { total: 600 } }, c);
      expect(result.approvalRequired).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // business_hours
  // -------------------------------------------------------------------------
  describe('business_hours', () => {
    it('does not require approval when within business hours', () => {
      // 09:00 UTC
      const now = new Date('2024-01-15T09:00:00Z');
      const c: PolicyConstraints = { business_hours: { start: '08:00', end: '18:00' } };
      const result = evaluatePolicyConstraints({}, c, now);
      expect(result.approvalRequired).toBe(false);
    });

    it('requires approval when outside business hours', () => {
      // 20:00 UTC — after 18:00 end
      const now = new Date('2024-01-15T20:00:00Z');
      const c: PolicyConstraints = { business_hours: { start: '08:00', end: '18:00' } };
      const result = evaluatePolicyConstraints({}, c, now);
      expect(result.approvalRequired).toBe(true);
      expect(result.approvalReasons[0]).toContain('outside allowed business hours');
    });

    it('applies UTC offset correctly', () => {
      // 07:00 UTC = 12:00 IST (+05:30), which is within 09:00–18:00 IST
      const now = new Date('2024-01-15T07:00:00Z');
      const c: PolicyConstraints = {
        business_hours: { start: '09:00', end: '18:00', utc_offset: '+05:30' },
      };
      const result = evaluatePolicyConstraints({}, c, now);
      expect(result.approvalRequired).toBe(false);
    });

    it('handles overnight windows (start > end)', () => {
      // 23:00 UTC — within 22:00–06:00 overnight window
      const now = new Date('2024-01-15T23:00:00Z');
      const c: PolicyConstraints = { business_hours: { start: '22:00', end: '06:00' } };
      const result = evaluatePolicyConstraints({}, c, now);
      expect(result.approvalRequired).toBe(false);
    });

    it('skips business_hours check when start or end is missing', () => {
      const now = new Date('2024-01-15T20:00:00Z');
      const result = evaluatePolicyConstraints({}, { business_hours: { start: '09:00', end: '' } }, now);
      expect(result.approvalRequired).toBe(false);
    });

    it('skips when clock format is invalid', () => {
      const now = new Date('2024-01-15T20:00:00Z');
      const c: PolicyConstraints = { business_hours: { start: 'bad', end: '18:00' } };
      const result = evaluatePolicyConstraints({}, c, now);
      expect(result.approvalRequired).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // dual_approval
  // -------------------------------------------------------------------------
  describe('dual_approval', () => {
    it('requires approval when dual_approval is true', () => {
      const result = evaluatePolicyConstraints({}, { dual_approval: true });
      expect(result.approvalRequired).toBe(true);
      expect(result.dualApproval).toBe(true);
      expect(result.approvalReasons).toContain('Dual approval required by policy');
    });

    it('does not require approval when dual_approval is false', () => {
      const result = evaluatePolicyConstraints({}, { dual_approval: false });
      expect(result.approvalRequired).toBe(false);
      expect(result.dualApproval).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Combined constraints — multiple conditions
  // -------------------------------------------------------------------------
  describe('combined constraints', () => {
    it('can be both blocked and requiring approval', () => {
      const c: PolicyConstraints = {
        emergency_disabled: true,
        dual_approval: true,
      };
      const result = evaluatePolicyConstraints({}, c);
      expect(result.blocked).toBe(true);
      expect(result.approvalRequired).toBe(true);
    });

    it('accumulates multiple block reasons', () => {
      const c: PolicyConstraints = {
        emergency_disabled: true,
        entity_field: 'dept',
        allowed_entities: ['Engineering'],
      };
      const result = evaluatePolicyConstraints({ dept: 'Sales' }, c);
      expect(result.blocked).toBe(true);
      expect(result.blockReasons).toHaveLength(2);
    });
  });
});
