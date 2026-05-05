import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Link2, Link2Off, Info, Loader2, Bot, FileText, DollarSign, CreditCard,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { api } from '../../../../../lib/api-client';
import { toast } from '../../../../../lib/toast';
import { StatusBadge, EmptyState } from '../shared';
import AgentSuggestionBanner from '../../../../../components/AgentSuggestionBanner';
import { SharedAutomationTab } from '../shared/SharedAutomationTab';

const CONNECTOR_ID = 'xero';
const CALLBACK_URL = 'https://api.zapheit.com/integrations/oauth/callback/xero';

const XERO_TRIGGERS = {
  invoice_created:      { label: 'Invoice created',       description: 'Agent sends payment reminders and notifies clients',         Icon: FileText },
  payment_received:     { label: 'Payment received',      description: 'Agent updates records and sends receipts automatically',     Icon: DollarSign },
  bank_reconciliation:  { label: 'Bank reconciliation',   description: 'Agent flags discrepancies and drafts reconciliation notes',  Icon: CreditCard },
  contact_created:      { label: 'Contact created',       description: 'Agent enriches contact data from external sources',          Icon: FileText },
};

const XERO_EXAMPLES = [
  'List all unpaid invoices',
  'Show invoices overdue by more than 30 days',
  'Create an invoice for Acme Corp — ₹50,000 for consulting services',
  'Get the bank account balance for the current month',
];

type Tab = 'invoices' | 'contacts' | 'automation';

const TABS: { id: Tab; label: string; Icon: typeof FileText }[] = [
  { id: 'invoices',   label: 'Invoices',   Icon: FileText },
  { id: 'contacts',  label: 'Contacts',   Icon: DollarSign },
  { id: 'automation', label: 'Automation', Icon: Bot },
];

interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber?: string;
  Contact?: { Name: string };
  Total?: number;
  AmountDue?: number;
  Status?: string;
  DueDate?: string;
}

interface XeroContact {
  ContactID: string;
  Name: string;
  EmailAddress?: string;
  AccountNumber?: string;
  IsSupplier?: boolean;
  IsCustomer?: boolean;
}

function fmtXeroDate(xeroDate?: string): string {
  if (!xeroDate) return '—';
  const ms = parseInt(xeroDate.replace(/\/Date\((-?\d+)([+-]\d+)?\)\//, '$1'));
  if (isNaN(ms)) return xeroDate;
  return new Date(ms).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

export default function XeroWorkspace() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('invoices');

  const [invoices, setInvoices] = useState<XeroInvoice[]>([]);
  const [contacts, setContacts] = useState<XeroContact[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

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

  const loadInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_invoices', { statuses: 'AUTHORISED,DRAFT', page: 1 });
      if (res.success && (res.data as any)?.Invoices) setInvoices((res.data as any).Invoices);
      else if (res.success && Array.isArray(res.data)) setInvoices(res.data);
    } catch { /* silent */ }
    finally { setLoadingInvoices(false); }
  }, []);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_contacts', { page: 1 });
      if (res.success && (res.data as any)?.Contacts) setContacts((res.data as any).Contacts.slice(0, 20));
      else if (res.success && Array.isArray(res.data)) setContacts(res.data);
    } catch { /* silent */ }
    finally { setLoadingContacts(false); }
  }, []);

  useEffect(() => { void checkConnection(); }, [checkConnection]);

  useEffect(() => {
    if (!connected) return;
    if (activeTab === 'invoices') void loadInvoices();
    if (activeTab === 'contacts') void loadContacts();
  }, [connected, activeTab, loadInvoices, loadContacts]);

  const handleConnect = useCallback(() => {
    const url = api.integrations.getOAuthAuthorizeUrl('xero', window.location.href);
    window.location.href = url;
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Disconnect Xero? Finance automation will stop.')) return;
    try {
      await api.integrations.disconnect('xero');
      setConnected(false);
      toast.success('Xero disconnected');
    } catch {
      toast.error('Failed to disconnect Xero');
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#080b12]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 shrink-0">
        <button onClick={() => navigate('/dashboard/apps')} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-[#13B5EA] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">XR</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white">Xero</h1>
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
                <div className="w-12 h-12 rounded-xl bg-[#13B5EA] flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-base font-semibold text-white">Connect Xero</h2>
                <p className="text-sm text-slate-400">Authorize Zapheit to manage invoices, payments, and contacts.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">OAuth 2.0</p>
                <div className="flex items-start gap-2 pt-1">
                  <Info className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-500">Callback URL: <span className="font-mono text-slate-400">{CALLBACK_URL}</span></p>
                </div>
              </div>
              <button onClick={handleConnect} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#13B5EA] hover:bg-[#0fa3d4] text-white text-sm font-semibold transition-colors">
                <Link2 className="w-4 h-4" />
                Connect Xero with OAuth
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

        {!checking && connected && activeTab === 'invoices' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Invoices</h2>
              <button onClick={() => void loadInvoices()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {showBanner && <AgentSuggestionBanner serviceId="xero" onDismiss={() => setShowBanner(false)} />}
            {loadingInvoices ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : invoices.length === 0 ? (
              <EmptyState icon={FileText} title="No invoices found" description="Your Xero invoices will appear here." />
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.InvoiceID} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#13B5EA]/20 border border-[#13B5EA]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="w-4 h-4 text-[#13B5EA]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{inv.InvoiceNumber || inv.InvoiceID}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{inv.Contact?.Name || '—'}{inv.DueDate ? ` · Due ${fmtXeroDate(inv.DueDate)}` : ''}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {inv.AmountDue != null && <span className="text-xs font-medium text-white">${inv.AmountDue.toFixed(2)} due</span>}
                        {inv.Status && <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                          inv.Status === 'AUTHORISED' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400',
                        )}>{inv.Status}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!checking && connected && activeTab === 'contacts' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Contacts</h2>
              <button onClick={() => void loadContacts()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {loadingContacts ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : contacts.length === 0 ? (
              <EmptyState icon={DollarSign} title="No contacts found" description="Your Xero contacts will appear here." />
            ) : (
              <div className="space-y-2">
                {contacts.map((c) => (
                  <div key={c.ContactID} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#13B5EA]/20 border border-[#13B5EA]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <DollarSign className="w-4 h-4 text-[#13B5EA]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{c.Name}</p>
                      {c.EmailAddress && <p className="text-xs text-slate-400 mt-0.5">{c.EmailAddress}</p>}
                      <div className="flex gap-1.5 mt-1">
                        {c.IsCustomer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">Customer</span>}
                        {c.IsSupplier && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-medium">Supplier</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!checking && connected && activeTab === 'automation' && (
          <SharedAutomationTab connectorId="xero" triggerTypes={XERO_TRIGGERS} nlExamples={XERO_EXAMPLES} accentColor="cyan" />
        )}
      </div>
    </div>
  );
}
