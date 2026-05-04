import { useState, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle, ArrowRight, Bell, Bot, CheckCircle2, ChevronDown,
  Loader2, Play, Plus, Shield, Sparkles, ToggleLeft, ToggleRight,
  Trash2, Zap,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { api } from '../../../../../lib/api-client';
import { toast } from '../../../../../lib/toast';
import { useAgents } from '../../../../../hooks/useData';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface TriggerTypeDef {
  label: string;
  description: string;
  Icon: LucideIcon;
}

interface EventTrigger {
  id: string;
  agentId: string;
  agentName: string;
  type: string;
  scope?: string;
  enabled: boolean;
  proposeApprove: boolean;
}

interface Props {
  connectorId: string;
  triggerTypes: Record<string, TriggerTypeDef>;
  nlExamples: string[];
  scopeLabel?: string;
  scopePlaceholder?: string;
  accentColor?: 'cyan' | 'orange' | 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'indigo';
}

/* ------------------------------------------------------------------ */
/*  Accent color helpers                                                */
/* ------------------------------------------------------------------ */

const ACCENT: Record<NonNullable<Props['accentColor']>, { ring: string; btn: string; badge: string }> = {
  cyan:    { ring: 'focus:ring-cyan-500/30',    btn: 'bg-cyan-500 hover:bg-cyan-400',       badge: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300' },
  orange:  { ring: 'focus:ring-orange-500/30',  btn: 'bg-orange-500 hover:bg-orange-400',   badge: 'border-orange-500/20 bg-orange-500/10 text-orange-300' },
  blue:    { ring: 'focus:ring-blue-500/30',    btn: 'bg-blue-500 hover:bg-blue-400',       badge: 'border-blue-500/20 bg-blue-500/10 text-blue-300' },
  violet:  { ring: 'focus:ring-violet-500/30',  btn: 'bg-violet-500 hover:bg-violet-400',   badge: 'border-violet-500/20 bg-violet-500/10 text-violet-300' },
  emerald: { ring: 'focus:ring-emerald-500/30', btn: 'bg-emerald-500 hover:bg-emerald-400', badge: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' },
  amber:   { ring: 'focus:ring-amber-500/30',   btn: 'bg-amber-500 hover:bg-amber-400',     badge: 'border-amber-500/20 bg-amber-500/10 text-amber-300' },
  rose:    { ring: 'focus:ring-rose-500/30',    btn: 'bg-rose-500 hover:bg-rose-400',       badge: 'border-rose-500/20 bg-rose-500/10 text-rose-300' },
  indigo:  { ring: 'focus:ring-indigo-500/30',  btn: 'bg-indigo-500 hover:bg-indigo-400',   badge: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300' },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function SharedAutomationTab({
  connectorId,
  triggerTypes,
  nlExamples,
  scopeLabel,
  scopePlaceholder,
  accentColor = 'cyan',
}: Props) {
  const { agents } = useAgents();
  const accent = ACCENT[accentColor];

  // NL command state
  const [command, setCommand] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [executing, setExecuting] = useState(false);
  const [commandResult, setCommandResult] = useState<{ success: boolean; message: string } | null>(null);

  // Event triggers state
  const [triggers, setTriggers] = useState<EventTrigger[]>([]);
  const [showAddTrigger, setShowAddTrigger] = useState(false);
  const [newTriggerType, setNewTriggerType] = useState<string>(Object.keys(triggerTypes)[0] || '');
  const [newTriggerAgent, setNewTriggerAgent] = useState('');
  const [newTriggerScope, setNewTriggerScope] = useState('');

  /* -- NL Command -------------------------------------------------- */
  const handleExecute = useCallback(async () => {
    if (!command.trim() || !selectedAgent) return;
    setExecuting(true);
    setCommandResult(null);
    try {
      const res = await api.unifiedConnectors.executeAction(connectorId, 'nl_command', {
        command: command.trim(),
        agentId: selectedAgent,
      });
      if (res.success) {
        if (res.data?.pending) {
          setCommandResult({ success: true, message: 'Action requires approval — sent to approval queue.' });
          toast.info('Action sent for approval');
        } else {
          setCommandResult({ success: true, message: res.data?.data?.message || 'Command executed successfully.' });
          toast.success('Command executed');
        }
      } else {
        setCommandResult({ success: false, message: res.error || 'Failed to execute command.' });
        toast.error('Command failed');
      }
    } catch {
      setCommandResult({ success: false, message: 'Network error — please try again.' });
    } finally {
      setExecuting(false);
    }
  }, [command, selectedAgent, connectorId]);

  /* -- Add trigger ------------------------------------------------- */
  const handleAddTrigger = useCallback(() => {
    if (!newTriggerAgent) { toast.error('Select an agent'); return; }
    const agent = agents.find((a) => a.id === newTriggerAgent);
    const trigger: EventTrigger = {
      id: `trigger_${Date.now()}`,
      agentId: newTriggerAgent,
      agentName: agent?.name || 'Unknown',
      type: newTriggerType,
      scope: newTriggerScope || undefined,
      enabled: true,
      proposeApprove: true,
    };
    setTriggers((prev) => [...prev, trigger]);
    setShowAddTrigger(false);
    setNewTriggerAgent('');
    setNewTriggerScope('');
    toast.success(`Trigger added: ${triggerTypes[newTriggerType]?.label}`);
  }, [newTriggerAgent, newTriggerType, newTriggerScope, agents, triggerTypes]);

  const toggleTrigger = (id: string, field: 'enabled' | 'proposeApprove') => {
    setTriggers((prev) => prev.map((t) => t.id === id ? { ...t, [field]: !t[field] } : t));
  };

  const removeTrigger = (id: string) => setTriggers((prev) => prev.filter((t) => t.id !== id));

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  const inputCls = `w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 ${accent.ring}`;

  return (
    <div className="p-5 space-y-8 max-w-2xl">

      {/* ====== Section 1: NL Commands ============================== */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Natural Language Commands</h3>
        </div>
        <p className="text-xs text-slate-500">
          Tell an agent what to do in plain English. The command is routed through the governance pipeline.
        </p>

        {/* Agent selector */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium block mb-1">Agent</label>
          <div className="relative">
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className={cn(inputCls, 'appearance-none pr-8')}
            >
              <option value="">Select an agent…</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {/* Command input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleExecute(); }}
            placeholder="Describe what you want the agent to do…"
            className={cn(inputCls, 'flex-1')}
            disabled={executing}
          />
          <button
            onClick={() => void handleExecute()}
            disabled={!command.trim() || !selectedAgent || executing}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0',
              accent.btn,
            )}
          >
            {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Execute
          </button>
        </div>

        {/* Result */}
        {commandResult && (
          <div className={cn(
            'flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs border',
            commandResult.success
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300',
          )}>
            {commandResult.success
              ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
            {commandResult.message}
          </div>
        )}

        {/* Examples */}
        {nlExamples.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider font-medium">Examples</p>
            {nlExamples.map((ex) => (
              <button
                key={ex}
                onClick={() => setCommand(ex)}
                className="block w-full text-left text-xs text-slate-500 hover:text-slate-300 py-1 px-2 rounded hover:bg-white/[0.03] transition-colors"
              >
                <ArrowRight className="w-3 h-3 inline mr-1.5 opacity-40" />
                {ex}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ====== Section 2: Event Triggers =========================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Event Triggers</h3>
          </div>
          <button
            onClick={() => setShowAddTrigger(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs text-slate-300 hover:text-white font-medium transition-colors"
          >
            <Plus className="w-3 h-3" /> Add trigger
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Configure agents to automatically respond to events. All actions go through the governance pipeline.
        </p>

        {/* Add trigger form */}
        {showAddTrigger && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <p className="text-xs font-semibold text-white">New Event Trigger</p>

            {/* Trigger type grid */}
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium block mb-1.5">Event type</label>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(triggerTypes).map(([type, meta]) => (
                  <button
                    key={type}
                    onClick={() => setNewTriggerType(type)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all',
                      newTriggerType === type
                        ? 'border-violet-500/30 bg-violet-500/[0.08] text-white'
                        : 'border-white/8 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]',
                    )}
                  >
                    <meta.Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs font-medium">{meta.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Agent */}
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium block mb-1">Agent</label>
              <select
                value={newTriggerAgent}
                onChange={(e) => setNewTriggerAgent(e.target.value)}
                className={cn(inputCls, 'appearance-none text-xs')}
              >
                <option value="">Select agent…</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {/* Optional scope */}
            {scopeLabel && (
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium block mb-1">
                  {scopeLabel} (optional)
                </label>
                <input
                  type="text"
                  value={newTriggerScope}
                  onChange={(e) => setNewTriggerScope(e.target.value)}
                  placeholder={scopePlaceholder || `Leave blank for all`}
                  className={cn(inputCls, 'text-xs')}
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAddTrigger}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-white text-xs font-semibold transition-colors"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
              <button
                onClick={() => setShowAddTrigger(false)}
                className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-xs text-slate-400 hover:text-white font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Triggers list */}
        {triggers.length === 0 && !showAddTrigger ? (
          <div className="text-center py-8">
            <Bot className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No event triggers configured.</p>
            <p className="text-[10px] text-slate-600 mt-1">Add a trigger to let agents respond to events automatically.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {triggers.map((trigger) => {
              const meta = triggerTypes[trigger.type];
              if (!meta) return null;
              return (
                <div
                  key={trigger.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
                    trigger.enabled ? 'border-white/8 bg-white/[0.02]' : 'border-white/5 bg-white/[0.01] opacity-60',
                  )}
                >
                  <meta.Icon className="w-4 h-4 text-violet-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white">{meta.label}</p>
                    <p className="text-[10px] text-slate-500">
                      <Bot className="w-3 h-3 inline mr-0.5" />
                      {trigger.agentName}
                      {trigger.scope && <span className="ml-1.5">in {trigger.scope}</span>}
                    </p>
                  </div>

                  {/* Propose/Auto */}
                  <button
                    onClick={() => toggleTrigger(trigger.id, 'proposeApprove')}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-all',
                      trigger.proposeApprove
                        ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                        : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
                    )}
                    title={trigger.proposeApprove ? 'Propose & approve mode' : 'Auto-execute mode'}
                  >
                    <Shield className="w-3 h-3" />
                    {trigger.proposeApprove ? 'Propose' : 'Auto'}
                  </button>

                  {/* Enable/disable */}
                  <button
                    onClick={() => toggleTrigger(trigger.id, 'enabled')}
                    className="text-slate-500 hover:text-white transition-colors"
                    title={trigger.enabled ? 'Disable' : 'Enable'}
                  >
                    {trigger.enabled
                      ? <ToggleRight className="w-5 h-5 text-cyan-400" />
                      : <ToggleLeft className="w-5 h-5" />}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => removeTrigger(trigger.id)}
                    className="text-slate-600 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ====== Section 3: Governance Info ========================== */}
      <section className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-white">Governance Pipeline</h3>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          All automated actions — NL commands, event triggers, and agent proposals — are routed through
          the governance pipeline. Write actions check action policies, may require human approval,
          and are logged with a full audit trail.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            { Icon: Zap,          color: 'text-amber-400',   label: 'Preflight gate' },
            { Icon: Shield,       color: 'text-cyan-400',    label: 'Policy check' },
            { Icon: CheckCircle2, color: 'text-emerald-400', label: 'Audit trail' },
            { Icon: Sparkles,     color: 'text-violet-400',  label: 'Agent governed' },
          ].map(({ Icon, color, label }) => (
            <span key={label} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.03] text-slate-400 font-medium">
              <Icon className={cn('w-3 h-3', color)} /> {label}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
