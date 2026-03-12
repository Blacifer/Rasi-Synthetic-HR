import type { ReactNode } from 'react';
import {
  BriefcaseBusiness,
  Building2,
  Gavel,
  HandCoins,
  Headset,
  Shield,
  Wrench,
} from 'lucide-react';

export type IntegrationPackId = 'recruitment' | 'support' | 'sales' | 'it' | 'finance' | 'compliance';

export type IntegrationPack = {
  id: IntegrationPackId;
  name: string;
  description: string;
  icon: (props: any) => ReactNode;
};

export const INTEGRATION_PACKS: IntegrationPack[] = [
  {
    id: 'recruitment',
    name: 'Recruitment',
    description: 'Sourcing, screening, outreach, and interview workflows.',
    icon: BriefcaseBusiness,
  },
  {
    id: 'support',
    name: 'Support',
    description: 'Tickets, customer communications, and SLA actions.',
    icon: Headset,
  },
  {
    id: 'sales',
    name: 'Sales',
    description: 'Leads, CRM enrichment, and pipeline automation.',
    icon: Building2,
  },
  {
    id: 'it',
    name: 'IT / Identity',
    description: 'Access requests, directory sync, and collaboration rails.',
    icon: Wrench,
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Transactions, payroll, payouts, and accounting.',
    icon: HandCoins,
  },
  {
    id: 'compliance',
    name: 'Compliance',
    description: 'Filings, deadlines, policy posture, and notices.',
    icon: Gavel,
  },
];

export type IntegrationSummary = {
  id: string;
  name: string;
  category: string;
  tags?: string[];
};

export function guessPackForIntegration(integration: IntegrationSummary): IntegrationPackId {
  const category = String(integration.category || '').toUpperCase();
  const id = String(integration.id || '').toLowerCase();
  const tags = (integration.tags || []).map((t) => String(t).toLowerCase());

  if (category === 'COMPLIANCE') return 'compliance';
  if (category === 'FINANCE' || category === 'PAYROLL' || category === 'GLOBAL_PAYROLL' || category === 'PAYMENTS') return 'finance';
  if (category === 'IAM' || category === 'IDENTITY' || category === 'COLLABORATION' || category === 'PRODUCTIVITY') return 'it';
  if (category === 'COMMUNICATION') return 'support';
  if (category === 'RECRUITMENT' || category === 'ATS' || category === 'HRMS') return 'recruitment';

  // Heuristics for CRMs and ticketing systems.
  const salesHints = ['crm', 'sales', 'salesforce', 'hubspot', 'freshsales', 'zoho-crm', 'pipedrive'];
  if (salesHints.some((h) => id.includes(h)) || tags.some((t) => t.includes('crm') || t.includes('sales'))) return 'sales';

  const supportHints = ['zendesk', 'freshdesk', 'intercom', 'jira'];
  if (supportHints.some((h) => id.includes(h)) || tags.some((t) => t.includes('support'))) return 'support';

  // Default to IT because it is the broadest “operational” pack.
  return 'it';
}

export function packDisplayBadge(packId: IntegrationPackId) {
  switch (packId) {
    case 'recruitment':
      return { label: 'Enabled in V1', cls: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100' };
    default:
      return { label: 'Visible, disabled', cls: 'border-white/10 bg-white/5 text-slate-300' };
  }
}

