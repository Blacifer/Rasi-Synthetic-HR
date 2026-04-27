export type ConnectorAction = { label: string; type: 'read' | 'write'; risk?: 'low' | 'medium' | 'high' };

export const CONNECTOR_ACTIONS: Record<string, ConnectorAction[]> = {
  greythr: [
    { label: 'List employees', type: 'read' },
    { label: 'Get leave requests', type: 'read' },
    { label: 'Approve leave request', type: 'write', risk: 'medium' },
    { label: 'Get payroll summary', type: 'read' },
    { label: 'Update employee record', type: 'write', risk: 'medium' },
  ],
  tally: [
    { label: 'List transactions', type: 'read' },
    { label: 'List invoices', type: 'read' },
    { label: 'Get GST summary', type: 'read' },
    { label: 'Create invoice', type: 'write', risk: 'high' },
    { label: 'Approve payment', type: 'write', risk: 'high' },
  ],
  naukri: [
    { label: 'List job postings', type: 'read' },
    { label: 'Get applications', type: 'read' },
    { label: 'Shortlist candidate', type: 'write', risk: 'low' },
    { label: 'Reject application', type: 'write', risk: 'medium' },
    { label: 'Post new job', type: 'write', risk: 'medium' },
  ],
  freshdesk: [
    { label: 'List tickets', type: 'read' },
    { label: 'Get ticket details', type: 'read' },
    { label: 'Add ticket reply', type: 'write', risk: 'low' },
    { label: 'Assign ticket', type: 'write', risk: 'low' },
    { label: 'Close ticket', type: 'write', risk: 'medium' },
  ],
  cashfree: [
    { label: 'List transactions', type: 'read' },
    { label: 'Get order details', type: 'read' },
    { label: 'Initiate payout', type: 'write', risk: 'high' },
    { label: 'Create payment link', type: 'write', risk: 'medium' },
  ],
  'google-workspace': [
    { label: 'List users', type: 'read' },
    { label: 'Read emails', type: 'read' },
    { label: 'Send email', type: 'write', risk: 'low' },
    { label: 'Create calendar event', type: 'write', risk: 'low' },
    { label: 'Create Google Doc', type: 'write', risk: 'low' },
  ],
  slack: [
    { label: 'List channels', type: 'read' },
    { label: 'Read messages', type: 'read' },
    { label: 'Send message', type: 'write', risk: 'low' },
    { label: 'Create channel', type: 'write', risk: 'medium' },
  ],
  linkedin: [
    { label: 'Get company profile', type: 'read' },
    { label: 'List job postings', type: 'read' },
    { label: 'Post job listing', type: 'write', risk: 'medium' },
  ],
  hubspot: [
    { label: 'List contacts', type: 'read' },
    { label: 'Get deals', type: 'read' },
    { label: 'Create contact', type: 'write', risk: 'low' },
    { label: 'Update deal stage', type: 'write', risk: 'medium' },
    { label: 'Create task', type: 'write', risk: 'low' },
  ],
  jira: [
    { label: 'List issues', type: 'read' },
    { label: 'Get sprint board', type: 'read' },
    { label: 'Create issue', type: 'write', risk: 'low' },
    { label: 'Update issue status', type: 'write', risk: 'low' },
    { label: 'Assign issue', type: 'write', risk: 'low' },
  ],
  github: [
    { label: 'List pull requests', type: 'read' },
    { label: 'Get repo info', type: 'read' },
    { label: 'Create issue', type: 'write', risk: 'low' },
    { label: 'Review PR', type: 'write', risk: 'medium' },
    { label: 'Merge PR', type: 'write', risk: 'high' },
  ],
  notion: [
    { label: 'Read pages', type: 'read' },
    { label: 'Search database', type: 'read' },
    { label: 'Create page', type: 'write', risk: 'low' },
    { label: 'Update page', type: 'write', risk: 'low' },
  ],
};

export const RISK_COLOR: Record<string, string> = {
  low: 'text-emerald-400/70',
  medium: 'text-amber-400/70',
  high: 'text-rose-400/70',
};
