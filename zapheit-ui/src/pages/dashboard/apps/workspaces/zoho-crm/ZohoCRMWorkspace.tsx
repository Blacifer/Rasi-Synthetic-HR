import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Link2, Link2Off, Info, Loader2, Bot, Users, TrendingUp, Star,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { api } from '../../../../../lib/api-client';
import { toast } from '../../../../../lib/toast';
import { StatusBadge, EmptyState } from '../shared';
import AgentSuggestionBanner from '../../../../../components/AgentSuggestionBanner';
import { SharedAutomationTab } from '../shared/SharedAutomationTab';

const CONNECTOR_ID = 'zoho_crm';
const CALLBACK_URL = 'https://api.zapheit.com/integrations/oauth/callback/zoho_crm';

const CRM_TRIGGERS = {
  lead_created:     { label: 'Lead created',     description: 'Agent scores and routes new leads automatically',              Icon: Users },
  deal_won:         { label: 'Deal won',          description: 'Agent sends congratulations and creates onboarding tasks',    Icon: Star },
  contact_updated:  { label: 'Contact updated',   description: 'Agent syncs changes to downstream systems',                   Icon: Users },
  task_overdue:     { label: 'Task overdue',      description: 'Agent escalates and notifies the assigned rep',               Icon: TrendingUp },
};

const CRM_EXAMPLES = [
  'List all open deals in the pipeline',
  'Show leads created this week',
  'Create a follow-up task for deal "Acme Corp Q2"',
  'Update contact email for John Smith to john@acme.com',
];

type Tab = 'leads' | 'deals' | 'automation';

const TABS: { id: Tab; label: string; Icon: typeof Users }[] = [
  { id: 'leads',      label: 'Leads',      Icon: Users },
  { id: 'deals',      label: 'Deals',      Icon: TrendingUp },
  { id: 'automation', label: 'Automation', Icon: Bot },
];

interface CRMRecord {
  id: string;
  Full_Name?: string;
  Company?: string;
  Email?: string;
  Lead_Status?: string;
  Deal_Name?: string;
  Stage?: string;
  Amount?: number;
  Closing_Date?: string;
}

export default function ZohoCRMWorkspace() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('leads');

  const [leads, setLeads] = useState<CRMRecord[]>([]);
  const [deals, setDeals] = useState<CRMRecord[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingDeals, setLoadingDeals] = useState(false);

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

  const loadLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_leads', { per_page: 20 });
      if (res.success && (res.data as any)?.data) setLeads((res.data as any).data);
      else if (res.success && Array.isArray(res.data)) setLeads(res.data);
    } catch { /* silent */ }
    finally { setLoadingLeads(false); }
  }, []);

  const loadDeals = useCallback(async () => {
    setLoadingDeals(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_deals', { per_page: 20 });
      if (res.success && (res.data as any)?.data) setDeals((res.data as any).data);
      else if (res.success && Array.isArray(res.data)) setDeals(res.data);
    } catch { /* silent */ }
    finally { setLoadingDeals(false); }
  }, []);

  useEffect(() => { void checkConnection(); }, [checkConnection]);

  useEffect(() => {
    if (!connected) return;
    if (activeTab === 'leads') void loadLeads();
    if (activeTab === 'deals') void loadDeals();
  }, [connected, activeTab, loadLeads, loadDeals]);

  const handleConnect = useCallback(() => {
    const url = api.integrations.getOAuthAuthorizeUrl('zoho_crm', window.location.href);
    window.location.href = url;
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Disconnect Zoho CRM? Sales automation will stop.')) return;
    try {
      await api.integrations.disconnect('zoho_crm');
      setConnected(false);
      toast.success('Zoho CRM disconnected');
    } catch {
      toast.error('Failed to disconnect Zoho CRM');
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#080b12]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 shrink-0">
        <button onClick={() => navigate('/dashboard/apps')} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-[#E42527] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">ZC</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white">Zoho CRM</h1>
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
                <div className="w-12 h-12 rounded-xl bg-[#E42527] flex items-center justify-center mx-auto">
                  <span className="text-white text-xl font-bold">ZC</span>
                </div>
                <h2 className="text-base font-semibold text-white">Connect Zoho CRM</h2>
                <p className="text-sm text-slate-400">Authorize Zapheit to manage leads, deals, and contacts.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">OAuth 2.0</p>
                <div className="flex items-start gap-2 pt-1">
                  <Info className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-500">Callback URL: <span className="font-mono text-slate-400">{CALLBACK_URL}</span></p>
                </div>
              </div>
              <button onClick={handleConnect} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#E42527] hover:bg-[#c91f22] text-white text-sm font-semibold transition-colors">
                <Link2 className="w-4 h-4" />
                Connect Zoho CRM with OAuth
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

        {!checking && connected && activeTab === 'leads' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Leads</h2>
              <button onClick={() => void loadLeads()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {showBanner && <AgentSuggestionBanner serviceId="zoho_crm" onDismiss={() => setShowBanner(false)} />}
            {loadingLeads ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : leads.length === 0 ? (
              <EmptyState icon={Users} title="No leads found" description="Your Zoho CRM leads will appear here." />
            ) : (
              <div className="space-y-2">
                {leads.map((lead) => (
                  <div key={lead.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#E42527]/20 border border-[#E42527]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Users className="w-4 h-4 text-[#E42527]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{lead.Full_Name || '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{lead.Company || ''}{lead.Email ? ` · ${lead.Email}` : ''}</p>
                      {lead.Lead_Status && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-400 font-medium mt-1 inline-block">{lead.Lead_Status}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!checking && connected && activeTab === 'deals' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Deals</h2>
              <button onClick={() => void loadDeals()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {loadingDeals ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : deals.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No deals found" description="Your Zoho CRM deals will appear here." />
            ) : (
              <div className="space-y-2">
                {deals.map((deal) => (
                  <div key={deal.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#E42527]/20 border border-[#E42527]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <TrendingUp className="w-4 h-4 text-[#E42527]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{deal.Deal_Name || '—'}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {deal.Amount != null && <span className="text-xs text-slate-400">₹{deal.Amount.toLocaleString('en-IN')}</span>}
                        {deal.Closing_Date && <span className="text-xs text-slate-500">Closes {deal.Closing_Date}</span>}
                      </div>
                      {deal.Stage && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-400 font-medium mt-1 inline-block">{deal.Stage}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!checking && connected && activeTab === 'automation' && (
          <SharedAutomationTab connectorId="zoho_crm" triggerTypes={CRM_TRIGGERS} nlExamples={CRM_EXAMPLES} accentColor="orange" />
        )}
      </div>
    </div>
  );
}
