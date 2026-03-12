import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../lib/api-client';
import { toast } from '../../lib/toast';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Fingerprint,
  Info,
  Link2,
  Mail,
  Shield,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

type CapabilityWrite = { id: string; label: string; risk: 'low' | 'medium' | 'high' | 'money' };
type Capabilities = { reads: string[]; writes: CapabilityWrite[] };

type RequiredField = {
  name: string;
  label: string;
  type: 'text' | 'password';
  placeholder?: string;
  required: boolean;
  description?: string;
};

type IntegrationRow = {
  id: string;
  name: string;
  category: string;
  description: string;
  authType: 'api_key' | 'oauth2' | string;
  tags: string[];
  color?: string;
  priority?: number;
  requiredFields: RequiredField[];
  capabilities?: Capabilities;
  status: 'disconnected' | 'connected' | 'error' | 'syncing' | 'expired' | string;
  lastSyncAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorMsg?: string | null;
  connectionId?: string | null;
};

type ConnectionLog = {
  id: string;
  action: string;
  status: string;
  message: string | null;
  metadata?: any;
  created_at: string;
};

type SampleCandidate = {
  id: string;
  source: string;
  full_name: string;
  headline: string;
  location: string;
  experience_years: number;
  skills: string[];
  match_score: number;
  summary: string;
  last_updated_at: string;
};

type SamplePullResponse = { candidates: SampleCandidate[]; jds: Array<{ id: string; title: string; location: string; seniority: string }> };

function statusTone(status: IntegrationRow['status']): 'connected' | 'pending' | 'error' | 'neutral' {
  if (status === 'connected') return 'connected';
  if (status === 'syncing') return 'pending';
  if (status === 'error' || status === 'expired') return 'error';
  return 'neutral';
}

const statusToneClasses: Record<ReturnType<typeof statusTone>, string> = {
  connected: 'border-emerald-400/20 bg-emerald-400/12 text-emerald-100',
  pending: 'border-amber-400/20 bg-amber-400/12 text-amber-100',
  error: 'border-rose-400/20 bg-rose-400/12 text-rose-100',
  neutral: 'border-white/10 bg-white/[0.05] text-slate-300',
};

function formatStatusLabel(status: IntegrationRow['status']): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'syncing':
      return 'Syncing';
    case 'expired':
      return 'Expired';
    case 'error':
      return 'Needs attention';
    default:
      return 'Disconnected';
  }
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function parseOAuthToastFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  const service = params.get('service');
  const message = params.get('message');

  if (!status) return;

  if (status === 'connected') {
    toast.success(`Connected ${service || 'integration'}.`);
  } else if (status === 'error') {
    toast.error(message ? String(message) : `Failed to connect ${service || 'integration'}.`);
  } else {
    toast.info('Integration flow updated.');
  }

  try {
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url.toString());
  } catch {
    // ignore
  }
}

function readLabel(readId: string): { label: string; icon: any } {
  switch (readId) {
    case 'candidate_profiles':
      return { label: 'Read candidates', icon: Users };
    case 'candidate_profiles_lite':
      return { label: 'Read profiles (lite)', icon: Users };
    case 'job_descriptions':
      return { label: 'Read jobs/JDs', icon: FileText };
    case 'user_profile':
      return { label: 'Identity', icon: Fingerprint };
    default:
      return { label: readId.replace(/_/g, ' '), icon: Database };
  }
}

function riskBadge(risk: CapabilityWrite['risk']) {
  switch (risk) {
    case 'low':
      return { label: 'Low', cls: 'border-white/10 bg-white/5 text-slate-200' };
    case 'medium':
      return { label: 'Medium', cls: 'border-amber-400/20 bg-amber-400/12 text-amber-200' };
    case 'high':
      return { label: 'High', cls: 'border-rose-400/20 bg-rose-400/12 text-rose-200' };
    case 'money':
      return { label: 'Money', cls: 'border-rose-400/25 bg-rose-400/15 text-rose-100' };
    default:
      return { label: '—', cls: 'border-white/10 bg-white/5 text-slate-200' };
  }
}

function providerIcon(id: string) {
  const key = id.toLowerCase();
  if (key.includes('google')) return Mail;
  if (key.includes('microsoft') || key.includes('teams')) return CalendarDays;
  if (key.includes('linkedin')) return Users;
  if (key.includes('naukri')) return Users;
  return Building2;
}

function Modal({
  title,
  children,
  onClose,
  widthClass = 'max-w-3xl',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  widthClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close modal" />
      <div className={`relative w-full ${widthClass} rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-300" />
            <h2 className="text-base font-semibold text-white">{title}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Drawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <button className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close drawer" />
      <div className="ml-auto w-full max-w-xl h-full border-l border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl relative">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-auto h-[calc(100%-64px)]">{children}</div>
      </div>
    </div>
  );
}

const RECRUITMENT_PROVIDER_IDS = ['naukri', 'linkedin', 'google_workspace', 'microsoft_365'] as const;
type RecruitmentProviderId = (typeof RECRUITMENT_PROVIDER_IDS)[number];

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<IntegrationRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logs, setLogs] = useState<ConnectionLog[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedNaukri, setSelectedNaukri] = useState(true);
  const [selectedLinkedIn, setSelectedLinkedIn] = useState(true);
  const [outreachChoice, setOutreachChoice] = useState<'google_workspace' | 'microsoft_365'>('google_workspace');
  const [governanceConfirmed, setGovernanceConfirmed] = useState(false);
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const [credentials, setCredentials] = useState<Record<string, Record<string, string>>>({});

  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [sampleCandidates, setSampleCandidates] = useState<SampleCandidate[]>([]);
  const [sampleJds, setSampleJds] = useState<SamplePullResponse['jds']>([]);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);

  const selectedIntegration = useMemo(() => {
    if (!activeProviderId) return null;
    return items.find((it) => it.id === activeProviderId) || null;
  }, [items, activeProviderId]);

  const recruitmentProviders = useMemo(() => items.filter((it) => RECRUITMENT_PROVIDER_IDS.includes(it.id as any)), [items]);
  const connectedRecruitmentCount = useMemo(
    () => recruitmentProviders.filter((it) => it.status === 'connected').length,
    [recruitmentProviders],
  );

  const selectedProviders = useMemo(() => {
    const list: RecruitmentProviderId[] = [];
    if (selectedNaukri) list.push('naukri');
    if (selectedLinkedIn) list.push('linkedin');
    list.push(outreachChoice);
    return list;
  }, [selectedNaukri, selectedLinkedIn, outreachChoice]);

  const providerMap = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);

  const activeCandidate = useMemo(() => {
    if (!activeCandidateId) return null;
    return sampleCandidates.find((c) => c.id === activeCandidateId) || null;
  }, [sampleCandidates, activeCandidateId]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    const res = await api.integrations.getAll();
    if (!res.success) {
      setItems([]);
      setLoadError(res.error || 'Failed to load integrations');
      setLoading(false);
      return;
    }
    setItems((res.data as IntegrationRow[]) || []);
    setLoading(false);
  }

  async function loadLogs(serviceId: string) {
    setLogsLoading(true);
    setLogsError(null);
    const res = await api.integrations.getLogs(serviceId, 20);
    if (!res.success) {
      setLogs([]);
      setLogsError(res.error || 'Failed to load connection history');
      setLogsLoading(false);
      return;
    }
    setLogs((res.data as ConnectionLog[]) || []);
    setLogsLoading(false);
  }

  const openDetails = async (providerId: string) => {
    setActiveProviderId(providerId);
    setDetailsOpen(true);
    await loadLogs(providerId);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setActiveProviderId(null);
    setLogs([]);
    setLogsError(null);
    setLogsLoading(false);
  };

  const openWizard = (step?: 1 | 2 | 3 | 4 | 5) => {
    setWizardOpen(true);
    setWizardStep(step || 1);
    setGovernanceConfirmed(false);
    setSampleError(null);
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setWizardStep(1);
    setSampleError(null);
  };

  const ensureCredentialSeed = (providerId: string) => {
    const provider = providerMap.get(providerId);
    if (!provider) return;
    if (provider.authType !== 'api_key') return;
    setCredentials((prev) => {
      if (prev[providerId]) return prev;
      const seed: Record<string, string> = {};
      provider.requiredFields.forEach((f) => {
        seed[f.name] = '';
      });
      return { ...prev, [providerId]: seed };
    });
  };

  const startConnectProvider = (providerId: string) => {
    if (providerId === 'naukri') setSelectedNaukri(true);
    if (providerId === 'linkedin') setSelectedLinkedIn(true);
    if (providerId === 'google_workspace' || providerId === 'microsoft_365') setOutreachChoice(providerId);
    openWizard(3);
    ensureCredentialSeed(providerId);
  };

  const connectOAuth = async (providerId: string) => {
    setConnecting((prev) => ({ ...prev, [providerId]: true }));
    try {
      const returnTo = '/dashboard/integrations';
      const init = await api.integrations.initOAuth(providerId, returnTo);
      if (!init.success || !init.data?.url) {
        toast.error(init.error || 'Failed to start OAuth connection');
        return;
      }
      window.location.href = init.data.url;
    } finally {
      setConnecting((prev) => ({ ...prev, [providerId]: false }));
    }
  };

  const connectApiKey = async (providerId: string) => {
    const provider = providerMap.get(providerId);
    if (!provider) return;
    ensureCredentialSeed(providerId);
    const creds = credentials[providerId] || {};

    const missing = provider.requiredFields.filter((f) => f.required && !String(creds[f.name] || '').trim());
    if (missing.length > 0) {
      toast.error(`Missing required field: ${missing[0].label}`);
      return;
    }

    setConnecting((prev) => ({ ...prev, [providerId]: true }));
    try {
      const res = await api.integrations.connect(providerId, creds);
      if (!res.success) {
        toast.error(res.error || 'Failed to connect integration');
        return;
      }
      toast.success(`Connected ${provider.name}.`);
      await load();
    } finally {
      setConnecting((prev) => ({ ...prev, [providerId]: false }));
    }
  };

  const runSamplePull = async (providerId: string) => {
    setSampleLoading(true);
    setSampleError(null);
    try {
      const res = await api.integrations.samplePull(providerId);
      if (!res.success) {
        setSampleCandidates([]);
        setSampleJds([]);
        setSampleError(res.error || 'Sample pull failed');
        return;
      }
      const data = (res.data || {}) as SamplePullResponse;
      setSampleCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      setSampleJds(Array.isArray(data.jds) ? data.jds : []);
      if (Array.isArray(data.candidates) && data.candidates.length > 0) {
        setActiveCandidateId(data.candidates[0].id);
      }
      toast.success('Sample data loaded.');
    } finally {
      setSampleLoading(false);
    }
  };

  useEffect(() => {
    parseOAuthToastFromQuery();
    void load();
  }, []);

  const connectedCandidateSources = useMemo(() => {
    return recruitmentProviders
      .filter((p) => p.status === 'connected')
      .filter((p) => (p.capabilities?.reads || []).some((r) => String(r).includes('candidate_profiles')))
      .map((p) => p.id);
  }, [recruitmentProviders]);

  const defaultSampleProviderId = connectedCandidateSources[0] || null;

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-300" />
            <h1 className="text-2xl font-bold text-white">Integration Hub</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Connect third-party apps with clear capabilities, safe defaults, and an immediate “see it” moment.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => openWizard(1)}
            className="px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 hover:bg-blue-500/25 transition-colors text-sm font-semibold"
          >
            Set up Recruitment pack
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-rose-100 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>
            <div className="font-semibold">Could not load integrations</div>
            <div className="text-sm text-rose-100/80">{loadError}</div>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-300" />
              <div className="font-semibold text-white">Recruitment</div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-slate-300">
              {connectedRecruitmentCount}/{RECRUITMENT_PROVIDER_IDS.length} connected
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            Naukri + LinkedIn sources, plus outreach via Google Workspace or Microsoft 365.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-slate-200 inline-flex items-center gap-1">
              <BadgeCheck className="w-3.5 h-3.5 text-emerald-300" />
              Capability-first
            </span>
            <span className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-slate-200 inline-flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-blue-300" />
              Approval-first
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 opacity-70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-300" />
              <div className="font-semibold text-white">Payments</div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-slate-300">Coming soon</span>
          </div>
          <p className="text-sm text-slate-400 mt-2">Transactions and refunds with strict approvals and audit.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 opacity-70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-300" />
              <div className="font-semibold text-white">Finance / ERP</div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-slate-300">Coming soon</span>
          </div>
          <p className="text-sm text-slate-400 mt-2">Read-first ledgers/vouchers with safe automation patterns.</p>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Recruitment providers</h2>
            <p className="text-sm text-slate-400 mt-1">Connect sources and outreach tools. Every write is approval-first.</p>
          </div>
          {loading ? (
            <div className="text-sm text-slate-400 inline-flex items-center gap-2">
              <Clock className="w-4 h-4 animate-pulse" />
              Loading…
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          {recruitmentProviders.map((provider) => {
            const Icon = providerIcon(provider.id);
            const caps = provider.capabilities || { reads: [], writes: [] };
            const readBadges = (caps.reads || []).slice(0, 2);
            const writeBadges = (caps.writes || []).slice(0, 2);

            return (
              <div key={provider.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-slate-200" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-white truncate">{provider.name}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusToneClasses[statusTone(provider.status)]}`}>
                          {formatStatusLabel(provider.status)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400 mt-1 line-clamp-2">{provider.description}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {readBadges.map((readId) => {
                          const meta = readLabel(readId);
                          const ReadIcon = meta.icon;
                          return (
                            <span
                              key={readId}
                              className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-slate-200 inline-flex items-center gap-1"
                            >
                              <ReadIcon className="w-3.5 h-3.5 text-slate-300" />
                              {meta.label}
                            </span>
                          );
                        })}
                        {writeBadges.map((w) => {
                          const risk = riskBadge(w.risk);
                          return (
                            <span
                              key={w.id}
                              className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-slate-200 inline-flex items-center gap-2"
                            >
                              <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                              {w.label}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${risk.cls}`}>{risk.label}</span>
                            </span>
                          );
                        })}
                        {(readBadges.length === 0 && writeBadges.length === 0) ? (
                          <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                            <Info className="w-3.5 h-3.5" />
                            Capabilities coming soon
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openDetails(provider.id)}
                      className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition-colors text-sm"
                    >
                      Details
                    </button>

                    {provider.status === 'connected' && (caps.reads || []).some((r) => String(r).includes('candidate_profiles')) ? (
                      <button
                        onClick={() => runSamplePull(provider.id)}
                        className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/25 text-emerald-100 hover:bg-emerald-500/20 transition-colors text-sm font-semibold"
                        disabled={sampleLoading}
                      >
                        {sampleLoading ? 'Loading…' : 'Sample pull'}
                      </button>
                    ) : (
                      <button
                        onClick={() => startConnectProvider(provider.id)}
                        className="px-3 py-2 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 hover:bg-blue-500/25 transition-colors text-sm font-semibold"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Recruitment browser (preview)</h2>
            <p className="text-sm text-slate-400 mt-1">A fast “see it” view. V1 uses sample pulls; real sync comes next.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (defaultSampleProviderId) {
                  void runSamplePull(defaultSampleProviderId);
                } else {
                  openWizard(3);
                }
              }}
              className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition-colors text-sm"
            >
              {defaultSampleProviderId ? 'Refresh preview' : 'Connect & preview'}
            </button>
          </div>
        </div>

        {sampleError ? (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-rose-100">
            <div className="font-semibold">Preview unavailable</div>
            <div className="text-sm text-rose-100/80 mt-1">{sampleError}</div>
          </div>
        ) : null}

        {sampleCandidates.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-300 mt-0.5" />
              <div>
                <div className="font-semibold text-white">No preview data yet</div>
                <div className="text-sm text-slate-400 mt-1">
                  Connect Naukri or LinkedIn, then run a sample pull to instantly see candidate cards inside SyntheticHR.
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => openWizard(1)}
                    className="px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 hover:bg-blue-500/25 transition-colors text-sm font-semibold"
                  >
                    Start setup
                  </button>
                  <button
                    onClick={() => openWizard(3)}
                    className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition-colors text-sm"
                  >
                    Connect providers
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 text-sm text-slate-300 flex items-center justify-between">
                <span>{sampleCandidates.length} candidates</span>
                <span className="text-xs text-slate-500">Preview data</span>
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-950/95 backdrop-blur border-b border-white/10">
                    <tr className="text-left text-slate-400">
                      <th className="px-4 py-2 font-medium">Candidate</th>
                      <th className="px-4 py-2 font-medium">Source</th>
                      <th className="px-4 py-2 font-medium">Experience</th>
                      <th className="px-4 py-2 font-medium">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampleCandidates.map((c) => (
                      <tr
                        key={c.id}
                        className={`border-b border-white/5 hover:bg-white/5 cursor-pointer ${activeCandidateId === c.id ? 'bg-white/5' : ''}`}
                        onClick={() => setActiveCandidateId(c.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{c.full_name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{c.headline}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{c.source}</td>
                        <td className="px-4 py-3 text-slate-300">{c.experience_years} yrs</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                            {c.match_score}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              {activeCandidate ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white">{activeCandidate.full_name}</div>
                      <div className="text-sm text-slate-400 mt-1">{activeCandidate.headline}</div>
                      <div className="text-xs text-slate-500 mt-1">{activeCandidate.location}</div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                      {activeCandidate.match_score}%
                    </span>
                  </div>

                  <div className="mt-4 text-sm text-slate-300">{activeCandidate.summary}</div>

                  <div className="mt-4">
                    <div className="text-xs text-slate-400 font-semibold">Skills</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {activeCandidate.skills.map((s) => (
                        <span key={s} className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-slate-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2 text-sm text-white font-semibold">
                      <FileText className="w-4 h-4 text-blue-300" />
                      Suggested JDs (stub)
                    </div>
                    <div className="mt-2 space-y-2">
                      {(sampleJds || []).slice(0, 3).map((jd, idx) => (
                        <div key={jd.id} className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-sm text-slate-100 truncate">{jd.title}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {jd.location} • {jd.seniority}
                            </div>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-slate-200">
                            {Math.max(55, activeCandidate.match_score - idx * 6)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2 text-sm text-white font-semibold">
                      <Shield className="w-4 h-4 text-emerald-300" />
                      Actions (approval-first)
                    </div>
                    <div className="mt-2 text-sm text-slate-400">
                      In V1, outreach/shortlist actions are shown as a preview. Execution will route through Jobs &amp; Approvals.
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => toast.info('Action preview: Shortlist request (coming next).')}
                        className="flex-1 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition-colors text-sm"
                      >
                        Request shortlist
                      </button>
                      <button
                        onClick={() => toast.info('Action preview: Outreach draft (coming next).')}
                        className="flex-1 px-3 py-2 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 hover:bg-blue-500/25 transition-colors text-sm font-semibold"
                      >
                        Draft outreach
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-slate-500 inline-flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    Updated {formatTime(activeCandidate.last_updated_at)}
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-400">Select a candidate to view details.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {detailsOpen && selectedIntegration ? (
        <Drawer title={`${selectedIntegration.name} • Details`} onClose={closeDetails}>
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-white">Status</div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusToneClasses[statusTone(selectedIntegration.status)]}`}>
                  {formatStatusLabel(selectedIntegration.status)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Last sync</div>
                  <div className="text-slate-200">{formatTime(selectedIntegration.lastSyncAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Last error</div>
                  <div className="text-slate-200">{formatTime(selectedIntegration.lastErrorAt)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-slate-500">Error message</div>
                  <div className="text-slate-200">{selectedIntegration.lastErrorMsg || '—'}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="font-semibold text-white">Capabilities</div>
              <div className="mt-3">
                <div className="text-xs text-slate-500 font-semibold">Reads</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(selectedIntegration.capabilities?.reads || []).length === 0 ? (
                    <span className="text-xs text-slate-500">—</span>
                  ) : (
                    (selectedIntegration.capabilities?.reads || []).map((r) => {
                      const meta = readLabel(r);
                      const ReadIcon = meta.icon;
                      return (
                        <span key={r} className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-slate-200 inline-flex items-center gap-1">
                          <ReadIcon className="w-3.5 h-3.5 text-slate-300" />
                          {meta.label}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-slate-500 font-semibold">Writes</div>
                <div className="mt-2 space-y-2">
                  {(selectedIntegration.capabilities?.writes || []).length === 0 ? (
                    <div className="text-xs text-slate-500">—</div>
                  ) : (
                    (selectedIntegration.capabilities?.writes || []).map((w) => {
                      const risk = riskBadge(w.risk);
                      return (
                        <div key={w.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                          <div className="text-sm text-slate-100 flex items-center gap-2">
                            <ArrowRight className="w-4 h-4 text-slate-300" />
                            {w.label}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-md border ${risk.cls}`}>{risk.label}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md border border-blue-400/20 bg-blue-400/10 text-blue-100">
                              Approval required
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-white">Connection logs</div>
                <button
                  onClick={() => void loadLogs(selectedIntegration.id)}
                  className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition-colors"
                  disabled={logsLoading}
                >
                  {logsLoading ? 'Loading…' : 'Refresh'}
                </button>
              </div>
              {logsError ? <div className="mt-2 text-sm text-rose-200">{logsError}</div> : null}
              <div className="mt-3 space-y-2">
                {logs.length === 0 ? (
                  <div className="text-sm text-slate-500">No logs yet.</div>
                ) : (
                  logs.slice(0, 10).map((log) => (
                    <div key={log.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm text-slate-200">
                          <span className="font-semibold">{log.action}</span>{' '}
                          <span className="text-slate-500">• {log.status}</span>
                        </div>
                        <div className="text-xs text-slate-500">{formatTime(log.created_at)}</div>
                      </div>
                      {log.message ? <div className="text-xs text-slate-400 mt-1">{log.message}</div> : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Drawer>
      ) : null}

      {wizardOpen ? (
        <Modal title="Recruitment pack setup" onClose={closeWizard} widthClass="max-w-4xl">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-slate-400">
              Step <span className="text-slate-200 font-semibold">{wizardStep}</span> / 5
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWizardStep((s) => (s > 1 ? ((s - 1) as any) : s))}
                className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition-colors text-sm"
                disabled={wizardStep === 1}
              >
                Back
              </button>
              <button
                onClick={() => setWizardStep((s) => (s < 5 ? ((s + 1) as any) : s))}
                className="px-3 py-2 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 hover:bg-blue-500/25 transition-colors text-sm font-semibold"
                disabled={wizardStep === 4 && !governanceConfirmed}
              >
                Next
              </button>
            </div>
          </div>

          {wizardStep === 1 ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-white">Choose pack</div>
                  <div className="text-sm text-slate-400 mt-1">V1 ships Recruitment end-to-end. Payments and ERP come next.</div>
                </div>
                <span className="text-xs px-2 py-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-100 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Enabled
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <div className="font-semibold text-white">Recruitment</div>
                  <div className="text-sm text-emerald-100/80 mt-1">Sources + outreach</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 opacity-60">
                  <div className="font-semibold text-white">Payments</div>
                  <div className="text-sm text-slate-400 mt-1">Coming soon</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 opacity-60">
                  <div className="font-semibold text-white">Finance / ERP</div>
                  <div className="text-sm text-slate-400 mt-1">Coming soon</div>
                </div>
              </div>
            </div>
          ) : null}

          {wizardStep === 2 ? (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="font-semibold text-white">Candidate sources</div>
                <div className="text-sm text-slate-400 mt-1">Pick where candidate data will come from.</div>
                <div className="mt-4 space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" className="mt-1" checked={selectedNaukri} onChange={(e) => setSelectedNaukri(e.target.checked)} />
                    <div>
                      <div className="text-sm font-semibold text-white">Naukri</div>
                      <div className="text-xs text-slate-500">API key based</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" className="mt-1" checked={selectedLinkedIn} onChange={(e) => setSelectedLinkedIn(e.target.checked)} />
                    <div>
                      <div className="text-sm font-semibold text-white">LinkedIn</div>
                      <div className="text-xs text-slate-500">OAuth (official scopes only)</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="font-semibold text-white">Outreach tool</div>
                <div className="text-sm text-slate-400 mt-1">Pick one tool for email/calendar outreach in V1.</div>
                <div className="mt-4 space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="radio" className="mt-1" checked={outreachChoice === 'google_workspace'} onChange={() => setOutreachChoice('google_workspace')} />
                    <div>
                      <div className="text-sm font-semibold text-white">Google Workspace</div>
                      <div className="text-xs text-slate-500">OAuth (Gmail + Calendar)</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="radio" className="mt-1" checked={outreachChoice === 'microsoft_365'} onChange={() => setOutreachChoice('microsoft_365')} />
                    <div>
                      <div className="text-sm font-semibold text-white">Microsoft 365</div>
                      <div className="text-xs text-slate-500">OAuth (Graph)</div>
                    </div>
                  </label>
                </div>
                <div className="mt-4 text-xs text-slate-500 inline-flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" />
                  Writes will require approvals by default.
                </div>
              </div>
            </div>
          ) : null}

          {wizardStep === 3 ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-white">Connect providers</div>
                  <div className="text-sm text-slate-400 mt-1">Connect each selected provider. You can come back anytime.</div>
                </div>
                <button
                  onClick={() => void load()}
                  className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition-colors"
                >
                  Refresh status
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {selectedProviders.map((providerId) => {
                  const provider = providerMap.get(providerId);
                  if (!provider) return null;
                  const isBusy = Boolean(connecting[providerId]);
                  const isConnected = provider.status === 'connected';
                  return (
                    <div key={providerId} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-white">{provider.name}</div>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${statusToneClasses[statusTone(provider.status)]}`}>
                              {formatStatusLabel(provider.status)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {provider.authType === 'oauth2' ? 'OAuth' : provider.authType === 'api_key' ? 'API key' : provider.authType}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openDetails(provider.id)}
                            className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition-colors text-sm"
                          >
                            Details
                          </button>
                          {isConnected ? (
                            <span className="text-xs px-2 py-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-100 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Connected
                            </span>
                          ) : provider.authType === 'oauth2' ? (
                            <button
                              onClick={() => void connectOAuth(provider.id)}
                              className="px-3 py-2 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 hover:bg-blue-500/25 transition-colors text-sm font-semibold"
                              disabled={isBusy}
                            >
                              {isBusy ? 'Starting…' : 'Connect OAuth'}
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                ensureCredentialSeed(provider.id);
                                void connectApiKey(provider.id);
                              }}
                              className="px-3 py-2 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 hover:bg-blue-500/25 transition-colors text-sm font-semibold"
                              disabled={isBusy}
                            >
                              {isBusy ? 'Connecting…' : 'Connect'}
                            </button>
                          )}
                        </div>
                      </div>

                      {provider.authType === 'api_key' && provider.requiredFields.length > 0 && provider.status !== 'connected' ? (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {provider.requiredFields.map((field) => (
                            <label key={field.name} className="block">
                              <div className="text-xs text-slate-400 font-semibold">{field.label}</div>
                              <input
                                type={field.type === 'password' ? 'password' : 'text'}
                                value={(credentials[provider.id]?.[field.name] || '') as string}
                                onChange={(e) =>
                                  setCredentials((prev) => ({
                                    ...prev,
                                    [provider.id]: { ...(prev[provider.id] || {}), [field.name]: e.target.value },
                                  }))
                                }
                                placeholder={field.placeholder || ''}
                                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-white/10 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                              />
                              {field.description ? <div className="text-xs text-slate-500 mt-1">{field.description}</div> : null}
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {selectedProviders.length === 0 ? (
                <div className="mt-3 text-sm text-slate-500">Select providers in Step 2.</div>
              ) : null}
            </div>
          ) : null}

          {wizardStep === 4 ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="font-semibold text-white">Governance defaults</div>
              <div className="text-sm text-slate-400 mt-1">
                V1 defaults to being strict: reads are role-gated, and writes require approvals. You can tune these later in the sidebar’s “Action Policies”.
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Users className="w-4 h-4 text-slate-200" />
                    Who can connect
                  </div>
                  <div className="text-sm text-slate-400 mt-2">Users with `connectors.manage` permission.</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <FileText className="w-4 h-4 text-slate-200" />
                    Who can read
                  </div>
                  <div className="text-sm text-slate-400 mt-2">Users with `connectors.read` permission.</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Shield className="w-4 h-4 text-emerald-300" />
                    Writes
                  </div>
                  <div className="text-sm text-slate-400 mt-2">Approval required by default (safe).</div>
                </div>
              </div>

              <label className="mt-5 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={governanceConfirmed}
                  onChange={(e) => setGovernanceConfirmed(e.target.checked)}
                />
                <div>
                  <div className="text-sm text-white font-semibold">Confirm safe defaults</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    I understand that writes are approval-first and that this pack is a preview of the full governed workflow.
                  </div>
                </div>
              </label>
            </div>
          ) : null}

          {wizardStep === 5 ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="font-semibold text-white">Test + Sample pull</div>
              <div className="text-sm text-slate-400 mt-1">Instantly see candidate cards inside SyntheticHR (no full sync required yet).</div>

              {defaultSampleProviderId ? (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="min-w-0">
                    <div className="text-sm text-white font-semibold">Preview source</div>
                    <div className="text-sm text-slate-400 mt-1 truncate">
                      {providerMap.get(defaultSampleProviderId)?.name || defaultSampleProviderId}
                    </div>
                  </div>
                  <button
                    onClick={() => void runSamplePull(defaultSampleProviderId)}
                    className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/25 text-emerald-100 hover:bg-emerald-500/20 transition-colors text-sm font-semibold"
                    disabled={sampleLoading}
                  >
                    {sampleLoading ? 'Loading…' : 'Run sample pull'}
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-amber-100 flex items-start gap-3">
                  <Info className="w-5 h-5 mt-0.5" />
                  <div>
                    <div className="font-semibold">No connected candidate source yet</div>
                    <div className="text-sm text-amber-100/80 mt-1">Connect Naukri or LinkedIn in Step 3, then come back here.</div>
                  </div>
                </div>
              )}

              {sampleError ? <div className="mt-3 text-sm text-rose-200">{sampleError}</div> : null}
              {sampleCandidates.length > 0 ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="text-sm text-white font-semibold">Preview loaded</div>
                  <div className="text-sm text-slate-400 mt-1">
                    {sampleCandidates.length} candidates are now visible in the Recruitment browser on this page.
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => {
                        closeWizard();
                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 hover:bg-blue-500/25 transition-colors text-sm font-semibold"
                    >
                      View candidates
                    </button>
                    <button
                      onClick={() => toast.info('Next: wire preview actions into Jobs & Approvals execution.')}
                      className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition-colors text-sm"
                    >
                      Next steps
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
