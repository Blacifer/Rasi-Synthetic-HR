import { GitMerge, GitPullRequestDraft, ExternalLink } from 'lucide-react';
import { cn } from '../../../../../lib/utils';

export interface GitLabMR {
  iid: number;
  title: string;
  state: string;
  author: string;
  created_at: string;
  updated_at: string;
  draft: boolean;
  source_branch: string;
  target_branch: string;
  web_url: string;
  labels: string[];
  reviewers: string[];
}

interface MRListProps {
  mrs: GitLabMR[];
  loading: boolean;
  projectPath: string;
  onMerge: (iid: number) => void;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function MRList({ mrs, loading, projectPath, onMerge }: MRListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 shrink-0">
        <span className="text-xs text-slate-400 font-medium">{projectPath} — Merge Requests</span>
        <span className="text-[11px] text-slate-600">{mrs.length} open</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="animate-pulse space-y-1 p-4">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-white/[0.03] rounded-lg" />)}
          </div>
        ) : mrs.length === 0 ? (
          <div className="text-center py-16">
            <GitMerge className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No open merge requests</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {mrs.map((mr) => (
              <div key={mr.iid} className="px-4 py-3 hover:bg-white/[0.03]">
                <div className="flex items-start gap-2">
                  {mr.draft ? (
                    <GitPullRequestDraft className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                  ) : (
                    <GitMerge className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white truncate">{mr.title}</span>
                      {mr.draft && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">Draft</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-slate-500">
                        !{mr.iid} by {mr.author}
                      </span>
                      <span className="text-[10px] text-slate-600">
                        {mr.source_branch} → {mr.target_branch}
                      </span>
                      <span className="text-[10px] text-slate-600">{timeAgo(mr.updated_at)}</span>
                    </div>
                    {mr.labels.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {mr.labels.slice(0, 3).map((l) => (
                          <span key={l} className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300 border border-orange-500/20">
                            {l}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={mr.web_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    {!mr.draft && (
                      <button
                        onClick={() => onMerge(mr.iid)}
                        className={cn(
                          'px-2.5 py-1 rounded text-[11px] font-medium transition-colors',
                          'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/20',
                        )}
                      >
                        Merge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
