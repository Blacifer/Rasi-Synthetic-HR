import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Link2, Link2Off, Info, Loader2, Mail, Users, Bot, ExternalLink, AlertCircle,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { api } from '../../../../../lib/api-client';
import { toast } from '../../../../../lib/toast';
import { StatusBadge, EmptyState } from '../shared';
import AgentSuggestionBanner from '../../../../../components/AgentSuggestionBanner';
import { SharedAutomationTab } from '../shared/SharedAutomationTab';

const CONNECTOR_ID = 'mailchimp';

const MAILCHIMP_TRIGGERS = {
  campaign_sent:    { label: 'Campaign sent',  description: 'Agent logs metrics when a campaign is dispatched',       Icon: Mail },
  subscriber_added: { label: 'New subscriber', description: 'Agent welcomes or enriches a new subscriber record',     Icon: Users },
  unsubscribe:      { label: 'Unsubscribe',    description: 'Agent flags churn risk and can trigger re-engagement',   Icon: Users },
  bounce:           { label: 'Email bounce',   description: 'Agent cleans the list and alerts on high bounce rates',  Icon: AlertCircle },
};

const MAILCHIMP_EXAMPLES = [
  'List all sent campaigns this month',
  'Show subscriber growth for the past week',
  'How many unsubscribes happened today?',
  'Draft a re-engagement campaign for inactive subscribers',
];

type Tab = 'campaigns' | 'audience' | 'automation';

const TABS: { id: Tab; label: string; Icon: typeof Mail }[] = [
  { id: 'campaigns', label: 'Campaigns', Icon: Mail },
  { id: 'audience',  label: 'Audience',  Icon: Users },
  { id: 'automation', label: 'Automation', Icon: Bot },
];

interface Campaign {
  id: string;
  settings: {
    title?: string;
    subject_line?: string;
  };
  status: string;
  emails_sent: number;
  send_time?: string;
}

interface Member {
  email_address: string;
  status: string;
  merge_fields: {
    FNAME?: string;
    LNAME?: string;
  };
  timestamp_signup?: string;
}

function campaignStatusClass(status: string): string {
  switch (status) {
    case 'sent':     return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'draft':    return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'sending':  return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'archived': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    default:         return 'bg-white/10 text-slate-400 border-white/10';
  }
}

function memberStatusClass(status: string): string {
  switch (status) {
    case 'subscribed':   return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'unsubscribed': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    case 'cleaned':      return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    default:             return 'bg-white/10 text-slate-400 border-white/10';
  }
}

export default function MailchimpWorkspace() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('campaigns');

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const res = await api.integrations.getAll();
      const items = Array.isArray(res.data) ? res.data : [];
      const entry = items.find((i: any) => i.service_type === CONNECTOR_ID || i.id === CONNECTOR_ID);
      setConnected(entry?.status === 'connected');
    } catch {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_campaigns', { count: 20 });
      if (res.success && (res.data as any)?.campaigns) setCampaigns((res.data as any).campaigns);
      else if (res.success && Array.isArray(res.data)) setCampaigns(res.data);
    } catch {
      /* silent */
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_members', { count: 30 });
      if (res.success && (res.data as any)?.members) setMembers((res.data as any).members);
      else if (res.success && Array.isArray(res.data)) setMembers(res.data);
    } catch {
      /* silent */
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => { void checkConnection(); }, [checkConnection]);

  useEffect(() => {
    if (!connected) return;
    if (activeTab === 'campaigns') void loadCampaigns();
    if (activeTab === 'audience') void loadMembers();
  }, [connected, activeTab, loadCampaigns, loadMembers]);

  const handleConnect = useCallback(() => {
    const url = api.integrations.getOAuthAuthorizeUrl('mailchimp', window.location.href);
    window.location.href = url;
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Disconnect Mailchimp? Email automation will stop.')) return;
    try {
      await api.integrations.disconnect('mailchimp');
      setConnected(false);
      toast.success('Mailchimp disconnected');
    } catch {
      toast.error('Failed to disconnect Mailchimp');
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#080b12]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 shrink-0">
        <button
          onClick={() => navigate('/dashboard/apps')}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="w-8 h-8 rounded-lg bg-[#FFE01B] flex items-center justify-center shrink-0">
          <Mail className="w-4 h-4 text-black" />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white">Mailchimp</h1>
          {!checking && connected !== null && (
            <div className="mt-0.5">
              <StatusBadge status={connected ? 'connected' : 'disconnected'} size="sm" />
            </div>
          )}
        </div>

        {checking && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}

        {!checking && connected && (
          <button
            onClick={() => void handleDisconnect()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-xs font-medium transition-colors"
          >
            <Link2Off className="w-3.5 h-3.5" />
            Disconnect
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-5 py-2 border-b border-white/5 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              activeTab === t.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]',
            )}
          >
            <t.Icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Not connected */}
        {!checking && !connected && (
          <div className="flex items-center justify-center p-8 h-full">
            <div className="w-full max-w-sm space-y-5">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-[#FFE01B] flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6 text-black" />
                </div>
                <h2 className="text-base font-semibold text-white">Connect Mailchimp</h2>
                <p className="text-sm text-slate-400">Authorize Zapheit to read campaigns, manage audiences, and automate email workflows.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">What Zapheit can access</p>
                <div className="flex items-start gap-2 pt-1">
                  <Info className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-500">
                    Agents can list campaigns, read audience members, and surface engagement metrics.
                    OAuth credentials are stored encrypted and never shared.
                  </p>
                </div>
              </div>
              <button
                onClick={handleConnect}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#FFE01B] hover:bg-[#e6ca00] text-black text-sm font-semibold transition-colors"
              >
                <Link2 className="w-4 h-4" />
                Connect Mailchimp with OAuth
              </button>
            </div>
          </div>
        )}

        {/* Checking */}
        {checking && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Checking connection…</span>
            </div>
          </div>
        )}

        {/* Campaigns tab */}
        {!checking && connected && activeTab === 'campaigns' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Campaigns</h2>
              <button onClick={() => void loadCampaigns()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>

            {showBanner && <AgentSuggestionBanner serviceId="mailchimp" onDismiss={() => setShowBanner(false)} />}

            {loadingCampaigns ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              </div>
            ) : campaigns.length === 0 ? (
              <EmptyState icon={Mail} title="No campaigns found" description="Your Mailchimp campaigns will appear here once the connection fetches them." />
            ) : (
              <div className="space-y-2">
                {campaigns.map((c) => (
                  <div key={c.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FFE01B]/20 border border-[#FFE01B]/30 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-[#FFE01B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {c.settings.title || c.settings.subject_line || c.id}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border', campaignStatusClass(c.status))}>
                          {c.status}
                        </span>
                        {c.emails_sent > 0 && (
                          <span className="text-[11px] text-slate-400">{c.emails_sent.toLocaleString()} sent</span>
                        )}
                        {c.send_time && (
                          <span className="text-[11px] text-slate-500">
                            {new Date(c.send_time).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href="https://mailchimp.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audience tab */}
        {!checking && connected && activeTab === 'audience' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Subscribers</h2>
              <button onClick={() => void loadMembers()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {loadingMembers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              </div>
            ) : members.length === 0 ? (
              <EmptyState icon={Users} title="No subscribers found" description="Your Mailchimp audience members will appear here." />
            ) : (
              <div className="space-y-2">
                {members.map((m) => {
                  const firstName = m.merge_fields?.FNAME ?? '';
                  const lastName = m.merge_fields?.LNAME ?? '';
                  const fullName = [firstName, lastName].filter(Boolean).join(' ');
                  const initial = (firstName[0] || m.email_address[0] || '?').toUpperCase();
                  return (
                    <div key={m.email_address} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#FFE01B]/20 border border-[#FFE01B]/30 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-[#FFE01B]">{initial}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        {fullName && (
                          <p className="text-sm font-medium text-white truncate">{fullName}</p>
                        )}
                        <p className="text-xs text-slate-400 truncate">{m.email_address}</p>
                        {m.timestamp_signup && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Signed up {new Date(m.timestamp_signup).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                          </p>
                        )}
                      </div>
                      <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0', memberStatusClass(m.status))}>
                        {m.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Automation tab */}
        {!checking && connected && activeTab === 'automation' && (
          <SharedAutomationTab
            connectorId="mailchimp"
            triggerTypes={MAILCHIMP_TRIGGERS}
            nlExamples={MAILCHIMP_EXAMPLES}
            accentColor="amber"
          />
        )}
      </div>
    </div>
  );
}
