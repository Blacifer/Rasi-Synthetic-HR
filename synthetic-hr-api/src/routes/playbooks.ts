import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requirePermission } from '../middleware/rbac';
import { SupabaseRestError, eq, supabaseRestAsUser } from '../lib/supabase-rest';
import { logger } from '../lib/logger';
import { auditLog } from '../lib/audit-logger';

const router = Router();

const getOrgId = (req: any): string | null => req.user?.organization_id || null;
const getUserId = (req: any): string | null => req.user?.id || null;
const getUserJwt = (req: any): string => {
  const jwt = req.userJwt as string | undefined;
  if (!jwt) throw new Error('Missing user JWT on request');
  return jwt;
};

function nowIso() {
  return new Date().toISOString();
}

function safeError(res: Response, err: any, statusCode = 500) {
  const resolved = err instanceof SupabaseRestError ? err.status : statusCode;
  const message = err instanceof SupabaseRestError ? err.responseBody : (err?.message || 'Internal error');
  logger.error('Playbooks route error', { status: resolved, message });
  return res.status(resolved).json({ success: false, error: message });
}

const upsertSchema = z.object({
  enabled: z.boolean().optional(),
  overrides: z.record(z.any()).optional(),
});

router.get('/settings', requirePermission('agents.read'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'Organization not found' });

    const query = new URLSearchParams();
    query.set('organization_id', eq(orgId));
    query.set('order', 'updated_at.desc');

    const rows = (await supabaseRestAsUser(getUserJwt(req), 'playbook_settings', query)) as any[];
    return res.json({ success: true, data: rows || [], count: rows?.length || 0 });
  } catch (err: any) {
    return safeError(res, err);
  }
});

router.patch('/settings/:playbookId', requirePermission('settings.update'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'Organization not found' });
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

    const playbookId = String(req.params.playbookId || '').trim();
    if (!playbookId) return res.status(400).json({ success: false, error: 'playbookId is required' });

    const parsed = upsertSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ success: false, errors: parsed.error.errors.map((e) => e.message) });

    // Try fetch existing
    const existingQ = new URLSearchParams();
    existingQ.set('organization_id', eq(orgId));
    existingQ.set('playbook_id', eq(playbookId));
    existingQ.set('select', '*');
    const existing = (await supabaseRestAsUser(getUserJwt(req), 'playbook_settings', existingQ)) as any[];
    const row = existing?.[0] || null;

    const now = nowIso();
    if (row?.id) {
      const patchQ = new URLSearchParams();
      patchQ.set('id', eq(row.id));
      patchQ.set('organization_id', eq(orgId));

      const patched = (await supabaseRestAsUser(getUserJwt(req), 'playbook_settings', patchQ, {
        method: 'PATCH',
        body: {
          ...(typeof parsed.data.enabled === 'boolean' ? { enabled: parsed.data.enabled } : {}),
          ...(parsed.data.overrides ? { overrides: parsed.data.overrides } : {}),
          updated_by: userId,
          updated_at: now,
        },
      })) as any[];

      const updated = patched?.[0] || null;
      if (!updated) return res.status(500).json({ success: false, error: 'Failed to update playbook setting' });

      await auditLog.log({
        user_id: userId,
        action: 'playbook.setting.updated',
        resource_type: 'playbook_setting',
        resource_id: updated.id,
        organization_id: orgId,
        ip_address: req.ip || (req.socket as any)?.remoteAddress,
        user_agent: req.get('user-agent') || undefined,
        metadata: { playbook_id: playbookId, enabled: updated.enabled },
      });

      return res.json({ success: true, data: updated });
    }

    const created = (await supabaseRestAsUser(getUserJwt(req), 'playbook_settings', '', {
      method: 'POST',
      body: {
        organization_id: orgId,
        playbook_id: playbookId,
        enabled: typeof parsed.data.enabled === 'boolean' ? parsed.data.enabled : true,
        overrides: parsed.data.overrides || {},
        updated_by: userId,
        updated_at: now,
      },
    })) as any[];

    const createdRow = created?.[0] || null;
    if (!createdRow) return res.status(500).json({ success: false, error: 'Failed to create playbook setting' });

    await auditLog.log({
      user_id: userId,
      action: 'playbook.setting.created',
      resource_type: 'playbook_setting',
      resource_id: createdRow.id,
      organization_id: orgId,
      ip_address: req.ip || (req.socket as any)?.remoteAddress,
      user_agent: req.get('user-agent') || undefined,
      metadata: { playbook_id: playbookId, enabled: createdRow.enabled },
    });

    return res.status(201).json({ success: true, data: createdRow });
  } catch (err: any) {
    return safeError(res, err);
  }
});

export default router;

