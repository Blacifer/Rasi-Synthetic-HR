import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertCircle, ArrowLeft, BarChart3, CheckCircle2,
  Clock, Loader2, Shield, TrendingUp, Zap,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { api } from '../../../lib/api-client';
import type { AuditLogEntry } from '../../../lib/api/governance';
import { APP_CATALOG } from './data/catalog';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function monthStart(): string {
  const d = new Date();
  d.setDate(1); d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function extractAppId(entry: AuditLogEntry): string | null {
  const d = entry.details as any;
  return d?.service || d?.app_id || d?.appId || d?.connector || entry.resource_id || null;
}

function extractRisk(entry: AuditLogEntry): 'high' | 'medium' | 'low' {
  const d = entry.details as any;
  const r = d?.risk_level || d?.riskLevel || d?.risk || '';
  if (r === 'high') return 'high';
  if (r === 'medium') return 'medium';
  return 'low';
}

const RISK_COLOR: Record<string, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};
const RISK_TEXT: Record<string, string> = {
  high: 'text-rose-400',
  medium: 'text-amber-400',
  low: 'text-emerald-400',
};

/* ------------------------------------------------------------------ */
/*  Mini bar chart (no library — pure CSS)                             */
/* ------------------------------------------------------------------ */

function BarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d) => (
        <div key={d.label} className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <span className="text-[10px] text-slate-400 font-medium">{d.value}</span>
          <div className="w-full relative flex-1 flex items-end">
            <div
              className="w-full rounded-t-md transition-all duration-500"
              style={{
                height: `${Math.max((d.value / max) * 100, 4)}%`,
                background: d.color,
                opacity: 0.85,
              }}
            />
          </div>
          <span className="text-[9px] text-slate-500 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Donut chart (pure CSS / SVG)                                       */
/* ------------------------------------------------------------------ */

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, d) => s + d.value, 0) || 1;
  const R = 40; const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="18" />
        {segments.map((seg) => {
          const dash = (seg.value / total) * C;
          const el = (
            <circle
              key={seg.label}
              cx="50" cy="50" r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth="18"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
            />
          );
          offset += dash;
          return el;
        })}
        <text
          x="50" y="50"
          textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize="14" fontWeight="bold"
          style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}
        >
          {total}
        </text>
      </svg>
      <div className="space-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-xs text-slate-400">{seg.label}</span>
            <span className="ml-auto text-xs font-semibold text-white">{seg.value}</span>
            <span className="text-[10px] text-slate-500">({Math.round((seg.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: typeof Activity; color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 flex items-start gap-4">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold mb-1">{label}</p>
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function AppAnalytics() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const from = monthStart();
        const [logRes, approvalRes] = await Promise.all([
          api.auditLogs.list({ from, limit: 500 }),
          api.approvals.list({ limit: 200 }),
        ]);
        setLogs(Array.isArray(logRes.data) ? logRes.data : []);
        const appData = (approvalRes as any)?.data;
        setApprovals(Array.isArray(appData) ? appData : Array.isArray(appData?.approvals) ? appData.approvals : []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---- Derived stats ---- */
  const stats = useMemo(() => {
    // Actions by app (top 8)
    const byApp: Record<string, number> = {};
    logs.forEach((l) => {
      const app = extractAppId(l);
      if (app) byApp[app] = (byApp[app] || 0) + 1;
    });

    const topApps = Object.entries(byApp)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, count]) => {
        const def = APP_CATALOG.find((a) => a.appId === id || a.serviceId === id);
        return { id, label: def?.name || id, count, color: def?.colorHex || '#6366f1' };
      });

    // Risk distribution
    const riskCounts = { high: 0, medium: 0, low: 0 };
    logs.forEach((l) => { riskCounts[extractRisk(l)]++; });

    // Approval stats
    const totalApprovals = approvals.length;
    const approved = approvals.filter((a) => a.status === 'approved').length;
    const denied = approvals.filter((a) => a.status === 'denied').length;
    const approvalRate = totalApprovals > 0 ? Math.round((approved / totalApprovals) * 100) : 0;

    // Avg decision time (approved/denied only)
    const decided = approvals.filter((a) => a.status === 'approved' || a.status === 'denied');
    const avgDecisionMs = decided.length > 0
      ? decided.reduce((sum, a) => {
          const created = new Date(a.created_at).getTime();
          const updated = new Date(a.updated_at || a.created_at).getTime();
          return sum + (updated - created);
        }, 0) / decided.length
      : 0;
    const avgDecisionMin = Math.round(avgDecisionMs / 60000);

    // Error rate by connector
    const byAppErrors: Record<string, { total: number; errors: number }> = {};
    logs.forEach((l) => {
      const app = extractAppId(l);
      if (!app) return;
      if (!byAppErrors[app]) byAppErrors[app] = { total: 0, errors: 0 };
      byAppErrors[app].total++;
      if (l.status === 'error' || l.status === 'failed') byAppErrors[app].errors++;
    });
    const errorRates = Object.entries(byAppErrors)
      .filter(([, v]) => v.total >= 2)
      .map(([id, v]) => {
        const def = APP_CATALOG.find((a) => a.appId === id || a.serviceId === id);
        return { id, label: def?.name || id, rate: Math.round((v.errors / v.total) * 100), total: v.total, errors: v.errors };
      })
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 6);

    return { topApps, riskCounts, totalApprovals, approved, denied, approvalRate, avgDecisionMin, errorRates, totalActions: logs.length };
  }, [logs, approvals]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080f1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-sm text-slate-400">Loading analytics…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080f1a]">
      {/* Header */}
      <div className="border-b border-white/[0.06] sticky top-0 z-10 bg-[#080f1a]/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard/apps')}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">App Analytics</h1>
              <p className="text-[11px] text-slate-500">Governed actions this month</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* ---- KPI row ---- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total actions" value={stats.totalActions} sub="this month" icon={Activity} color="bg-blue-500/20" />
          <StatCard label="Approval rate" value={`${stats.approvalRate}%`} sub={`${stats.approved} approved · ${stats.denied} denied`} icon={CheckCircle2} color="bg-emerald-500/20" />
          <StatCard
            label="Avg decision time"
            value={stats.avgDecisionMin < 60 ? `${stats.avgDecisionMin}m` : `${Math.round(stats.avgDecisionMin / 60)}h`}
            sub="per approval request"
            icon={Clock}
            color="bg-violet-500/20"
          />
          <StatCard label="Total approvals" value={stats.totalApprovals} sub="requests this month" icon={Shield} color="bg-amber-500/20" />
        </div>

        {/* ---- Charts row ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Actions by app (bar chart) */}
          <div className="lg:col-span-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-bold text-white">Actions by app</h2>
              <span className="ml-auto text-[11px] text-slate-500">this month</span>
            </div>
            {stats.topApps.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-slate-500 text-sm">No action data yet</div>
            ) : (
              <BarChart data={stats.topApps.map((a) => ({ label: a.label, value: a.count, color: a.color }))} />
            )}
          </div>

          {/* Risk distribution (donut) */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-5">
              <Shield className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-bold text-white">By risk level</h2>
            </div>
            {stats.totalActions === 0 ? (
              <div className="h-32 flex items-center justify-center text-slate-500 text-sm">No data yet</div>
            ) : (
              <DonutChart segments={[
                { label: 'Low risk', value: stats.riskCounts.low, color: '#10b981' },
                { label: 'Medium risk', value: stats.riskCounts.medium, color: '#f59e0b' },
                { label: 'High risk', value: stats.riskCounts.high, color: '#ef4444' },
              ]} />
            )}
          </div>
        </div>

        {/* ---- Bottom row: most active + error rates ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Most active connectors */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-5">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Most active connectors</h2>
            </div>
            {stats.topApps.length === 0 ? (
              <p className="text-sm text-slate-500">No activity recorded this month.</p>
            ) : (
              <div className="space-y-3">
                {stats.topApps.map((app, i) => {
                  const pct = Math.round((app.count / (stats.topApps[0]?.count || 1)) * 100);
                  return (
                    <div key={app.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-4 text-right">{i + 1}</span>
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                            style={{ background: app.color }}
                          >
                            {app.label[0]}
                          </div>
                          <span className="text-slate-200 font-medium">{app.label}</span>
                        </div>
                        <span className="text-slate-400 font-medium">{app.count} actions</span>
                      </div>
                      <div className="ml-6 h-1 rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: app.color, opacity: 0.7 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Error rates by connector */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-5">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-bold text-white">Error rate by connector</h2>
            </div>
            {stats.errorRates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                <p className="text-sm text-slate-400">No errors recorded this month</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.errorRates.map((app) => (
                  <div key={app.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-300 font-medium truncate">{app.label}</span>
                        <span className={cn('font-semibold ml-2', app.rate > 20 ? 'text-rose-400' : app.rate > 5 ? 'text-amber-400' : 'text-emerald-400')}>
                          {app.rate}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06]">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', app.rate > 20 ? 'bg-rose-500' : app.rate > 5 ? 'bg-amber-500' : 'bg-emerald-500')}
                          style={{ width: `${Math.min(app.rate, 100)}%`, opacity: 0.8 }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">{app.errors}/{app.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Empty state */}
        {stats.totalActions === 0 && !error && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] py-16 flex flex-col items-center text-center gap-3">
            <BarChart3 className="w-10 h-10 text-slate-600" />
            <p className="text-sm font-semibold text-slate-400">No governed actions this month yet</p>
            <p className="text-xs text-slate-500 max-w-sm">
              Once agents start using connected apps, action data will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
