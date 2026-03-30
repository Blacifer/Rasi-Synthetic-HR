import { cn } from '../../../../lib/utils';

interface StatsBarProps {
  totalConnected: number;
  errorCount: number;
  totalActions: number;
  governedCount: number;
}

export function StatsBar({ totalConnected, errorCount, totalActions, governedCount }: StatsBarProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className={cn(
        'rounded-xl border p-3 text-center',
        errorCount > 0 ? 'border-rose-400/15 bg-rose-500/[0.04]' : 'border-emerald-400/15 bg-emerald-500/[0.04]'
      )}>
        <p className={cn('text-xl font-bold', errorCount > 0 ? 'text-rose-300' : 'text-emerald-300')}>
          {totalConnected - errorCount}/{totalConnected}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          {errorCount > 0 ? `${errorCount} need attention` : 'All healthy'}
        </p>
      </div>
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-center">
        <p className="text-xl font-bold text-white">{totalActions}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">Governed actions</p>
      </div>
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-center">
        <p className="text-xl font-bold text-white">{governedCount}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">Governed connectors</p>
      </div>
    </div>
  );
}
