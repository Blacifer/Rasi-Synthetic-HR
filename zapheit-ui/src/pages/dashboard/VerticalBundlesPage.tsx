import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Bot, BriefcaseBusiness,
  Calculator, CheckCircle2, Clock3, FileText, Filter, Headphones, HeartHandshake,
  IndianRupee, Landmark, LockKeyhole, Megaphone, Scale, Search, ShieldCheck,
  Sparkles, TrendingUp, Users, Wrench,
} from 'lucide-react';
import { formatInr } from '../../lib/roi';

type BundleStatus = 'Active' | 'Early Access' | 'Coming Soon';
type BundleTier = 1 | 2;

type AgentTemplate = {
  name: string;
  does: string;
  connectors: string[];
  sampleApproval: string;
};

type Bundle = {
  id: string;
  name: string;
  icon: typeof Landmark;
  tier: BundleTier;
  status: BundleStatus;
  color: string;
  valueProp: string;
  topUseCase: string;
  problem: string;
  useCases: string[];
  connectors: string[];
  sampleAgents: AgentTemplate[];
  roiMetrics: string[];
  compliance: string;
  complianceEvidence: string[];
  roiRange: [number, number];
  monthlyBaseSavings: number;
  savingsPerPerson: number;
  approval: {
    title: string;
    app: string;
    risk: string;
    reason: string;
    cta: string;
  };
};

const STATUS_STYLES: Record<BundleStatus, string> = {
  Active: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
  'Early Access': 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  'Coming Soon': 'border-slate-600 bg-slate-800/70 text-slate-300',
};

const BUNDLES: Bundle[] = [
  {
    id: 'finance',
    name: 'Finance & Accounting',
    icon: Landmark,
    tier: 1,
    status: 'Active',
    color: 'text-emerald-300',
    valueProp: 'Close invoices, payments, GST checks, and approvals without losing financial control.',
    topUseCase: 'Invoice reconciliation with approval-before-write controls',
    problem: 'Indian finance teams still reconcile Tally ledgers, payment gateway settlements, invoice reminders, GST summaries, and expense approvals across separate systems. The pain is not just speed; it is proving who checked what before money moved.',
    useCases: ['Invoice reconciliation', 'Payment reminders', 'Expense approvals', 'Tally sync', 'GST summary', 'Anomaly detection on transactions'],
    connectors: ['TallyPrime', 'Razorpay', 'Cashfree', 'Zoho Books', 'QuickBooks', 'WhatsApp'],
    sampleAgents: [
      {
        name: 'Finance Reconciliation Agent',
        does: 'Matches invoices, gateway settlements, and ledger entries, then flags mismatches with evidence.',
        connectors: ['TallyPrime', 'Razorpay', 'Cashfree'],
        sampleApproval: 'Approve ledger note for invoice INV-1048 mismatch of Rs 18,400 before Tally sync.',
      },
      {
        name: 'Payment Follow-up Agent',
        does: 'Finds overdue receivables, drafts WhatsApp or email reminders, and escalates large overdue accounts.',
        connectors: ['Zoho Books', 'QuickBooks', 'WhatsApp'],
        sampleApproval: 'Send payment reminder to a customer 9 days overdue with invoice and UTR evidence attached.',
      },
      {
        name: 'GST Summary Agent',
        does: 'Prepares monthly GST exception summaries and routes high-risk entries for finance owner review.',
        connectors: ['TallyPrime', 'Zoho Books'],
        sampleApproval: 'Review GST input credit anomaly before month-end summary is exported.',
      },
    ],
    roiMetrics: ['Invoices processed', 'Payment delays reduced', 'Hours saved on reconciliation', 'INR recovered'],
    compliance: 'GST audit trail and payment evidence',
    complianceEvidence: ['Invoice-to-payment match logs', 'Tally sync approval evidence', 'GST exception report', 'WhatsApp reminder delivery proof'],
    roiRange: [85000, 420000],
    monthlyBaseSavings: 65000,
    savingsPerPerson: 6400,
    approval: {
      title: 'Send payment reminder for overdue invoice INV-1048',
      app: 'Zoho Books + WhatsApp',
      risk: 'Medium risk',
      reason: 'Customer is 9 days overdue and the payment link is valid. Human approval is needed before external messaging.',
      cta: 'Approve reminder',
    },
  },
  {
    id: 'hr',
    name: 'HR',
    icon: Users,
    tier: 1,
    status: 'Active',
    color: 'text-cyan-300',
    valueProp: 'Automate employee moments while keeping DPDP-sensitive HR decisions reviewable.',
    topUseCase: 'Employee onboarding and leave approvals',
    problem: 'HR teams in India handle joining documents, leave rules, payroll exceptions, policy questions, exits, and employee data requests across greytHR, Keka, Darwinbox, email, and WhatsApp. Repetition is high, but employee data and payroll mistakes are expensive.',
    useCases: ['Employee onboarding', 'Leave approvals', 'Payroll exceptions', 'Policy queries', 'Exit workflows', 'Document collection'],
    connectors: ['greytHR', 'Keka', 'Darwinbox', 'Zoho People', 'WhatsApp', 'Gmail'],
    sampleAgents: [
      {
        name: 'HR Assistant',
        does: 'Answers policy questions, collects missing employee context, and escalates sensitive cases.',
        connectors: ['greytHR', 'Keka', 'WhatsApp'],
        sampleApproval: 'Answer maternity leave policy question with employee-specific eligibility masked.',
      },
      {
        name: 'Onboarding Agent',
        does: 'Tracks joining documents, nudges candidates, and prepares Day 1 access checklists.',
        connectors: ['Darwinbox', 'Zoho People', 'Gmail'],
        sampleApproval: 'Send pending PAN and bank detail reminder to new joiner before payroll cutoff.',
      },
      {
        name: 'Leave Approval Agent',
        does: 'Checks balance, team calendar conflicts, and policy rules before routing approval.',
        connectors: ['greytHR', 'Keka', 'Gmail'],
        sampleApproval: 'Approve 3-day leave request after validating balance and manager coverage.',
      },
      {
        name: 'Payroll Exception Agent',
        does: 'Detects payroll anomalies and prepares evidence for HR and finance sign-off.',
        connectors: ['Keka', 'Darwinbox'],
        sampleApproval: 'Review variable pay exception above configured policy threshold.',
      },
    ],
    roiMetrics: ['Onboarding time reduced', 'HR queries automated', 'Leave processing time', 'INR saved'],
    compliance: 'DPDP employee data controls and HR audit trail',
    complianceEvidence: ['Consent-aware employee data access', 'Leave approval history', 'Document collection log', 'Payroll exception review trail'],
    roiRange: [60000, 300000],
    monthlyBaseSavings: 48000,
    savingsPerPerson: 4200,
    approval: {
      title: 'Approve leave after policy and staffing check',
      app: 'greytHR + Gmail',
      risk: 'Low risk',
      reason: 'Employee has sufficient leave balance and no team coverage conflict. Approval creates a full audit entry.',
      cta: 'Approve leave',
    },
  },
  {
    id: 'support',
    name: 'Support',
    icon: Headphones,
    tier: 1,
    status: 'Active',
    color: 'text-blue-300',
    valueProp: 'Reduce ticket backlog while governing refunds, escalations, and customer data exposure.',
    topUseCase: 'Ticket triage and response drafting',
    problem: 'Support teams lose time switching between Freshdesk, Zendesk, WhatsApp, Slack, Intercom, and Gmail. The dangerous work is not drafting replies; it is sending the wrong refund, missing an SLA, or exposing customer data without review.',
    useCases: ['Ticket triage', 'Response drafting', 'Escalation routing', 'Refund approvals', 'Customer follow-up', 'SLA monitoring'],
    connectors: ['Freshdesk', 'Zendesk', 'WhatsApp', 'Slack', 'Intercom', 'Gmail'],
    sampleAgents: [
      {
        name: 'Support Triage Agent',
        does: 'Classifies tickets by urgency, product area, SLA, and customer value.',
        connectors: ['Freshdesk', 'Zendesk', 'Slack'],
        sampleApproval: 'Escalate angry enterprise customer ticket to L2 and notify Slack channel.',
      },
      {
        name: 'Response Draft Agent',
        does: 'Drafts contextual replies from ticket history and knowledge base snippets.',
        connectors: ['Intercom', 'Gmail', 'WhatsApp'],
        sampleApproval: 'Send refund-policy response with customer PII masked in the approval view.',
      },
      {
        name: 'Escalation Agent',
        does: 'Routes SLA breaches, refund requests, and sensitive issues to the right owner.',
        connectors: ['Freshdesk', 'Slack'],
        sampleApproval: 'Approve goodwill refund above agent limit before customer notification.',
      },
    ],
    roiMetrics: ['Tickets resolved', 'Response time', 'Escalations avoided', 'CSAT impact', 'INR saved'],
    compliance: 'Customer data handling and DPDP audit trail',
    complianceEvidence: ['PII-masked approval packets', 'Refund approval evidence', 'SLA breach log', 'Customer follow-up history'],
    roiRange: [70000, 360000],
    monthlyBaseSavings: 56000,
    savingsPerPerson: 4800,
    approval: {
      title: 'Send drafted response for refund request',
      app: 'Freshdesk + WhatsApp',
      risk: 'High risk',
      reason: 'Customer-facing response includes refund language and order details. Human approval is required before sending.',
      cta: 'Approve response',
    },
  },
  {
    id: 'it-operations',
    name: 'IT Operations',
    icon: Wrench,
    tier: 2,
    status: 'Early Access',
    color: 'text-amber-300',
    valueProp: 'Govern access provisioning, incidents, assets, and vendors.',
    topUseCase: 'Access provisioning and incident response',
    problem: 'IT teams need provable handoffs between ticketing, identity, communication, and vendor systems.',
    useCases: ['Access provisioning', 'Incident response', 'Asset tracking', 'Vendor management'],
    connectors: ['Jira', 'GitHub', 'Slack', 'Microsoft 365'],
    sampleAgents: [],
    roiMetrics: ['Tickets automated', 'Provisioning time reduced', 'Incidents routed'],
    compliance: 'Access and asset evidence',
    complianceEvidence: ['Access request log', 'Incident owner trail'],
    roiRange: [50000, 240000],
    monthlyBaseSavings: 40000,
    savingsPerPerson: 3600,
    approval: { title: 'Provision access for approved employee', app: 'Microsoft 365 + Jira', risk: 'Medium risk', reason: 'Access changes require manager evidence.', cta: 'Approve access' },
  },
  {
    id: 'devops',
    name: 'DevOps',
    icon: Sparkles,
    tier: 2,
    status: 'Early Access',
    color: 'text-violet-300',
    valueProp: 'Turn PR, deployment, incident, and on-call work into governed automation.',
    topUseCase: 'PR reviews and deployment monitoring',
    problem: 'Engineering automation needs strong boundaries because code and deployment actions carry production risk.',
    useCases: ['PR reviews', 'Deployment monitoring', 'Incident alerts', 'On-call routing'],
    connectors: ['GitHub', 'Jira', 'PagerDuty', 'Slack'],
    sampleAgents: [],
    roiMetrics: ['Review time saved', 'Incidents routed', 'Deployment checks'],
    compliance: 'Change-management evidence',
    complianceEvidence: ['PR review log', 'Deployment approval evidence'],
    roiRange: [80000, 380000],
    monthlyBaseSavings: 52000,
    savingsPerPerson: 5200,
    approval: { title: 'Post release note after deployment checks pass', app: 'GitHub + Slack', risk: 'Medium risk', reason: 'Customer-visible release messaging needs owner approval.', cta: 'Approve update' },
  },
  {
    id: 'marketing',
    name: 'Marketing',
    icon: Megaphone,
    tier: 2,
    status: 'Early Access',
    color: 'text-pink-300',
    valueProp: 'Govern campaign approvals, content review, lead routing, and social monitoring.',
    topUseCase: 'Campaign approval workflow',
    problem: 'Marketing teams need faster content and campaign ops without brand, legal, or consent mistakes.',
    useCases: ['Campaign approvals', 'Content review', 'Lead routing', 'Social monitoring'],
    connectors: ['HubSpot', 'Salesforce', 'Slack', 'Gmail'],
    sampleAgents: [],
    roiMetrics: ['Campaign ops hours saved', 'Leads routed', 'Approval delays reduced'],
    compliance: 'Consent and content approval evidence',
    complianceEvidence: ['Campaign approval trail', 'Lead routing evidence'],
    roiRange: [45000, 220000],
    monthlyBaseSavings: 34000,
    savingsPerPerson: 3000,
    approval: { title: 'Approve campaign copy before sending', app: 'HubSpot + Gmail', risk: 'Medium risk', reason: 'External messaging and consent list are being checked.', cta: 'Approve campaign' },
  },
  {
    id: 'compliance',
    name: 'Compliance',
    icon: ShieldCheck,
    tier: 2,
    status: 'Coming Soon',
    color: 'text-emerald-300',
    valueProp: 'Create audit evidence, enforce policy, detect breaches, and manage consent.',
    topUseCase: 'Audit evidence automation',
    problem: 'Compliance teams need evidence continuously, not only when auditors ask for it.',
    useCases: ['Policy enforcement', 'Audit evidence', 'Breach detection', 'Consent management'],
    connectors: ['Zapheit native audit', 'DPDP workflows'],
    sampleAgents: [],
    roiMetrics: ['Evidence hours saved', 'Policy exceptions caught'],
    compliance: 'DPDP and internal control evidence',
    complianceEvidence: ['Policy enforcement log', 'Consent workflow trail'],
    roiRange: [65000, 300000],
    monthlyBaseSavings: 46000,
    savingsPerPerson: 4000,
    approval: { title: 'Open breach investigation workflow', app: 'Zapheit Audit', risk: 'High risk', reason: 'Potential DPDP incident needs controlled evidence capture.', cta: 'Start review' },
  },
  {
    id: 'legal',
    name: 'Legal',
    icon: Scale,
    tier: 2,
    status: 'Coming Soon',
    color: 'text-indigo-300',
    valueProp: 'Track NDAs, contract review triggers, approvals, and document handoffs.',
    topUseCase: 'NDA and contract workflow tracking',
    problem: 'Legal teams need earlier triggers and better handoff evidence across email, documents, and business approvals.',
    useCases: ['Contract review triggers', 'NDA tracking', 'Approval workflows', 'Document management'],
    connectors: ['Gmail', 'Notion', 'Slack'],
    sampleAgents: [],
    roiMetrics: ['Review delays reduced', 'NDAs tracked', 'Approvals completed'],
    compliance: 'Document approval evidence',
    complianceEvidence: ['NDA status trail', 'Contract approval log'],
    roiRange: [35000, 180000],
    monthlyBaseSavings: 30000,
    savingsPerPerson: 2600,
    approval: { title: 'Route NDA exception to legal owner', app: 'Gmail + Notion', risk: 'High risk', reason: 'Contract language changed from standard template.', cta: 'Route to legal' },
  },
  {
    id: 'sales',
    name: 'Sales',
    icon: BriefcaseBusiness,
    tier: 2,
    status: 'Early Access',
    color: 'text-orange-300',
    valueProp: 'Automate pipeline updates, outreach drafts, lead scoring, and follow-ups.',
    topUseCase: 'Pipeline hygiene and follow-up automation',
    problem: 'Sales teams lose revenue when CRM updates, lead scoring, and follow-ups are delayed or inconsistent.',
    useCases: ['Pipeline updates', 'Outreach drafting', 'Lead scoring', 'Follow-up automation'],
    connectors: ['HubSpot', 'Salesforce', 'Pipedrive', 'Gmail'],
    sampleAgents: [],
    roiMetrics: ['Follow-ups sent', 'CRM hours saved', 'Pipeline leakage reduced'],
    compliance: 'CRM update and consent evidence',
    complianceEvidence: ['Lead source record', 'Outreach approval trail'],
    roiRange: [70000, 340000],
    monthlyBaseSavings: 50000,
    savingsPerPerson: 4600,
    approval: { title: 'Send follow-up to high-intent lead', app: 'HubSpot + Gmail', risk: 'Low risk', reason: 'Lead engaged twice and consent source is present.', cta: 'Approve follow-up' },
  },
];

const FILTERS: Array<'All' | BundleStatus> = ['All', 'Active', 'Early Access', 'Coming Soon'];

function statusBadge(status: BundleStatus) {
  return `rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[status]}`;
}

function BundleIcon({ bundle }: { bundle: Bundle }) {
  const Icon = bundle.icon;
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
      <Icon className={`h-5 w-5 ${bundle.color}`} />
    </div>
  );
}

function bundleDisplayName(bundle: Bundle) {
  return bundle.name.endsWith('Bundle') ? bundle.name : `${bundle.name} Bundle`;
}

function useEstimate(bundle: Bundle, teamSize: number, hourlyRate: number) {
  return Math.max(bundle.monthlyBaseSavings, bundle.savingsPerPerson * teamSize + hourlyRate * teamSize * 7);
}

function BundleCard({ bundle }: { bundle: Bundle }) {
  const navigate = useNavigate();
  const isActive = bundle.status === 'Active';
  return (
    <button
      onClick={() => navigate(`/dashboard/bundles/${bundle.id}`)}
      className={`group flex h-full flex-col rounded-2xl border p-5 text-left transition ${
        isActive
          ? 'border-white/10 bg-white/[0.035] hover:border-cyan-500/35 hover:bg-white/[0.055]'
          : 'border-slate-700/70 bg-slate-900/35 hover:border-slate-600'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <BundleIcon bundle={bundle} />
        <span className={statusBadge(bundle.status)}>{bundle.status}</span>
      </div>
      <h3 className="mt-4 text-lg font-bold text-white">{bundleDisplayName(bundle)}</h3>
      <p className="mt-2 min-h-[44px] text-sm leading-relaxed text-slate-400">{bundle.topUseCase}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-white/[0.07] bg-slate-950/40 p-3">
          <p className="text-slate-500">Connectors</p>
          <p className="mt-1 font-semibold text-white">{bundle.connectors.length}</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-slate-950/40 p-3">
          <p className="text-slate-500">ROI range</p>
          <p className="mt-1 font-semibold text-white">{formatInr(bundle.roiRange[0])} - {formatInr(bundle.roiRange[1])}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {bundle.useCases.slice(0, 3).map((item) => (
          <span key={item} className="rounded-full border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-300">{item}</span>
        ))}
      </div>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">
        {bundle.tier === 1 ? 'Open bundle' : 'Preview vision'}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function OverviewPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'All' | BundleStatus>('All');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return BUNDLES.filter((bundle) => {
      const matchesFilter = filter === 'All' || bundle.status === filter;
      const haystack = [bundle.name, bundle.topUseCase, bundle.valueProp, ...bundle.useCases, ...bundle.connectors].join(' ').toLowerCase();
      return matchesFilter && (!query || haystack.includes(query));
    });
  }, [filter, search]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.045] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              <BriefcaseBusiness className="h-4 w-4" />
              Vertical bundles
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Deploy AI workers by department, not by blank canvas.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
              Bundles package India-first connectors, prebuilt agents, approval policies, ROI metrics, and compliance evidence for the workflows buyers already understand.
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard/shadow?source=bundle')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
          >
            Find my first bundle
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search GST, greytHR, support, sales..."
            className="w-full rounded-xl border border-slate-700 bg-slate-900/60 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500/50"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                filter === item ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:text-white'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((bundle) => <BundleCard key={bundle.id} bundle={bundle} />)}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-8 text-center">
          <p className="font-semibold text-white">No bundle matched that search.</p>
          <p className="mt-1 text-sm text-slate-400">Try GST, WhatsApp, payroll, refund, pipeline, or audit.</p>
        </div>
      )}
    </div>
  );
}

function TierTwoPage({ bundle }: { bundle: Bundle }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <button onClick={() => navigate('/dashboard/bundles')} className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Back to bundles
      </button>
      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/45 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <BundleIcon bundle={bundle} />
              <span className={statusBadge(bundle.status)}>{bundle.status}</span>
            </div>
            <h1 className="mt-4 text-3xl font-bold text-white">{bundleDisplayName(bundle)}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">{bundle.valueProp}</p>
          </div>
          <button
            onClick={() => navigate(`/dashboard/shadow?source=bundle&vertical=${bundle.id}`)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
          >
            Join early access
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Use cases</h2>
          <div className="mt-4 space-y-2">
            {bundle.useCases.map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                {item}
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Connectors</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {bundle.connectors.map((item) => <span key={item} className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300">{item}</span>)}
          </div>
        </section>
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.045] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Why it matters</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">{bundle.problem}</p>
        </section>
      </div>
    </div>
  );
}

function BundleDetailPage({ bundle }: { bundle: Bundle }) {
  const navigate = useNavigate();
  const [teamSize, setTeamSize] = useState(12);
  const [hourlyRate, setHourlyRate] = useState(800);
  const estimate = useEstimate(bundle, teamSize, hourlyRate);

  if (bundle.tier === 2) return <TierTwoPage bundle={bundle} />;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <button onClick={() => navigate('/dashboard/bundles')} className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Back to bundles
      </button>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <BundleIcon bundle={bundle} />
              <span className={statusBadge(bundle.status)}>{bundle.status}</span>
              <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">Deploy in 5 minutes</span>
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">{bundleDisplayName(bundle)}</h1>
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-slate-300">{bundle.valueProp}</p>
          </div>
          <button
            onClick={() => navigate(`/dashboard/shadow?source=bundle&vertical=${bundle.id}`)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
          >
            Start with this bundle
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            Problem this solves
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{bundle.problem}</p>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {bundle.useCases.map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-950/35 px-3 py-2 text-sm text-slate-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.045] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">
            <Calculator className="h-4 w-4" />
            ROI calculator
          </h2>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Team size</label>
          <input
            type="number"
            min={1}
            value={teamSize}
            onChange={(event) => setTeamSize(Math.max(1, Number(event.target.value) || 1))}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
          />
          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Average hourly rate</label>
          <input
            type="range"
            min={200}
            max={5000}
            step={50}
            value={hourlyRate}
            onChange={(event) => setHourlyRate(Number(event.target.value))}
            className="mt-3 w-full accent-emerald-400"
          />
          <div className="mt-2 text-sm font-semibold text-white">{formatInr(hourlyRate)}/hour</div>
          <div className="mt-5 rounded-xl border border-emerald-500/20 bg-slate-950/45 p-4">
            <p className="text-xs text-slate-400">Estimated monthly value</p>
            <p className="mt-1 text-3xl font-bold text-emerald-300">{formatInr(estimate)}</p>
            <p className="mt-1 text-xs text-slate-400">Based on configured workflows, team size, and recoverable manual hours.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
          <Bot className="h-4 w-4 text-cyan-300" />
          Agent templates included
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {bundle.sampleAgents.map((agent) => (
            <div key={agent.name} className="rounded-2xl border border-slate-700/60 bg-slate-950/35 p-4">
              <h3 className="font-semibold text-white">{agent.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{agent.does}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {agent.connectors.map((item) => <span key={item} className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300">{item}</span>)}
              </div>
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Sample approval</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">{agent.sampleApproval}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
            <BadgeCheck className="h-4 w-4 text-blue-300" />
            Supported connectors
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            {bundle.connectors.map((connector) => (
              <div key={connector} className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-950/40 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xs font-bold text-cyan-200">
                  {connector.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-slate-200">{connector}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.045] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-blue-200">
            <FileText className="h-4 w-4" />
            Sample approval card
          </h2>
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">{bundle.approval.title}</h3>
                <p className="mt-1 text-xs text-slate-400">{bundle.approval.app}</p>
              </div>
              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">{bundle.approval.risk}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{bundle.approval.reason}</p>
            <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white">
              {bundle.approval.cta}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
            <TrendingUp className="h-4 w-4 text-emerald-300" />
            ROI metrics tracked
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {bundle.roiMetrics.map((item) => (
              <div key={item} className="rounded-xl border border-slate-700/60 bg-slate-950/35 px-3 py-2 text-sm text-slate-300">
                <IndianRupee className="mr-2 inline h-4 w-4 text-emerald-300" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.045] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">
            <LockKeyhole className="h-4 w-4" />
            Compliance evidence
          </h2>
          <p className="mt-3 text-sm font-medium text-white">{bundle.compliance}</p>
          <div className="mt-4 space-y-2">
            {bundle.complianceEvidence.map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm text-slate-300">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.045] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <HeartHandshake className="h-5 w-5 text-cyan-300" />
              Start safely in shadow mode
            </h2>
            <p className="mt-1 text-sm text-slate-300">Zapheit will preselect this vertical, scan connected apps, and recommend the first read-only agent with approval controls.</p>
          </div>
          <button
            onClick={() => navigate(`/dashboard/shadow?source=bundle&vertical=${bundle.id}`)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
          >
            Start with this bundle
            <Clock3 className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}

export default function VerticalBundlesPage() {
  const { bundleId } = useParams();
  const normalizedBundleId = bundleId === 'it-ops' ? 'it-operations' : bundleId;
  const bundle = normalizedBundleId ? BUNDLES.find((item) => item.id === normalizedBundleId) : null;

  if (!normalizedBundleId) return <OverviewPage />;
  if (!bundle) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-700 bg-slate-900/50 p-8 text-center">
        <p className="font-semibold text-white">Bundle not found</p>
        <p className="mt-1 text-sm text-slate-400">This vertical may have moved or is not available yet.</p>
      </div>
    );
  }
  return <BundleDetailPage bundle={bundle} />;
}
