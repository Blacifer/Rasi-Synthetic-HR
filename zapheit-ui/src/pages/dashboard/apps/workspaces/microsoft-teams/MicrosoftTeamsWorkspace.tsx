import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Link2, Link2Off, Info, Loader2, Bot, MessageSquare, Users, Hash, Video,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { api } from '../../../../../lib/api-client';
import { toast } from '../../../../../lib/toast';
import { StatusBadge, EmptyState } from '../shared';
import AgentSuggestionBanner from '../../../../../components/AgentSuggestionBanner';
import { SharedAutomationTab } from '../shared/SharedAutomationTab';

const CONNECTOR_ID = 'teams';
const CALLBACK_URL = 'https://api.zapheit.com/integrations/oauth/callback/teams';

const TEAMS_TRIGGERS = {
  message_received:  { label: 'Message received',  description: 'Agent replies or routes incoming Teams messages',              Icon: MessageSquare },
  meeting_started:   { label: 'Meeting started',   description: 'Agent takes notes or sends pre-meeting briefs',               Icon: Video },
  channel_created:   { label: 'Channel created',   description: 'Agent sets up default permissions and pins resources',        Icon: Hash },
  member_added:      { label: 'Member added',      description: 'Agent sends welcome messages to new team members',            Icon: Users },
};

const TEAMS_EXAMPLES = [
  'List all teams I am a member of',
  'Post a message to the #general channel in "Engineering" team',
  'Create a new channel "Q2-Planning" in "Finance" team',
  'Send a meeting summary to the team',
];

type Tab = 'teams' | 'channels' | 'automation';

const TABS: { id: Tab; label: string; Icon: typeof MessageSquare }[] = [
  { id: 'teams',      label: 'Teams',      Icon: Users },
  { id: 'channels',  label: 'Channels',   Icon: Hash },
  { id: 'automation', label: 'Automation', Icon: Bot },
];

interface Team {
  id: string;
  displayName: string;
  description?: string;
  visibility?: string;
}

interface Channel {
  id: string;
  displayName: string;
  description?: string;
  membershipType?: string;
}

export default function MicrosoftTeamsWorkspace() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('teams');

  const [teams, setTeams] = useState<Team[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);

  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const res = await api.integrations.getAll();
      const items = Array.isArray(res.data) ? res.data : [];
      const entry = items.find((i: any) => i.service_type === CONNECTOR_ID || i.id === CONNECTOR_ID || i.service_type === 'microsoft_teams');
      setConnected(entry?.status === 'connected');
    } catch {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  }, []);

  const loadTeams = useCallback(async () => {
    setLoadingTeams(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_teams', {});
      if (res.success && (res.data as any)?.value) setTeams((res.data as any).value);
      else if (res.success && Array.isArray(res.data)) setTeams(res.data);
    } catch { /* silent */ }
    finally { setLoadingTeams(false); }
  }, []);

  const loadChannels = useCallback(async () => {
    if (teams.length === 0) return;
    setLoadingChannels(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_channels', { team_id: teams[0]?.id });
      if (res.success && (res.data as any)?.value) setChannels((res.data as any).value);
      else if (res.success && Array.isArray(res.data)) setChannels(res.data);
    } catch { /* silent */ }
    finally { setLoadingChannels(false); }
  }, [teams]);

  useEffect(() => { void checkConnection(); }, [checkConnection]);

  useEffect(() => {
    if (!connected) return;
    if (activeTab === 'teams') void loadTeams();
    if (activeTab === 'channels') void loadChannels();
  }, [connected, activeTab, loadTeams, loadChannels]);

  const handleConnect = useCallback(() => {
    const url = api.integrations.getOAuthAuthorizeUrl('teams', window.location.href);
    window.location.href = url;
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Disconnect Microsoft Teams? Team automation will stop.')) return;
    try {
      await api.integrations.disconnect('teams');
      setConnected(false);
      toast.success('Microsoft Teams disconnected');
    } catch {
      toast.error('Failed to disconnect Microsoft Teams');
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#080b12]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 shrink-0">
        <button onClick={() => navigate('/dashboard/apps')} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-[#5059C9] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">MT</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white">Microsoft Teams</h1>
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
                <div className="w-12 h-12 rounded-xl bg-[#5059C9] flex items-center justify-center mx-auto">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-base font-semibold text-white">Connect Microsoft Teams</h2>
                <p className="text-sm text-slate-400">Authorize Zapheit to post messages and manage teams and channels.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">OAuth 2.0</p>
                <div className="flex items-start gap-2 pt-1">
                  <Info className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-500">Callback URL: <span className="font-mono text-slate-400">{CALLBACK_URL}</span></p>
                </div>
              </div>
              <button onClick={handleConnect} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#5059C9] hover:bg-[#4048b5] text-white text-sm font-semibold transition-colors">
                <Link2 className="w-4 h-4" />
                Connect Microsoft Teams with OAuth
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

        {!checking && connected && activeTab === 'teams' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">My Teams</h2>
              <button onClick={() => void loadTeams()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {showBanner && <AgentSuggestionBanner serviceId="teams" onDismiss={() => setShowBanner(false)} />}
            {loadingTeams ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : teams.length === 0 ? (
              <EmptyState icon={Users} title="No teams found" description="Your Microsoft Teams will appear here." />
            ) : (
              <div className="space-y-2">
                {teams.map((team) => (
                  <div key={team.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#5059C9]/20 border border-[#5059C9]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Users className="w-4 h-4 text-[#5059C9]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{team.displayName}</p>
                      {team.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{team.description}</p>}
                      {team.visibility && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-400 font-medium mt-1 inline-block">{team.visibility}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!checking && connected && activeTab === 'channels' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Channels</h2>
              <button onClick={() => void loadChannels()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {loadingChannels ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : channels.length === 0 ? (
              <EmptyState icon={Hash} title="No channels found" description="Channels from your Teams will appear here." />
            ) : (
              <div className="space-y-2">
                {channels.map((ch) => (
                  <div key={ch.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#5059C9]/20 border border-[#5059C9]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Hash className="w-4 h-4 text-[#5059C9]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{ch.displayName}</p>
                      {ch.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{ch.description}</p>}
                    </div>
                    {ch.membershipType && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-400 font-medium shrink-0">{ch.membershipType}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!checking && connected && activeTab === 'automation' && (
          <SharedAutomationTab connectorId="teams" triggerTypes={TEAMS_TRIGGERS} nlExamples={TEAMS_EXAMPLES} accentColor="blue" />
        )}
      </div>
    </div>
  );
}
