import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowDown, ArrowUp, Award, BarChart3, Download, IndianRupee,
  ShieldCheck, SlidersHorizontal, TrendingUp, Users, Zap,
} from 'lucide-react';
import { useAgents, useCostData, useIncidents } from '../../hooks/useData';
import { calculatePortfolioRoi, formatInr, getDepartment, roiTone } from '../../lib/roi';
import { USD_TO_INR } from '../../lib/currency';

type SortKey = 'department' | 'agents' | 'actions' | 'valueInr' | 'costInr' | 'roiRatio';

function StatCard({ label, value, detail, tone = 'text-white', icon: Icon }: { label: string; value: string; detail?: string; tone?: string; icon: typeof IndianRupee }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-400">{detail}</p> : null}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05] p-8 text-center">
      <TrendingUp className="mx-auto mb-3 h-10 w-10 text-cyan-300" />
      <p className="text-sm font-semibold text-white">No ROI data yet</p>
      <p className="mt-1 text-sm text-slate-400">{children}</p>
    </div>
  );
}

function lastSixMonths() {
  const months: Array<{ key: string; label: string; start: Date }> = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('en-IN', { month: 'short' }),
      start: date,
    });
  }
  return months;
}

export default function ROIPage() {
  const { agents } = useAgents();
  const { incidents } = useIncidents();
  const { costData } = useCostData();
  const [hourlyRate, setHourlyRate] = useState(800);
  const [sortKey, setSortKey] = useState<SortKey>('valueInr');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  const portfolio = useMemo(() => calculatePortfolioRoi(agents, costData, incidents, hourlyRate), [agents, costData, incidents, hourlyRate]);
  const departments = useMemo(() => {
    return [...portfolio.departments].sort((a: any, b: any) => {
      const left = a[sortKey];
      const right = b[sortKey];
      const delta = typeof left === 'string' ? String(left).localeCompare(String(right)) : Number(left) - Number(right);
      return sortDir === 'asc' ? delta : -delta;
    });
  }, [portfolio.departments, sortDir, sortKey]);

  const leaderboard = portfolio.agentRois
    .filter((item) => departmentFilter === 'all' || item.department === departmentFilter)
    .sort((a, b) => b.valueInr - a.valueInr);
  const topAgents = leaderboard.slice(0, 5);
  const topGovernedActions = incidents
    .slice()
    .sort((a, b) => {
      const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      return (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
    })
    .slice(0, 5);

  const trend = useMemo(() => {
    return lastSixMonths().map((month, index, arr) => {
      const next = index === arr.length - 1 ? new Date(month.start.getFullYear(), month.start.getMonth() + 1, 1) : arr[index + 1].start;
      const monthCosts = costData.filter((item) => {
        const date = new Date(item.date);
        return date >= month.start && date < next;
      });
      const requests = monthCosts.reduce((sum, item) => sum + Number(item.requests || 0), 0);
      const costInr = monthCosts.reduce((sum, item) => sum + Number(item.cost || 0) * USD_TO_INR, 0);
      const hours = Math.round(requests * 0.2);
      return {
        ...month,
        valueInr: Math.max(0, hours * hourlyRate),
        costInr,
      };
    });
  }, [costData, hourlyRate]);

  const maxTrend = Math.max(...trend.flatMap((item) => [item.valueInr, item.costInr]), 1);
  const reportPeriod = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const hasRoiData = portfolio.totalValueInr > 0 || portfolio.totalCostInr > 0 || agents.length > 0;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body { background: #fff !important; color: #0f172a !important; }
          .print\\:hidden { display: none !important; }
          .cfo-report { display: block !important; color: #0f172a !important; }
          .app-bg, main { background: #fff !important; }
        }
        @media screen { .cfo-report { display: none; } }
      `}</style>

      <div className="flex flex-col gap-4 print:hidden lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ROI Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">INR value created by every agent, action, and department this month.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
        >
          <Download className="h-4 w-4" />
          Export CFO Report
        </button>
      </div>

      {!hasRoiData ? (
        <EmptyState>Deploy your first agent to start tracking value.</EmptyState>
      ) : (
        <>
          <div className="grid gap-3 print:hidden md:grid-cols-3 xl:grid-cols-6">
            <StatCard icon={IndianRupee} label="Total INR saved" value={formatInr(portfolio.totalValueInr)} tone="text-emerald-300" />
            <StatCard icon={IndianRupee} label="Total cost" value={formatInr(portfolio.totalCostInr)} />
            <StatCard icon={TrendingUp} label="Net value" value={formatInr(portfolio.netValueInr)} tone={portfolio.netValueInr >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
            <StatCard icon={Award} label="Overall ROI" value={`${portfolio.roiRatio >= 99 ? '∞' : portfolio.roiRatio.toFixed(1)}x`} tone={roiTone(portfolio.roiRatio)} />
            <StatCard icon={Users} label="Hours saved" value={`${portfolio.totalHoursSaved.toLocaleString('en-IN')}h`} tone="text-cyan-300" />
            <StatCard icon={ShieldCheck} label="Actions" value={`${portfolio.totalActions.toLocaleString('en-IN')} / ${portfolio.totalBlocked.toLocaleString('en-IN')}`} detail="completed / blocked" />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 print:hidden">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
                  <SlidersHorizontal className="h-4 w-4 text-cyan-300" />
                  Set your team's average hourly rate
                </h2>
                <p className="mt-1 text-xs text-slate-400">Adjusting this recalculates savings live across every department and agent.</p>
              </div>
              <span className="text-lg font-bold text-white">{formatInr(hourlyRate)}/hour</span>
            </div>
            <input
              type="range"
              min={200}
              max={5000}
              step={50}
              value={hourlyRate}
              onChange={(event) => setHourlyRate(Number(event.target.value))}
              className="mt-4 w-full accent-cyan-400"
            />
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 print:hidden">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
              <BarChart3 className="h-4 w-4 text-cyan-300" />
              Department breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    {[
                      ['department', 'Department'],
                      ['agents', 'Agents'],
                      ['actions', 'Actions'],
                      ['valueInr', 'INR saved'],
                      ['costInr', 'Cost'],
                      ['roiRatio', 'ROI'],
                    ].map(([key, label]) => (
                      <th key={key} className="px-3 py-2">
                        <button onClick={() => handleSort(key as SortKey)} className="inline-flex items-center gap-1 hover:text-white">
                          {label}
                          {sortKey === key ? sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : null}
                        </button>
                      </th>
                    ))}
                    <th className="px-3 py-2">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {departments.map((row) => (
                    <tr key={row.department} onClick={() => setDepartmentFilter(row.department)} className="cursor-pointer transition-colors hover:bg-white/[0.04]">
                      <td className="px-3 py-3 font-semibold text-white">{row.department}</td>
                      <td className="px-3 py-3 text-slate-300">{row.agents}</td>
                      <td className="px-3 py-3 text-slate-300">{row.actions.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-emerald-300">{formatInr(row.valueInr)}</td>
                      <td className="px-3 py-3 text-slate-300">{formatInr(row.costInr)}</td>
                      <td className={`px-3 py-3 font-bold ${roiTone(row.roiRatio)}`}>{row.roiRatio >= 99 ? '∞' : row.roiRatio.toFixed(1)}x</td>
                      <td className="px-3 py-3">{row.netValueInr >= 0 ? <ArrowUp className="h-4 w-4 text-emerald-300" /> : <ArrowDown className="h-4 w-4 text-rose-300" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-5 print:hidden xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
                  <Award className="h-4 w-4 text-amber-300" />
                  Agent ROI leaderboard
                </h2>
                {departmentFilter !== 'all' && (
                  <button onClick={() => setDepartmentFilter('all')} className="text-xs text-cyan-300 hover:text-cyan-200">Clear {departmentFilter}</button>
                )}
              </div>
              <div className="space-y-2">
                {leaderboard.length === 0 ? (
                  <EmptyState>No ROI data yet — deploy your first agent to start tracking value.</EmptyState>
                ) : leaderboard.map((item, index) => {
                  const healthScore = Math.max(0, Math.min(100, 100 - item.agent.risk_score + Math.round((item.agent.uptime || 95) / 10)));
                  return (
                    <div key={item.agent.id} className="grid gap-3 rounded-xl border border-white/[0.07] bg-slate-950/35 px-4 py-3 md:grid-cols-[40px_minmax(0,1fr)_120px_100px_80px_80px] md:items-center">
                      <div className="text-sm font-bold text-slate-500">#{index + 1}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-white">{item.agent.name}</p>
                          {index === 0 ? <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">Top performer</span> : null}
                        </div>
                        <p className="text-xs text-slate-500">{item.department}</p>
                      </div>
                      <div className="font-semibold text-emerald-300">{formatInr(item.valueInr)}</div>
                      <div className="text-slate-300">{formatInr(item.costInr)}</div>
                      <div className={`font-bold ${roiTone(item.roiRatio)}`}>{item.roiRatio >= 99 ? '∞' : item.roiRatio.toFixed(1)}x</div>
                      <div className={healthScore >= 80 ? 'text-emerald-300' : healthScore >= 50 ? 'text-amber-300' : 'text-rose-300'}>{healthScore}/100</div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
                <BarChart3 className="h-4 w-4 text-cyan-300" />
                Monthly trend
              </h2>
              <div className="flex h-64 items-end gap-3">
                {trend.map((item) => (
                  <div key={item.key} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-48 w-full items-end justify-center gap-1 rounded-lg bg-slate-950/40 px-1">
                      <div className="w-3 rounded-t bg-emerald-400" style={{ height: `${Math.max(3, (item.valueInr / maxTrend) * 100)}%` }} title={`Saved ${formatInr(item.valueInr)}`} />
                      <div className="w-3 rounded-t bg-rose-400" style={{ height: `${Math.max(3, (item.costInr / maxTrend) * 100)}%` }} title={`Cost ${formatInr(item.costInr)}`} />
                    </div>
                    <span className="text-xs text-slate-500">{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-4 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> INR saved</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> Cost</span>
              </div>
            </section>
          </div>
        </>
      )}

      <div className="cfo-report space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-bold">Zapheit CFO Report</h1>
          <p className="mt-1 text-sm">Company: Your organization · Report period: {reportPeriod}</p>
        </div>
        <section>
          <h2 className="text-xl font-bold">Executive Summary</h2>
          <p className="mt-2">
            Zapheit created {formatInr(portfolio.totalValueInr)} in estimated value at {formatInr(portfolio.totalCostInr)} cost,
            producing {portfolio.roiRatio >= 99 ? 'uncapped' : `${portfolio.roiRatio.toFixed(1)}x`} ROI and {formatInr(portfolio.netValueInr)} net value.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold">Department Breakdown</h2>
          <table className="mt-3 w-full border-collapse text-sm">
            <thead><tr><th>Department</th><th>Agents</th><th>Actions</th><th>Saved</th><th>Cost</th><th>ROI</th></tr></thead>
            <tbody>{departments.map((row) => <tr key={row.department}><td>{row.department}</td><td>{row.agents}</td><td>{row.actions}</td><td>{formatInr(row.valueInr)}</td><td>{formatInr(row.costInr)}</td><td>{row.roiRatio >= 99 ? '∞' : row.roiRatio.toFixed(1)}x</td></tr>)}</tbody>
          </table>
        </section>
        <section>
          <h2 className="text-xl font-bold">Top 5 Performing Agents</h2>
          <ol className="mt-3 list-decimal pl-5">{topAgents.map((item) => <li key={item.agent.id}>{item.agent.name} ({getDepartment(item.agent)}): {formatInr(item.valueInr)} value, {item.roiRatio >= 99 ? '∞' : item.roiRatio.toFixed(1)}x ROI</li>)}</ol>
        </section>
        <section>
          <h2 className="text-xl font-bold">Top 5 Most Governed Actions</h2>
          <ol className="mt-3 list-decimal pl-5">{topGovernedActions.length ? topGovernedActions.map((incident) => <li key={incident.id}>{incident.title || incident.incident_type}: {incident.severity} risk safely handled, estimated impact {formatInr(2400)}</li>) : <li>No high-risk governed actions recorded this month.</li>}</ol>
        </section>
        <section>
          <h2 className="text-xl font-bold">Incidents Prevented</h2>
          <p className="mt-2">{incidents.length} incidents tracked with estimated avoided impact of {formatInr(incidents.length * 2400)}.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold">Month-over-Month Trend</h2>
          <p className="mt-2">{trend.map((item) => `${item.label}: ${formatInr(item.valueInr)} saved / ${formatInr(item.costInr)} cost`).join(' · ')}</p>
        </section>
        <footer className="border-t pt-4 text-sm">Generated by Zapheit — AI Workforce Governance</footer>
      </div>
    </div>
  );
}
