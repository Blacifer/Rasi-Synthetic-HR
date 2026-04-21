/**
 * Agent health score (0-100).
 *
 * 4 dimensions — each 0-25:
 *   Performance (25pts): uptime proxy via no terminated/error status recently
 *   Safety     (25pts): incident rate — fewer incidents = higher score
 *   Cost       (25pts): vs org average — at or below average = full score
 *   Activity   (25pts): conversation volume as a proxy for usefulness
 *
 * Score is deterministic from existing DB data — no ML.
 */

import { supabaseRestAsService } from '../lib/supabase-rest';
import { logger } from '../lib/logger';

export interface AgentHealthScore {
  agentId: string;
  total: number;      // 0-100
  performance: number; // 0-25
  safety: number;      // 0-25
  cost: number;        // 0-25
  activity: number;    // 0-25
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendations: string[];
}

function grade(score: number): AgentHealthScore['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export async function computeAgentHealth(agentId: string, orgId: string): Promise<AgentHealthScore> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [incidentRows, costRows, agentRows, orgCostRows] = await Promise.all([
    // Open/investigating incidents in last 30d
    supabaseRestAsService('incidents', new URLSearchParams(
      `organization_id=eq.${orgId}&agent_id=eq.${agentId}&created_at=gte.${since}&status=in.(open,investigating)&select=id,severity`,
    )) as Promise<Array<{ id: string; severity: string }>>,

    // Cost this month for this agent
    supabaseRestAsService('cost_tracking', new URLSearchParams(
      `organization_id=eq.${orgId}&agent_id=eq.${agentId}&created_at=gte.${since}&select=cost_usd,request_count`,
    )) as Promise<Array<{ cost_usd: number; request_count: number }>>,

    // Agent status + conversations
    supabaseRestAsService('ai_agents', new URLSearchParams(
      `id=eq.${agentId}&organization_id=eq.${orgId}&select=status,conversations`,
    )) as Promise<Array<{ status: string; conversations: number }>>,

    // Org average cost per agent this month
    supabaseRestAsService('cost_tracking', new URLSearchParams(
      `organization_id=eq.${orgId}&created_at=gte.${since}&select=cost_usd`,
    )) as Promise<Array<{ cost_usd: number }>>,
  ]);

  const agent = agentRows?.[0];
  const incidents = incidentRows || [];
  const costs = costRows || [];
  const orgCosts = orgCostRows || [];

  // --- Performance (0-25) ---
  // Terminated or errored = 0; active = 25; paused = 15
  let performanceScore = 20;
  if (agent?.status === 'active') performanceScore = 25;
  else if (agent?.status === 'paused') performanceScore = 15;
  else if (agent?.status === 'terminated') performanceScore = 0;

  // --- Safety (0-25) ---
  // 0 open incidents = 25; each incident costs 5pts (min 0)
  const criticalCount = incidents.filter((i) => i.severity === 'critical').length;
  const highCount = incidents.filter((i) => i.severity === 'high').length;
  const medCount = incidents.filter((i) => ['medium', 'low'].includes(i.severity)).length;
  const safetyScore = Math.max(0, 25 - criticalCount * 10 - highCount * 5 - medCount * 2);

  // --- Cost (0-25) ---
  // At or below org average = 25; >2x average = 0
  const agentCostUsd = costs.reduce((s, r) => s + Number(r.cost_usd || 0), 0);
  const agentRequests = costs.reduce((s, r) => s + Number(r.request_count || 0), 0);
  const orgTotalCost = orgCosts.reduce((s, r) => s + Number(r.cost_usd || 0), 0);
  const orgAvgCostPerAgent = orgTotalCost > 0 ? orgTotalCost / Math.max(1, agentRequests) : 0;
  let costScore = 25;
  if (orgAvgCostPerAgent > 0 && agentCostUsd > 0) {
    const ratio = agentCostUsd / orgAvgCostPerAgent;
    costScore = ratio <= 1 ? 25 : ratio <= 1.5 ? 20 : ratio <= 2 ? 12 : 0;
  }

  // --- Activity (0-25) ---
  // Conversations > 100 = 25; > 20 = 18; > 5 = 10; else 5
  const convs = agent?.conversations ?? 0;
  const activityScore = convs > 100 ? 25 : convs > 20 ? 18 : convs > 5 ? 10 : 5;

  const total = Math.min(100, performanceScore + safetyScore + costScore + activityScore);

  // Recommendations
  const recs: string[] = [];
  if (safetyScore < 15) recs.push('Review open safety alerts — this assistant has flagged issues that need attention.');
  if (performanceScore < 15) recs.push('Check the assistant status — it may be paused or have configuration issues.');
  if (costScore < 10) recs.push('This assistant costs significantly more than average. Consider adding a budget limit.');
  if (activityScore < 10) recs.push('Low conversation volume — consider connecting this assistant to more channels.');

  return { agentId, total, performance: performanceScore, safety: safetyScore, cost: costScore, activity: activityScore, grade: grade(total), recommendations: recs };
}

export async function computeAllAgentHealthForOrg(orgId: string): Promise<AgentHealthScore[]> {
  try {
    const agents = (await supabaseRestAsService('ai_agents', new URLSearchParams(
      `organization_id=eq.${orgId}&status=neq.terminated&select=id`,
    ))) as Array<{ id: string }>;

    return Promise.all((agents || []).map((a) =>
      computeAgentHealth(a.id, orgId).catch((err) => {
        logger.warn('agent-health: compute failed for agent', { agentId: a.id, err: err?.message });
        return { agentId: a.id, total: 0, performance: 0, safety: 0, cost: 0, activity: 0, grade: 'F' as const, recommendations: [] };
      }),
    ));
  } catch (err: any) {
    logger.warn('agent-health: computeAll failed', { orgId, err: err?.message });
    return [];
  }
}
