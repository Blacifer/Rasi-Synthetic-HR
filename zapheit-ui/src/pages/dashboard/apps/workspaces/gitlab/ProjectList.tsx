import { useState, useMemo } from 'react';
import { Search, Star, Globe, Lock, Code2 } from 'lucide-react';
import { cn } from '../../../../../lib/utils';

export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path_with_namespace: string;
  description: string | null;
  visibility: 'public' | 'internal' | 'private';
  star_count: number;
  open_issues_count: number;
  last_activity_at: string;
  web_url: string;
  default_branch: string;
}

interface ProjectListProps {
  projects: GitLabProject[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (p: GitLabProject) => void;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function ProjectList({ projects, loading, selectedId, onSelect }: ProjectListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'public' | 'private'>('all');

  const filtered = useMemo(() => {
    let list = projects;
    if (filter === 'public') list = list.filter((p) => p.visibility === 'public');
    if (filter === 'private') list = list.filter((p) => p.visibility !== 'public');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.path_with_namespace.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [projects, search, filter]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a project…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'public', 'private'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors capitalize',
                filter === f ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="animate-pulse space-y-1 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-white/[0.03] rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Code2 className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No projects found</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((project) => (
              <button
                key={project.id}
                onClick={() => onSelect(project)}
                className={cn(
                  'w-full text-left px-4 py-3 hover:bg-white/[0.04] transition-colors',
                  selectedId === project.id && 'bg-white/[0.06]',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {project.visibility === 'private' ? (
                    <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-orange-400 truncate">{project.path_with_namespace}</span>
                </div>
                {project.description && (
                  <p className="text-[11px] text-slate-500 line-clamp-1 mb-2 ml-5">{project.description}</p>
                )}
                <div className="flex items-center gap-3 ml-5">
                  {project.star_count > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                      <Star className="w-3 h-3" /> {project.star_count}
                    </span>
                  )}
                  {project.open_issues_count > 0 && (
                    <span className="text-[10px] text-slate-500">{project.open_issues_count} open issues</span>
                  )}
                  <span className="text-[10px] text-slate-600">Active {timeAgo(project.last_activity_at)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
