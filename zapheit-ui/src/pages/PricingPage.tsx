import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, MessageCircle, ChevronDown, X } from 'lucide-react';

const CONTACT_WA = '919433116259';

function openWhatsApp(msg: string) {
  window.open(`https://wa.me/${CONTACT_WA}?text=${encodeURIComponent(msg)}`, '_blank');
}

const PLANS = [
  {
    id: 'free', name: 'Free', tagline: 'Try with 1 assistant, no credit card.',
    priceMonthly: 0, priceAnnual: 0,
    agents: '1', requests: '1,000/mo', members: '1', audit: '7 days',
    incident: 'PII only', compliance: false, sso: false, vpc: false, support: 'Community',
    popular: false,
    cta: 'Start Free',
    ctaClass: 'bg-white/8 hover:bg-white/14 text-white border border-white/10',
  },
  {
    id: 'pro', name: 'Pro', tagline: 'Full visibility for small teams.',
    priceMonthly: 4999, priceAnnual: 49999,
    agents: '10', requests: '50,000/mo', members: '10', audit: '90 days',
    incident: 'PII + hallucination', compliance: false, sso: false, vpc: false, support: 'Email',
    popular: false,
    cta: 'Get Started',
    ctaClass: 'bg-white/8 hover:bg-white/14 text-white border border-white/10',
  },
  {
    id: 'business', name: 'Business', tagline: 'Compliance + unlimited members + predictive alerts.',
    priceMonthly: 19999, priceAnnual: 199999,
    agents: '50', requests: '2,50,000/mo', members: 'Unlimited', audit: 'Unlimited',
    incident: 'Predictive', compliance: true, sso: false, vpc: false, support: '4hr SLA',
    popular: true,
    cta: 'Get Started',
    ctaClass: 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20',
  },
  {
    id: 'enterprise', name: 'Enterprise', tagline: 'SSO, VPC, dedicated support, custom SLAs.',
    priceMonthly: null, priceAnnual: null,
    agents: 'Unlimited', requests: 'Unlimited', members: 'Unlimited', audit: 'Unlimited',
    incident: 'Predictive + custom', compliance: true, sso: true, vpc: true, support: '1hr SLA + dedicated',
    popular: false,
    cta: 'Talk to Sales',
    ctaClass: 'border border-white/15 text-slate-300 hover:bg-white/[0.06]',
  },
];

const COMPARISON_ROWS: { label: string; key: keyof typeof PLANS[0] | null; custom?: (plan: typeof PLANS[0]) => React.ReactNode }[] = [
  { label: 'AI assistants', key: 'agents' },
  { label: 'Gateway requests/mo', key: 'requests' },
  { label: 'Team members', key: 'members' },
  { label: 'Audit log retention', key: 'audit' },
  { label: 'Incident detection', key: 'incident' },
  { label: 'DPDPA compliance export', key: 'compliance' },
  { label: 'Predictive alerts', key: null, custom: (p) => p.incident === 'Predictive' || p.incident === 'Predictive + custom' ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <X className="w-4 h-4 text-slate-700 mx-auto" /> },
  { label: 'SSO / SAML', key: 'sso' },
  { label: 'VPC / on-prem runtime', key: 'vpc' },
  { label: 'Support', key: 'support' },
];

const ADDONS = [
  { name: 'Extra team members', note: 'Pro plan only', price: '₹500/user/mo' },
  { name: 'Concierge onboarding', note: 'One-time, includes 30-min training call', price: '₹25,000' },
  { name: 'Extended audit log (+1 year)', note: 'Any paid plan', price: '₹1,000/mo' },
];

const FAQS = [
  {
    q: 'What counts as a gateway request?',
    a: 'Each call routed through the Zapheit AI message hub counts as one request — regardless of model, token count, or provider. Streaming responses count as one request.',
  },
  {
    q: 'Can I change plans anytime?',
    a: 'Yes. Upgrade or downgrade at any time. Upgrades take effect immediately; downgrades apply at the end of your billing period.',
  },
  {
    q: 'Is there a free trial on paid plans?',
    a: 'The Free plan is permanently free with no time limit. Paid plans don\'t have a separate trial — start on Free and upgrade when you\'re ready.',
  },
  {
    q: 'Where is my data stored?',
    a: 'All data is stored in India (Google Cloud asia-south1, Mumbai). We never store your AI conversations on shared infrastructure. Enterprise plans support custom data residency.',
  },
  {
    q: 'Does Zapheit support DPDPA compliance?',
    a: 'Yes. The Business plan includes a one-click DPDPA compliance export — an auto-populated PDF from your audit log, timestamped and ready for regulators. GDPR export is available on Enterprise.',
  },
];

function CellValue({ val }: { val: boolean | string | React.ReactNode }) {
  if (val === true) return <Check className="w-4 h-4 text-emerald-400 mx-auto" />;
  if (val === false) return <X className="w-4 h-4 text-slate-700 mx-auto" />;
  if (typeof val === 'string') return <span className="text-slate-300 text-xs text-center block">{val}</span>;
  return <>{val}</>;
}

export default function PricingPage() {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const displayPrice = (plan: typeof PLANS[0]): string => {
    if (plan.priceMonthly === null) return 'Custom';
    if (plan.priceMonthly === 0) return '₹0';
    const price = billing === 'annual'
      ? Math.round((plan.priceAnnual ?? 0) / 12)
      : plan.priceMonthly;
    return `₹${price.toLocaleString('en-IN')}`;
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white">

      {/* Nav */}
      <nav className="border-b border-white/[0.06] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Zapheit
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2"
            >
              Log in
            </button>
            <button
              onClick={() => openWhatsApp("Hi, I'd like to learn more about Zapheit. Can we connect?")}
              className="text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:from-cyan-400 hover:to-blue-500 transition-all flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Talk to us
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-16 space-y-20">

        {/* Header + billing toggle */}
        <div className="text-center space-y-5 max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Pricing</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Simple, honest pricing
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Start free. Upgrade when you need more. INR billing, no per-seat surprises, no hidden fees.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-white/10 bg-white/[0.04]">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${billing === 'monthly' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${billing === 'annual' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}
            >
              Annual
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">Save 17%</span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={[
                'relative rounded-2xl border p-6 flex flex-col gap-5',
                plan.popular
                  ? 'border-cyan-400/50 bg-[linear-gradient(160deg,rgba(34,211,238,0.10),rgba(8,47,73,0.25))] ring-1 ring-cyan-400/30'
                  : 'border-slate-800/60 bg-slate-900/40',
              ].join(' ')}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 whitespace-nowrap">
                    Most Popular
                  </span>
                </div>
              )}

              <div>
                <h2 className="text-lg font-bold text-white">{plan.name}</h2>
                <p className="text-xs text-slate-500 mt-1">{plan.tagline}</p>
              </div>

              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">{displayPrice(plan)}</span>
                  {plan.priceMonthly !== null && <span className="text-slate-500 text-sm">/mo</span>}
                </div>
                {billing === 'annual' && plan.priceAnnual && plan.priceAnnual > 0 && (
                  <p className="text-xs text-emerald-400 mt-1">
                    ₹{plan.priceAnnual.toLocaleString('en-IN')}/yr · saves ₹{((plan.priceMonthly ?? 0) * 12 - plan.priceAnnual).toLocaleString('en-IN')}
                  </p>
                )}
                {plan.priceMonthly === null && (
                  <p className="text-xs text-slate-500 mt-1">Contact us for a quote</p>
                )}
              </div>

              <div className="border-t border-slate-800/60" />

              <ul className="space-y-2 flex-1 text-xs text-slate-400">
                <li className="flex justify-between gap-2"><span>AI assistants</span><span className="text-white font-medium">{plan.agents}</span></li>
                <li className="flex justify-between gap-2"><span>Requests/mo</span><span className="text-white font-medium">{plan.requests}</span></li>
                <li className="flex justify-between gap-2"><span>Team members</span><span className="text-white font-medium">{plan.members}</span></li>
                <li className="flex justify-between gap-2"><span>Audit log</span><span className="text-white font-medium">{plan.audit}</span></li>
                <li className="flex justify-between gap-2"><span>Support</span><span className="text-white font-medium">{plan.support}</span></li>
              </ul>

              <button
                onClick={() => {
                  if (plan.id === 'enterprise') {
                    openWhatsApp("Hi, I'd like to discuss Enterprise pricing for Zapheit. Can we connect?");
                  } else {
                    navigate('/signup');
                  }
                }}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${plan.ctaClass}`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* India trust tags */}
        <div className="flex flex-wrap justify-center gap-2">
          <span className="text-xs text-slate-600 flex items-center pr-1">🇮🇳 Built for India —</span>
          {['Aadhaar detection', 'PAN card protection', 'UPI ID masking', 'DPDPA compliance', 'INR billing', 'Data stored in India'].map((tag) => (
            <span key={tag} className="px-3 py-1 rounded-full border border-slate-800 bg-slate-900/60 text-slate-400 text-xs">
              {tag}
            </span>
          ))}
        </div>

        {/* Full feature comparison */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-center tracking-tight">Full feature comparison</h2>
          <div className="rounded-2xl border border-slate-800/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/60 bg-slate-900/60">
                  <th className="text-left px-6 py-4 text-slate-400 font-medium w-2/5">Feature</th>
                  <th className="px-3 py-4 text-center text-slate-300 font-semibold text-xs">Free</th>
                  <th className="px-3 py-4 text-center text-slate-300 font-semibold text-xs">Pro</th>
                  <th className="px-3 py-4 text-center text-cyan-300 font-semibold text-xs">Business</th>
                  <th className="px-3 py-4 text-center text-emerald-300 font-semibold text-xs">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={row.label} className={`border-b border-slate-800/40 ${i % 2 === 0 ? 'bg-slate-950/20' : ''}`}>
                    <td className="px-6 py-3.5 text-slate-300 text-sm">{row.label}</td>
                    {PLANS.map((plan) => (
                      <td key={plan.id} className="px-3 py-3.5 text-center">
                        {row.custom
                          ? row.custom(plan)
                          : <CellValue val={plan[row.key as keyof typeof plan] as boolean | string} />
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add-ons */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-center tracking-tight">Add-ons</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {ADDONS.map((addon) => (
              <div key={addon.name} className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 space-y-2">
                <p className="font-semibold text-white text-sm">{addon.name}</p>
                <p className="text-xs text-slate-500">{addon.note}</p>
                <p className="text-lg font-bold text-cyan-300">{addon.price}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl font-bold text-center tracking-tight">Common questions</h2>
          <div className="space-y-2">
            {FAQS.map(({ q, a }, idx) => (
              <div key={q} className="rounded-2xl border border-slate-800/50 bg-slate-900/40 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-6 py-5 text-left gap-4"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                >
                  <span className="font-semibold text-white text-sm">{q}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-200 ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-5">
                    <p className="text-sm text-slate-400 leading-relaxed">{a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center space-y-6 pb-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Not sure where to start?</h2>
            <p className="text-slate-400 text-sm">Start free — no credit card required. Or chat with us and we'll recommend the right plan.</p>
          </div>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => navigate('/signup')}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20 text-sm"
            >
              Start Free — No Credit Card
            </button>
            <button
              onClick={() => openWhatsApp("Hi, I'd like to find the right Zapheit plan for my team. Can we connect?")}
              className="px-8 py-3 rounded-xl border border-slate-700 text-slate-300 font-semibold hover:border-slate-600 hover:text-white transition-all text-sm flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Talk to Sales
            </button>
          </div>
        </div>

      </div>

      {/* Floating WhatsApp */}
      <button
        onClick={() => openWhatsApp("Hi, I'd like to learn more about Zapheit. Can we connect?")}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-xl shadow-emerald-900/50 transition-all hover:scale-105"
      >
        <MessageCircle className="w-4 h-4" />
        Chat with us
      </button>
    </div>
  );
}
