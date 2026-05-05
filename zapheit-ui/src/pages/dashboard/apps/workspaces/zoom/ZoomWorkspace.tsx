import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Link2, Link2Off, Info, Loader2, Video, Clock, Bot, Users, Mic,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { api } from '../../../../../lib/api-client';
import { toast } from '../../../../../lib/toast';
import { StatusBadge, EmptyState } from '../shared';
import AgentSuggestionBanner from '../../../../../components/AgentSuggestionBanner';
import { SharedAutomationTab } from '../shared/SharedAutomationTab';

const CONNECTOR_ID = 'zoom';
const CALLBACK_URL = 'https://api.zapheit.com/integrations/oauth/callback/zoom';

const ZOOM_TRIGGERS = {
  meeting_started:     { label: 'Meeting started',      description: 'Agent takes notes or notifies when a meeting begins',             Icon: Video },
  meeting_ended:       { label: 'Meeting ended',        description: 'Agent sends summaries and follow-ups after meetings',             Icon: Clock },
  recording_ready:     { label: 'Recording ready',      description: 'Agent transcribes and archives cloud recordings',                 Icon: Mic },
  participant_joined:  { label: 'Participant joined',   description: 'Agent welcomes participants or logs attendance',                  Icon: Users },
};

const ZOOM_EXAMPLES = [
  'List my meetings scheduled for today',
  'Show all recordings from last week',
  'Schedule a 30-minute meeting with team@example.com tomorrow at 3pm',
  'Get the transcript from my last standup',
];

type Tab = 'meetings' | 'recordings' | 'automation';

const TABS: { id: Tab; label: string; Icon: typeof Video }[] = [
  { id: 'meetings',    label: 'Meetings',    Icon: Video },
  { id: 'recordings', label: 'Recordings',  Icon: Mic },
  { id: 'automation', label: 'Automation',  Icon: Bot },
];

interface ZoomMeeting {
  id: number;
  topic: string;
  start_time: string;
  duration: number;
  status: string;
  join_url: string;
}

interface ZoomRecording {
  id: string;
  topic: string;
  start_time: string;
  duration: number;
  total_size: number;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ZoomWorkspace() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('meetings');

  const [meetings, setMeetings] = useState<ZoomMeeting[]>([]);
  const [recordings, setRecordings] = useState<ZoomRecording[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [loadingRecordings, setLoadingRecordings] = useState(false);

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

  const loadMeetings = useCallback(async () => {
    setLoadingMeetings(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_meetings', { type: 'upcoming', page_size: 20 });
      if (res.success && (res.data as any)?.meetings) setMeetings((res.data as any).meetings);
      else if (res.success && Array.isArray(res.data)) setMeetings(res.data);
    } catch { /* silent */ }
    finally { setLoadingMeetings(false); }
  }, []);

  const loadRecordings = useCallback(async () => {
    setLoadingRecordings(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_recordings', { page_size: 20 });
      if (res.success && (res.data as any)?.meetings) setRecordings((res.data as any).meetings);
      else if (res.success && Array.isArray(res.data)) setRecordings(res.data);
    } catch { /* silent */ }
    finally { setLoadingRecordings(false); }
  }, []);

  useEffect(() => { void checkConnection(); }, [checkConnection]);

  useEffect(() => {
    if (!connected) return;
    if (activeTab === 'meetings') void loadMeetings();
    if (activeTab === 'recordings') void loadRecordings();
  }, [connected, activeTab, loadMeetings, loadRecordings]);

  const handleConnect = useCallback(() => {
    const url = api.integrations.getOAuthAuthorizeUrl('zoom', window.location.href);
    window.location.href = url;
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Disconnect Zoom? Meeting automation will stop.')) return;
    try {
      await api.integrations.disconnect('zoom');
      setConnected(false);
      toast.success('Zoom disconnected');
    } catch {
      toast.error('Failed to disconnect Zoom');
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#080b12]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 shrink-0">
        <button onClick={() => navigate('/dashboard/apps')} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-[#2D8CFF] flex items-center justify-center shrink-0">
          <Video className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white">Zoom</h1>
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
                <div className="w-12 h-12 rounded-xl bg-[#2D8CFF] flex items-center justify-center mx-auto">
                  <Video className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-base font-semibold text-white">Connect Zoom</h2>
                <p className="text-sm text-slate-400">Authorize Zapheit to schedule meetings and automate follow-ups.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">OAuth 2.0</p>
                <div className="flex items-start gap-2 pt-1">
                  <Info className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-500">Callback URL: <span className="font-mono text-slate-400">{CALLBACK_URL}</span></p>
                </div>
              </div>
              <button onClick={handleConnect} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2D8CFF] hover:bg-[#1a7ae8] text-white text-sm font-semibold transition-colors">
                <Link2 className="w-4 h-4" />
                Connect Zoom with OAuth
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

        {!checking && connected && activeTab === 'meetings' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Upcoming Meetings</h2>
              <button onClick={() => void loadMeetings()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {showBanner && <AgentSuggestionBanner serviceId="zoom" onDismiss={() => setShowBanner(false)} />}
            {loadingMeetings ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : meetings.length === 0 ? (
              <EmptyState icon={Video} title="No upcoming meetings" description="Your scheduled Zoom meetings will appear here." />
            ) : (
              <div className="space-y-2">
                {meetings.map((m) => (
                  <div key={m.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2D8CFF]/20 border border-[#2D8CFF]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Video className="w-4 h-4 text-[#2D8CFF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{m.topic}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{fmtDateTime(m.start_time)} · {m.duration} min</p>
                      {m.join_url && (
                        <a href={m.join_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#2D8CFF] hover:text-blue-300 mt-1 inline-block transition-colors">
                          Join meeting →
                        </a>
                      )}
                    </div>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
                      m.status === 'started' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400',
                    )}>{m.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!checking && connected && activeTab === 'recordings' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Cloud Recordings</h2>
              <button onClick={() => void loadRecordings()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {loadingRecordings ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : recordings.length === 0 ? (
              <EmptyState icon={Mic} title="No recordings found" description="Your Zoom cloud recordings will appear here." />
            ) : (
              <div className="space-y-2">
                {recordings.map((r) => (
                  <div key={r.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2D8CFF]/20 border border-[#2D8CFF]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Mic className="w-4 h-4 text-[#2D8CFF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{r.topic}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{fmtDateTime(r.start_time)} · {r.duration} min · {fmtSize(r.total_size)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!checking && connected && activeTab === 'automation' && (
          <SharedAutomationTab connectorId="zoom" triggerTypes={ZOOM_TRIGGERS} nlExamples={ZOOM_EXAMPLES} accentColor="blue" />
        )}
      </div>
    </div>
  );
}
