import { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Gavel,
  HandCoins,
  Headset,
  Key,
  Loader2,
  Search,
  Shield,
  ShoppingBag,
  Star,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { api, type MarketplaceApp } from '../../lib/api-client';
import { toast } from '../../lib/toast';
import { cn } from '../../lib/utils';

interface MarketplacePageProps {
  onNavigate?: (page: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Apps',
  finance: 'Finance',
  support: 'Support',
  sales: 'Sales',
  it: 'IT / Identity',
  compliance: 'Compliance',
  recruitment: 'Recruitment',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  all: ShoppingBag,
  finance: HandCoins,
  support: Headset,
  sales: Building2,
  it: Wrench,
  compliance: Gavel,
  recruitment: BriefcaseBusiness,
};

const CATEGORY_COLOR: Record<string, string> = {
  finance: 'text-rose-300',
  support: 'text-blue-300',
  sales: 'text-emerald-300',
  it: 'text-amber-300',
  compliance: 'text-sky-300',
  recruitment: 'text-violet-300',
};

const BADGE_STYLE: Record<string, string> = {
  Popular: 'bg-blue-500/15 border-blue-400/25 text-blue-200',
  Verified: 'bg-emerald-500/15 border-emerald-400/25 text-emerald-200',
  'India Priority': 'bg-amber-500/15 border-amber-400/25 text-amber-200',
  New: 'bg-violet-500/15 border-violet-400/25 text-violet-200',
};

function AppLogo({ app }: { app: MarketplaceApp }) {
  return (
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-white font-bold text-lg shadow-sm"
      style={{ backgroundColor: app.colorHex }}
    >
      {app.logoLetter}
    </div>
  );
}

function InstallPanel({
  app,
  onClose,
  onInstalled,
}: {
  app: MarketplaceApp;
  onClose: () => void;
  onInstalled: (appId: string) => void;
}) {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const res = await api.marketplace.install(app.id, credentials);
      if (!res.success) throw new Error((res as any).error || 'Install failed');
      if (res.data?.oauth) {
        toast.info(`OAuth flow for ${app.name} — opening authorization…`);
        // OAuth: in production redirect to partner. Show informational message here.
        onInstalled(app.id);
      } else {
        toast.success(`${app.name} installed successfully`);
        onInstalled(app.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Installation failed');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/95 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <AppLogo app={app} />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-base font-bold text-white">{app.name}</p>
                {app.badge && (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', BADGE_STYLE[app.badge] || BADGE_STYLE['Verified'])}>
                    {app.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">by {app.developer}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Description */}
          <p className="text-sm text-slate-300">{app.description}</p>

          {/* Permissions */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Permissions Requested</p>
            <ul className="space-y-1.5">
              {app.permissions.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-slate-300">
                  <Shield className="w-3.5 h-3.5 text-blue-300 mt-0.5 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Related agents */}
          {app.relatedAgentIds.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Works With</p>
              <div className="flex flex-wrap gap-1.5">
                {app.relatedAgentIds.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-blue-400/20 bg-blue-500/10 text-blue-200">
                    <Bot className="w-3 h-3" />
                    {id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Credentials form for api_key apps */}
          {app.installMethod === 'api_key' && app.requiredFields && app.requiredFields.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Key className="w-3 h-3" /> Credentials
              </p>
              <div className="space-y-3">
                {app.requiredFields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-xs text-slate-400 mb-1">
                      {field.label}{field.required && <span className="text-rose-400 ml-0.5">*</span>}
                    </label>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={credentials[field.name] || ''}
                      onChange={(e) => setCredentials((prev) => ({ ...prev, [field.name]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-white/10 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OAuth notice */}
          {app.installMethod === 'oauth2' && (
            <div className="rounded-xl border border-blue-400/15 bg-blue-500/[0.05] px-4 py-3 flex items-start gap-3">
              <ExternalLink className="w-4 h-4 text-blue-300 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-300">
                You'll be redirected to <strong className="text-white">{app.developer}</strong> to authorize access. No credentials stored manually.
              </p>
            </div>
          )}

          {/* Free notice */}
          {app.installMethod === 'free' && (
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.05] px-4 py-3 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-300 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-300">No credentials required — this app installs instantly.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 text-sm font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handleInstall}
            disabled={installing}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
          >
            {installing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Installing…</>
            ) : app.installMethod === 'oauth2' ? (
              <><ExternalLink className="w-4 h-4" /> Authorize with {app.name}</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> Install App</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function AppCard({
  app,
  onInstall,
  onUninstall,
}: {
  app: MarketplaceApp;
  onInstall: (app: MarketplaceApp) => void;
  onUninstall: (app: MarketplaceApp) => void;
}) {
  const [uninstalling, setUninstalling] = useState(false);
  const CatIcon = CATEGORY_ICONS[app.category] || ShoppingBag;
  const catColor = CATEGORY_COLOR[app.category] || 'text-slate-300';

  const handleUninstall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setUninstalling(true);
    try {
      const res = await api.marketplace.uninstall(app.id);
      if (!res.success) throw new Error((res as any).error || 'Uninstall failed');
      toast.success(`${app.name} uninstalled`);
      onUninstall(app);
    } catch (err: any) {
      toast.error(err.message || 'Uninstall failed');
    } finally {
      setUninstalling(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] p-5 flex flex-col gap-4 transition-colors">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <AppLogo app={app} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-white">{app.name}</p>
            {app.badge && (
              <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', BADGE_STYLE[app.badge] || BADGE_STYLE['Verified'])}>
                {app.badge}
              </span>
            )}
            {app.installed && (
              <span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-400/25 text-emerald-200 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Installed
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{app.developer}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <CatIcon className={cn('w-3 h-3', catColor)} />
            <span className={cn('text-xs font-medium', catColor)}>{CATEGORY_LABELS[app.category] || app.category}</span>
            <span className="text-slate-600 text-xs">·</span>
            <Star className="w-3 h-3 text-amber-400" />
            <span className="text-xs text-slate-400">{app.installCount.toLocaleString()} installs</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{app.description}</p>

      {/* Related agents */}
      {app.relatedAgentIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {app.relatedAgentIds.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md border border-blue-400/15 bg-blue-500/10 text-blue-300">
              <Bot className="w-2.5 h-2.5" />
              {id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
          ))}
        </div>
      )}

      {/* Action */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        {app.installed ? (
          <>
            <span className="flex-1 text-xs text-slate-500 flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-400" /> Active in your workspace
            </span>
            <button
              onClick={handleUninstall}
              disabled={uninstalling}
              className="text-xs text-slate-500 hover:text-rose-300 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              {uninstalling ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              Remove
            </button>
          </>
        ) : (
          <button
            onClick={() => onInstall(app)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/15 border border-blue-400/25 text-blue-200 hover:bg-blue-500/25 transition-colors text-xs font-semibold"
          >
            Install <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function MarketplacePage({ onNavigate }: MarketplacePageProps) {
  const [apps, setApps] = useState<MarketplaceApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [installTarget, setInstallTarget] = useState<MarketplaceApp | null>(null);
  const [showInstalled, setShowInstalled] = useState(false);

  const loadApps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.marketplace.getAll();
      if (res.success && Array.isArray(res.data)) {
        setApps(res.data);
      }
    } catch {
      // silent — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  const handleInstalled = (appId: string) => {
    setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, installed: true } : a)));
    setInstallTarget(null);
  };

  const handleUninstalled = (app: MarketplaceApp) => {
    setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, installed: false } : a)));
  };

  const installedApps = apps.filter((a) => a.installed);
  const featuredApps = apps.filter((a) => a.featured && !a.installed);

  const filtered = apps.filter((a) => {
    const matchCat = activeCategory === 'all' || a.category === activeCategory;
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <ShoppingBag className="w-6 h-6 text-blue-300" />
          <h1 className="text-2xl font-bold text-white">Partner Marketplace</h1>
        </div>
        <p className="text-slate-400 text-sm">
          Connect third-party platforms to Rasi. Every installed app is governed, monitored, and covered by your action policies.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search apps…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm"
        />
      </div>

      {/* Installed apps (collapsible) */}
      {installedApps.length > 0 && (
        <section>
          <button
            onClick={() => setShowInstalled((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-white mb-3"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            Installed Apps ({installedApps.length})
            {showInstalled ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showInstalled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {installedApps.map((app) => (
                <AppCard key={app.id} app={app} onInstall={setInstallTarget} onUninstall={handleUninstalled} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Featured */}
      {!search && activeCategory === 'all' && featuredApps.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-300" />
            <h2 className="text-base font-semibold text-white">Featured</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {featuredApps.map((app) => (
              <AppCard key={app.id} app={app} onInstall={setInstallTarget} onUninstall={handleUninstalled} />
            ))}
          </div>
        </section>
      )}

      {/* Category tabs + All apps grid */}
      <section>
        <div className="flex flex-wrap gap-2 mb-5">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const Icon = CATEGORY_ICONS[key];
            const isActive = activeCategory === key;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
                  isActive
                    ? 'border-blue-400/40 bg-blue-500/15 text-blue-200'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No apps found{search ? ` for "${search}"` : ''}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((app) => (
              <AppCard key={app.id} app={app} onInstall={setInstallTarget} onUninstall={handleUninstalled} />
            ))}
          </div>
        )}
      </section>

      {/* Footer CTA */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex items-center gap-5">
        <Shield className="w-8 h-8 text-slate-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">All apps are governed by Rasi</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Every installed app operates within your Action Policies and is subject to incident detection and cost monitoring.
          </p>
        </div>
        <button
          onClick={() => onNavigate?.('action-policies')}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold transition-colors"
        >
          Manage Policies <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Install modal */}
      {installTarget && (
        <InstallPanel
          app={installTarget}
          onClose={() => setInstallTarget(null)}
          onInstalled={handleInstalled}
        />
      )}
    </div>
  );
}
