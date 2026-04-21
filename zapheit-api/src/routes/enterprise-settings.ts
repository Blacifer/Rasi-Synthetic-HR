import { Router } from 'express';
import { z } from 'zod';
import { supabaseRestAsService } from '../lib/supabase-rest';
import { logger } from '../lib/logger';
import { requireRole } from '../middleware/rbac';
import { clearIpAllowlistCache } from '../middleware/ipAllowlist';
import { auditLog } from '../lib/audit-logger';
import { getShadowAiSummary } from '../services/shadow-ai';

const router = Router();

const DATA_REGIONS = ['in-south1', 'us-central1', 'eu-west1'] as const;

const UpdateEnterpriseSettingsSchema = z.object({
  data_region: z.enum(DATA_REGIONS).optional(),
  ip_allowlist: z
    .array(z.string().regex(/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/, 'Must be a valid IPv4 CIDR'))
    .max(100)
    .optional(),
});

/**
 * GET /api/enterprise/settings
 * Returns data_region and ip_allowlist for the authenticated org.
 */
router.get('/enterprise/settings', async (req, res) => {
  const orgId = req.user?.organization_id;
  if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const rows = await supabaseRestAsService('organizations', new URLSearchParams({
      select: 'data_region,ip_allowlist',
      id: `eq.${orgId}`,
      limit: '1',
    }));
    const row = Array.isArray(rows) ? rows[0] : null;
    return res.json({
      success: true,
      data_region: row?.data_region ?? 'in-south1',
      ip_allowlist: row?.ip_allowlist ?? [],
    });
  } catch (err: any) {
    logger.error('enterprise-settings GET error', { err: err?.message });
    return res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

/**
 * PATCH /api/enterprise/settings
 * Update data_region and/or ip_allowlist. Admin-only.
 */
router.patch('/enterprise/settings', requireRole('admin'), async (req, res) => {
  const orgId = req.user?.organization_id;
  const userId = req.user?.id;
  if (!orgId || !userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const parsed = UpdateEnterpriseSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
  }

  const patch: Record<string, any> = {};
  if (parsed.data.data_region !== undefined) patch.data_region = parsed.data.data_region;
  if (parsed.data.ip_allowlist !== undefined) patch.ip_allowlist = parsed.data.ip_allowlist;

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ success: false, error: 'No fields to update' });
  }

  try {
    await supabaseRestAsService('organizations', new URLSearchParams({ id: `eq.${orgId}` }), {
      method: 'PATCH',
      body: patch,
    });

    if (parsed.data.ip_allowlist !== undefined) {
      clearIpAllowlistCache(orgId);
    }

    await auditLog.log({
      user_id: userId,
      action: 'enterprise_settings.updated',
      resource_type: 'organization',
      resource_id: orgId,
      organization_id: orgId,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      metadata: { changed: Object.keys(patch) },
    });

    return res.json({ success: true, updated: Object.keys(patch) });
  } catch (err: any) {
    logger.error('enterprise-settings PATCH error', { err: err?.message });
    return res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

/**
 * GET /api/enterprise/shadow-ai
 * Returns 30-day shadow AI detection summary for the org.
 */
router.get('/enterprise/shadow-ai', async (req, res) => {
  const orgId = req.user?.organization_id;
  if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const summary = await getShadowAiSummary(orgId, 30);
  return res.json(summary);
});

export default router;
