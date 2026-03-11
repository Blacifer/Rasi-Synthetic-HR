import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, RefreshCw } from 'lucide-react';
import type { AIAgent } from '../../types';
import { api } from '../../lib/api-client';
import { toast } from '../../lib/toast';
import type { PlaybookPackId, Playbook } from '../../lib/playbooks/types';
import { PLAYBOOK_PACKS, PLAYBOOKS } from '../../lib/playbooks/registry';

const PACK_STORAGE_KEY = 'synthetic_hr.playbooks.pack';

export default function PlaybooksPage({
  agents,
  onNavigate,
}: {
  agents: AIAgent[];
  onNavigate?: (page: string) => void;
}) {
  const allPlaybooks = useMemo(() => PLAYBOOKS, []);

  const initialPack = (() => {
    try {
      const saved = localStorage.getItem(PACK_STORAGE_KEY) as PlaybookPackId | null;
      if (saved && ['all', 'hr', 'support', 'sales', 'it'].includes(saved)) return saved;
    } catch {
      // ignore
    }
    return 'all' as PlaybookPackId;
  })();

  const [pack, setPack] = useState<PlaybookPackId>(initialPack);
  const [showDisabled, setShowDisabled] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [enabledByPlaybookId, setEnabledByPlaybookId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const res = await api.playbooks.listSettings();
      if (!res.success) return;
      const map: Record<string, boolean> = {};
      for (const row of res.data || []) {
        if (row?.playbook_id) map[row.playbook_id] = Boolean(row.enabled);
      }
      setEnabledByPlaybookId(map);
    })().catch(() => void 0);
  }, []);

  const packPlaybooks = useMemo(() => {
    const filtered = pack === 'all'
      ? allPlaybooks
      : allPlaybooks.filter((p) => p.pack === pack);

    if (manageMode && showDisabled) return filtered;
    if (!manageMode && showDisabled) return filtered;

    // Default view: hide disabled (if setting exists); otherwise show.
    return filtered.filter((p) => enabledByPlaybookId[p.id] !== false);
  }, [allPlaybooks, enabledByPlaybookId, manageMode, pack, showDisabled]);

  const [selectedPlaybookId, setSelectedPlaybookId] = useState(() => packPlaybooks[0]?.id || allPlaybooks[0]?.id || '');
  const selectedPlaybook: Playbook | undefined =
    packPlaybooks.find((p) => p.id === selectedPlaybookId) ||
    allPlaybooks.find((p) => p.id === selectedPlaybookId) ||
    packPlaybooks[0] ||
    allPlaybooks[0];

  const recommendedAgents = useMemo(() => {
    if (!selectedPlaybook?.recommendedAgentType) return agents;
    const match = agents.filter((a) => String(a.agent_type || '').toLowerCase() === selectedPlaybook.recommendedAgentType);
    return match.length ? match : agents;
  }, [agents, selectedPlaybook?.recommendedAgentType]);

  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  const ensureAgentSelected = () => {
    if (selectedAgentId) return selectedAgentId;
    const first = recommendedAgents[0]?.id || agents[0]?.id || '';
    if (first) setSelectedAgentId(first);
    return first;
  };

  const runPlaybook = async () => {
    const agentId = ensureAgentSelected();
    if (!agentId) {
      toast.error('No agents found. Create an agent first (Fleet or Agent Templates).');
      return;
    }

    if (!selectedPlaybook) return;
    setBusy(true);
    setLastJobId(null);
    setLastStatus(null);
    try {
      const built = selectedPlaybook.buildJob(inputs);
      const res = await api.jobs.create({
        agent_id: agentId,
        type: built.type,
        input: built.input,
      });

      if (!res.success || !res.data?.job?.id) {
        throw new Error(res.error || 'Failed to create job');
      }

      setLastJobId(res.data.job.id);
      setLastStatus(res.data.job.status || 'pending_approval');

      toast.success('Playbook submitted. Approve it in Jobs & Approvals to run.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit playbook');
    } finally {
      setBusy(false);
    }
  };

  const resetInputs = () => setInputs({});

  const updatePack = (next: PlaybookPackId) => {
    setPack(next);
    try {
      localStorage.setItem(PACK_STORAGE_KEY, next);
    } catch {
      // ignore
    }

    const nextList = next === 'all' ? allPlaybooks : allPlaybooks.filter((p) => p.pack === next);
    const nextSelected = nextList[0]?.id || '';
    if (nextSelected) setSelectedPlaybookId(nextSelected);
    setInputs({});
    setLastJobId(null);
    setLastStatus(null);
  };

  const setPlaybookEnabled = async (playbookId: string, enabled: boolean) => {
    setEnabledByPlaybookId((prev) => ({ ...prev, [playbookId]: enabled }));
    const res = await api.playbooks.updateSetting(playbookId, { enabled });
    if (!res.success) {
      // revert
      setEnabledByPlaybookId((prev) => ({ ...prev, [playbookId]: !enabled }));
      toast.error(res.error || 'Failed to update playbook setting');
      return;
    }
    toast.success(enabled ? 'Playbook enabled' : 'Playbook disabled');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-cyan-400" />
            Playbooks
          </h1>
          <p className="text-sm text-slate-400 mt-1">Standard workflows that run via Agents with approvals and audit trail.</p>
        </div>
        <button
          onClick={() => onNavigate?.('jobs')}
          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm border border-slate-700"
        >
          Open Jobs & Approvals
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
        {([
          { id: 'all', label: 'All' },
          ...PLAYBOOK_PACKS.map((p) => ({ id: p.id, label: p.label })),
        ] as Array<{ id: PlaybookPackId; label: string }>).map((item) => (
          <button
            key={item.id}
            onClick={() => updatePack(item.id)}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              pack === item.id
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                : 'bg-slate-800/30 text-slate-300 border-slate-700 hover:bg-slate-800/60'
            }`}
          >
            {item.label}
          </button>
        ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDisabled((v) => !v)}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              showDisabled
                ? 'bg-slate-700 text-slate-100 border-slate-600'
                : 'bg-slate-800/30 text-slate-300 border-slate-700 hover:bg-slate-800/60'
            }`}
            title="Show disabled playbooks"
          >
            {showDisabled ? 'Showing disabled' : 'Hide disabled'}
          </button>
          <button
            onClick={() => setManageMode((v) => !v)}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              manageMode
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-slate-800/30 text-slate-300 border-slate-700 hover:bg-slate-800/60'
            }`}
            title="Enable/disable playbooks (requires permission)"
          >
            {manageMode ? 'Managing' : 'Manage'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          {packPlaybooks.map((pb) => {
            const Icon = pb.icon;
            const selected = pb.id === selectedPlaybookId;
            const enabled = enabledByPlaybookId[pb.id] !== false;
            return (
              <button
                key={pb.id}
                onClick={() => setSelectedPlaybookId(pb.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  selected ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800/60'
                } ${!enabled ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-900/40 border border-slate-700 flex items-center justify-center">
                    <Icon className={`w-5 h-5 ${selected ? 'text-cyan-300' : 'text-slate-300'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-semibold truncate">{pb.title}</div>
                    <div className="text-xs text-slate-400 mt-1 line-clamp-2">{pb.description}</div>
                    <div className="text-[10px] text-slate-500 mt-2 uppercase tracking-wide">{pb.pack}</div>
                  </div>
                  {manageMode ? (
                    <div className="ml-auto flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        enabled ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' : 'border-slate-600 text-slate-300 bg-slate-900/20'
                      }`}>
                        {enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void setPlaybookEnabled(pb.id, !enabled);
                        }}
                        className="px-2 py-1 rounded-md bg-slate-900/40 hover:bg-slate-900/60 border border-slate-700 text-xs text-slate-200"
                      >
                        {enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-2 bg-slate-800/30 border border-slate-700 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">{selectedPlaybook?.title}</h2>
              <p className="text-sm text-slate-400 mt-1">{selectedPlaybook?.description}</p>
            </div>
            <button
              onClick={resetInputs}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm border border-slate-700 inline-flex items-center gap-2"
              title="Clear inputs"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-slate-400">Agent</label>
              <select
                value={selectedAgentId || (recommendedAgents[0]?.id || '')}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="mt-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
              >
                {(recommendedAgents.length ? recommendedAgents : agents).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.agent_type})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                If the agent isn’t deployed to a runtime yet, deploy it from Fleet → Deploy.
              </p>
            </div>

            {selectedPlaybook?.fields.map((field) => {
              const value = inputs[field.key] || '';
              if (field.kind === 'textarea') {
                return (
                  <div key={field.key} className="md:col-span-2">
                    <label className="text-xs text-slate-400">{field.label}</label>
                    <textarea
                      value={value}
                      onChange={(e) => setInputs((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={6}
                      className="mt-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
                    />
                  </div>
                );
              }

              return (
                <div key={field.key}>
                  <label className="text-xs text-slate-400">{field.label}</label>
                  <input
                    value={value}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="mt-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-400">
              {lastJobId ? (
                <span>
                  Last job: <span className="text-slate-200">{lastJobId}</span> · status: <span className="text-slate-200">{lastStatus}</span>
                </span>
              ) : (
                <span>Submitting creates a job in <span className="text-slate-200">pending approval</span> state.</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate?.('jobs')}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm border border-slate-700"
              >
                Jobs
              </button>
              <button
                onClick={runPlaybook}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-sm font-semibold"
              >
                {busy ? 'Submitting…' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
