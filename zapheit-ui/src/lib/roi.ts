import type { AIAgent, CostData, Incident } from '../types';
import { USD_TO_INR } from './currency';

export type AgentRoi = {
  agent: AIAgent;
  department: string;
  actions: number;
  blockedActions: number;
  hoursSaved: number;
  valueInr: number;
  costInr: number;
  netValueInr: number;
  roiRatio: number;
};

export function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value || 0)));
}

export function getDepartment(agent: AIAgent): string {
  const raw = String((agent as any).config?.department || agent.primaryPack || agent.agent_type || 'Operations').toLowerCase();
  if (raw.includes('recruit') || raw.includes('hiring')) return 'Hiring';
  if (raw.includes('hr') || raw.includes('employee') || raw.includes('onboarding')) return 'HR';
  if (raw.includes('finance') || raw.includes('payroll') || raw.includes('invoice') || raw.includes('refund')) return 'Finance';
  if (raw.includes('support') || raw.includes('customer')) return 'Support';
  if (raw.includes('sales') || raw.includes('marketing')) return 'Sales';
  if (raw.includes('it') || raw.includes('devops') || raw.includes('engineering')) return 'IT';
  if (raw.includes('compliance') || raw.includes('legal') || raw.includes('security')) return 'Compliance';
  return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, ' ');
}

function isThisMonth(date: string): boolean {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return false;
  const now = new Date();
  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
}

export function calculateAgentRoi(
  agent: AIAgent,
  costData: CostData[],
  incidents: Incident[] = [],
  hourlyRate = 800,
): AgentRoi {
  const agentCosts = costData.filter((item) => item.agent_id === agent.id && isThisMonth(item.date));
  const requests = agentCosts.reduce((sum, item) => sum + Number(item.requests || 0), 0);
  const costInrFromCosts = agentCosts.reduce((sum, item) => sum + Number(item.cost || 0) * USD_TO_INR, 0);
  const configuredValue = Number((agent as any).config?.estimated_monthly_savings_inr || 0);
  const actions = Math.max(Number(agent.conversations || 0), requests, configuredValue > 0 ? Math.ceil(configuredValue / Math.max(1, hourlyRate * 0.2)) : 0);
  const blockedActions = incidents.filter((incident) => incident.agent_id === agent.id && isThisMonth(incident.created_at)).length;
  const hoursSaved = Math.round((actions * 0.2) + (blockedActions * 3));
  const valueInr = Math.max(configuredValue, hoursSaved * hourlyRate);
  const costInr = Math.max(costInrFromCosts, Number(agent.current_spend || 0));
  const netValueInr = valueInr - costInr;
  const roiRatio = costInr > 0 ? valueInr / costInr : valueInr > 0 ? 99 : 0;

  return {
    agent,
    department: getDepartment(agent),
    actions,
    blockedActions,
    hoursSaved,
    valueInr,
    costInr,
    netValueInr,
    roiRatio,
  };
}

export function calculatePortfolioRoi(
  agents: AIAgent[],
  costData: CostData[],
  incidents: Incident[] = [],
  hourlyRate = 800,
) {
  const agentRois = agents.map((agent) => calculateAgentRoi(agent, costData, incidents, hourlyRate));
  const totalValueInr = agentRois.reduce((sum, item) => sum + item.valueInr, 0);
  const totalCostInr = agentRois.reduce((sum, item) => sum + item.costInr, 0);
  const totalHoursSaved = agentRois.reduce((sum, item) => sum + item.hoursSaved, 0);
  const totalActions = agentRois.reduce((sum, item) => sum + item.actions, 0);
  const totalBlocked = agentRois.reduce((sum, item) => sum + item.blockedActions, 0);
  const topAgent = [...agentRois].sort((a, b) => b.valueInr - a.valueInr)[0] || null;

  return {
    agentRois,
    totalValueInr,
    totalCostInr,
    netValueInr: totalValueInr - totalCostInr,
    roiRatio: totalCostInr > 0 ? totalValueInr / totalCostInr : totalValueInr > 0 ? 99 : 0,
    totalHoursSaved,
    totalActions,
    totalBlocked,
    topAgent,
    departments: Array.from(
      agentRois.reduce((map, item) => {
        const current = map.get(item.department) || { department: item.department, agents: 0, actions: 0, blocked: 0, valueInr: 0, costInr: 0, hoursSaved: 0 };
        current.agents += 1;
        current.actions += item.actions;
        current.blocked += item.blockedActions;
        current.valueInr += item.valueInr;
        current.costInr += item.costInr;
        current.hoursSaved += item.hoursSaved;
        map.set(item.department, current);
        return map;
      }, new Map<string, { department: string; agents: number; actions: number; blocked: number; valueInr: number; costInr: number; hoursSaved: number }>())
      .values(),
    ).map((row) => ({
      ...row,
      roiRatio: row.costInr > 0 ? row.valueInr / row.costInr : row.valueInr > 0 ? 99 : 0,
      netValueInr: row.valueInr - row.costInr,
    })),
  };
}

export function roiTone(ratio: number): string {
  if (ratio > 2) return 'text-emerald-300';
  if (ratio >= 1) return 'text-amber-300';
  return 'text-rose-300';
}
