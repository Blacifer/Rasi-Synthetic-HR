/**
 * planGate — enforces per-plan limits at the API layer.
 *
 * Plans: free | pro | business | enterprise
 *
 * Free plan hard limits:
 *   - 1 active agent
 *   - 1,000 gateway requests / month (enforced by enforceOrgMonthlyQuota in gateway.ts)
 *   - 1 team member
 *   - 7-day audit log retention
 *
 * Higher plans: see PLAN_LIMITS below.
 *
 * Usage:
 *   import { planGate } from '../middleware/planGate';
 *   router.post('/agents', requireAuth, planGate('agents.create'), async (req, res) => { ... });
 */

import type { Request, Response, NextFunction } from 'express';
import { supabaseRest, eq } from '../lib/supabase-rest';
import { logger } from '../lib/logger';

export type PlanFeature =
  | 'agents.create'
  | 'members.invite'
  | 'audit.read_old'   // access to logs older than 7 days
  | 'compliance.export'
  | 'sso';

type PlanLimits = {
  maxAgents: number;          // -1 = unlimited
  maxMembers: number;         // -1 = unlimited
  auditRetentionDays: number; // -1 = unlimited
  features: Set<PlanFeature>;
};

const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    maxAgents: 1,
    maxMembers: 1,
    auditRetentionDays: 7,
    features: new Set(),
  },
  pro: {
    maxAgents: 10,
    maxMembers: 10,
    auditRetentionDays: 90,
    features: new Set(['audit.read_old']),
  },
  business: {
    maxAgents: 50,
    maxMembers: -1,
    auditRetentionDays: -1,
    features: new Set(['audit.read_old', 'compliance.export']),
  },
  enterprise: {
    maxAgents: -1,
    maxMembers: -1,
    auditRetentionDays: -1,
    features: new Set(['audit.read_old', 'compliance.export', 'sso']),
  },
};

async function getOrgPlan(orgId: string): Promise<string> {
  try {
    const rows = await supabaseRest('organizations', `id=eq.${orgId}&select=plan,grace_period_ends_at`, { method: 'GET' }) as any[];
    const org = Array.isArray(rows) ? rows[0] : null;
    if (!org) return 'free';

    // Honor 14-day grace period
    if (org.grace_period_ends_at && new Date(org.grace_period_ends_at) > new Date()) {
      return org.plan || 'free';
    }

    return String(org.plan || 'free').toLowerCase();
  } catch (err: any) {
    logger.warn('planGate: could not fetch org plan, defaulting to free', { err: err?.message, orgId });
    return 'free';
  }
}

async function getActiveAgentCount(orgId: string): Promise<number> {
  try {
    const rows = await supabaseRest('ai_agents', `organization_id=eq.${orgId}&status=in.(active,paused)&select=id`, { method: 'GET' }) as any[];
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

async function getActiveMemberCount(orgId: string): Promise<number> {
  try {
    const rows = await supabaseRest('users', `organization_id=eq.${orgId}&select=id`, { method: 'GET' }) as any[];
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

function upgradeMessage(plan: string, reason: string): string {
  const nextPlan = plan === 'free' ? 'Pro' : plan === 'pro' ? 'Business' : 'Enterprise';
  return `${reason} Upgrade to ${nextPlan} to continue, or contact support@zapheit.com.`;
}

export function planGate(feature: PlanFeature) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const orgId: string | undefined = (req as any).user?.organizationId || (req as any).apiKey?.organization_id;
    if (!orgId) return next(); // auth middleware will reject unauthenticated requests

    try {
      const plan = await getOrgPlan(orgId);
      const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

      if (feature === 'agents.create') {
        if (limits.maxAgents !== -1) {
          const count = await getActiveAgentCount(orgId);
          if (count >= limits.maxAgents) {
            return res.status(402).json({
              error: {
                message: upgradeMessage(plan, `Your ${plan} plan allows up to ${limits.maxAgents} AI assistant${limits.maxAgents !== 1 ? 's' : ''}.`),
                type: 'plan_limit_exceeded',
                code: 'max_agents_reached',
                current: count,
                limit: limits.maxAgents,
                plan,
              },
            });
          }
        }
        return next();
      }

      if (feature === 'members.invite') {
        if (limits.maxMembers !== -1) {
          const count = await getActiveMemberCount(orgId);
          if (count >= limits.maxMembers) {
            return res.status(402).json({
              error: {
                message: upgradeMessage(plan, `Your ${plan} plan allows up to ${limits.maxMembers} team member${limits.maxMembers !== 1 ? 's' : ''}.`),
                type: 'plan_limit_exceeded',
                code: 'max_members_reached',
                current: count,
                limit: limits.maxMembers,
                plan,
              },
            });
          }
        }
        return next();
      }

      if (!limits.features.has(feature)) {
        return res.status(402).json({
          error: {
            message: upgradeMessage(plan, `This feature is not available on the ${plan} plan.`),
            type: 'plan_limit_exceeded',
            code: 'feature_not_available',
            feature,
            plan,
          },
        });
      }

      return next();
    } catch (err: any) {
      logger.warn('planGate: error checking plan limits, allowing request', { err: err?.message, feature });
      return next();
    }
  };
}
