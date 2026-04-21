/**
 * AgentHealthBadge — shows the 0-100 health score and grade for an agent.
 * Fetches lazily on first render. Shows a skeleton until loaded.
 */
import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';

interface HealthScore {
  total: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  performance: number;
  safety: number;
  cost: number;
  activity: number;
  recommendations: string[];
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'B': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'C': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'D': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    default:  return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  }
}

interface Props {
  agentId: string;
  size?: 'sm' | 'md';
  showTooltip?: boolean;
}

export function AgentHealthBadge({ agentId, size = 'sm', showTooltip = true }: Props) {
  const [score, setScore] = useState<HealthScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.agents.getHealthScore(agentId).then((res) => {
      if (cancelled) return;
      if ('data' in res && res.data) setScore(res.data as HealthScore);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [agentId]);

  if (loading) {
    return <span className="inline-block h-5 w-14 rounded-full bg-slate-700/50 animate-pulse" />;
  }

  if (!score) return null;

  const colorClass = gradeColor(score.grade);
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  const tooltip = showTooltip
    ? `Health: ${score.total}/100 | Performance: ${score.performance}/25 | Safety: ${score.safety}/25 | Cost: ${score.cost}/25 | Activity: ${score.activity}/25${score.recommendations.length > 0 ? ' | ' + score.recommendations[0] : ''}`
    : undefined;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold ${colorClass} ${sizeClass}`}
      title={tooltip}
    >
      <span className="tabular-nums">{score.total}</span>
      <span className="opacity-70">/100</span>
      <span className={`ml-0.5 font-bold ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>{score.grade}</span>
    </span>
  );
}
