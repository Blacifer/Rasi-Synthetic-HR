import { useEffect, useMemo, useState } from 'react';
import { Check, X, RefreshCw, Clock, PlayCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from '../../lib/toast';
import type { AgentJob } from '../../types';

const WORK_ITEMS_FOCUS_KEY = 'synthetic_hr.work_items_focus';

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending approval',
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  canceled: 'Canceled',
};

function statusIcon(status: string) {
  if (status === 'pending_approval') return Clock;
  if (status === 'queued' || status === 'running') return PlayCircle;
  if (status === 'succeeded') return CheckCircle2;
  if (status === 'failed') return AlertCircle;
  return Clock;
}

function prettyJson(value: any): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value);
  }
}

function detectWorkItemFocus(job: AgentJob): { tab: 'support' | 'sales' | 'it'; id: string } | null {
  const output: any = (job as any)?.output || {};
  const actionRun = output?.action_run;
  const resourceType = String(actionRun?.output?.resource_type || '');
  const resourceId = String(actionRun?.output?.resource_id || output?.resource?.id || '');

  if (!resourceId) return null;
  if (resourceType === 'support_ticket') return { tab: 'support', id: resourceId };
  if (resourceType === 'sales_lead') return { tab: 'sales', id: resourceId };
  if (resourceType === 'it_access_request') return { tab: 'it', id: resourceId };
  return null;
}

export default function JobsInboxPage({ agents }: { agents: { id: string; name: string }[] }) {
  const [statusFilter, setStatusFilter] = useState<string>('pending_approval');
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const agentNameById = useMemo(() => new Map(agents.map((a) => [a.id, a.name])), [agents]);

  const loadJobs = async () => {
    setBusy(true);
    try {
      const res = await api.jobs.list({ status: statusFilter, limit: 100 });
      if (!res.success) throw new Error(res.error || 'Failed to load jobs');
      setJobs((res.data || []) as any);
      if (!selectedJobId && res.data?.[0]?.id) setSelectedJobId(res.data[0].id);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load jobs');
      setJobs([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || null;
  const focus = selectedJob ? detectWorkItemFocus(selectedJob) : null;

  const decide = async (jobId: string, decision: 'approved' | 'rejected') => {
    try {
      const res = await api.jobs.decide(jobId, decision);
      if (!res.success) throw new Error(res.error || 'Decision failed');
      toast.success(decision === 'approved' ? 'Approved' : 'Rejected');
      await loadJobs();
    } catch (err: any) {
      toast.error(err?.message || 'Decision failed');
    }
  };

  const statuses = [
    'pending_approval',
    'queued',
    'running',
    'succeeded',
    'failed',
    'canceled',
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Jobs & Approvals</h1>
          <p className="text-sm text-slate-400 mt-1">Approve playbooks, monitor execution, and review outputs with audit trail.</p>
        </div>
        <button
          onClick={loadJobs}
          disabled={busy}
          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm border border-slate-700 inline-flex items-center gap-2 disabled:opacity-60"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              statusFilter === s
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                : 'bg-slate-800/30 text-slate-300 border-slate-700 hover:bg-slate-800/60'
            }`}
          >
            {STATUS_LABELS[s] || s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <div className="text-sm text-slate-300">Jobs ({jobs.length})</div>
            <div className="text-xs text-slate-500">{busy ? 'Loading…' : ''}</div>
          </div>
          <div className="max-h-[560px] overflow-auto">
            {jobs.length === 0 ? (
              <div className="p-4 text-sm text-slate-400">No jobs in this status.</div>
            ) : (
              jobs.map((job) => {
                const Icon = statusIcon(String(job.status || ''));
                const selected = job.id === selectedJobId;
                const agentName = job.agent_id ? agentNameById.get(job.agent_id) : null;
                return (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/40 ${
                      selected ? 'bg-cyan-500/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <Icon className={`w-4 h-4 ${selected ? 'text-cyan-300' : 'text-slate-400'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white truncate">{agentName || job.agent_id || 'Unbound agent'}</div>
                        <div className="text-xs text-slate-400 mt-0.5 truncate">
                          {job.type} · {STATUS_LABELS[String(job.status)] || job.status}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 truncate">{job.created_at}</div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-800/30 border border-slate-700 rounded-xl p-5 space-y-4">
          {!selectedJob ? (
            <div className="text-sm text-slate-400">Select a job to view details.</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm text-slate-400">Job</div>
                  <div className="text-white font-semibold truncate">{selectedJob.id}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Status: <span className="text-slate-200">{STATUS_LABELS[String(selectedJob.status)] || selectedJob.status}</span> · Type:{' '}
                    <span className="text-slate-200">{selectedJob.type}</span>
                  </div>
                </div>
                {String(selectedJob.status) === 'pending_approval' ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => decide(selectedJob.id, 'rejected')}
                      className="px-3 py-2 rounded-lg bg-slate-900/40 hover:bg-slate-900/60 text-slate-200 text-sm border border-slate-700 inline-flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => decide(selectedJob.id, 'approved')}
                      className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900/30 border border-slate-700 rounded-lg p-3">
                  <div className="text-slate-400">Agent</div>
                  <div className="text-slate-200 mt-1">{selectedJob.agent_id ? (agentNameById.get(selectedJob.agent_id) || selectedJob.agent_id) : '—'}</div>
                </div>
                <div className="bg-slate-900/30 border border-slate-700 rounded-lg p-3">
                  <div className="text-slate-400">Runtime</div>
                  <div className="text-slate-200 mt-1">{selectedJob.runtime_instance_id || '—'}</div>
                </div>
                <div className="bg-slate-900/30 border border-slate-700 rounded-lg p-3">
                  <div className="text-slate-400">Started</div>
                  <div className="text-slate-200 mt-1">{selectedJob.started_at || '—'}</div>
                </div>
                <div className="bg-slate-900/30 border border-slate-700 rounded-lg p-3">
                  <div className="text-slate-400">Finished</div>
                  <div className="text-slate-200 mt-1">{selectedJob.finished_at || '—'}</div>
                </div>
              </div>

              {selectedJob.error ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-200">
                  {selectedJob.error}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3">
                {focus ? (
                  <div className="flex items-center justify-between gap-3 bg-slate-900/30 border border-slate-700 rounded-lg p-3">
                    <div className="text-xs text-slate-300">
                      Created resource: <span className="text-slate-100">{focus.tab}</span> ·{' '}
                      <span className="text-slate-100">{focus.id}</span>
                    </div>
                    <button
                      onClick={() => {
                        try {
                          localStorage.setItem(WORK_ITEMS_FOCUS_KEY, JSON.stringify(focus));
                        } catch {
                          // ignore
                        }
                        window.dispatchEvent(new Event('storage'));
                      }}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm border border-slate-700"
                      title="Open Work Items and highlight the created record"
                    >
                      View in Work Items
                    </button>
                  </div>
                ) : null}
                <div>
                  <div className="text-xs text-slate-400 mb-2">Input</div>
                  <pre className="text-xs text-slate-200 bg-slate-900/40 border border-slate-700 rounded-lg p-3 overflow-auto max-h-[220px]">
                    {prettyJson(selectedJob.input)}
                  </pre>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-2">Output</div>
                  <pre className="text-xs text-slate-200 bg-slate-900/40 border border-slate-700 rounded-lg p-3 overflow-auto max-h-[300px]">
                    {prettyJson(selectedJob.output)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
