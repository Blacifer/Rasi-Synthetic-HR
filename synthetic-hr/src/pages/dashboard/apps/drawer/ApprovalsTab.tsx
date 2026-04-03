import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import type { ApprovalRequest } from '../../../../lib/api-client';
import { toast } from '../../../../lib/toast';

interface ApprovalsTabProps {
  serviceId: string;
}

export function ApprovalsTab({ serviceId }: ApprovalsTabProps) {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [items, setItems] = useState<ApprovalRequest[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const res = await api.approvals.list({ service: serviceId, status: 'pending', limit: 50 });
      if (mounted && res.success) {
        setItems(res.data || []);
      }
      if (mounted) setLoading(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [serviceId]);

  const updateItem = (id: string, status: ApprovalRequest['status']) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, status } : item).filter((item) => item.status === 'pending'));
  };

  const approve = async (id: string) => {
    setBusyId(id);
    const res = await api.approvals.approve(id);
    if (res.success) {
      updateItem(id, 'approved');
      toast.success('Approval granted');
    } else {
      toast.error((res as any).error || 'Approval failed');
    }
    setBusyId(null);
  };

  const deny = async (id: string) => {
    setBusyId(id);
    const res = await api.approvals.deny(id);
    if (res.success) {
      updateItem(id, 'denied');
      toast.success('Request denied');
    } else {
      toast.error((res as any).error || 'Deny failed');
    }
    setBusyId(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 text-slate-500 animate-spin" /></div>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <p className="text-sm font-medium text-white">No pending approvals</p>
        <p className="mt-1 text-xs text-slate-400">Write actions that require a human decision will appear here before the backend fires the real tool call.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Approve or reject high-risk agent actions before Rasi executes them in the connected app.</p>
      {items.map((item) => {
        const isBusy = busyId === item.id;
        return (
          <div key={item.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <p className="text-xs font-semibold text-white">{item.action}</p>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{item.reason_message || 'Approval required before execution.'}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  Agent: {item.agent_id || 'Manual/operator'} · Risk: {item.risk_score ?? 'n/a'}
                </p>
                {item.recommended_next_action && (
                  <p className="mt-1 text-[11px] text-cyan-300">Next: {item.recommended_next_action}</p>
                )}
                <pre className="mt-2 rounded-lg border border-white/8 bg-black/20 p-2 text-[10px] text-slate-400 overflow-x-auto">
{JSON.stringify(item.action_payload || {}, null, 2)}
                </pre>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => void approve(item.id)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[11px] font-medium text-emerald-200 border border-emerald-400/20 disabled:opacity-60"
                >
                  {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  Approve
                </button>
                <button
                  onClick={() => void deny(item.id)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-3 py-1.5 text-[11px] font-medium text-rose-200 border border-rose-400/20 disabled:opacity-60"
                >
                  <XCircle className="w-3 h-3" />
                  Reject
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
