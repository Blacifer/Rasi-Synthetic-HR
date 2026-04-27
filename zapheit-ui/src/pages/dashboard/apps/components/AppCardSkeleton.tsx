export function AppCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/[0.06] shrink-0" />
        <div className="flex-1 space-y-2.5 min-w-0">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-28 rounded bg-white/[0.07]" />
            <div className="h-3 w-14 rounded-full bg-white/[0.05]" />
          </div>
          <div className="h-2.5 w-full max-w-sm rounded bg-white/[0.05]" />
          <div className="h-2.5 w-3/4 rounded bg-white/[0.04]" />
        </div>
        <div className="h-7 w-20 rounded-xl bg-white/[0.06] shrink-0" />
      </div>
    </div>
  );
}
