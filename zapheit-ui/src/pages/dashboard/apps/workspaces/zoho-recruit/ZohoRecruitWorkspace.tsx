import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Link2, Link2Off, Info, Loader2, Bot, Users, Briefcase, Calendar,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { api } from '../../../../../lib/api-client';
import { toast } from '../../../../../lib/toast';
import { StatusBadge, EmptyState } from '../shared';
import AgentSuggestionBanner from '../../../../../components/AgentSuggestionBanner';
import { SharedAutomationTab } from '../shared/SharedAutomationTab';

const CONNECTOR_ID = 'zoho_recruit';
const CALLBACK_URL = 'https://api.zapheit.com/integrations/oauth/callback/zoho_recruit';

const RECRUIT_TRIGGERS = {
  application_received:   { label: 'Application received',   description: 'Agent screens and scores new job applications',            Icon: Users },
  candidate_shortlisted:  { label: 'Candidate shortlisted',  description: 'Agent schedules interviews and notifies candidates',       Icon: Calendar },
  job_posted:             { label: 'Job posted',             description: 'Agent distributes job posts to external job boards',       Icon: Briefcase },
  interview_scheduled:    { label: 'Interview scheduled',    description: 'Agent sends reminders and prep materials to candidates',   Icon: Calendar },
};

const RECRUIT_EXAMPLES = [
  'List all open job postings',
  'Show candidates in the final interview stage',
  'Schedule an interview with candidate ID 12345 for tomorrow at 2pm',
  'Get all applications for the "Senior Engineer" role',
];

type Tab = 'jobs' | 'candidates' | 'automation';

const TABS: { id: Tab; label: string; Icon: typeof Briefcase }[] = [
  { id: 'jobs',       label: 'Jobs',       Icon: Briefcase },
  { id: 'candidates', label: 'Candidates', Icon: Users },
  { id: 'automation', label: 'Automation', Icon: Bot },
];

interface JobOpening {
  id: string;
  Posting_Title: string;
  Department?: string;
  Job_Opening_Status?: string;
  Number_of_Positions?: number;
}

interface Candidate {
  id: string;
  Full_Name?: string;
  Email?: string;
  Current_Job_Title?: string;
  Candidate_Status?: string;
}

export default function ZohoRecruitWorkspace() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('jobs');

  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

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

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_job_openings', { per_page: 20 });
      if (res.success && (res.data as any)?.data) setJobs((res.data as any).data);
      else if (res.success && Array.isArray(res.data)) setJobs(res.data);
    } catch { /* silent */ }
    finally { setLoadingJobs(false); }
  }, []);

  const loadCandidates = useCallback(async () => {
    setLoadingCandidates(true);
    try {
      const res = await api.unifiedConnectors.executeAction(CONNECTOR_ID, 'list_candidates', { per_page: 20 });
      if (res.success && (res.data as any)?.data) setCandidates((res.data as any).data);
      else if (res.success && Array.isArray(res.data)) setCandidates(res.data);
    } catch { /* silent */ }
    finally { setLoadingCandidates(false); }
  }, []);

  useEffect(() => { void checkConnection(); }, [checkConnection]);

  useEffect(() => {
    if (!connected) return;
    if (activeTab === 'jobs') void loadJobs();
    if (activeTab === 'candidates') void loadCandidates();
  }, [connected, activeTab, loadJobs, loadCandidates]);

  const handleConnect = useCallback(() => {
    const url = api.integrations.getOAuthAuthorizeUrl('zoho_recruit', window.location.href);
    window.location.href = url;
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Disconnect Zoho Recruit? Recruitment automation will stop.')) return;
    try {
      await api.integrations.disconnect('zoho_recruit');
      setConnected(false);
      toast.success('Zoho Recruit disconnected');
    } catch {
      toast.error('Failed to disconnect Zoho Recruit');
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#080b12]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 shrink-0">
        <button onClick={() => navigate('/dashboard/apps')} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-[#E42527] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">ZR</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white">Zoho Recruit</h1>
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
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-base font-semibold text-white">Connect Zoho Recruit</h2>
                <p className="text-sm text-slate-400">Authorize Zapheit to manage jobs, candidates, and interviews.</p>
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
                Connect Zoho Recruit with OAuth
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

        {!checking && connected && activeTab === 'jobs' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Job Openings</h2>
              <button onClick={() => void loadJobs()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {showBanner && <AgentSuggestionBanner serviceId="zoho_recruit" onDismiss={() => setShowBanner(false)} />}
            {loadingJobs ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : jobs.length === 0 ? (
              <EmptyState icon={Briefcase} title="No job openings" description="Your Zoho Recruit job openings will appear here." />
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <div key={job.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#E42527]/20 border border-[#E42527]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Briefcase className="w-4 h-4 text-[#E42527]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{job.Posting_Title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{job.Department || ''}{job.Number_of_Positions ? ` · ${job.Number_of_Positions} position(s)` : ''}</p>
                      {job.Job_Opening_Status && (
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium mt-1 inline-block',
                          job.Job_Opening_Status === 'In-progress' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400',
                        )}>{job.Job_Opening_Status}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!checking && connected && activeTab === 'candidates' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white">Candidates</h2>
              <button onClick={() => void loadCandidates()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>
            {loadingCandidates ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : candidates.length === 0 ? (
              <EmptyState icon={Users} title="No candidates" description="Your Zoho Recruit candidates will appear here." />
            ) : (
              <div className="space-y-2">
                {candidates.map((c) => (
                  <div key={c.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#E42527]/20 border border-[#E42527]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Users className="w-4 h-4 text-[#E42527]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{c.Full_Name || '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{c.Current_Job_Title || ''}{c.Email ? ` · ${c.Email}` : ''}</p>
                      {c.Candidate_Status && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-400 font-medium mt-1 inline-block">{c.Candidate_Status}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!checking && connected && activeTab === 'automation' && (
          <SharedAutomationTab connectorId="zoho_recruit" triggerTypes={RECRUIT_TRIGGERS} nlExamples={RECRUIT_EXAMPLES} accentColor="orange" />
        )}
      </div>
    </div>
  );
}
