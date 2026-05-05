import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Link2, Link2Off, Info, Loader2, LayoutGrid, CheckSquare, Bot, AlertCircle,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { api } from '../../../../../lib/api-client';
import { toast } from '../../../../../lib/toast';
import { StatusBadge, EmptyState } from '../shared';
import AgentSuggestionBanner from '../../../../../components/AgentSuggestionBanner';
import { SharedAutomationTab } from '../shared/SharedAutomationTab';

const CONNECTOR_ID = 'monday';

const MONDAY_TRIGGERS = {
  item_created:   { label: 'Item created',         description: 'Agent assigns, enriches or notifies on new board items', Icon: CheckSquare },
  status_changed: { label: 'Status changed',       description: 'Agent triggers workflows when item status updates',       Icon: LayoutGrid },
  item_overdue:   { label: 'Item overdue',          description: 'Agent escalates or pings assignee when deadline passes', Icon: AlertCircle },
  column_updated: { label: 'Column value changed', description: 'Agent reacts when any tracked column value changes',     Icon: LayoutGrid },
};

const MONDAY_EXAMPLES = [
  'List all boards in my workspace',
  'Show items due this week on the Marketing board',
  'Create a new task in the Dev board',
  'Which items are overdue across all boards?',
];

type Tab = 'boards' | 'items' | 'automation';

const TABS: { id: Tab; label: string; Icon: typeof LayoutGrid }[] = [
  { id: 'boards',     label: 'Boards',     Icon: LayoutGrid },
  { id: 'items',      label: 'Items',      Icon: CheckSquare },
  { id: 'automation', label: 'Automation', Icon: Bot },
];

interface MondayBoard {
  id: string;
  name: string;
  description?: string;
  board_kind: 'public' | 'private' | 'share';
  items_count: number;
  updated_at: string;
}

interface MondayItem {
  id: string;
  name: string;
  state: 'active' | 'done' | 'deleted' | 'archived';
  board: { name: string };
  updated_at: string;
}

export default function MondayWorkspace() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('boards');

  const [boards, setBoards] = useState<MondayBoard[]>([]);
  const [items, setItems] = useState<MondayItem[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

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

  const loadBoards = useCallback(async () => {
    setLoadingBoards(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_boards', { limit: 20 });
      if (res.success && (res.data as any)?.boards) setBoards((res.data as any).boards);
      else if (res.success && Array.isArray(res.data)) setBoards(res.data);
    } catch {
      /* silent */
    } finally {
      setLoadingBoards(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_items', { limit: 30 });
      if (res.success && (res.data as any)?.items) setItems((res.data as any).items);
      else if (res.success && Array.isArray(res.data)) setItems(res.data);
    } catch {
      /* silent */
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => { void checkConnection(); }, [checkConnection]);

  useEffect(() => {
    if (!connected) return;
    if (activeTab === 'boards') void loadBoards();
    if (activeTab === 'items') void loadItems();
  }, [connected, activeTab, loadBoards, loadItems]);

  const handleConnect = useCallback(() => {
    const url = api.integrations.getOAuthAuthorizeUrl('monday', window.location.href);
    window.location.href = url;
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Disconnect Monday.com? Board automation will stop.')) return;
    try {
      await api.integrations.disconnect('monday');
      setConnected(false);
      toast.success('Monday.com disconnected');
    } catch {
      toast.error('Failed to disconnect Monday.com');
    }
  }, []);

  const boardKindBadge = (kind: MondayBoard['board_kind']) => {
    if (kind === 'public')  return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
    if (kind === 'private') return 'bg-violet-500/15 text-violet-400 border-violet-500/20';
    return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
  };

  const itemStateBadge = (state: MondayItem['state']) => {
    if (state === 'active')   return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
    if (state === 'done')     return 'bg-green-500/15 text-green-400 border-green-500/20';
    if (state === 'archived') return 'bg-slate-500/15 text-slate-400 border-slate-500/20';
    return 'bg-rose-500/15 text-rose-400 border-rose-500/20';
  };

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

        <div className="w-8 h-8 rounded-lg bg-[#FF3D57] flex items-center justify-center shrink-0">
          <LayoutGrid className="w-4 h-4 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white">Monday.com</h1>
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
                <div className="w-12 h-12 rounded-xl bg-[#FF3D57] flex items-center justify-center mx-auto">
                  <LayoutGrid className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-base font-semibold text-white">Connect Monday.com</h2>
                <p className="text-sm text-slate-400">Authorize Zapheit to manage boards, track items, and automate workflows.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Workspace access</p>
                <div className="flex items-start gap-2 pt-1">
                  <Info className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-500">
                    Agents can read boards and items, create tasks, update statuses, and trigger automations across your Monday.com workspace.
                  </p>
                </div>
              </div>
              <button
                onClick={handleConnect}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF3D57] hover:bg-[#e02e47] text-white text-sm font-semibold transition-colors"
              >
                <Link2 className="w-4 h-4" />
                Connect Monday.com with OAuth
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

        {/* Boards tab */}
        {!checking && connected && activeTab === 'boards' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Boards</h2>
              <button onClick={() => void loadBoards()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>

            {showBanner && <AgentSuggestionBanner serviceId="monday" onDismiss={() => setShowBanner(false)} />}

            {loadingBoards ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              </div>
            ) : boards.length === 0 ? (
              <EmptyState icon={LayoutGrid} title="No boards found" description="Your Monday.com boards will appear here once the connection fetches them." />
            ) : (
              <div className="space-y-2">
                {boards.map((b) => (
                  <div key={b.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FF3D57]/20 border border-[#FF3D57]/30 flex items-center justify-center shrink-0">
                      <LayoutGrid className="w-5 h-5 text-[#FF3D57]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-white truncate">{b.name}</p>
                        <span className={cn(
                          'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border capitalize',
                          boardKindBadge(b.board_kind),
                        )}>
                          {b.board_kind}
                        </span>
                      </div>
                      {b.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{b.description}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {b.items_count} item{b.items_count !== 1 ? 's' : ''} · Updated {new Date(b.updated_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Items tab */}
        {!checking && connected && activeTab === 'items' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Items</h2>
              <button onClick={() => void loadItems()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {loadingItems ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              </div>
            ) : items.length === 0 ? (
              <EmptyState icon={CheckSquare} title="No items found" description="Items from your Monday.com boards will appear here." />
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3 flex items-center gap-3">
                    <CheckSquare className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {item.board.name} · Updated {new Date(item.updated_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </p>
                    </div>
                    <span className={cn(
                      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border capitalize shrink-0',
                      itemStateBadge(item.state),
                    )}>
                      {item.state}
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
            connectorId="monday"
            triggerTypes={MONDAY_TRIGGERS}
            nlExamples={MONDAY_EXAMPLES}
            accentColor="rose"
          />
        )}
      </div>
    </div>
  );
}
