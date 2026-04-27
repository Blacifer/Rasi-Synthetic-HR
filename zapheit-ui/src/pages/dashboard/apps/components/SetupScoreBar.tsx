export function setupScore(isConnected: boolean, health: { good: boolean } | null, hasAgent: boolean): number {
  return (isConnected ? 34 : 0) + (health?.good ? 33 : 0) + (hasAgent ? 33 : 0);
}

export function SetupScoreBar({ score, onAttachAgent }: { score: number; onAttachAgent: () => void }) {
  const label = score >= 100 ? 'Fully set up' : score >= 67 ? 'Almost there' : score >= 34 ? 'Getting started' : 'Not set up';
  const color = score >= 100 ? 'bg-emerald-400' : score >= 67 ? 'bg-blue-400' : 'bg-amber-400';
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-slate-500">Setup: {label}</span>
        <span className="text-[10px] text-slate-500">{score}%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/[0.06]">
        <div className={`h-1 rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      {score < 100 && (
        <button
          onClick={onAttachAgent}
          className="mt-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
        >
          {score < 67 ? 'Connect to unlock automation →' : 'Attach an agent to reach 100% →'}
        </button>
      )}
    </div>
  );
}
