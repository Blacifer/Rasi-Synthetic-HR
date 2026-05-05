import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Link2, Link2Off, Info, Loader2, Bot, MessageCircle, Users, CheckCircle, Clock,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { api } from '../../../../../lib/api-client';
import { toast } from '../../../../../lib/toast';
import { StatusBadge, EmptyState } from '../shared';
import AgentSuggestionBanner from '../../../../../components/AgentSuggestionBanner';
import { SharedAutomationTab } from '../shared/SharedAutomationTab';

const CONNECTOR_ID = 'intercom';
const CALLBACK_URL = 'https://api.zapheit.com/integrations/oauth/callback/intercom';

const INTERCOM_TRIGGERS = {
  conversation_created:  { label: 'Conversation created',  description: 'Agent auto-assigns and drafts a first reply',               Icon: MessageCircle },
  conversation_resolved: { label: 'Conversation resolved', description: 'Agent sends a CSAT survey or follow-up',                    Icon: CheckCircle },
  user_created:          { label: 'User created',          description: 'Agent enriches user profile from external sources',          Icon: Users },
  lead_converted:        { label: 'Lead converted',        description: 'Agent triggers onboarding sequence for new customers',       Icon: Users },
};

const INTERCOM_EXAMPLES = [
  'List open conversations assigned to me',
  'Show all unread conversations in the inbox',
  'Reply to conversation ID 456 with "Thanks for reaching out!"',
  'Find all users who signed up in the last 7 days',
];

type Tab = 'conversations' | 'contacts' | 'automation';

const TABS: { id: Tab; label: string; Icon: typeof MessageCircle }[] = [
  { id: 'conversations', label: 'Conversations', Icon: MessageCircle },
  { id: 'contacts',     label: 'Contacts',      Icon: Users },
  { id: 'automation',  label: 'Automation',     Icon: Bot },
];

interface Conversation {
  id: string;
  title?: string;
  state: string;
  created_at: number;
  assignee?: { name?: string };
  source?: { author?: { name?: string; email?: string } };
}

interface Contact {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  created_at?: number;
  last_seen_at?: number;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts * 1000;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function IntercomWorkspace() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('conversations');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

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

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_conversations', { per_page: 20 });
      if (res.success && (res.data as any)?.conversations) setConversations((res.data as any).conversations);
      else if (res.success && Array.isArray(res.data)) setConversations(res.data);
    } catch { /* silent */ }
    finally { setLoadingConversations(false); }
  }, []);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_contacts', { per_page: 20 });
      if (res.success && (res.data as any)?.data) setContacts((res.data as any).data);
      else if (res.success && Array.isArray(res.data)) setContacts(res.data);
    } catch { /* silent */ }
    finally { setLoadingContacts(false); }
  }, []);

  useEffect(() => { void checkConnection(); }, [checkConnection]);

  useEffect(() => {
    if (!connected) return;
    if (activeTab === 'conversations') void loadConversations();
    if (activeTab === 'contacts') void loadContacts();
  }, [connected, activeTab, loadConversations, loadContacts]);

  const handleConnect = useCallback(() => {
    const url = api.integrations.getOAuthAuthorizeUrl('intercom', window.location.href);
    window.location.href = url;
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Disconnect Intercom? Support automation will stop.')) return;
    try {
      await api.integrations.disconnect('intercom');
      setConnected(false);
      toast.success('Intercom disconnected');
    } catch {
      toast.error('Failed to disconnect Intercom');
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#080b12]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 shrink-0">
        <button onClick={() => navigate('/dashboard/apps')} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-[#1F8DED] flex items-center justify-center shrink-0">
          <MessageCircle className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white">Intercom</h1>
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
                <div className="w-12 h-12 rounded-xl bg-[#1F8DED] flex items-center justify-center mx-auto">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-base font-semibold text-white">Connect Intercom</h2>
                <p className="text-sm text-slate-400">Authorize Zapheit to manage conversations, contacts, and support automation.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">OAuth 2.0</p>
                <div className="flex items-start gap-2 pt-1">
                  <Info className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-500">Callback URL: <span className="font-mono text-slate-400">{CALLBACK_URL}</span></p>
                </div>
              </div>
              <button onClick={handleConnect} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1F8DED] hover:bg-[#187dc5] text-white text-sm font-semibold transition-colors">
                <Link2 className="w-4 h-4" />
                Connect Intercom with OAuth
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

        {!checking && connected && activeTab === 'conversations' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Conversations</h2>
              <button onClick={() => void loadConversations()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {showBanner && <AgentSuggestionBanner serviceId="intercom" onDismiss={() => setShowBanner(false)} />}
            {loadingConversations ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : conversations.length === 0 ? (
              <EmptyState icon={MessageCircle} title="No conversations" description="Your Intercom conversations will appear here." />
            ) : (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <div key={conv.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#1F8DED]/20 border border-[#1F8DED]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <MessageCircle className="w-4 h-4 text-[#1F8DED]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {conv.title || conv.source?.author?.name || `Conversation #${conv.id}`}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {conv.assignee?.name && <span className="text-xs text-slate-400">→ {conv.assignee.name}</span>}
                        <span className="text-xs text-slate-500">{relativeTime(conv.created_at)}</span>
                      </div>
                    </div>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
                      conv.state === 'open' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400',
                    )}>{conv.state}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!checking && connected && activeTab === 'contacts' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Contacts</h2>
              <button onClick={() => void loadContacts()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {loadingContacts ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : contacts.length === 0 ? (
              <EmptyState icon={Users} title="No contacts found" description="Your Intercom users and leads will appear here." />
            ) : (
              <div className="space-y-2">
                {contacts.map((c) => (
                  <div key={c.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#1F8DED]/20 border border-[#1F8DED]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Users className="w-4 h-4 text-[#1F8DED]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{c.name || c.email || c.id}</p>
                      {c.email && c.name && <p className="text-xs text-slate-400 mt-0.5">{c.email}</p>}
                      <div className="flex gap-1.5 mt-1">
                        {c.role && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-400 font-medium">{c.role}</span>}
                        {c.last_seen_at && <span className="text-[10px] text-slate-500">Last seen {relativeTime(c.last_seen_at)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!checking && connected && activeTab === 'automation' && (
          <SharedAutomationTab connectorId="intercom" triggerTypes={INTERCOM_TRIGGERS} nlExamples={INTERCOM_EXAMPLES} accentColor="blue" />
        )}
      </div>
    </div>
  );
}
