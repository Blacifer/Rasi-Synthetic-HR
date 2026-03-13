import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { encryptSecret } from '../lib/integrations/encryption';
import { eq, supabaseRestAsService } from '../lib/supabase-rest';

const router = express.Router();

// ---------------------------------------------------------------------------
// Static partner app catalog
// ---------------------------------------------------------------------------

export type MarketplaceApp = {
  id: string;
  name: string;
  developer: string;
  category: string;
  description: string;
  permissions: string[];
  relatedAgentIds: string[];
  installMethod: 'free' | 'api_key' | 'oauth2';
  requiredFields?: Array<{ name: string; label: string; type: 'text' | 'password'; placeholder?: string; required: boolean }>;
  installCount: number;
  featured: boolean;
  badge?: string;
  colorHex: string;
  logoLetter: string;
};

const PARTNER_APP_CATALOG: MarketplaceApp[] = [
  // --- Finance ---
  {
    id: 'stripe',
    name: 'Stripe',
    developer: 'Stripe, Inc.',
    category: 'finance',
    description: "Accept payments, automate payouts, and reconcile transactions. Rasi's Refund Agent monitors every charge and automates dispute handling.",
    permissions: ['Read charges and refunds', 'Initiate refunds up to policy limit', 'Read payout schedules', 'Receive webhook events'],
    relatedAgentIds: ['refund_agent', 'finance_ops_agent'],
    installMethod: 'api_key',
    requiredFields: [
      { name: 'secret_key', label: 'Secret Key', type: 'password', placeholder: 'sk_live_...', required: true },
      { name: 'webhook_secret', label: 'Webhook Signing Secret', type: 'password', placeholder: 'whsec_...', required: false },
    ],
    installCount: 3820,
    featured: true,
    badge: 'Popular',
    colorHex: '#6772E5',
    logoLetter: 'S',
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    developer: 'Razorpay Software Pvt. Ltd.',
    category: 'finance',
    description: "India's leading payment gateway. Full payment lifecycle management with automated refund processing and settlement reconciliation.",
    permissions: ['Read orders and payments', 'Initiate refunds', 'Read settlements', 'Receive webhook events'],
    relatedAgentIds: ['refund_agent', 'finance_ops_agent'],
    installMethod: 'api_key',
    requiredFields: [
      { name: 'key_id', label: 'Key ID', type: 'text', placeholder: 'rzp_live_...', required: true },
      { name: 'key_secret', label: 'Key Secret', type: 'password', placeholder: 'Your Razorpay key secret', required: true },
    ],
    installCount: 2410,
    featured: true,
    badge: 'India Priority',
    colorHex: '#2C73D2',
    logoLetter: 'R',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    developer: 'Intuit Inc.',
    category: 'finance',
    description: 'Sync invoices, reconcile accounts, and automate payroll. Finance Ops Agent keeps your books accurate and flags anomalies in real time.',
    permissions: ['Read and write invoices', 'Read bank accounts', 'Read/write payroll runs', 'Sync chart of accounts'],
    relatedAgentIds: ['finance_ops_agent'],
    installMethod: 'oauth2',
    installCount: 1880,
    featured: false,
    badge: 'Verified',
    colorHex: '#2CA01C',
    logoLetter: 'Q',
  },
  {
    id: 'xero',
    name: 'Xero',
    developer: 'Xero Limited',
    category: 'finance',
    description: 'Cloud accounting with automated bank reconciliation. Let Finance Ops Agent reconcile transactions and alert on discrepancies daily.',
    permissions: ['Read and write bank transactions', 'Read invoices', 'Read payroll', 'Post journal entries'],
    relatedAgentIds: ['finance_ops_agent'],
    installMethod: 'oauth2',
    installCount: 1240,
    featured: false,
    colorHex: '#1AB4D7',
    logoLetter: 'X',
  },

  // --- Support ---
  {
    id: 'zendesk',
    name: 'Zendesk',
    developer: 'Zendesk, Inc.',
    category: 'support',
    description: 'Enterprise customer support platform. Triage Agent auto-classifies tickets, drafts replies, and Escalation Agent monitors SLA breaches.',
    permissions: ['Read and write tickets', 'Read/update user profiles', 'Manage ticket fields and views', 'Post internal notes'],
    relatedAgentIds: ['triage_agent', 'escalation_agent'],
    installMethod: 'api_key',
    requiredFields: [
      { name: 'subdomain', label: 'Subdomain', type: 'text', placeholder: 'yourcompany', required: true },
      { name: 'email', label: 'Agent Email', type: 'text', placeholder: 'agent@company.com', required: true },
      { name: 'api_token', label: 'API Token', type: 'password', placeholder: 'Zendesk API token', required: true },
    ],
    installCount: 4150,
    featured: true,
    badge: 'Popular',
    colorHex: '#03363D',
    logoLetter: 'Z',
  },
  {
    id: 'freshdesk',
    name: 'Freshdesk',
    developer: 'Freshworks Inc.',
    category: 'support',
    description: 'Omni-channel helpdesk. Triage Agent classifies inbound tickets from email, chat, and social — and Escalation Agent keeps your SLAs green.',
    permissions: ['Read and create tickets', 'Update ticket status and priority', 'Assign tickets to agents', 'Add notes and replies'],
    relatedAgentIds: ['triage_agent', 'escalation_agent'],
    installMethod: 'api_key',
    requiredFields: [
      { name: 'domain', label: 'Domain', type: 'text', placeholder: 'yourcompany.freshdesk.com', required: true },
      { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'Freshdesk API key', required: true },
    ],
    installCount: 2730,
    featured: false,
    badge: 'Verified',
    colorHex: '#25C16F',
    logoLetter: 'F',
  },
  {
    id: 'intercom',
    name: 'Intercom',
    developer: 'Intercom, Inc.',
    category: 'support',
    description: 'Conversational customer support. Triage Agent reads inbound conversations, categorises them, and routes to the right inbox automatically.',
    permissions: ['Read and reply to conversations', 'Manage contacts', 'Create notes and tags', 'Send outbound messages'],
    relatedAgentIds: ['triage_agent'],
    installMethod: 'oauth2',
    installCount: 1960,
    featured: false,
    colorHex: '#286EFA',
    logoLetter: 'I',
  },

  // --- Sales ---
  {
    id: 'hubspot',
    name: 'HubSpot',
    developer: 'HubSpot, Inc.',
    category: 'sales',
    description: 'Full-funnel CRM with marketing automation. Lead Agent qualifies every inbound lead and Outreach Agent logs activity automatically.',
    permissions: ['Read and write contacts/companies', 'Read and update deals', 'Create tasks and notes', 'Send emails via HubSpot'],
    relatedAgentIds: ['lead_agent', 'outreach_agent'],
    installMethod: 'oauth2',
    installCount: 5200,
    featured: true,
    badge: 'Popular',
    colorHex: '#FF7A59',
    logoLetter: 'H',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    developer: 'Salesforce, Inc.',
    category: 'sales',
    description: "The world's #1 CRM. Lead Agent enriches and scores every lead, updates pipeline stages, and Outreach Agent syncs all email activity.",
    permissions: ['Read and write Leads/Contacts/Opportunities', 'Log Activities', 'Update pipeline stages', 'Create Tasks'],
    relatedAgentIds: ['lead_agent', 'outreach_agent'],
    installMethod: 'oauth2',
    installCount: 4680,
    featured: true,
    badge: 'Verified',
    colorHex: '#00A1E0',
    logoLetter: 'S',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    developer: 'Pipedrive OÜ',
    category: 'sales',
    description: 'Sales pipeline built for action. Lead Agent auto-moves deals through stages based on activity signals, keeping your pipeline healthy.',
    permissions: ['Read and write deals and leads', 'Update pipeline stages', 'Create activities and notes', 'Manage contacts'],
    relatedAgentIds: ['lead_agent', 'outreach_agent'],
    installMethod: 'api_key',
    requiredFields: [
      { name: 'api_token', label: 'API Token', type: 'password', placeholder: 'Pipedrive API token', required: true },
    ],
    installCount: 1320,
    featured: false,
    colorHex: '#1A1F36',
    logoLetter: 'P',
  },

  // --- IT / Identity ---
  {
    id: 'okta',
    name: 'Okta',
    developer: 'Okta, Inc.',
    category: 'it',
    description: 'Identity and access management at scale. Access Request Agent evaluates requests against Okta policies and provisions accounts automatically.',
    permissions: ['Read and manage users and groups', 'Assign application access', 'Read audit logs', 'Trigger lifecycle events'],
    relatedAgentIds: ['access_agent'],
    installMethod: 'api_key',
    requiredFields: [
      { name: 'domain', label: 'Okta Domain', type: 'text', placeholder: 'yourcompany.okta.com', required: true },
      { name: 'api_token', label: 'API Token', type: 'password', placeholder: 'Okta SSWS API token', required: true },
    ],
    installCount: 2890,
    featured: true,
    badge: 'Verified',
    colorHex: '#007DC1',
    logoLetter: 'O',
  },
  {
    id: 'jira-service-management',
    name: 'Jira Service Management',
    developer: 'Atlassian Pty Ltd',
    category: 'it',
    description: 'ITSM for modern teams. On-Call Agent creates P1 incidents automatically and Access Request Agent routes approval flows through JSM queues.',
    permissions: ['Create and update requests/incidents', 'Manage queues and priorities', 'Add comments and watchers', 'Read SLA metrics'],
    relatedAgentIds: ['access_agent', 'oncall_agent'],
    installMethod: 'api_key',
    requiredFields: [
      { name: 'site_url', label: 'Site URL', type: 'text', placeholder: 'https://yourcompany.atlassian.net', required: true },
      { name: 'email', label: 'Email', type: 'text', placeholder: 'admin@company.com', required: true },
      { name: 'api_token', label: 'API Token', type: 'password', placeholder: 'Atlassian API token', required: true },
    ],
    installCount: 3410,
    featured: false,
    badge: 'Popular',
    colorHex: '#0052CC',
    logoLetter: 'J',
  },

  // --- Compliance ---
  {
    id: 'cleartax',
    name: 'ClearTax',
    developer: 'Defmacro Software Pvt. Ltd.',
    category: 'compliance',
    description: "India's leading GST and ITR filing platform. Compliance Monitor Agent tracks all filing deadlines and initiates returns with your approval.",
    permissions: ['Read filing status and deadlines', 'Draft GST/TDS returns', 'Submit returns (with approval)', 'Read notices and demands'],
    relatedAgentIds: ['compliance_agent'],
    installMethod: 'api_key',
    requiredFields: [
      { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'ClearTax API key', required: true },
      { name: 'gstin', label: 'GSTIN', type: 'text', placeholder: '22AAAAA0000A1Z5', required: true },
    ],
    installCount: 1870,
    featured: false,
    badge: 'India Priority',
    colorHex: '#0C8A40',
    logoLetter: 'C',
  },

  // --- Recruitment ---
  {
    id: 'linkedin-recruiter',
    name: 'LinkedIn Recruiter',
    developer: 'LinkedIn Corporation',
    category: 'recruitment',
    description: "Access LinkedIn's 900M+ member network. Sourcing Agent searches, scores, and shortlists candidates against your JD automatically.",
    permissions: ['Search candidate profiles', 'Send InMails (with approval)', 'Read job postings', 'Export candidate data'],
    relatedAgentIds: ['sourcing_agent'],
    installMethod: 'oauth2',
    installCount: 6100,
    featured: true,
    badge: 'Popular',
    colorHex: '#0A66C2',
    logoLetter: 'L',
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse',
    developer: 'Greenhouse Software, Inc.',
    category: 'recruitment',
    description: 'ATS trusted by 7,500+ companies. Screening Agent updates candidate stages, logs interview notes, and sends rejection/offer emails via Greenhouse.',
    permissions: ['Read and update candidate profiles', 'Manage interview stages', 'Create and send offer letters', 'Log activity notes'],
    relatedAgentIds: ['sourcing_agent', 'screening_agent'],
    installMethod: 'api_key',
    requiredFields: [
      { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'Greenhouse Harvest API key', required: true },
      { name: 'on_behalf_of', label: 'On-Behalf-Of User ID', type: 'text', placeholder: 'Greenhouse user ID for actions', required: false },
    ],
    installCount: 1540,
    featured: false,
    badge: 'Verified',
    colorHex: '#24B247',
    logoLetter: 'G',
  },
];

// ---------------------------------------------------------------------------
// Helper: get installed app IDs for an org
// ---------------------------------------------------------------------------
async function getInstalledAppIds(orgId: string): Promise<Set<string>> {
  try {
    const rows = (await supabaseRestAsService('integrations', new URLSearchParams({
      organization_id: eq(orgId),
      'metadata->>marketplace_app': eq('true'),
      select: 'service_type',
    }))) as Array<{ service_type: string }>;
    return new Set((rows || []).map((r) => r.service_type));
  } catch {
    return new Set();
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /marketplace/apps — full catalog with installation status
router.get('/apps', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.organization_id;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const installedIds = await getInstalledAppIds(orgId);
    const apps = PARTNER_APP_CATALOG.map((app) => ({
      ...app,
      installed: installedIds.has(app.id),
    }));

    return res.json({ success: true, data: apps });
  } catch (error: any) {
    logger.error('Failed to list marketplace apps', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /marketplace/apps/installed — only installed apps for this org
router.get('/apps/installed', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.organization_id;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const installedIds = await getInstalledAppIds(orgId);
    const apps = PARTNER_APP_CATALOG
      .filter((app) => installedIds.has(app.id))
      .map((app) => ({ ...app, installed: true }));

    return res.json({ success: true, data: apps });
  } catch (error: any) {
    logger.error('Failed to list installed apps', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

const installSchema = z.object({
  credentials: z.record(z.string()).optional().default({}),
});

// POST /marketplace/apps/:id/install — install a partner app
router.post('/apps/:id/install', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.organization_id;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const app = PARTNER_APP_CATALOG.find((a) => a.id === req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'App not found' });

    const parsed = installSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.errors.map((e) => e.message) });
    }

    // For OAuth apps return a placeholder auth URL (real OAuth per-partner handled by edge functions)
    if (app.installMethod === 'oauth2') {
      const state = crypto.randomUUID();
      return res.json({
        success: true,
        oauth: true,
        state,
        message: `OAuth flow for ${app.name} — redirect user to partner authorization page.`,
      });
    }

    // Validate required fields for api_key apps
    if (app.installMethod === 'api_key' && app.requiredFields) {
      const missing = app.requiredFields
        .filter((f) => f.required && !parsed.data.credentials[f.name])
        .map((f) => f.label);
      if (missing.length > 0) {
        return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
      }
    }

    const now = new Date().toISOString();

    // Create integration record
    const integrationBody = {
      organization_id: orgId,
      service_type: app.id,
      service_name: app.name,
      category: app.category.toUpperCase(),
      auth_type: app.installMethod,
      status: 'configured',
      ai_enabled: true,
      created_at: now,
      updated_at: now,
      metadata: { marketplace_app: 'true', developer: app.developer },
    };

    const created = (await supabaseRestAsService('integrations', '', {
      method: 'POST',
      body: integrationBody,
    })) as any[];

    const integration = Array.isArray(created) ? created[0] : created;
    const integrationId = integration?.id;

    if (!integrationId) {
      return res.status(500).json({ success: false, error: 'Failed to create integration record' });
    }

    // Store credentials (encrypted)
    if (app.installMethod === 'api_key' && Object.keys(parsed.data.credentials).length > 0) {
      const credInserts = await Promise.allSettled(
        Object.entries(parsed.data.credentials).map(async ([key, value]) => {
          const field = app.requiredFields?.find((f) => f.name === key);
          const isSensitive = field?.type === 'password';
          const encrypted = isSensitive ? await encryptSecret(value) : value;
          return supabaseRestAsService('integration_credentials', '', {
            method: 'POST',
            body: {
              integration_id: integrationId,
              key,
              value: encrypted,
              is_sensitive: isSensitive,
              label: field?.label || key,
              created_at: now,
              updated_at: now,
            },
          });
        })
      );
      const failed = credInserts.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        logger.warn('Some credentials failed to store', { integrationId, count: failed.length });
      }
    }

    logger.info('Marketplace app installed', { app_id: app.id, org_id: orgId, integration_id: integrationId });

    return res.status(201).json({
      success: true,
      integration_id: integrationId,
      message: `${app.name} has been installed successfully.`,
    });
  } catch (error: any) {
    logger.error('Failed to install marketplace app', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /marketplace/apps/:id — uninstall a partner app
router.delete('/apps/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.organization_id;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // Find and remove the integration record
    const rows = (await supabaseRestAsService('integrations', new URLSearchParams({
      organization_id: eq(orgId),
      service_type: eq(req.params.id),
      'metadata->>marketplace_app': eq('true'),
      select: 'id',
      limit: '1',
    }))) as Array<{ id: string }>;

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'App not installed' });
    }

    const integrationId = rows[0].id;

    await supabaseRestAsService('integrations', new URLSearchParams({ id: eq(integrationId) }), {
      method: 'DELETE',
    });

    logger.info('Marketplace app uninstalled', { app_id: req.params.id, org_id: orgId });

    return res.json({ success: true, message: 'App uninstalled.' });
  } catch (error: any) {
    logger.error('Failed to uninstall marketplace app', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
