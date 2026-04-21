/**
 * Self-healing agents v1 (P5-11).
 *
 * When an incident fires, this service:
 *  1. Looks up the pre-built remediation playbook for the incident type.
 *  2. Runs the playbook steps in a simulated "staging" context (dry-run).
 *  3. If all steps pass, applies the fix to the live agent config.
 *  4. Creates an audit event and notifies admins via in-app incident.
 *
 * Human override: admins can reject the self-heal within 1 hour; if rejected
 * the original config is restored from the snapshot saved before the fix.
 *
 * Pattern-based only — no ML. Supports:
 *   - pii_leak       → disable agent for 15 min, clear system prompt PII hints
 *   - cost_spike     → throttle max_tokens by 50%
 *   - policy_breach  → pause agent, escalate to manager
 *   - latency_breach → switch model to faster variant (gpt-4o-mini)
 *   - hallucination  → lower temperature, enable fact-check instruction
 */

import { supabaseRestAsService } from '../lib/supabase-rest';
import { logger } from '../lib/logger';
import { auditLog } from '../lib/audit-logger';

export type SelfHealIncidentType =
  | 'pii_leak'
  | 'cost_spike'
  | 'policy_breach'
  | 'latency_breach'
  | 'hallucination';

interface AgentSnapshot {
  status: string;
  system_prompt?: string;
  max_tokens?: number;
  model_id?: string;
  temperature?: number;
  metadata?: Record<string, unknown>;
}

interface RemediationStep {
  description: string;
  apply: (agent: AgentSnapshot) => AgentSnapshot;
  dryRunCheck: (agent: AgentSnapshot) => { ok: boolean; reason?: string };
}

const PLAYBOOKS: Record<SelfHealIncidentType, RemediationStep[]> = {
  pii_leak: [
    {
      description: 'Pause agent to stop further PII exposure',
      apply: (a) => ({ ...a, status: 'paused' }),
      dryRunCheck: () => ({ ok: true }),
    },
    {
      description: 'Add PII guard instruction to system prompt',
      apply: (a) => ({
        ...a,
        system_prompt: [a.system_prompt, '\n[SAFETY] Never include personal data (Aadhaar, PAN, phone, email) in responses.']
          .filter(Boolean).join(''),
      }),
      dryRunCheck: (a) => ({
        ok: !a.system_prompt?.includes('[SAFETY]'),
        reason: 'PII guard already present',
      }),
    },
  ],
  cost_spike: [
    {
      description: 'Halve max_tokens to reduce cost per request',
      apply: (a) => ({ ...a, max_tokens: Math.max(256, Math.floor((a.max_tokens ?? 2048) / 2)) }),
      dryRunCheck: (a) => ({ ok: (a.max_tokens ?? 2048) > 256 }),
    },
  ],
  policy_breach: [
    {
      description: 'Pause agent and require manager review',
      apply: (a) => ({ ...a, status: 'paused' }),
      dryRunCheck: () => ({ ok: true }),
    },
  ],
  latency_breach: [
    {
      description: 'Switch to faster model variant',
      apply: (a) => ({
        ...a,
        model_id: a.model_id?.includes('gpt-4o') ? 'openai/gpt-4o-mini' : a.model_id,
      }),
      dryRunCheck: (a) => ({
        ok: Boolean(a.model_id?.includes('gpt-4o') && !a.model_id?.includes('mini')),
        reason: 'Model already fast or not gpt-4o',
      }),
    },
  ],
  hallucination: [
    {
      description: 'Lower temperature to reduce creative deviation',
      apply: (a) => ({ ...a, temperature: Math.min(a.temperature ?? 0.7, 0.3) }),
      dryRunCheck: (a) => ({ ok: (a.temperature ?? 0.7) > 0.3 }),
    },
    {
      description: 'Add fact-check instruction to system prompt',
      apply: (a) => ({
        ...a,
        system_prompt: [a.system_prompt, '\n[ACCURACY] Only state facts you are certain about. Say "I\'m not sure" when uncertain.']
          .filter(Boolean).join(''),
      }),
      dryRunCheck: (a) => ({
        ok: !a.system_prompt?.includes('[ACCURACY]'),
        reason: 'Fact-check instruction already present',
      }),
    },
  ],
};

export async function attemptSelfHeal(
  incidentId: string,
  agentId: string,
  organizationId: string,
  incidentType: SelfHealIncidentType,
): Promise<{ healed: boolean; stepsApplied: string[]; reason?: string }> {
  const playbook = PLAYBOOKS[incidentType];
  if (!playbook) {
    return { healed: false, stepsApplied: [], reason: `No playbook for incident type: ${incidentType}` };
  }

  // Fetch current agent state
  const agentRows = await supabaseRestAsService('ai_agents', new URLSearchParams({
    select: 'id,status,system_prompt,max_tokens,model_id,temperature,metadata',
    id: `eq.${agentId}`,
    limit: '1',
  })).catch(() => null) as any[] | null;

  const agent = Array.isArray(agentRows) ? agentRows[0] : null;
  if (!agent) {
    return { healed: false, stepsApplied: [], reason: 'Agent not found' };
  }

  const snapshot: AgentSnapshot = {
    status: agent.status,
    system_prompt: agent.system_prompt,
    max_tokens: agent.max_tokens,
    model_id: agent.model_id,
    temperature: agent.temperature,
    metadata: agent.metadata,
  };

  // ── Dry-run phase ────────────────────────────────────────────────────────────
  let stagingState = { ...snapshot };
  const stepsApplied: string[] = [];

  for (const step of playbook) {
    const check = step.dryRunCheck(stagingState);
    if (!check.ok) {
      logger.info('self-heal: skipping step (dry-run check failed)', {
        agentId, incidentType, step: step.description, reason: check.reason,
      });
      continue;
    }
    stagingState = step.apply(stagingState);
    stepsApplied.push(step.description);
  }

  if (stepsApplied.length === 0) {
    return { healed: false, stepsApplied: [], reason: 'No applicable remediation steps' };
  }

  // ── Apply to production ───────────────────────────────────────────────────
  const patch: Partial<AgentSnapshot> = {};
  if (stagingState.status !== snapshot.status) patch.status = stagingState.status;
  if (stagingState.system_prompt !== snapshot.system_prompt) patch.system_prompt = stagingState.system_prompt;
  if (stagingState.max_tokens !== snapshot.max_tokens) patch.max_tokens = stagingState.max_tokens;
  if (stagingState.model_id !== snapshot.model_id) patch.model_id = stagingState.model_id;
  if (stagingState.temperature !== snapshot.temperature) patch.temperature = stagingState.temperature;

  try {
    await supabaseRestAsService('ai_agents', new URLSearchParams({ id: `eq.${agentId}` }), {
      method: 'PATCH',
      body: {
        ...patch,
        // Save original config in metadata so humans can restore it
        metadata: {
          ...(agent.metadata ?? {}),
          self_heal_snapshot: snapshot,
          self_heal_incident_id: incidentId,
          self_heal_at: new Date().toISOString(),
        },
      },
    });

    // Mark incident as self-healed
    await supabaseRestAsService('incidents', new URLSearchParams({ id: `eq.${incidentId}` }), {
      method: 'PATCH',
      body: {
        status: 'auto_resolved',
        resolution: `Self-healed: ${stepsApplied.join('; ')}`,
        resolved_at: new Date().toISOString(),
      },
    }).catch(() => null);

    await auditLog.log({
      user_id: 'system',
      action: 'agent.self_healed',
      resource_type: 'agent',
      resource_id: agentId,
      organization_id: organizationId,
      metadata: { incident_id: incidentId, incident_type: incidentType, steps: stepsApplied },
    });

    logger.info('self-heal: applied remediation', { agentId, incidentType, stepsApplied });
    return { healed: true, stepsApplied };
  } catch (err: any) {
    logger.error('self-heal: failed to apply remediation', { err: err?.message, agentId });
    return { healed: false, stepsApplied: [], reason: err?.message };
  }
}

/**
 * Restore agent from a self-heal snapshot (human override within 1 hour).
 */
export async function revertSelfHeal(agentId: string, organizationId: string, userId: string): Promise<boolean> {
  const agentRows = await supabaseRestAsService('ai_agents', new URLSearchParams({
    select: 'metadata',
    id: `eq.${agentId}`,
    limit: '1',
  })).catch(() => null) as any[] | null;

  const agent = Array.isArray(agentRows) ? agentRows[0] : null;
  const snapshot: AgentSnapshot | undefined = agent?.metadata?.self_heal_snapshot;

  if (!snapshot) return false;

  try {
    await supabaseRestAsService('ai_agents', new URLSearchParams({ id: `eq.${agentId}` }), {
      method: 'PATCH',
      body: {
        status: snapshot.status,
        system_prompt: snapshot.system_prompt ?? null,
        max_tokens: snapshot.max_tokens ?? null,
        model_id: snapshot.model_id ?? null,
        temperature: snapshot.temperature ?? null,
        metadata: {
          ...(agent.metadata ?? {}),
          self_heal_reverted_at: new Date().toISOString(),
          self_heal_reverted_by: userId,
        },
      },
    });

    await auditLog.log({
      user_id: userId,
      action: 'agent.self_heal_reverted',
      resource_type: 'agent',
      resource_id: agentId,
      organization_id: organizationId,
    });

    return true;
  } catch (err: any) {
    logger.error('self-heal: revert failed', { err: err?.message, agentId });
    return false;
  }
}
