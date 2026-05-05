import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Link2, Link2Off, Info, Loader2, Bot, MessageSquare, Hash, Bell, Users,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { api } from '../../../../../lib/api-client';
import { toast } from '../../../../../lib/toast';
import { StatusBadge, EmptyState } from '../shared';
import AgentSuggestionBanner from '../../../../../components/AgentSuggestionBanner';
import { SharedAutomationTab } from '../shared/SharedAutomationTab';

const CONNECTOR_ID = 'flock';
const CALLBACK_URL = 'https://api.zapheit.com/integrations/oauth/callback/flock';

const FLOCK_TRIGGERS = {
  message_received:   { label: 'Message received',   description: 'Agent replies or routes incoming Flock messages',           Icon: MessageSquare },
  channel_created:    { label: 'Channel created',    description: 'Agent sets up default permissions and pins resources',     Icon: Hash },
  reminder_triggered: { label: 'Reminder triggered', description: 'Agent acts on scheduled reminders and follow-ups',        Icon: Bell },
};

const FLOCK_EXAMPLES = [
  'List all channels in my team',
  'Send a message to the #announcements channel',
  'Create a reminder for the team tomorrow at 10am',
  'Show recent messages in #engineering',
];

type Tab = 'channels' | 'overview' | 'automation';

const TABS: { id: Tab; label: string; Icon: typeof MessageSquare }[] = [
  { id: 'channels',   label: 'Channels',   Icon: Hash },
  { id: 'overview',  label: 'Overview',   Icon: Users },
  { id: 'automation', label: 'Automation', Icon: Bot },
];

interface FlockChannel {
  uid: string;
  name: string;
  description?: string;
  member_count?: number;
}

export default function FlockWorkspace() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('channels');

  const [channels, setChannels] = useState<FlockChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

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

  const loadChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_channels', {});
      if (res.success && (res.data as any)?.channels) setChannels((res.data as any).channels);
      else if (res.success && Array.isArray(res.data)) setChannels(res.data);
    } catch { /* silent */ }
    finally { setLoadingChannels(false); }
  }, []);

  useEffect(() => { void checkConnection(); }, [checkConnection]);

  useEffect(() => {
    if (!connected) return;
    if (activeTab === 'channels') void loadChannels();
  }, [connected, activeTab, loadChannels]);

  const handleConnect = useCallback(() => {
    const url = api.integrations.getOAuthAuthorizeUrl('flock', window.location.href);
    window.location.href = url;
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Disconnect Flock? Team messaging automation will stop.')) return;
    try {
      await api.integrations.disconnect('flock');
      setConnected(false);
      toast.success('Flock disconnected');
    } catch {
      toast.error('Failed to disconnect Flock');
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#080b12]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 shrink-0">
        <button onClick={() => navigate('/dashboard/apps')} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-[#6557FF] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">FL</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white">Flock</h1>
          {!checking && connected !== null && (
            <div className="mt-0.5"><StatusBadge status={connected ? 'connected' : 'disconnected'} size="sm" /></div>
          )}
        </div>
        {checking && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
        {!checking && connected && (
          <button onClick={() => void handleDisconnect()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-xs font-medium transition-colors">
            <Link2Off className="w-3.5 h-3.5" />
            Disconnect
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 px-5 py-2 border-b border-white/5 shrink-0">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            activeTab === t.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]',
          )}>
            <t.Icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!checking && !connected && (
          <div className="flex items-center justify-center p-8 h-full">
            <div className="w-full max-w-sm space-y-5">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-[#6557FF] flex items-center justify-center mx-auto">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-base font-semibold text-white">Connect Flock</h2>
                <p className="text-sm text-slate-400">Authorize Zapheit to send messages and automate team notifications.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">OAuth 2.0</p>
                <div className="flex items-start gap-2 pt-1">
                  <Info className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-500">Callback URL: <span className="font-mono text-slate-400">{CALLBACK_URL}</span></p>
                </div>
              </div>
              <button onClick={handleConnect} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#6557FF] hover:bg-[#5446e8] text-white text-sm font-semibold transition-colors">
                <Link2 className="w-4 h-4" />
                Connect Flock with OAuth
              </button>
            </div>
          </div>
        )}

        {checking && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Checking connection…</span>
            </div>
          </div>
        )}

        {!checking && connected && activeTab === 'channels' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Channels</h2>
              <button onClick={() => void loadChannels()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {showBanner && <AgentSuggestionBanner serviceId="flock" onDismiss={() => setShowBanner(false)} />}
            {loadingChannels ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : channels.length === 0 ? (
              <EmptyState icon={Hash} title="No channels found" description="Your Flock channels will appear here." />
            ) : (
              <div className="space-y-2">
                {channels.map((ch) => (
                  <div key={ch.uid} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#6557FF]/20 border border-[#6557FF]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Hash className="w-4 h-4 text-[#6557FF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">#{ch.name}</p>
                      {ch.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{ch.description}</p>}
                      {ch.member_count != null && (
                        <span className="text-[10px] text-slate-500 mt-0.5 inline-block">{ch.member_count} members</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!checking && connected && activeTab === 'overview' && (
          <div className="flex items-center justify-center p-8 h-full">
            <div className="w-full max-w-sm space-y-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#6557FF]/20 border border-[#6557FF]/30 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6 text-[#6557FF]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white mb-1">Flock connected</h2>
                <p className="text-sm text-slate-400">Your agents can now send messages, create reminders, and automate team notifications via Flock.</p>
              </div>
              <button
                onClick={() => setActiveTab('automation')}
                className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-white text-sm font-medium transition-colors hover:bg-white/[0.08]"
              >
                Configure Automation →
              </button>
            </div>
          </div>
        )}

        {!checking && connected && activeTab === 'automation' && (
          <SharedAutomationTab connectorId="flock" triggerTypes={FLOCK_TRIGGERS} nlExamples={FLOCK_EXAMPLES} accentColor="blue" />
        )}
      </div>
    </div>
  );
}
