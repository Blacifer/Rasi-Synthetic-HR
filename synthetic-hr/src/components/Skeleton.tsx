/** Reusable skeleton loader components — animate-pulse bg-slate-800 pattern */

/** A single skeleton row mirroring an incident list item */
export function SkeletonIncidentRow() {
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-4 h-4 rounded bg-slate-800 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="h-4 w-48 rounded bg-slate-800" />
            <div className="h-5 w-16 rounded-full bg-slate-800" />
            <div className="h-5 w-20 rounded-full bg-slate-800" />
          </div>
          <div className="h-3 w-72 rounded bg-slate-800/60" />
          <div className="flex items-center gap-3">
            <div className="h-3 w-24 rounded bg-slate-800/50" />
            <div className="h-3 w-20 rounded bg-slate-800/50" />
          </div>
        </div>
        <div className="h-5 w-24 rounded-full bg-slate-800 flex-shrink-0" />
      </div>
    </div>
  );
}

/** A single skeleton row mirroring an agent card in Fleet */
export function SkeletonAgentCard() {
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="h-5 w-40 rounded bg-slate-800" />
            <div className="h-5 w-16 rounded-full bg-slate-800" />
            <div className="h-5 w-20 rounded-full bg-slate-800" />
            <div className="h-5 w-24 rounded-full bg-slate-800" />
          </div>
          <div className="h-3 w-80 rounded bg-slate-800/60" />
          <div className="flex items-center gap-4">
            <div className="h-3 w-28 rounded bg-slate-800/50" />
            <div className="h-3 w-24 rounded bg-slate-800/50" />
            <div className="h-3 w-20 rounded bg-slate-800/50" />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="h-8 w-20 rounded-lg bg-slate-800" />
          <div className="h-8 w-8 rounded-lg bg-slate-800" />
        </div>
      </div>
    </div>
  );
}

/** A stat/metric card skeleton */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 animate-pulse ${className}`}>
      <div className="h-3 w-24 rounded bg-slate-800 mb-3" />
      <div className="h-7 w-20 rounded bg-slate-800 mb-2" />
      <div className="h-3 w-32 rounded bg-slate-800/60" />
    </div>
  );
}
