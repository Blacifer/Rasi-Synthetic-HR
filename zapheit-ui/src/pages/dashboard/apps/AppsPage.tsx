import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, ChevronDown, ChevronUp, X, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { api } from '../../../lib/api-client';
import { toast } from '../../../lib/toast';
import type { AIAgent } from '../../../types';
import { AppLogo } from './components/AppLogo';
import { useAppsData } from './hooks/useAppsData';
import { getAppServiceId } from './helpers';

/* ─── App catalog ────────────────────────────────────────────────────── */

type AuthType = 'oauth' | 'api_key';

interface CredField { key: string; label: string; type: 'text' | 'password' }

interface AppDef {
  appId: string;
  serviceId: string;
  name: string;
  description: string;
  category: string;
  auth: AuthType;
  logoLetter: string;
  colorHex: string;
  workspaceRoute?: string;
  fields?: CredField[];
}

const APP_CATALOG: AppDef[] = [
  // ── Productivity ─────────────────────────────────────────────────────
  {
    appId: 'google-workspace', serviceId: 'google_workspace', name: 'Google Workspace',
    description: 'Gmail, Calendar, and Drive. Agents can onboard employees, send emails, and schedule meetings.',
    category: 'productivity', auth: 'oauth', logoLetter: 'G', colorHex: '#4285F4',
    workspaceRoute: 'apps/google-workspace/workspace',
  },
  {
    appId: 'microsoft-365', serviceId: 'microsoft_365', name: 'Microsoft 365',
    description: 'Outlook, Teams, and OneDrive. Enterprise email, calendar, and document workflows.',
    category: 'productivity', auth: 'oauth', logoLetter: 'M', colorHex: '#0078D4',
    workspaceRoute: 'apps/microsoft-365/workspace',
  },
  {
    appId: 'notion', serviceId: 'notion', name: 'Notion',
    description: 'Access and update pages, databases, and wikis from your AI agents.',
    category: 'productivity', auth: 'api_key', logoLetter: 'N', colorHex: '#000000',
    workspaceRoute: 'apps/notion/workspace',
    fields: [{ key: 'api_key', label: 'Integration token', type: 'password' }],
  },
  // ── Communication ────────────────────────────────────────────────────
  {
    appId: 'slack', serviceId: 'slack', name: 'Slack',
    description: 'Read channels, send messages, and post incident alerts automatically.',
    category: 'communication', auth: 'oauth', logoLetter: 'S', colorHex: '#4A154B',
    workspaceRoute: 'apps/slack/workspace',
  },
  {
    appId: 'whatsapp-business', serviceId: 'whatsapp_business', name: 'WhatsApp Business',
    description: 'Send automated HR notifications, approval requests, and alerts via WhatsApp.',
    category: 'communication', auth: 'api_key', logoLetter: 'W', colorHex: '#25D366',
    workspaceRoute: 'apps/whatsapp/workspace',
    fields: [
      { key: 'access_token', label: 'Access token', type: 'password' },
      { key: 'phone_number_id', label: 'Phone number ID', type: 'text' },
    ],
  },
  // ── HR & People ──────────────────────────────────────────────────────
  {
    appId: 'zoho-people', serviceId: 'zoho_people', name: 'Zoho People',
    description: 'Employee directory, leave management, and attendance tracking for HR agents.',
    category: 'hr', auth: 'api_key', logoLetter: 'Z', colorHex: '#E42527',
    workspaceRoute: 'apps/zoho/workspace',
    fields: [{ key: 'api_key', label: 'API key', type: 'password' }],
  },
  // ── Sales & CRM ──────────────────────────────────────────────────────
  {
    appId: 'hubspot', serviceId: 'hubspot', name: 'HubSpot',
    description: 'CRM contacts, deals pipeline, and marketing automation.',
    category: 'sales', auth: 'oauth', logoLetter: 'H', colorHex: '#FF7A59',
    workspaceRoute: 'apps/hubspot/workspace',
  },
  {
    appId: 'salesforce', serviceId: 'salesforce', name: 'Salesforce',
    description: 'Leads, opportunities, and accounts for enterprise sales teams.',
    category: 'sales', auth: 'api_key', logoLetter: 'SF', colorHex: '#00A1E0',
    fields: [
      { key: 'access_token', label: 'Access token', type: 'password' },
      { key: 'instance_url', label: 'Instance URL', type: 'text' },
    ],
  },
  // ── Finance ──────────────────────────────────────────────────────────
  {
    appId: 'quickbooks', serviceId: 'quickbooks', name: 'QuickBooks',
    description: 'Invoices, expenses, and financial reports for finance agents.',
    category: 'finance', auth: 'oauth', logoLetter: 'QB', colorHex: '#2CA01C',
    workspaceRoute: 'apps/quickbooks/workspace',
  },
  {
    appId: 'cashfree', serviceId: 'cashfree', name: 'Cashfree Payments',
    description: 'Accept payments, initiate refunds, and query settlements via Cashfree.',
    category: 'finance', auth: 'api_key', logoLetter: 'CF', colorHex: '#1A73E8',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text' },
      { key: 'client_secret', label: 'Client secret', type: 'password' },
    ],
  },
  {
    appId: 'stripe', serviceId: 'stripe', name: 'Stripe',
    description: 'Payment processing, subscriptions, and revenue data.',
    category: 'finance', auth: 'api_key', logoLetter: 'S', colorHex: '#635BFF',
    fields: [{ key: 'secret_key', label: 'Secret key', type: 'password' }],
  },
  // ── IT & Security ────────────────────────────────────────────────────
  {
    appId: 'github', serviceId: 'github', name: 'GitHub',
    description: 'Repositories, issues, pull requests, and CI/CD pipeline management.',
    category: 'it', auth: 'api_key', logoLetter: 'GH', colorHex: '#333333',
    workspaceRoute: 'apps/github/workspace',
    fields: [{ key: 'access_token', label: 'Personal access token', type: 'password' }],
  },
  {
    appId: 'jira', serviceId: 'jira', name: 'Jira',
    description: 'Issue tracking, sprint planning, and project management.',
    category: 'it', auth: 'api_key', logoLetter: 'J', colorHex: '#0052CC',
    workspaceRoute: 'apps/jira/workspace',
    fields: [
      { key: 'api_token', label: 'API token', type: 'password' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'domain', label: 'Atlassian domain (e.g. yourco.atlassian.net)', type: 'text' },
    ],
  },
  {
    appId: 'okta', serviceId: 'okta', name: 'Okta',
    description: 'Identity management, SSO, and user provisioning.',
    category: 'it', auth: 'api_key', logoLetter: 'O', colorHex: '#007DC1',
    fields: [
      { key: 'api_token', label: 'API token', type: 'password' },
      { key: 'domain', label: 'Okta domain', type: 'text' },
    ],
  },
  // ── Support & CX ─────────────────────────────────────────────────────
  {
    appId: 'zendesk', serviceId: 'zendesk', name: 'Zendesk',
    description: 'Customer support tickets, agents, and helpdesk automation.',
    category: 'support', auth: 'api_key', logoLetter: 'ZD', colorHex: '#03363D',
    fields: [
      { key: 'api_token', label: 'API token', type: 'password' },
      { key: 'subdomain', label: 'Subdomain', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
    ],
  },
  {
    appId: 'freshdesk', serviceId: 'freshdesk', name: 'Freshdesk',
    description: 'Customer support tickets and multichannel helpdesk.',
    category: 'support', auth: 'api_key', logoLetter: 'FD', colorHex: '#25C16F',
    fields: [
      { key: 'api_key', label: 'API key', type: 'password' },
      { key: 'domain', label: 'Domain (e.g. yourco.freshdesk.com)', type: 'text' },
    ],
  },
  // ── Recruitment ──────────────────────────────────────────────────────
  {
    appId: 'linkedin', serviceId: 'linkedin', name: 'LinkedIn Recruiter',
    description: 'Search candidates, send InMails, and post jobs on LinkedIn.',
    category: 'recruitment', auth: 'oauth', logoLetter: 'in', colorHex: '#0A66C2',
    workspaceRoute: 'apps/linkedin/workspace',
  },
  {
    appId: 'naukri', serviceId: 'naukri', name: 'Naukri',
    description: "Search candidates and post jobs on India's largest job portal.",
    category: 'recruitment', auth: 'api_key', logoLetter: 'NK', colorHex: '#FF7555',
    fields: [
      { key: 'api_key', label: 'API key', type: 'password' },
      { key: 'client_id', label: 'Client ID', type: 'text' },
      { key: 'employer_id', label: 'Employer ID', type: 'text' },
    ],
  },
  // ── Compliance ───────────────────────────────────────────────────────
  {
    appId: 'cleartax', serviceId: 'cleartax', name: 'ClearTax',
    description: 'GST filing, tax compliance, and e-invoicing automation.',
    category: 'compliance', auth: 'api_key', logoLetter: 'CT', colorHex: '#F7941D',
    fields: [{ key: 'api_key', label: 'API key', type: 'password' }],
  },
];

const CATEGORY_TABS = [
  { id: 'all',          label: 'All' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'communication',label: 'Communication' },
  { id: 'hr',           label: 'HR & People' },
  { id: 'sales',        label: 'Sales & CRM' },
  { id: 'finance',      label: 'Finance' },
  { id: 'it',           label: 'IT & Security' },
  { id: 'support',      label: 'Support' },
  { id: 'recruitment',  label: 'Recruitment' },
  { id: 'compliance',   label: 'Compliance' },
];

/* ─── Status helpers ─────────────────────────────────────────────────── */

type ConnStatus = 'connected' | 'disconnected' | 'error';

function resolveStatus(app: AppDef, backendApp: any): ConnStatus {
  if (!backendApp) return 'disconnected';
  const s = backendApp.status || backendApp.connectionStatus || backendApp.connection_status || '';
  if (s === 'connected') return 'connected';
  if (s === 'error' || s === 'expired') return 'error';
  return 'disconnected';
}

const STATUS_BADGE: Record<ConnStatus, string> = {
  connected:    'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
  disconnected: 'border-white/10 bg-white/[0.04] text-slate-400',
  error:        'border-rose-400/20 bg-rose-500/10 text-rose-300',
};
const STATUS_LABEL: Record<ConnStatus, string> = {
  connected: 'Connected', disconnected: 'Disconnected', error: 'Error',
};

/* ─── API-key credential form ────────────────────────────────────────── */

function CredForm({
  fields,
  onSubmit,
  onCancel,
  submitting,
}: {
  fields: CredField[];
  onSubmit: (creds: Record<string, string>) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));
  const toggle = (k: string) => setShown((p) => ({ ...p, [k]: !p[k] }));

  const ready = fields.every((f) => values[f.key]?.trim());

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-xs font-medium text-slate-400 mb-1">{f.label}</label>
          <div className="flex items-center gap-1">
            <input
              type={f.type === 'password' && !shown[f.key] ? 'password' : 'text'}
              value={values[f.key] || ''}
              onChange={(e) => set(f.key, e.target.value)}
              className="flex-1 bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500/50"
              placeholder={f.type === 'password' ? '••••••••' : f.label}
            />
            {f.type === 'password' && (
              <button type="button" onClick={() => toggle(f.key)} className="p-2 text-slate-500 hover:text-slate-300">
                {shown[f.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
          Cancel
        </button>
        <button
          type="button"
          disabled={!ready || submitting}
          onClick={() => onSubmit(values)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-40"
        >
          {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Save & connect
        </button>
      </div>
    </div>
  );
}

/* ─── App card ───────────────────────────────────────────────────────── */

function AppCard({
  app,
  status,
  onConnect,
  onDisconnect,
  onOpenWorkspace,
}: {
  app: AppDef;
  status: ConnStatus;
  onConnect: (app: AppDef, creds?: Record<string, string>) => Promise<void>;
  onDisconnect: (app: AppDef) => Promise<void>;
  onOpenWorkspace: (app: AppDef) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const connect = async (creds?: Record<string, string>) => {
    setBusy(true);
    try { await onConnect(app, creds); }
    finally { setBusy(false); setFormOpen(false); }
  };

  const disconnect = async () => {
    setBusy(true);
    try { await onDisconnect(app); }
    finally { setBusy(false); }
  };

  return (
    <div className={cn(
      'rounded-2xl border p-5 transition-colors',
      status === 'connected' ? 'border-emerald-500/15 bg-white/[0.03]' : 'border-white/8 bg-white/[0.02]',
    )}>
      <div className="flex items-start gap-4">
        <AppLogo appId={app.appId} logoLetter={app.logoLetter} colorHex={app.colorHex} size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white">{app.name}</h3>
            <span className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium', STATUS_BADGE[status])}>
              {STATUS_LABEL[status]}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-500 font-mono">
              {app.auth === 'oauth' ? 'OAuth 2.0' : 'API key'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-lg">{app.description}</p>

          {/* Workspace link */}
          {status === 'connected' && app.workspaceRoute && (
            <button
              onClick={() => onOpenWorkspace(app)}
              className="mt-2 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Open workspace
            </button>
          )}
        </div>

        {/* Primary action */}
        <div className="shrink-0">
          {status === 'connected' ? (
            <button
              onClick={() => void disconnect()}
              disabled={busy}
              className="px-3 py-1.5 rounded-xl border border-rose-400/20 bg-rose-500/10 text-rose-300 text-xs font-semibold hover:bg-rose-500/20 transition-colors disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Disconnect'}
            </button>
          ) : app.auth === 'oauth' ? (
            <button
              onClick={() => void connect()}
              disabled={busy}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Connect
            </button>
          ) : (
            <button
              onClick={() => setFormOpen((v) => !v)}
              disabled={busy}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.13] text-slate-200 text-xs font-semibold transition-colors disabled:opacity-40"
            >
              {formOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Connect
            </button>
          )}
        </div>
      </div>

      {/* Inline credential form for API key apps */}
      {formOpen && app.fields && (
        <CredForm
          fields={app.fields}
          onSubmit={(creds) => void connect(creds)}
          onCancel={() => setFormOpen(false)}
          submitting={busy}
        />
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

interface AppsPageProps {
  agents?: AIAgent[];
  onNavigate?: (route: string) => void;
}

export default function AppsPage({ onNavigate }: AppsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');

  const { allApps, loading, reload } = useAppsData();

  // Handle OAuth callback params
  useEffect(() => {
    const status  = searchParams.get('status');
    const service = searchParams.get('service') || searchParams.get('provider');
    const message = searchParams.get('message');
    if (!status || !service) return;

    if (status === 'connected') {
      void reload().then(() => {
        const app = APP_CATALOG.find((a) => a.serviceId === service || a.appId === service);
        toast.success(`${app?.name ?? service} connected`);
        if (app?.workspaceRoute && onNavigate) onNavigate(app.workspaceRoute);
      });
    } else if (status === 'error') {
      toast.error(message || 'Connection failed');
    }

    setSearchParams((p) => {
      p.delete('status'); p.delete('service'); p.delete('provider'); p.delete('message');
      return p;
    }, { replace: true });
  }, [searchParams, setSearchParams, reload, onNavigate]);

  // Merge backend status into catalog
  const apps = useMemo(() => APP_CATALOG.map((def) => {
    const backendApp = allApps.find((a) => {
      const sid = getAppServiceId(a);
      return a.appId === def.appId || sid === def.serviceId;
    });
    return { def, status: resolveStatus(def, backendApp) };
  }), [allApps]);

  const filtered = useMemo(() => apps.filter(({ def }) => {
    const matchCat = activeCategory === 'all' || def.category === activeCategory;
    const matchSearch = !search.trim() || def.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [apps, activeCategory, search]);

  const connected = useMemo(() => apps.filter((a) => a.status === 'connected'), [apps]);

  /* Connect handler */
  const handleConnect = useCallback(async (app: AppDef, creds?: Record<string, string>) => {
    if (app.auth === 'oauth') {
      window.location.href = api.integrations.getOAuthAuthorizeUrl(app.serviceId, '/dashboard/apps');
      return;
    }
    if (!creds) return;
    const res = await api.integrations.connect(app.serviceId, creds);
    if (res.success) {
      toast.success(`${app.name} connected`);
      void reload();
    } else {
      toast.error((res as any).error || 'Connection failed');
    }
  }, [reload]);

  /* Disconnect handler */
  const handleDisconnect = useCallback(async (app: AppDef) => {
    const res = await api.integrations.disconnect(app.serviceId);
    if (res.success) {
      toast.success(`${app.name} disconnected`);
      void reload();
    } else {
      toast.error((res as any).error || 'Disconnect failed');
    }
  }, [reload]);

  /* Open workspace */
  const handleOpenWorkspace = useCallback((app: AppDef) => {
    if (app.workspaceRoute && onNavigate) onNavigate(app.workspaceRoute);
  }, [onNavigate]);

  return (
    <div className="min-h-full bg-[#080f1a] px-6 py-6">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400/80 mb-1">Connected Apps</p>
            <h1 className="text-2xl font-bold text-white">Your integrations</h1>
            <p className="text-sm text-slate-400 mt-1">
              {connected.length} of {APP_CATALOG.length} apps connected · all actions governed by Zapheit
            </p>
          </div>
          <input
            type="text"
            placeholder="Search apps…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500/40 w-52"
          />
        </div>

        {/* Connected highlight strip */}
        {connected.length > 0 && (
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
            <p className="text-xs font-semibold text-emerald-400 mb-3">Connected ({connected.length})</p>
            <div className="flex flex-wrap gap-2">
              {connected.map(({ def }) => (
                <button
                  key={def.appId}
                  onClick={() => def.workspaceRoute && onNavigate?.(def.workspaceRoute)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-500/20 bg-white/[0.04]',
                    'text-xs font-medium text-slate-200 hover:bg-white/[0.08] transition-colors',
                    !def.workspaceRoute && 'cursor-default',
                  )}
                >
                  <span
                    className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                    style={{ background: def.colorHex }}
                  >
                    {def.logoLetter[0]}
                  </span>
                  {def.name}
                  {def.workspaceRoute && <ExternalLink className="w-3 h-3 text-slate-500" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category tabs */}
        <div className="flex gap-1 flex-wrap">
          {CATEGORY_TABS.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                activeCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/[0.05] text-slate-400 hover:text-slate-200 hover:bg-white/[0.09]',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* App list */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-sm">
            No apps found{search ? ` for "${search}"` : ''}.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(({ def, status }) => (
              <AppCard
                key={def.appId}
                app={def}
                status={status}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onOpenWorkspace={handleOpenWorkspace}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
