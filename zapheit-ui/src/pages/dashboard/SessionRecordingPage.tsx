import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Save, Info, Lock, Play, ChevronRight, ChevronDown,
  Loader2, RefreshCw, MessageSquare, Bot, User, AlertCircle,
  Clock, CheckCircle2, XCircle, ArrowLeft, Search,
  Zap, Database, Eye, FileText,
} from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

/* ─────────────────────────────────────────────────────────────────────────
   Types
──────────────────────────────────────────────────────────────────────────── */

type SessionStatus = 'active' | 'completed' | 'error' | 'flagged';

interface Session {
  id: string;
  agent_id: string;
  agent_name?: string;
  status: SessionStatus;
  message_count: number;
  created_at: string;
  updated_at: string;
  incident_count?: number;
  summary?: string;
  mode?: string;
}

interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  created_at: string;
  tokens_used?: number;
  tool_name?: string;
}

interface TraceEntry {
  id: string;
  type: 'llm_call' | 'tool_call' | 'decision' | 'approval' | 'error' | 'info';
  label: string;
  detail?: string;
  timestamp?: string;
  duration_ms?: number;
  risk_score?: number;
  approved?: boolean;
}

const RETENTION_OPTIONS = [
  { value: 30,  label: '30 days',  description: 'Free tier maximum',       tier: 'free' },
  { value: 90,  label: '90 days',  description: 'Pro default',              tier: 'pro' },
  { value: 365, label: '1 year',   description: 'Business & Enterprise',    tier: 'business' },
] as const;

/* ─────────────────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────────────────────── */

function timeAgo(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function truncate(s: string, max = 80): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

const STATUS_STYLE: Record<SessionStatus, string> = {
  active:    'border-blue-400/20 bg-blue-500/[0.07] text-blue-300',
  completed: 'border-emerald-400/20 bg-emerald-500/[0.07] text-emerald-300',
  error:     'border-rose-400/20 bg-rose-500/[0.07] text-rose-300',
  flagged:   'border-amber-400/20 bg-amber-500/[0.07] text-amber-300',
};

const TRACE_ICON: Record<TraceEntry['type'], React.FC<{ className?: string }>> = {
  llm_call:  Bot,
  tool_call: Database,
  decision:  Zap,
  approval:  Shield,
  error:     AlertCircle,
  info:      Info,
};

const TRACE_COLOR: Record<TraceEntry['type'], string> = {
  llm_call:  'text-blue-400',
  tool_call: 'text-violet-400',
  decision:  'text-amber-400',
  approval:  'text-emerald-400',
  error:     'text-rose-400',
  info:      'text-slate-400',
};

/* ─────────────────────────────────────────────────────────────────────────
   Data normalisers
──────────────────────────────────────────────────────────────────────────── */

function normalizeSession(raw: any): Session {
  const msgs = Array.isArray(raw.messages) ? raw.messages : [];
  const incidents = Array.isArray(raw.incidents) ? raw.incidents : [];
  const firstUser = msgs.find((m: any) => m.role === 'user');
  const summary = firstUser?.content
    ? truncate(String(firstUser.content))
    : raw.summary || 'Agent session';
  return {
    id: raw.id,
    agent_id: raw.agent_id,
    agent_name: raw.ai_agents?.name || raw.agent_name || raw.agent_id || 'Unknown agent',
    status: (raw.status as SessionStatus) || 'completed',
    message_count: msgs.length || raw.message_count || 0,
    created_at: raw.created_at,
    updated_at: raw.updated_at || raw.created_at,
    incident_count: incidents.length,
    summary,
    mode: raw.mode,
  };
}

function normalizeMessages(raw: any): SessionMessage[] {
  const msgs: any[] = Array.isArray(raw.messages) ? raw.messages : [];
  return msgs.map((m) => ({
    id: m.id || crypto.randomUUID(),
    role: m.role || 'user',
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''),
    created_at: m.created_at || raw.created_at,
    tokens_used: m.tokens_used,
    tool_name: m.tool_name || m.metadata?.tool_name,
  }));
}

function normalizeTrace(rawTrace: any[]): TraceEntry[] {
  return rawTrace.map((t, idx) => ({
    id: t.id || String(idx),
    type: (t.type || 'info') as TraceEntry['type'],
    label: t.label || t.action || t.event || 'Step',
    detail: t.detail || t.content || t.result || undefined,
    timestamp: t.timestamp || t.created_at,
    duration_ms: t.duration_ms,
    risk_score: t.risk_score,
    approved: t.approved,
  }));
}

/* ─────────────────────────────────────────────────────────────────────────
   Session row
──────────────────────────────────────────────────────────────────────────── */

function SessionRow({ session, selected, onClick }: { session: Session; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-white/[0.04] transition-colors hover:bg-white/[0.04]',
        selected && 'bg-blue-500/[0.08] border-l-2 border-l-blue-500',
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <Bot className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="text-xs font-medium text-slate-300 truncate flex-1">{session.agent_name}</span>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize shrink-0', STATUS_STYLE[session.status])}>
          {session.status}
        </span>
      </div>
      <p className="text-[11px] text-slate-400 truncate pl-5">{session.summary}</p>
      <div className="flex items-center gap-3 pl-5 mt-1">
        <span className="text-[10px] text-slate-600 flex items-center gap-1">
          <MessageSquare className="w-2.5 h-2.5" />{session.message_count}
        </span>
        {!!session.incident_count && (
          <span className="text-[10px] text-rose-400/70 flex items-center gap-1">
            <AlertCircle className="w-2.5 h-2.5" />{session.incident_count}
          </span>
        )}
        <span className="text-[10px] text-slate-600 ml-auto">{timeAgo(session.created_at)}</span>
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Trace panel — step-by-step replay
──────────────────────────────────────────────────────────────────────────── */

function TracePanel({ trace }: { trace: TraceEntry[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  if (!trace.length) return (
    <p className="text-xs text-slate-500 text-center py-10 px-4">No trace data for this session. Traces are captured when agent reasoning is enabled.</p>
  );

  return (
    <div className="p-4 space-y-1.5">
      <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold mb-3">
        Step-by-step replay · {trace.length} step{trace.length !== 1 ? 's' : ''}
      </p>
      {trace.map((step, idx) => {
        const Icon = TRACE_ICON[step.type] ?? Info;
        const color = TRACE_COLOR[step.type];
        const isOpen = expanded.has(step.id);
        return (
          <div key={step.id} className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
            <button
              onClick={() => step.detail && toggle(step.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
            >
              <span className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0 text-[10px] text-slate-500 font-mono">
                {idx + 1}
              </span>
              <Icon className={cn('w-3.5 h-3.5 shrink-0', color)} />
              <span className="flex-1 text-xs text-slate-200">{step.label}</span>
              {step.duration_ms != null && (
                <span className="text-[10px] text-slate-600 shrink-0">{step.duration_ms}ms</span>
              )}
              {step.risk_score != null && (
                <span className={cn(
                  'text-[10px] px-1.5 rounded font-medium shrink-0',
                  step.risk_score >= 0.7 ? 'text-rose-400 bg-rose-500/10' :
                  step.risk_score >= 0.4 ? 'text-amber-400 bg-amber-500/10' :
                  'text-emerald-400 bg-emerald-500/10',
                )}>
                  Risk {Math.round(step.risk_score * 100)}%
                </span>
              )}
              {step.approved != null && (
                step.approved
                  ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  : <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
              )}
              {step.detail && (
                isOpen
                  ? <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                  : <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
              )}
            </button>
            {isOpen && step.detail && (
              <div className="px-3 pb-3 pl-12">
                <pre className="text-[11px] text-slate-400 bg-black/30 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-40">
                  {step.detail}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Message thread
──────────────────────────────────────────────────────────────────────────── */

function MessageThread({ messages }: { messages: SessionMessage[] }) {
  if (!messages.length) return (
    <p className="text-xs text-slate-500 text-center py-10">No messages in this session.</p>
  );
  return (
    <div className="p-4 space-y-3">
      {messages.map((msg) => (
        <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
          <div className={cn(
            'w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-0.5',
            msg.role === 'user' ? 'bg-blue-500/20' : msg.role === 'tool' ? 'bg-violet-500/20' : 'bg-white/[0.07]',
          )}>
            {msg.role === 'user'
              ? <User className="w-3.5 h-3.5 text-blue-400" />
              : msg.role === 'tool'
                ? <Database className="w-3.5 h-3.5 text-violet-400" />
                : <Bot className="w-3.5 h-3.5 text-slate-400" />}
          </div>
          <div className={cn('flex-1 max-w-[80%]', msg.role === 'user' && 'flex flex-col items-end')}>
            <div className={cn(
              'rounded-xl px-3 py-2 text-xs leading-relaxed',
              msg.role === 'user'
                ? 'bg-blue-500/[0.12] border border-blue-500/20 text-slate-200'
                : msg.role === 'tool'
                  ? 'bg-violet-500/[0.07] border border-violet-500/15 text-slate-300 font-mono text-[11px]'
                  : 'bg-white/[0.04] border border-white/8 text-slate-300',
            )}>
              {msg.tool_name && <p className="text-[10px] text-violet-400 font-semibold mb-1">Tool: {msg.tool_name}</p>}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
            <div className="flex items-center gap-2 mt-1 px-1">
              <span className="text-[10px] text-slate-600">{fmtTime(msg.created_at)}</span>
              {msg.tokens_used != null && <span className="text-[10px] text-slate-600">{msg.tokens_used} tokens</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Session detail
──────────────────────────────────────────────────────────────────────────── */

function SessionDetail({ session, onBack }: { session: Session; onBack: () => void }) {
  const [detailTab, setDetailTab] = useState<'replay' | 'messages' | 'meta'>('replay');
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.conversations.getById(session.id).catch(() => null),
      api.conversations.getTrace(session.id).catch(() => null),
    ]).then(([convRes, traceRes]) => {
      if (cancelled) return;
      if (convRes?.data) setMessages(normalizeMessages(convRes.data));
      if (traceRes?.data && Array.isArray(traceRes.data)) setTrace(normalizeTrace(traceRes.data));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session.id]);

  const TABS = [
    { id: 'replay'   as const, label: 'Step Replay', Icon: Play },
    { id: 'messages' as const, label: 'Messages',    Icon: MessageSquare },
    { id: 'meta'     as const, label: 'Metadata',    Icon: FileText },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">{session.agent_name}</p>
          <p className="text-[11px] text-slate-500 truncate">{session.summary}</p>
        </div>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize shrink-0', STATUS_STYLE[session.status])}>
          {session.status}
        </span>
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-white/[0.05] shrink-0 bg-white/[0.02]">
        <span className="text-[11px] text-slate-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(session.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="text-[11px] text-slate-500 flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />{session.message_count} msgs
        </span>
        {session.incident_count ? (
          <span className="text-[11px] text-rose-400/80 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />{session.incident_count} incident{session.incident_count !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-[11px] text-emerald-400/70 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />Clean
          </span>
        )}
        {session.mode && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.07] text-slate-500 capitalize ml-auto">{session.mode}</span>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.05] shrink-0">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setDetailTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              detailTab === id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]',
            )}
          >
            <Icon className="w-3 h-3" />{label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          </div>
        ) : detailTab === 'replay' ? (
          <TracePanel trace={trace} />
        ) : detailTab === 'messages' ? (
          <MessageThread messages={messages} />
        ) : (
          <div className="p-4 space-y-px">
            {[
              ['Session ID',     session.id],
              ['Agent ID',       session.agent_id],
              ['Status',         session.status],
              ['Mode',           session.mode || '—'],
              ['Started',        new Date(session.created_at).toLocaleString('en-IN')],
              ['Last updated',   new Date(session.updated_at).toLocaleString('en-IN')],
              ['Messages',       String(session.message_count)],
              ['Incidents',      String(session.incident_count ?? 0)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start gap-3 py-2 border-b border-white/[0.04]">
                <span className="text-[11px] text-slate-500 w-28 shrink-0">{label}</span>
                <span className="text-[11px] text-slate-200 font-mono break-all">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Settings panel
──────────────────────────────────────────────────────────────────────────── */

function SettingsPanel() {
  const [enabled, setEnabled] = useState(true);
  const [retentionDays, setRetentionDays] = useState<30 | 90 | 365>(90);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.sessionRecording.get().then((res) => {
      if (res.data) {
        setEnabled(res.data.enabled);
        const d = res.data.retention_days;
        if (d === 30 || d === 90 || d === 365) setRetentionDays(d);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false);
    const res = await api.sessionRecording.update({ enabled, retention_days: retentionDays });
    setSaving(false);
    if (res.error) { setError(res.error); } else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  };

  if (loading) return (
    <div className="p-6 animate-pulse space-y-4">
      <div className="h-6 bg-slate-700 rounded w-48" />
      <div className="h-32 bg-slate-800 rounded" />
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-xl">
      {/* Enable toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.03]">
        <div>
          <p className="text-sm font-medium text-white">Enable session recording</p>
          <p className="text-xs text-slate-400 mt-0.5">Capture every agent conversation for audit and replay</p>
        </div>
        <button
          onClick={() => setEnabled((v) => !v)}
          className={cn('w-11 h-6 rounded-full transition-colors relative', enabled ? 'bg-blue-500' : 'bg-white/10')}
        >
          <span className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform', enabled ? 'translate-x-6' : 'translate-x-1')} />
        </button>
      </div>

      {/* Retention */}
      <div>
        <p className="text-sm font-medium text-white mb-3">Retention period</p>
        <div className="space-y-2">
          {RETENTION_OPTIONS.map(({ value, label, description, tier }) => (
            <button
              key={value}
              onClick={() => setRetentionDays(value)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors',
                retentionDays === value
                  ? 'border-blue-500/40 bg-blue-500/[0.07]'
                  : 'border-white/8 bg-white/[0.02] hover:border-white/15',
              )}
            >
              <div className={cn('w-4 h-4 rounded-full border-2 shrink-0', retentionDays === value ? 'border-blue-400 bg-blue-400' : 'border-slate-600')} />
              <span className="flex-1 text-sm text-white">{label}</span>
              <span className="text-xs text-slate-500">{description}</span>
              {tier !== 'free' && <Lock className="w-3 h-3 text-slate-600 shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 text-xs text-slate-500 rounded-xl border border-white/8 bg-white/[0.02] p-3">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400/50" />
        <p>Sessions are encrypted at rest (AES-256). Only org admins and managers can replay sessions. All replays are logged to the audit trail.</p>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <button
        onClick={() => void handleSave()}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-40"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? 'Saved' : 'Save settings'}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Page
──────────────────────────────────────────────────────────────────────────── */

export default function SessionRecordingPage() {
  const [pageTab, setPageTab] = useState<'sessions' | 'settings'>('sessions');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatus | 'all'>('all');

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await api.conversations.getAll({ limit: 50 });
      if (res.success && Array.isArray(res.data)) {
        setSessions(res.data.map(normalizeSession));
      }
    } catch { /* silently ignore */ }
    setLoadingSessions(false);
  }, []);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  const filtered = sessions.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    const q = search.toLowerCase();
    return !q || s.agent_name?.toLowerCase().includes(q) || s.summary?.toLowerCase().includes(q) || s.id.includes(q);
  });

  const PAGE_TABS = [
    { id: 'sessions' as const, label: 'Sessions', Icon: Play },
    { id: 'settings' as const, label: 'Settings', Icon: Shield },
  ];

  return (
    <div className="flex flex-col h-full bg-[#080b12]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
          <Eye className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-bold text-white">Session Recording</h1>
          <p className="text-[11px] text-slate-500">Replay every agent conversation step by step</p>
        </div>
        <button
          onClick={() => void loadSessions()}
          className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loadingSessions && 'animate-spin')} />
        </button>
      </div>

      {/* Top-level tabs */}
      <div className="flex items-center gap-1 px-5 py-2 border-b border-white/[0.05] shrink-0">
        {PAGE_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setPageTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              pageTab === id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]',
            )}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
        {pageTab === 'sessions' && (
          <span className="ml-auto text-[11px] text-slate-600">{filtered.length} session{filtered.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Body */}
      {pageTab === 'settings' ? (
        <div className="flex-1 overflow-y-auto"><SettingsPanel /></div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {/* Session list */}
          <div className={cn(
            'flex flex-col border-r border-white/8 shrink-0',
            selectedSession ? 'w-72' : 'flex-1 max-w-lg',
          )}>
            {/* Search + filter */}
            <div className="p-3 border-b border-white/[0.05] space-y-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search sessions…"
                  className="w-full bg-white/[0.05] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-blue-500/40 transition-colors"
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {(['all', 'completed', 'active', 'error', 'flagged'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize transition-colors',
                      statusFilter === s
                        ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                        : 'border-white/10 text-slate-500 hover:text-slate-300',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loadingSessions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                </div>
              ) : !filtered.length ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Play className="w-8 h-8 text-slate-700 mb-3" />
                  <p className="text-sm text-slate-500">No sessions found</p>
                  <p className="text-xs text-slate-600 mt-1">Agent conversations appear here once they run</p>
                </div>
              ) : (
                filtered.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    selected={selectedSession?.id === s.id}
                    onClick={() => setSelectedSession(s)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Detail panel */}
          {selectedSession ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <SessionDetail session={selectedSession} onBack={() => setSelectedSession(null)} />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Play className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Select a session to replay it</p>
                <p className="text-xs text-slate-600 mt-1">See every step, decision, and tool call your agent made</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
