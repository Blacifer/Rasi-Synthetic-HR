import { lazy, Suspense } from 'react';

const GitHubWorkspace = lazy(() => import('../workspaces/github/GitHubWorkspace'));
const GitLabWorkspace = lazy(() => import('../workspaces/gitlab/GitLabWorkspace'));

interface Props {
  connectorId: string;
}

export function DevOpsWorkspaceTab({ connectorId }: Props) {
  const id = connectorId.toLowerCase();
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 text-sm">Loading workspace…</div>}>
      {id.includes('gitlab') ? <GitLabWorkspace /> : <GitHubWorkspace />}
    </Suspense>
  );
}
