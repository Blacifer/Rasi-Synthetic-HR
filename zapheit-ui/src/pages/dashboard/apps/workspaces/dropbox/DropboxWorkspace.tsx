import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Link2, Link2Off, Info, Loader2, Bot, FolderOpen, Users, Share2, Clock,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { api } from '../../../../../lib/api-client';
import { toast } from '../../../../../lib/toast';
import { StatusBadge, EmptyState } from '../shared';
import AgentSuggestionBanner from '../../../../../components/AgentSuggestionBanner';
import { SharedAutomationTab } from '../shared/SharedAutomationTab';

const CONNECTOR_ID = 'dropbox_business';
const CALLBACK_URL = 'https://api.zapheit.com/integrations/oauth/callback/dropbox_business';

const DROPBOX_TRIGGERS = {
  file_uploaded:         { label: 'File uploaded',          description: 'Agent tags, categorises, or notifies on new uploads',      Icon: FolderOpen },
  file_shared:           { label: 'File shared',            description: 'Agent logs sharing events for compliance and audit',       Icon: Share2 },
  folder_created:        { label: 'Folder created',         description: 'Agent applies default permissions to new folders',        Icon: FolderOpen },
  team_folder_updated:   { label: 'Team folder updated',    description: 'Agent syncs changes to downstream systems',               Icon: Users },
};

const DROPBOX_EXAMPLES = [
  'List all files in the root folder',
  'Show files shared externally in the last 7 days',
  'Who has access to the "Contracts" folder?',
  'Find documents modified this week',
];

type Tab = 'files' | 'shared' | 'automation';

const TABS: { id: Tab; label: string; Icon: typeof FolderOpen }[] = [
  { id: 'files',      label: 'Files',      Icon: FolderOpen },
  { id: 'shared',    label: 'Shared',     Icon: Share2 },
  { id: 'automation', label: 'Automation', Icon: Bot },
];

interface DropboxEntry {
  '.tag': 'file' | 'folder';
  id: string;
  name: string;
  path_display?: string;
  size?: number;
  server_modified?: string;
}

function fmtSize(bytes?: number): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DropboxWorkspace() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('files');

  const [files, setFiles] = useState<DropboxEntry[]>([]);
  const [sharedLinks, setSharedLinks] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingShared, setLoadingShared] = useState(false);

  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const res = await api.integrations.getAll();
      const items = Array.isArray(res.data) ? res.data : [];
      const entry = items.find((i: any) => i.service_type === CONNECTOR_ID || i.id === CONNECTOR_ID);
      setConnected(entry?.status === 'connected');
    } catch {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_folder', { path: '' });
      if (res.success && (res.data as any)?.entries) setFiles((res.data as any).entries);
      else if (res.success && Array.isArray(res.data)) setFiles(res.data);
    } catch { /* silent */ }
    finally { setLoadingFiles(false); }
  }, []);

  const loadShared = useCallback(async () => {
    setLoadingShared(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_shared_links', {});
      if (res.success && (res.data as any)?.links) setSharedLinks((res.data as any).links);
      else if (res.success && Array.isArray(res.data)) setSharedLinks(res.data);
    } catch { /* silent */ }
    finally { setLoadingShared(false); }
  }, []);

  useEffect(() => { void checkConnection(); }, [checkConnection]);

  useEffect(() => {
    if (!connected) return;
    if (activeTab === 'files') void loadFiles();
    if (activeTab === 'shared') void loadShared();
  }, [connected, activeTab, loadFiles, loadShared]);

  const handleConnect = useCallback(() => {
    const url = api.integrations.getOAuthAuthorizeUrl('dropbox_business', window.location.href);
    window.location.href = url;
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Disconnect Dropbox Business? File automation will stop.')) return;
    try {
      await api.integrations.disconnect('dropbox_business');
      setConnected(false);
      toast.success('Dropbox Business disconnected');
    } catch {
      toast.error('Failed to disconnect Dropbox Business');
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#080b12]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 shrink-0">
        <button onClick={() => navigate('/dashboard/apps')} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-[#0061FF] flex items-center justify-center shrink-0">
          <FolderOpen className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white">Dropbox Business</h1>
          {!checking && connected !== null && (
            <div className="mt-0.5"><StatusBadge status={connected ? 'connected' : 'disconnected'} size="sm" /></div>
          )}
        </div>
        {checking && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
        {!checking && connected && (
          <button onClick={() => void handleDisconnect()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-xs font-medium transition-colors">
            <Link2Off className="w-3.5 h-3.5" />
            Disconnect
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 px-5 py-2 border-b border-white/5 shrink-0">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            activeTab === t.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]',
          )}>
            <t.Icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!checking && !connected && (
          <div className="flex items-center justify-center p-8 h-full">
            <div className="w-full max-w-sm space-y-5">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-[#0061FF] flex items-center justify-center mx-auto">
                  <FolderOpen className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-base font-semibold text-white">Connect Dropbox Business</h2>
                <p className="text-sm text-slate-400">Authorize Zapheit to manage your files and team folders.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">OAuth 2.0</p>
                <div className="flex items-start gap-2 pt-1">
                  <Info className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-500">Callback URL: <span className="font-mono text-slate-400">{CALLBACK_URL}</span></p>
                </div>
              </div>
              <button onClick={handleConnect} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0061FF] hover:bg-[#0052d9] text-white text-sm font-semibold transition-colors">
                <Link2 className="w-4 h-4" />
                Connect Dropbox with OAuth
              </button>
            </div>
          </div>
        )}

        {checking && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Checking connection…</span>
            </div>
          </div>
        )}

        {!checking && connected && activeTab === 'files' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Files</h2>
              <button onClick={() => void loadFiles()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {showBanner && <AgentSuggestionBanner serviceId="dropbox_business" onDismiss={() => setShowBanner(false)} />}
            {loadingFiles ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : files.length === 0 ? (
              <EmptyState icon={FolderOpen} title="No files found" description="Your Dropbox files will appear here." />
            ) : (
              <div className="space-y-2">
                {files.map((f) => (
                  <div key={f.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0061FF]/20 border border-[#0061FF]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <FolderOpen className="w-4 h-4 text-[#0061FF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{f.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                          f['.tag'] === 'folder' ? 'bg-blue-500/15 text-blue-400' : 'bg-slate-500/15 text-slate-400',
                        )}>{f['.tag']}</span>
                        {f.size != null && <span className="text-xs text-slate-500">{fmtSize(f.size)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!checking && connected && activeTab === 'shared' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Shared Links</h2>
              <button onClick={() => void loadShared()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {loadingShared ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : sharedLinks.length === 0 ? (
              <EmptyState icon={Share2} title="No shared links" description="Files you've shared from Dropbox will appear here." />
            ) : (
              <div className="space-y-2">
                {sharedLinks.map((link: any, i: number) => (
                  <div key={link.id || i} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0061FF]/20 border border-[#0061FF]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Share2 className="w-4 h-4 text-[#0061FF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{link.name || link.path_lower || link.url}</p>
                      {link.url && (
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#0061FF] hover:text-blue-300 mt-1 inline-block transition-colors truncate max-w-full">
                          {link.url}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!checking && connected && activeTab === 'automation' && (
          <SharedAutomationTab connectorId="dropbox_business" triggerTypes={DROPBOX_TRIGGERS} nlExamples={DROPBOX_EXAMPLES} accentColor="blue" />
        )}
      </div>
    </div>
  );
}
