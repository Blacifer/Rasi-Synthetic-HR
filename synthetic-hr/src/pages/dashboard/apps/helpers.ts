import { useEffect } from 'react';
import type { MarketplaceApp } from '../../../lib/api-client';
import type { UnifiedApp, TrustTier, Maturity, GuardrailStatus } from './types';
import { LOGO_DOMAINS } from './constants';

// ─── Color helpers ──────────────────────────────────────────────────────────

function hashColor(s: string): string {
  const P = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4','#EC4899','#6366F1','#84CC16','#F97316'];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return P[h % P.length];
}

export function appColor(id: string, raw?: string): string {
  if (raw && /^#[0-9a-f]{3,6}$/i.test(raw)) return raw;
  const k = id.toLowerCase();
  if (k.includes('slack'))                              return '#4A154B';
  if (k.includes('linkedin'))                          return '#0A66C2';
  if (k.includes('google') || k.includes('gmail'))     return '#EA4335';
  if (k.includes('microsoft') || k.includes('teams'))  return '#0078D4';
  if (k.includes('hubspot'))                           return '#FF7A59';
  if (k.includes('jira') || k.includes('atlassian'))   return '#0052CC';
  if (k.includes('zendesk'))                           return '#03363D';
  if (k.includes('freshdesk'))                         return '#0070C0';
  if (k.includes('naukri'))                            return '#FF7555';
  if (k.includes('stripe'))                            return '#635BFF';
  if (k.includes('razorpay'))                          return '#2D81E0';
  if (k.includes('paytm'))                             return '#002970';
  if (k.includes('salesforce'))                        return '#00A1E0';
  if (k.includes('quickbooks'))                        return '#2CA01C';
  if (k.includes('zoho'))                              return '#E42527';
  if (k.includes('tally'))                             return '#FF6600';
  if (k.includes('mailchimp'))                         return '#FFE01B';
  return hashColor(id);
}

// ─── Logo URL ───────────────────────────────────────────────────────────────

export function getLogoUrl(appId: string): string | null {
  const domain = LOGO_DOMAINS[appId.toLowerCase()];
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
}

// ─── Data transforms ────────────────────────────────────────────────────────

export function fromMarketplaceApp(app: MarketplaceApp): UnifiedApp {
  const status =
    app.connectionStatus === 'error'   ? 'error'
    : app.connectionStatus === 'expired' ? 'expired'
    : app.connectionStatus === 'syncing' ? 'syncing'
    : app.installed                      ? 'connected'
    : 'disconnected' as const;
  return {
    id: `app:${app.id}`,
    appId: app.id,
    name: app.name,
    description: app.description,
    category: app.category,
    source: 'marketplace',
    connectionType: app.installMethod === 'oauth2' ? 'oauth_connector' : 'native_connector',
    logoLetter: app.logoLetter,
    colorHex: app.colorHex,
    badge: app.badge,
    installCount: app.installCount,
    comingSoon: !!app.comingSoon,
    connected: !!app.installed,
    status,
    lastErrorMsg: app.lastErrorMsg,
    authType: app.installMethod,
    requiredFields: app.requiredFields,
    permissions: app.permissions,
    actionsUnlocked: app.actionsUnlocked,
    setupTimeMinutes: app.setupTimeMinutes,
    developer: app.developer,
    featured: app.featured,
    trustTier: app.category === 'finance' || app.category === 'it' || app.category === 'compliance'
      ? 'high-trust-operational'
      : app.actionsUnlocked?.length
        ? 'controlled-write'
        : 'observe-only',
    maturity: app.installed ? (app.actionsUnlocked?.length ? 'action-ready' : 'read-ready') : 'connected',
    governanceSummary: {
      readCount: app.permissions?.length || 0,
      actionCount: app.actionsUnlocked?.length || 0,
      enabledActionCount: app.actionsUnlocked?.length || 0,
    },
    appData: app,
  };
}

export function fromIntegration(row: any): UnifiedApp {
  const raw = row.lifecycleStatus || row.status || 'disconnected';
  const status =
    raw === 'connected'                      ? 'connected'
    : raw === 'syncing'                      ? 'syncing'
    : raw === 'error'                        ? 'error'
    : raw === 'expired' || row.tokenExpired  ? 'expired'
    : 'disconnected' as const;
  return {
    id: `int:${row.id}`,
    appId: row.id,
    name: row.name,
    description: row.description || '',
    category: row.category || 'it',
    source: 'integration',
    connectionType: row.connectionType || (row.authType === 'oauth2' ? 'oauth_connector' : 'native_connector'),
    logoLetter: (row.name || '?')[0].toUpperCase(),
    colorHex: appColor(row.id, row.color),
    badge: row.specStatus === 'COMING_SOON' ? undefined : row.badge,
    installCount: 0,
    comingSoon: row.specStatus === 'COMING_SOON',
    connected: status === 'connected',
    status,
    lastErrorMsg: row.lastErrorMsg,
    authType: row.authType === 'oauth2' ? 'oauth2' : 'api_key',
    requiredFields: row.requiredFields,
    permissions: row.capabilities?.reads?.map((r: string) => `Read: ${r}`) || [],
    actionsUnlocked: row.capabilities?.writes?.map((w: any) => w.label) || [],
    trustTier: row.trustTier || 'observe-only',
    maturity: row.maturity || 'connected',
    governanceSummary: row.governanceSummary,
    wave: row.wave,
    wave1GuardrailsStatus: row.wave1GuardrailsStatus,
    wave1GuardrailsApplied: row.wave1GuardrailsApplied,
    wave1GuardrailsTotal: row.wave1GuardrailsTotal,
    integrationData: row,
  };
}

export function getAppServiceId(app: UnifiedApp) {
  return app.integrationData?.id || app.appData?.id || app.appId;
}

// ─── Date formatting ────────────────────────────────────────────────────────

export function fmtDate(v?: string | null) {
  if (!v) return '—';
  return new Date(v).toLocaleString();
}

// ─── Tone helpers (badge styling) ───────────────────────────────────────────

export function trustTierTone(tier?: TrustTier) {
  if (tier === 'high-trust-operational') return 'border-rose-400/25 bg-rose-500/10 text-rose-200';
  if (tier === 'controlled-write') return 'border-amber-400/25 bg-amber-500/10 text-amber-200';
  return 'border-white/10 bg-white/5 text-slate-300';
}

export function maturityTone(maturity?: Maturity) {
  if (maturity === 'governed') return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200';
  if (maturity === 'action-ready') return 'border-blue-400/25 bg-blue-500/10 text-blue-200';
  if (maturity === 'read-ready') return 'border-violet-400/25 bg-violet-500/10 text-violet-200';
  return 'border-white/10 bg-white/5 text-slate-300';
}

export function guardrailTone(status?: GuardrailStatus) {
  if (status === 'applied') return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200';
  if (status === 'partial') return 'border-amber-400/25 bg-amber-500/10 text-amber-200';
  if (status === 'missing') return 'border-rose-400/25 bg-rose-500/10 text-rose-200';
  return 'border-white/10 bg-white/5 text-slate-300';
}

// ─── Outside click hook ─────────────────────────────────────────────────────

export function useOutsideClick(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [ref, cb]);
}

// ─── Domain detector helpers ────────────────────────────────────────────────

export function financeConnectorMode(connectorId?: string | null): 'razorpay' | 'paytm' | null {
  const value = String(connectorId || '').toLowerCase();
  if (value.includes('razorpay')) return 'razorpay';
  if (value.includes('paytm')) return 'paytm';
  return null;
}

export function isTallyConnector(connectorId?: string | null) {
  return String(connectorId || '').toLowerCase().includes('tally');
}

export function isClearTaxConnector(connectorId?: string | null) {
  return String(connectorId || '').toLowerCase().includes('cleartax');
}

export function isNaukriConnector(connectorId?: string | null) {
  return String(connectorId || '').toLowerCase().includes('naukri');
}

export function isSlackRail(connectorId?: string | null) {
  return String(connectorId || '').toLowerCase().includes('slack');
}
