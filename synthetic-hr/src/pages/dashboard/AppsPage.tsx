import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, X, CheckCircle2, AlertCircle, Loader2, ExternalLink,
  ChevronDown, ChevronRight, Key, Zap, Shield,
  HandCoins, Users, Headset, TrendingUp, Wrench, Gavel, Briefcase,
  Megaphone, Layers,
} from 'lucide-react';
import { api, type MarketplaceApp } from '../../lib/api-client';
import { toast } from '../../lib/toast';
import { cn } from '../../lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type AppStatus = 'connected' | 'syncing' | 'error' | 'expired' | 'disconnected';

interface UnifiedApp {
  id: string;
  appId: string;
  name: string;
  description: string;
  category: string;
  logoLetter: string;
  colorHex: string;
  badge?: string;
  connected: boolean;
  status: AppStatus;
  authType: 'free' | 'api_key' | 'oauth2';
  requiredFields?: Array<{ name: string; label: string; type: 'text' | 'password'; placeholder?: string; required: boolean }>;
  permissions?: string[];
  actionsUnlocked?: string[];
  developer?: string;
  featured?: boolean;
  comingSoon?: boolean;
  source: 'marketplace' | 'integration';
  rawApp?: MarketplaceApp;
}

interface Category {
  id: string;
  label: string;
  icon: React.ElementType;
  hubRoute: string | null;
  hubLabel: string | null;
  apiCategory: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  { id: 'finance',     label: 'Finance & Payments',   icon: HandCoins,  hubRoute: 'finance-hub',    hubLabel: 'Finance Hub',      apiCategory: 'finance' },
  { id: 'hr',          label: 'HR & People',           icon: Users,      hubRoute: 'hr-hub',         hubLabel: 'HR Hub',           apiCategory: 'hr' },
  { id: 'support',     label: 'Support & CX',          icon: Headset,    hubRoute: 'support-hub',    hubLabel: 'Support Hub',      apiCategory: 'support' },
  { id: 'sales',       label: 'Sales & CRM',           icon: TrendingUp, hubRoute: 'sales-hub',      hubLabel: 'Sales Hub',        apiCategory: 'sales' },
  { id: 'it',          label: 'IT & Security',         icon: Wrench,     hubRoute: 'it-hub',         hubLabel: 'IT Hub',           apiCategory: 'it' },
  { id: 'compliance',  label: 'Compliance & Legal',    icon: Gavel,      hubRoute: 'compliance-hub', hubLabel: 'Compliance Hub',   apiCategory: 'compliance' },
  { id: 'recruitment', label: 'Recruitment & Hiring',  icon: Briefcase,  hubRoute: 'recruitment',    hubLabel: 'Recruitment Hub',  apiCategory: 'recruitment' },
  { id: 'marketing',   label: 'Marketing',             icon: Megaphone,  hubRoute: 'marketing-hub',  hubLabel: 'Marketing Hub',    apiCategory: 'marketing' },
  { id: 'productivity',label: 'Productivity',          icon: Layers,     hubRoute: null,             hubLabel: null,               apiCategory: 'productivity' },
];

const FEATURED_IDS = ['slack', 'google-workspace', 'zoho-people', 'quickbooks', 'hubspot', 'naukri'];

// ─── Logo domains (Clearbit logo API) ────────────────────────────────────────

const LOGO_DOMAINS: Record<string, string> = {
  'slack':            'slack.com',
  'google-workspace': 'google.com',
  'microsoft-365':    'microsoft.com',
  'quickbooks':       'quickbooks.intuit.com',
  'hubspot':          'hubspot.com',
  'naukri':           'naukri.com',
  'stripe':           'stripe.com',
  'razorpay':         'razorpay.com',
  'xero':             'xero.com',
  'tally':            'tallysolutions.com',
  'paytm':            'paytm.com',
  'zoho-people':      'zoho.com',
  'zoho-books':       'zoho.com',
  'zoho-crm':         'zoho.com',
  'zendesk':          'zendesk.com',
  'freshdesk':        'freshdesk.com',
  'intercom':         'intercom.com',
  'salesforce':       'salesforce.com',
  'pipedrive':        'pipedrive.com',
  'okta':             'okta.com',
  'jira':             'atlassian.com',
  'servicenow':       'servicenow.com',
  'jumpcloud':        'jumpcloud.com',
  'cleartax':         'cleartax.in',
  'diligent':         'diligent.com',
  'signdesk':         'signdesk.com',
  'linkedin':         'linkedin.com',
  'greenhouse':       'greenhouse.io',
  'lever':            'lever.co',
  'mailchimp':        'mailchimp.com',
  'klaviyo':          'klaviyo.com',
  'brevo':            'brevo.com',
  'google-ads':       'google.com',
  'meta-ads':         'meta.com',
  'darwinbox':        'darwinbox.com',
  'keka':             'keka.com',
  'greythr':          'greythr.com',
  'bamboohr':         'bamboohr.com',
};

function getLogoUrl(appId: string): string | null {
  const domain = LOGO_DOMAINS[appId.toLowerCase()];
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashColor(id: string): string {
  const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#a855f7'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

function appColor(id: string, raw?: string): string {
  if (raw && /^#[0-9a-f]{3,6}$/i.test(raw)) return raw;
  const k = id.toLowerCase();
  if (k.includes('slack'))       return '#4A154B';
  if (k.includes('google'))      return '#EA4335';
  if (k.includes('microsoft'))   return '#0078D4';
  if (k.includes('hubspot'))     return '#FF7A59';
  if (k.includes('jira'))        return '#0052CC';
  if (k.includes('zendesk'))     return '#03363D';
  if (k.includes('freshdesk'))   return '#0070C0';
  if (k.includes('naukri'))      return '#FF7555';
  if (k.includes('stripe'))      return '#635BFF';
  if (k.includes('razorpay'))    return '#2D81E0';
  if (k.includes('linkedin'))    return '#0A66C2';
  if (k.includes('salesforce'))  return '#00A1E0';
  if (k.includes('quickbooks'))  return '#2CA01C';
  if (k.includes('zoho'))        return '#E42527';
  if (k.includes('tally'))       return '#FF6600';
  if (k.includes('mailchimp'))   return '#FFE01B';
  return hashColor(id);
}

function fromApp(app: MarketplaceApp): UnifiedApp {
  const status: AppStatus =
    app.connectionStatus === 'error'   ? 'error'
    : app.connectionStatus === 'expired' ? 'expired'
    : app.connectionStatus === 'syncing' ? 'syncing'
    : app.installed                      ? 'connected'
    : 'disconnected';
  return {
    id: `app:${app.id}`,
    appId: app.id,
    name: app.name,
    description: app.description,
    category: app.category?.toLowerCase() || 'productivity',
    logoLetter: app.logoLetter || app.name[0].toUpperCase(),
    colorHex: app.colorHex || appColor(app.id),
    badge: app.badge,
    connected: !!app.installed,
    status,
    authType: app.installMethod,
    requiredFields: app.requiredFields,
    permissions: app.permissions,
    actionsUnlocked: app.actionsUnlocked,
    developer: app.developer,
    featured: app.featured,
    comingSoon: !!app.comingSoon,
    source: 'marketplace',
    rawApp: app,
  };
}

function fromIntegration(row: any): UnifiedApp {
  const raw = row.lifecycleStatus || row.status || 'disconnected';
  const status: AppStatus =
    raw === 'connected' ? 'connected'
    : raw === 'syncing' ? 'syncing'
    : raw === 'error'   ? 'error'
    : raw === 'expired' ? 'expired'
    : 'disconnected';
  return {
    id: `int:${row.id}`,
    appId: row.id,
    name: row.name,
    description: row.description || '',
    category: (row.category || 'it').toLowerCase(),
    logoLetter: (row.name || '?')[0].toUpperCase(),
    colorHex: appColor(row.id, row.color),
    connected: status === 'connected',
    status,
    authType: row.authType === 'oauth2' ? 'oauth2' : 'api_key',
    requiredFields: row.requiredFields,
    permissions: row.capabilities?.reads?.map((r: string) => `Read: ${r}`) || [],
    actionsUnlocked: row.capabilities?.writes?.map((w: any) => w.label) || [],
    comingSoon: row.specStatus === 'COMING_SOON',
    source: 'integration',
  };
}

// ─── App Card ─────────────────────────────────────────────────────────────────

function AppLogo({ appId, logoLetter, colorHex, size = 12 }: { appId: string; logoLetter: string; colorHex: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = getLogoUrl(appId);
  const dim = `w-${size} h-${size}`;
  if (url && !failed) {
    return (
      <div
        className={`${dim} rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden`}
        style={{ backgroundColor: colorHex }}
      >
        <img
          src={url}
          alt=""
          className="w-3/4 h-3/4 object-contain drop-shadow-sm"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }
  return (
    <div
      className={`${dim} rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ backgroundColor: colorHex, fontSize: size >= 12 ? '1.125rem' : '0.875rem' }}
    >
      {logoLetter}
    </div>
  );
}

function AppCard({ app, onClick }: { app: UnifiedApp; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={app.comingSoon}
      className="group w-full text-left rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-150 p-4 flex flex-col gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {/* Logo */}
      <AppLogo appId={app.appId} logoLetter={app.logoLetter} colorHex={app.colorHex} size={12} />

      {/* Meta */}
      <div className="space-y-1 flex-1 min-w-0">
        {app.badge && (
          <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/20 mb-1">
            {app.badge}
          </span>
        )}
        <p className="font-semibold text-white text-sm leading-tight truncate">{app.name}</p>
        <p className="text-xs text-slate-500 leading-snug line-clamp-2">{app.description}</p>
      </div>

      {/* Status */}
      {app.connected && (
        <div className="flex items-center gap-1.5">
          {app.status === 'error' ? (
            <AlertCircle className="w-3 h-3 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          )}
          <span className={cn('text-[11px] font-medium', app.status === 'error' ? 'text-rose-400' : 'text-emerald-400')}>
            {app.status === 'error' ? 'Error' : 'Connected'}
          </span>
        </div>
      )}
    </button>
  );
}

// ─── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  app,
  onClose,
  onConnect,
  onDisconnect,
  onNavigate,
}: {
  app: UnifiedApp;
  onClose: () => void;
  onConnect: (app: UnifiedApp, creds: Record<string, string>) => Promise<void>;
  onDisconnect: (app: UnifiedApp) => Promise<void>;
  onNavigate?: (page: string) => void;
}) {
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const cat = CATEGORIES.find((c) => c.apiCategory === app.category);

  const handleConnect = async () => {
    setBusy(true);
    try { await onConnect(app, creds); }
    finally { setBusy(false); }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try { await onDisconnect(app); }
    finally { setBusy(false); }
  };

  return (
    <div className="w-80 shrink-0 border-l border-white/[0.08] bg-[#080f1a] flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <AppLogo appId={app.appId} logoLetter={app.logoLetter} colorHex={app.colorHex} size={10} />
          <div>
            <p className="font-semibold text-white text-sm">{app.name}</p>
            {app.developer && <p className="text-xs text-slate-500">{app.developer}</p>}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 p-5 space-y-5">
        {/* Description */}
        <p className="text-sm text-slate-400 leading-relaxed">{app.description}</p>

        {/* Connection status */}
        {app.connected && (
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
            app.status === 'error' ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
          )}>
            {app.status === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {app.status === 'error' ? 'Connection error — reconfigure below' : 'Connected and active'}
          </div>
        )}

        {/* Hub link */}
        {cat?.hubRoute && (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.07]">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Powers</p>
              <p className="text-sm text-white font-medium mt-0.5">{cat.hubLabel}</p>
            </div>
            <button
              onClick={() => onNavigate?.(cat.hubRoute!)}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
            >
              Open <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* What you can do */}
        {(app.actionsUnlocked?.length || app.permissions?.length) ? (
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">What you can do</p>
            <ul className="space-y-1.5">
              {app.actionsUnlocked?.slice(0, 4).map((a) => (
                <li key={a} className="flex items-start gap-2 text-xs text-slate-300">
                  <Zap className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                  {a}
                </li>
              ))}
              {app.permissions?.slice(0, 3).map((p) => (
                <li key={p} className="flex items-start gap-2 text-xs text-slate-400">
                  <Shield className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Connect form */}
        {!app.comingSoon && (
          <div className="space-y-3">
            {!app.connected && app.authType === 'api_key' && app.requiredFields && (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                  <Key className="w-3 h-3" /> Credentials
                </p>
                {app.requiredFields.map((f) => (
                  <div key={f.name}>
                    <label className="text-xs text-slate-400 block mb-1">{f.label}</label>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={creds[f.name] || ''}
                      onChange={(e) => setCreds((p) => ({ ...p, [f.name]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white text-xs placeholder:text-slate-600 outline-none focus:border-cyan-500/40 transition-colors"
                    />
                  </div>
                ))}
              </div>
            )}

            {!app.connected && app.authType === 'oauth2' && (
              <div className="px-3 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
                You'll be redirected to {app.name} to authorize access.
              </div>
            )}

            {/* Action buttons */}
            {app.connected ? (
              <div className="flex gap-2 pt-1">
                {app.authType === 'api_key' && (
                  <button
                    onClick={handleConnect}
                    disabled={busy}
                    className="flex-1 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                  >
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Reconfigure
                  </button>
                )}
                <button
                  onClick={handleDisconnect}
                  disabled={busy}
                  className="flex-1 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                >
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {app.authType === 'oauth2' ? `Connect with ${app.name}` : 'Connect'}
              </button>
            )}
          </div>
        )}

        {app.comingSoon && (
          <div className="px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 text-center">
            Coming soon — we'll notify you when it's ready.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface AppsPageProps {
  onNavigate?: (page: string) => void;
}

export default function AppsPage({ onNavigate }: AppsPageProps) {
  const [searchParams] = useSearchParams();
  const [apps, setApps] = useState<UnifiedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null); // null = overview
  const [showMyApps, setShowMyApps] = useState(false);
  const [showCategories, setShowCategories] = useState(true);
  const [selectedApp, setSelectedApp] = useState<UnifiedApp | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [appsRes, intsRes] = await Promise.all([
        api.marketplace.getAll(),
        api.integrations.getAll(),
      ]);
      const marketplaceApps: UnifiedApp[] = appsRes.success && Array.isArray(appsRes.data)
        ? appsRes.data.map(fromApp) : [];
      const integrationApps: UnifiedApp[] = intsRes.success && Array.isArray(intsRes.data)
        ? intsRes.data.map(fromIntegration) : [];

      // Deduplicate: prefer marketplace over integration for same service
      const marketplaceIds = new Set(marketplaceApps.map((a) => a.appId));
      const dedupedInts = integrationApps.filter((a) => !marketplaceIds.has(a.appId));
      setApps([...marketplaceApps, ...dedupedInts]);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Handle OAuth redirect back: ?marketplace_connected=true&marketplace_app=hubspot
  useEffect(() => {
    const connected = searchParams.get('marketplace_connected') === 'true';
    const appName = searchParams.get('marketplace_app');
    if (connected && appName) {
      toast.success(`${appName.charAt(0).toUpperCase() + appName.slice(1)} connected successfully`);
      void loadData();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = useCallback(async (app: UnifiedApp, creds: Record<string, string>) => {
    try {
      let res;
      if (app.source === 'marketplace') {
        res = await api.marketplace.install(app.appId, creds);
        if (res.success && res.data?.authUrl) {
          window.location.href = res.data.authUrl;
          return;
        }
      } else {
        res = await api.integrations.connect(app.appId, creds);
      }
      if (res?.success) {
        toast.success(`${app.name} connected`);
        setApps((prev) => prev.map((a) => a.id === app.id ? { ...a, connected: true, status: 'connected' } : a));
        setSelectedApp((prev) => prev?.id === app.id ? { ...prev, connected: true, status: 'connected' } : prev);
      } else {
        toast.error(res?.error || 'Connection failed');
      }
    } catch (e: any) { toast.error(e?.message || 'Connection failed'); }
  }, []);

  const handleDisconnect = useCallback(async (app: UnifiedApp) => {
    if (!confirm(`Disconnect ${app.name}?`)) return;
    try {
      let res;
      if (app.source === 'marketplace') {
        res = await api.marketplace.uninstall(app.appId);
      } else {
        res = await api.integrations.disconnect(app.appId);
      }
      if (res?.success) {
        toast.success(`${app.name} disconnected`);
        setApps((prev) => prev.map((a) => a.id === app.id ? { ...a, connected: false, status: 'disconnected' } : a));
        setSelectedApp((prev) => prev?.id === app.id ? { ...prev, connected: false, status: 'disconnected' } : prev);
      } else {
        toast.error(res?.error || 'Disconnect failed');
      }
    } catch (e: any) { toast.error(e?.message || 'Disconnect failed'); }
  }, []);

  const filtered = useMemo(() => {
    let list = apps;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
    }
    return list;
  }, [apps, search]);

  const myApps = useMemo(() => filtered.filter((a) => a.connected), [filtered]);
  const featured = useMemo(() => FEATURED_IDS.map((id) => filtered.find((a) => a.appId === id)).filter(Boolean) as UnifiedApp[], [filtered]);

  const categoryApps = useCallback((cat: Category) =>
    filtered.filter((a) => a.category === cat.apiCategory), [filtered]);

  const isMyAppsView = showMyApps && !selectedCat;
  const displayCats = selectedCat ? CATEGORIES.filter((c) => c.id === selectedCat) : CATEGORIES;

  return (
    <div className="flex h-full overflow-hidden bg-[#080f1a]">
      {/* ── Left sidebar ── */}
      <div className="w-56 shrink-0 border-r border-white/[0.08] flex flex-col bg-[#080f1a] overflow-y-auto">
        {/* Search */}
        <div className="p-3 border-b border-white/[0.06]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find apps..."
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/30 transition-colors"
            />
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {/* Apps overview */}
          <button
            onClick={() => { setSelectedCat(null); setShowMyApps(false); }}
            className={cn('nav-item w-full text-left', !selectedCat && !showMyApps && 'nav-item-active')}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-sm">Apps overview</span>
          </button>

          {/* My apps */}
          <button
            onClick={() => { setShowMyApps((v) => !v); setSelectedCat(null); }}
            className={cn('nav-item w-full text-left', showMyApps && !selectedCat && 'nav-item-active')}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-sm">My apps</span>
            {myApps.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 font-semibold">
                {myApps.length}
              </span>
            )}
            <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 transition-transform', showMyApps && 'rotate-180')} />
          </button>

          {/* My apps expanded list */}
          {showMyApps && myApps.length > 0 && (
            <div className="pl-2 space-y-0.5 ml-1 border-l border-white/[0.06]">
              {myApps.slice(0, 8).map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedApp(a)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors text-left"
                >
                  <div className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: a.colorHex }}>
                    {a.logoLetter}
                  </div>
                  <span className="truncate">{a.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Categories */}
          <div className="pt-2">
            <button
              onClick={() => setShowCategories((v) => !v)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
            >
              <span className="flex-1 text-left">Categories</span>
              <ChevronDown className={cn('w-3 h-3 transition-transform', showCategories && 'rotate-180')} />
            </button>

            {showCategories && (
              <div className="space-y-0.5">
                <button
                  onClick={() => setSelectedCat(null)}
                  className={cn('nav-item w-full text-left text-sm', !selectedCat && !showMyApps && 'nav-item-active')}
                >
                  All apps
                </button>
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const count = apps.filter((a) => a.category === cat.apiCategory && a.connected).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { setSelectedCat(cat.id); setShowMyApps(false); }}
                      className={cn('nav-item w-full text-left', selectedCat === cat.id && 'nav-item-active')}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-sm truncate">{cat.label}</span>
                      {count > 0 && (
                        <span className="text-[10px] w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-semibold shrink-0">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-8 max-w-5xl">

          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-white">
              {isMyAppsView ? 'My apps' : selectedCat ? CATEGORIES.find((c) => c.id === selectedCat)?.label : 'Apps'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isMyAppsView ? `${myApps.length} app${myApps.length !== 1 ? 's' : ''} connected` : 'Connect your tools. Work from one place.'}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
            </div>
          ) : isMyAppsView ? (
            /* My apps grid */
            myApps.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-sm">No apps connected yet.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {myApps.map((app) => (
                  <AppCard key={app.id} app={app} onClick={() => setSelectedApp(app)} />
                ))}
              </div>
            )
          ) : (
            <>
              {/* Featured — only on overview with no search/category filter */}
              {!selectedCat && !search && featured.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-white">Featured apps</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                    {featured.map((app) => (
                      <AppCard key={app.id} app={app} onClick={() => setSelectedApp(app)} />
                    ))}
                  </div>
                </section>
              )}

              {/* Category rows */}
              {displayCats.map((cat) => {
                const catApps = categoryApps(cat);
                if (catApps.length === 0) return null;
                const isExpanded = !!selectedCat;
                const shown = isExpanded ? catApps : catApps.slice(0, 4);
                const hiddenCount = catApps.length - shown.length;
                return (
                  <section key={cat.id}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <cat.icon className="w-4 h-4 text-slate-400" />
                        <h2 className="text-sm font-semibold text-white">{cat.label}</h2>
                        {cat.hubRoute && (
                          <button
                            onClick={() => onNavigate?.(cat.hubRoute!)}
                            className="text-[11px] text-cyan-500 hover:text-cyan-400 transition-colors flex items-center gap-0.5 font-medium"
                          >
                            Open {cat.hubLabel} <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {hiddenCount > 0 && (
                        <button
                          onClick={() => setSelectedCat(cat.id)}
                          className="text-xs text-slate-500 hover:text-white transition-colors flex items-center gap-1"
                        >
                          View all <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {shown.map((app) => (
                        <AppCard key={app.id} app={app} onClick={() => setSelectedApp(app)} />
                      ))}
                    </div>
                  </section>
                );
              })}

              {filtered.length === 0 && (
                <div className="text-center py-16 text-slate-500 text-sm">
                  No apps found{search ? ` for "${search}"` : ''}.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Right detail panel ── */}
      {selectedApp && (
        <DetailPanel
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
