import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Link2, Link2Off, Info, Loader2, FolderOpen, Clock, Bot,
  ExternalLink, Share2, Users,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { api } from '../../../../../lib/api-client';
import { toast } from '../../../../../lib/toast';
import { StatusBadge, EmptyState } from '../shared';
import AgentSuggestionBanner from '../../../../../components/AgentSuggestionBanner';
import { SharedAutomationTab } from '../shared/SharedAutomationTab';

const CONNECTOR_ID = 'box';
const CALLBACK_URL = 'https://api.zapheit.com/integrations/oauth/callback/box';

const BOX_TRIGGERS = {
  file_uploaded:       { label: 'File uploaded',     description: 'Agent tags, categorises or notifies when a file is added',            Icon: FolderOpen },
  file_shared:         { label: 'File shared',        description: 'Agent logs sharing events for compliance and audit',                  Icon: Share2 },
  folder_created:      { label: 'Folder created',     description: 'Agent applies default permissions to new folders',                   Icon: FolderOpen },
  collaboration_added: { label: 'Collaborator added', description: 'Agent verifies permissions and notifies on new access',              Icon: Users },
};

const BOX_EXAMPLES = [
  'List all files in my root folder',
  'Show files shared externally in the last 7 days',
  'Who has access to the "Contracts" folder?',
  'Find documents modified this week',
];

type Tab = 'files' | 'recent' | 'automation';

const TABS: { id: Tab; label: string; Icon: typeof FolderOpen }[] = [
  { id: 'files',      label: 'Files',      Icon: FolderOpen },
  { id: 'recent',    label: 'Recent',     Icon: Clock },
  { id: 'automation', label: 'Automation', Icon: Bot },
];

interface BoxEntry {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  modified_at?: string;
  shared_link?: { url: string } | null;
}

interface BoxRecentItem {
  item: {
    id: string;
    name: string;
    type: string;
  };
  interacted_at: string;
}

function formatFileSize(bytes?: number): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function BoxWorkspace() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('files');

  const [entries, setEntries] = useState<BoxEntry[]>([]);
  const [recentItems, setRecentItems] = useState<BoxRecentItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_folder_items', { folder_id: '0', limit: 1 });
      setConnected(res.success);
    } catch {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_folder_items', { folder_id: '0', limit: 30 });
      if (res.success && (res.data as any)?.entries) setEntries((res.data as any).entries);
      else if (res.success && Array.isArray(res.data)) setEntries(res.data);
    } catch {
      /* silent */
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_recent_items', { limit: 20 });
      if (res.success && (res.data as any)?.items) setRecentItems((res.data as any).items);
      else if (res.success && Array.isArray(res.data)) setRecentItems(res.data);
    } catch {
      /* silent */
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => { void checkConnection(); }, [checkConnection]);

  useEffect(() => {
    if (!connected) return;
    if (activeTab === 'files') void loadFiles();
    if (activeTab === 'recent') void loadRecent();
  }, [connected, activeTab, loadFiles, loadRecent]);

  const handleConnect = useCallback(() => {
    const url = api.integrations.getOAuthAuthorizeUrl('box', window.location.href);
    window.location.href = url;
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Disconnect Box? File automation will stop.')) return;
    try {
      await api.integrations.disconnect('box');
      setConnected(false);
      toast.success('Box disconnected');
    } catch {
      toast.error('Failed to disconnect Box');
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#080b12]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 shrink-0">
        <button
          onClick={() => navigate('/dashboard/apps')}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="w-8 h-8 rounded-lg bg-[#0061D5] flex items-center justify-center shrink-0">
          <FolderOpen className="w-4 h-4 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white">Box</h1>
          {!checking && connected !== null && (
            <div className="mt-0.5">
              <StatusBadge status={connected ? 'connected' : 'disconnected'} size="sm" />
            </div>
          )}
        </div>

        {checking && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}

        {!checking && connected && (
          <button
            onClick={() => void handleDisconnect()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-xs font-medium transition-colors"
          >
            <Link2Off className="w-3.5 h-3.5" />
            Disconnect
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-5 py-2 border-b border-white/5 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              activeTab === t.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]',
            )}
          >
            <t.Icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Not connected */}
        {!checking && !connected && (
          <div className="flex items-center justify-center p-8 h-full">
            <div className="w-full max-w-sm space-y-5">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-[#0061D5] flex items-center justify-center mx-auto">
                  <FolderOpen className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-base font-semibold text-white">Connect Box</h2>
                <p className="text-sm text-slate-400">Authorize Zapheit to browse files, track sharing events, and automate folder workflows.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Secure access</p>
                <div className="flex items-start gap-2 pt-1">
                  <Info className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-500">
                    Zapheit requests read access to list files and recent items. Write operations require explicit agent approval.
                    <br />Callback: <span className="font-mono text-slate-400">{CALLBACK_URL}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={handleConnect}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0061D5] hover:bg-[#0052b3] text-white text-sm font-semibold transition-colors"
              >
                <Link2 className="w-4 h-4" />
                Connect Box with OAuth
              </button>
            </div>
          </div>
        )}

        {/* Checking */}
        {checking && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Checking connection…</span>
            </div>
          </div>
        )}

        {/* Files tab */}
        {!checking && connected && activeTab === 'files' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Root Folder</h2>
              <button onClick={() => void loadFiles()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>

            {showBanner && <AgentSuggestionBanner serviceId="box" onDismiss={() => setShowBanner(false)} />}

            {loadingFiles ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              </div>
            ) : entries.length === 0 ? (
              <EmptyState icon={FolderOpen} title="No items found" description="Files and folders in your Box root will appear here once the connection fetches them." />
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      entry.type === 'folder'
                        ? 'bg-blue-500/20 border border-blue-500/30'
                        : 'bg-slate-500/20 border border-slate-500/30',
                    )}>
                      <FolderOpen className={cn(
                        'w-4 h-4',
                        entry.type === 'folder' ? 'text-blue-400' : 'text-slate-400',
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white truncate">{entry.name}</p>
                        <span className={cn(
                          'shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded',
                          entry.type === 'folder'
                            ? 'bg-blue-500/15 text-blue-400'
                            : 'bg-slate-500/15 text-slate-400',
                        )}>
                          {entry.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {entry.type === 'file' && entry.size != null && (
                          <span>{formatFileSize(entry.size)}{entry.modified_at ? ' · ' : ''}</span>
                        )}
                        {entry.modified_at && (
                          <span>{new Date(entry.modified_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                        )}
                      </p>
                    </div>

                    {entry.shared_link?.url && (
                      <a
                        href={entry.shared_link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors shrink-0"
                        title="Open shared link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent tab */}
        {!checking && connected && activeTab === 'recent' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Recently Accessed</h2>
              <button onClick={() => void loadRecent()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {loadingRecent ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              </div>
            ) : recentItems.length === 0 ? (
              <EmptyState icon={Clock} title="No recent items" description="Items you've recently accessed in Box will appear here." />
            ) : (
              <div className="space-y-2">
                {recentItems.map((r) => (
                  <div key={r.item.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      r.item.type === 'folder'
                        ? 'bg-blue-500/20 border border-blue-500/30'
                        : 'bg-slate-500/20 border border-slate-500/30',
                    )}>
                      <FolderOpen className={cn(
                        'w-4 h-4',
                        r.item.type === 'folder' ? 'text-blue-400' : 'text-slate-400',
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{r.item.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{relativeTime(r.interacted_at)}</p>
                    </div>
                    <span className={cn(
                      'shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded',
                      r.item.type === 'folder'
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-slate-500/15 text-slate-400',
                    )}>
                      {r.item.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Automation tab */}
        {!checking && connected && activeTab === 'automation' && (
          <SharedAutomationTab
            connectorId="box"
            triggerTypes={BOX_TRIGGERS}
            nlExamples={BOX_EXAMPLES}
            accentColor="blue"
          />
        )}
      </div>
    </div>
  );
}
