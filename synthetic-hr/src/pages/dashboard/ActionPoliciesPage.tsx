import { useEffect, useMemo, useState } from 'react';
import { Shield, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api, type ActionPolicyRow } from '../../lib/api-client';
import { toast } from '../../lib/toast';

type Editor = {
  service: string;
  action: string;
  enabled: boolean;
  require_approval: boolean;
  required_role: 'viewer' | 'manager' | 'admin' | 'super_admin';
  webhook_allowlist_text: string;
  notes: string;
};

const DEFAULT_ACTIONS: Array<{ service: string; action: string; hint: string }> = [
  { service: 'internal', action: 'support.ticket.create', hint: 'Create support ticket' },
  { service: 'internal', action: 'support.ticket.update_status', hint: 'Update ticket status' },
  { service: 'internal', action: 'sales.lead.create', hint: 'Create sales lead' },
  { service: 'internal', action: 'sales.lead.update_stage', hint: 'Update lead stage' },
  { service: 'internal', action: 'it.access_request.create', hint: 'Create access request' },
  { service: 'internal', action: 'it.access_request.decide', hint: 'Approve/reject access request' },
  { service: 'webhook', action: 'webhook.call', hint: 'External webhook call (runtime)' },
];

function allowlistToText(list: unknown): string {
  if (!Array.isArray(list)) return '';
  return list.map((h) => String(h)).join(', ');
}

function textToAllowlist(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, 50);
}

export default function ActionPoliciesPage() {
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ActionPolicyRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>({
    service: 'internal',
    action: 'support.ticket.create',
    enabled: true,
    require_approval: true,
    required_role: 'manager',
    webhook_allowlist_text: '',
    notes: '',
  });

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

  const load = async () => {
    setBusy(true);
    try {
      const res = await api.actionPolicies.list({ limit: 200 });
      if (!res.success) throw new Error(res.error || 'Failed to load action policies');
      setRows(res.data || []);
      if (!selectedId && res.data?.[0]?.id) setSelectedId(res.data[0].id);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load action policies');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    setEditor({
      service: selected.service,
      action: selected.action,
      enabled: Boolean(selected.enabled),
      require_approval: Boolean(selected.require_approval),
      required_role: selected.required_role || 'manager',
      webhook_allowlist_text: allowlistToText(selected.webhook_allowlist),
      notes: selected.notes || '',
    });
  }, [selected]);

  const upsert = async () => {
    setBusy(true);
    try {
      const payload = {
        service: editor.service.trim(),
        action: editor.action.trim(),
        enabled: editor.enabled,
        require_approval: editor.require_approval,
        required_role: editor.required_role,
        webhook_allowlist: editor.service === 'webhook' ? textToAllowlist(editor.webhook_allowlist_text) : [],
        notes: editor.notes.trim() || undefined,
      };
      const res = await api.actionPolicies.upsert(payload);
      if (!res.success) throw new Error(res.error || 'Failed to save policy');
      toast.success('Saved');
      await load();
      if (res.data?.id) setSelectedId(res.data.id);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save policy');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await api.actionPolicies.remove(selected.id);
      if (!res.success) throw new Error(res.error || 'Failed to delete policy');
      toast.success('Deleted');
      setSelectedId(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete policy');
    } finally {
      setBusy(false);
    }
  };

  const selectTemplate = (service: string, action: string) => {
    setSelectedId(null);
    setEditor((prev) => ({
      ...prev,
      service,
      action,
      webhook_allowlist_text: service === 'webhook' ? prev.webhook_allowlist_text : '',
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-cyan-400" />
            Action Policies
          </h1>
          <p className="text-sm text-slate-400 mt-1">Configure who can approve which connector actions and which webhook hosts are allowed.</p>
        </div>
        <button
          onClick={load}
          disabled={busy}
          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm border border-slate-700 inline-flex items-center gap-2 disabled:opacity-60"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <div className="text-sm text-slate-300">Policies ({rows.length})</div>
            <button
              onClick={() => {
                setSelectedId(null);
                setEditor({
                  service: 'internal',
                  action: 'support.ticket.create',
                  enabled: true,
                  require_approval: true,
                  required_role: 'manager',
                  webhook_allowlist_text: '',
                  notes: '',
                });
              }}
              className="px-2 py-1 rounded-md bg-slate-900/40 hover:bg-slate-900/60 border border-slate-700 text-xs text-slate-200 inline-flex items-center gap-1"
              title="New policy"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
          </div>
          <div className="max-h-[560px] overflow-auto">
            {rows.length === 0 ? (
              <div className="p-4 text-sm text-slate-400">No action policies configured yet.</div>
            ) : rows.map((r) => {
              const selectedRow = r.id === selectedId;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/40 ${selectedRow ? 'bg-cyan-500/10' : ''}`}
                >
                  <div className="text-sm text-white truncate">{r.service}:{r.action}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {r.enabled ? 'Enabled' : 'Disabled'} · role ≥ {r.required_role} · {r.require_approval ? 'Approval required' : 'Auto-approve'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-800/30 border border-slate-700 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-slate-400">Edit</div>
              <div className="text-white font-semibold truncate">
                {editor.service}:{editor.action}
              </div>
            </div>
            {selected ? (
              <button
                onClick={remove}
                disabled={busy}
                className="px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-200 text-sm border border-red-500/30 inline-flex items-center gap-2 disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Service</label>
              <input
                value={editor.service}
                onChange={(e) => setEditor((p) => ({ ...p, service: e.target.value }))}
                className="mt-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
                placeholder="internal | webhook"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Action</label>
              <input
                value={editor.action}
                onChange={(e) => setEditor((p) => ({ ...p, action: e.target.value }))}
                className="mt-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
                placeholder="support.ticket.create"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-slate-400">Quick templates</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DEFAULT_ACTIONS.map((t) => (
                  <button
                    key={`${t.service}:${t.action}`}
                    onClick={() => selectTemplate(t.service, t.action)}
                    className="px-3 py-1.5 rounded-full text-xs border bg-slate-800/30 text-slate-300 border-slate-700 hover:bg-slate-800/60"
                    title={t.hint}
                  >
                    {t.service}:{t.action}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400">Required role</label>
              <select
                value={editor.required_role}
                onChange={(e) => setEditor((p) => ({ ...p, required_role: e.target.value as any }))}
                className="mt-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
              >
                <option value="viewer">viewer</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">Enforced when approving connector_action jobs.</p>
            </div>

            <div>
              <label className="text-xs text-slate-400">Approval mode</label>
              <select
                value={editor.require_approval ? 'required' : 'auto'}
                onChange={(e) => setEditor((p) => ({ ...p, require_approval: e.target.value === 'required' }))}
                className="mt-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
              >
                <option value="required">Require approval</option>
                <option value="auto">Auto-approve</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">Auto-approve applies at job creation time.</p>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-slate-400">Enabled</label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editor.enabled}
                  onChange={(e) => setEditor((p) => ({ ...p, enabled: e.target.checked }))}
                />
                <span className="text-sm text-slate-200">{editor.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Disabled actions are blocked at runtime even if a job exists.</p>
            </div>

            {editor.service.trim() === 'webhook' ? (
              <div className="md:col-span-2">
                <label className="text-xs text-slate-400">Webhook allowlist (hosts)</label>
                <input
                  value={editor.webhook_allowlist_text}
                  onChange={(e) => setEditor((p) => ({ ...p, webhook_allowlist_text: e.target.value }))}
                  className="mt-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
                  placeholder="example.com, hooks.mycompany.com"
                />
                <p className="text-xs text-slate-500 mt-1">Runtime should only call allowed hosts for webhook actions.</p>
              </div>
            ) : null}

            <div className="md:col-span-2">
              <label className="text-xs text-slate-400">Notes</label>
              <textarea
                value={editor.notes}
                onChange={(e) => setEditor((p) => ({ ...p, notes: e.target.value }))}
                rows={4}
                className="mt-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
                placeholder="Why this policy exists, expected usage, owners…"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={upsert}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-sm font-semibold"
            >
              Save Policy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

