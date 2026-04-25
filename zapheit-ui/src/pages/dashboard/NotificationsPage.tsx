import { useCallback, useEffect, useState } from 'react';
import {
  Bell, Plus, Trash2, Mail, CheckCircle2, AlertTriangle,
  Loader2, Send, Eye, EyeOff, RefreshCw, Info,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import type { AlertChannel, ChannelType, SeverityLevel } from '../../lib/api/alert-channels';
import { toast } from '../../lib/toast';
import { cn } from '../../lib/utils';

const CHANNEL_META: Record<ChannelType, { label: string; color: string; fields: Array<{ key: string; label: string; placeholder: string; secret?: boolean }> }> = {
  email: {
    label: 'Email',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    fields: [{ key: 'to', label: 'Recipient email', placeholder: 'alerts@yourcompany.com' }],
  },
  teams: {
    label: 'Microsoft Teams',
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    fields: [{ key: 'webhook_url', label: 'Incoming Webhook URL', placeholder: 'https://outlook.office.com/webhook/…', secret: true }],
  },
  pagerduty: {
    label: 'PagerDuty',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    fields: [{ key: 'routing_key', label: 'Routing Key', placeholder: 'abc123…', secret: true }],
  },
  opsgenie: {
    label: 'OpsGenie',
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    fields: [{ key: 'api_key', label: 'API Key', placeholder: 'xxxxxxxx-xxxx-…', secret: true }],
  },
};

const SEVERITY_ORDER: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];
const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  low: 'text-slate-400',
  medium: 'text-amber-400',
  high: 'text-orange-400',
  critical: 'text-rose-400',
};

const EVENT_TYPES = [
  { id: 'incident_high', label: 'High / Critical incident detected', severity: 'high' as SeverityLevel, always: true },
  { id: 'incident_medium', label: 'Medium severity incident', severity: 'medium' as SeverityLevel },
  { id: 'approval_pending', label: 'Approval request waiting (>1 hour)', severity: 'low' as SeverityLevel },
  { id: 'agent_paused', label: 'AI assistant paused by kill switch', severity: 'high' as SeverityLevel },
  { id: 'quota_80', label: 'Usage quota reaches 80%', severity: 'medium' as SeverityLevel },
  { id: 'pii_detected', label: 'PII detected in AI response', severity: 'high' as SeverityLevel },
];

function ChannelBadge({ type }: { type: ChannelType }) {
  const m = CHANNEL_META[type];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', m.color)}>
      {m.label}
    </span>
  );
}

interface FormState {
  name: string;
  channel_type: ChannelType;
  min_severity: SeverityLevel;
  enabled: boolean;
  config: Record<string, string>;
}

const DEFAULT_FORM: FormState = {
  name: '',
  channel_type: 'email',
  min_severity: 'high',
  enabled: true,
  config: {},
};

function ChannelForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState;
  onSave: (form: FormState) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const meta = CHANNEL_META[form.channel_type];

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setConfig = (key: string, value: string) =>
    setForm((f) => ({ ...f, config: { ...f.config, [key]: value } }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Ops Email"
            className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Channel type</label>
          <select
            value={form.channel_type}
            onChange={(e) => set('channel_type', e.target.value as ChannelType)}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-500/50"
          >
            {(Object.keys(CHANNEL_META) as ChannelType[]).map((t) => (
              <option key={t} value={t}>{CHANNEL_META[t].label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Minimum severity to trigger</label>
        <div className="flex gap-2">
          {SEVERITY_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set('min_severity', s)}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize',
                form.min_severity === s
                  ? `${SEVERITY_COLORS[s]} bg-white/10 border-white/20`
                  : 'text-slate-500 border-white/[0.06] hover:border-white/10',
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          This channel will be notified for <span className={SEVERITY_COLORS[form.min_severity]}>{form.min_severity}</span> and above.
        </p>
      </div>

      {meta.fields.map((field) => (
        <div key={field.key}>
          <label className="block text-xs text-slate-400 mb-1">{field.label}</label>
          <div className="relative">
            <input
              type={field.secret && !showSecrets[field.key] ? 'password' : 'text'}
              value={form.config[field.key] || ''}
              onChange={(e) => setConfig(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 pr-10"
            />
            {field.secret && (
              <button
                type="button"
                onClick={() => setShowSecrets((s) => ({ ...s, [field.key]: !s[field.key] }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showSecrets[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
            className="w-4 h-4 accent-cyan-500"
          />
          <span className="text-sm text-slate-300">Enabled</span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [channels, setChannels] = useState<AlertChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.alertChannels.list();
    if (res.success) setChannels(res.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async (form: FormState) => {
    setSaving(true);
    const res = await api.alertChannels.create({
      name: form.name,
      channel_type: form.channel_type,
      min_severity: form.min_severity,
      enabled: form.enabled,
      config: form.config,
    });
    setSaving(false);
    if (res.success && res.data) {
      setChannels((prev) => [...prev, res.data!]);
      setShowAdd(false);
      toast.success('Channel created');
    } else {
      toast.error(res.error || 'Failed to create channel');
    }
  };

  const handleUpdate = async (id: string, form: FormState) => {
    setSaving(true);
    const res = await api.alertChannels.update(id, {
      name: form.name,
      min_severity: form.min_severity,
      enabled: form.enabled,
      config: form.config,
    });
    setSaving(false);
    if (res.success && res.data) {
      setChannels((prev) => prev.map((c) => c.id === id ? res.data! : c));
      setEditId(null);
      toast.success('Channel updated');
    } else {
      toast.error(res.error || 'Failed to update channel');
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const res = await api.alertChannels.delete(id);
    setDeleting(null);
    if (res.success) {
      setChannels((prev) => prev.filter((c) => c.id !== id));
      toast.success('Channel removed');
    } else {
      toast.error(res.error || 'Failed to remove channel');
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    const res = await api.alertChannels.test(id);
    setTesting(null);
    if (res.success) {
      toast.success(res.data?.message || 'Test notification sent');
    } else {
      toast.error(res.error || 'Test failed');
    }
  };

  const toggleEnabled = async (ch: AlertChannel) => {
    const res = await api.alertChannels.update(ch.id, { enabled: !ch.enabled });
    if (res.success && res.data) {
      setChannels((prev) => prev.map((c) => c.id === ch.id ? res.data! : c));
    } else {
      toast.error('Failed to update channel');
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Automatic Notifications</h1>
            <p className="text-sm text-slate-400">Where to send alerts when something needs your attention.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.05]"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowAdd(true); setEditId(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add channel
          </button>
        </div>
      </div>

      {/* What triggers notifications */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-500 shrink-0" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">What triggers notifications</p>
        </div>
        <div className="space-y-2">
          {EVENT_TYPES.map((ev) => (
            <div key={ev.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {ev.always
                  ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  : <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                <span className="text-sm text-slate-300 truncate">{ev.label}</span>
              </div>
              <span className={cn('text-xs font-medium capitalize shrink-0', SEVERITY_COLORS[ev.severity])}>
                {ev.severity}+
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 pt-1 border-t border-white/[0.05]">
          Each channel has a minimum severity threshold. Events below that threshold are not sent to that channel.
        </p>
      </div>

      {/* Weekly digest info */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-white">Weekly digest is active</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Every Monday at 9am IST, all org members receive a summary: problems caught, messages sent, and estimated hours saved. No configuration needed.
          </p>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-5 space-y-2">
          <p className="text-sm font-semibold text-white mb-3">New notification channel</p>
          <ChannelForm
            initial={DEFAULT_FORM}
            onSave={handleCreate}
            onCancel={() => setShowAdd(false)}
            saving={saving}
          />
        </div>
      )}

      {/* Channel list */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {channels.length === 0 && !loading ? 'No channels yet' : `${channels.length} channel${channels.length !== 1 ? 's' : ''}`}
        </p>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-12 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No notification channels yet</p>
            <p className="text-xs text-slate-600 mt-1">Add email, Teams, PagerDuty, or OpsGenie to start receiving alerts</p>
          </div>
        ) : (
          channels.map((ch) => (
            <div
              key={ch.id}
              className={cn(
                'rounded-xl border p-4 transition-colors',
                ch.enabled ? 'border-white/[0.08] bg-white/[0.02]' : 'border-white/[0.05] bg-white/[0.01] opacity-60',
              )}
            >
              {editId === ch.id ? (
                <ChannelForm
                  initial={{
                    name: ch.name,
                    channel_type: ch.channel_type,
                    min_severity: ch.min_severity,
                    enabled: ch.enabled,
                    config: ch.config,
                  }}
                  onSave={(form) => handleUpdate(ch.id, form)}
                  onCancel={() => setEditId(null)}
                  saving={saving}
                />
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{ch.name}</span>
                      <ChannelBadge type={ch.channel_type} />
                      {!ch.enabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">Disabled</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Fires for <span className={cn('font-medium', SEVERITY_COLORS[ch.min_severity])}>{ch.min_severity}+</span> severity events
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => void handleTest(ch.id)}
                      disabled={testing === ch.id}
                      title="Send test notification"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/[0.06] transition-colors disabled:opacity-40"
                    >
                      {testing === ch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => void toggleEnabled(ch)}
                      title={ch.enabled ? 'Disable' : 'Enable'}
                      className={cn(
                        'p-1.5 rounded-lg transition-colors',
                        ch.enabled
                          ? 'text-emerald-400 hover:bg-white/[0.06]'
                          : 'text-slate-500 hover:text-emerald-400 hover:bg-white/[0.06]',
                      )}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditId(ch.id)}
                      className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] text-xs transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void handleDelete(ch.id)}
                      disabled={deleting === ch.id}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-white/[0.06] transition-colors disabled:opacity-40"
                    >
                      {deleting === ch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
