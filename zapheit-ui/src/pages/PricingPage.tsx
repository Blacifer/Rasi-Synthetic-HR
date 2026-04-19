import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, MessageCircle, ChevronDown } from 'lucide-react';

const CONTACT_WA = '919433116259';

function openWhatsApp(planName: string, note?: string) {
  const text = note ?? `Hi, I'm interested in ${planName} by Zapheit. Can we connect?`;
  window.open(`https://wa.me/${CONTACT_WA}?text=${encodeURIComponent(text)}`, '_blank');
}

const PLANS = [
  {
    name: 'The Audit',
    subtitle: 'One-time assessment',
    price: '₹25,000',
    cadence: 'one-time',
    bestFor: 'Teams validating a first AI rollout',
    popular: false,
    features: [
      'AI Workforce Health Scan',
      'Risk score and leakage report',
      '1-hour strategic review session',
      'Governance action plan',
      'Up to 5 agents assessed',
    ],
    cta: 'Book an Audit',
    waText: "Hi, I'd like to book an AI Governance Audit with Zapheit. Can we connect?",
    ctaClass: 'bg-slate-800 hover:bg-slate-700 text-white',
  },
  {
    name: 'The Retainer',
    subtitle: 'Continuous governance',
    price: '₹40k–₹60k',
    cadence: '/month',
    bestFor: 'Operating teams with active agent fleets',
    popular: true,
    features: [
      'Everything in The Audit',
      '200,000 gateway requests/month',
      'Real-time PII & hallucination detection',
      'Action policies & kill switch',
      'HITL approval workflows',
      'Weekly behavioral reviews',
      'Incident log & Black Box forensics',
      'Monthly performance report',
      'Slack alerts & webhook integrations',
    ],
    cta: 'Talk to us',
    waText: "Hi, I'm interested in The Retainer plan by Zapheit for continuous AI governance. Can we connect?",
    ctaClass: 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20',
  },
  {
    name: 'Enterprise',
    subtitle: 'Governance partnership',
    price: 'Custom',
    cadence: '',
    bestFor: 'Regulated orgs running business-critical AI',
    popular: false,
    features: [
      'Everything in The Retainer',
      'Unlimited gateway requests',
      'VPC / on-prem runtime workers',
      'DPDPA & NIST AI RMF mapping',
      'Custom compliance report generation',
      'Dedicated governance manager',
      'Executive-ready compliance layer',
      'SLA with response-time guarantees',
      'Priority support & onboarding',
    ],
    cta: 'Contact Sales',
    waText: "Hi, I'd like to discuss Enterprise pricing with Zapheit. We're a regulated org and need a governance partnership.",
    ctaClass: 'bg-emerald-900/40 border border-emerald-500/30 hover:bg-emerald-900/60 text-emerald-300',
  },
];

const COMPARISON = [
  { feature: 'Gateway requests/month', audit: '—', retainer: '200,000', enterprise: 'Unlimited' },
  { feature: 'Agents governed', audit: 'Up to 5', retainer: 'Up to 50', enterprise: 'Unlimited' },
  { feature: 'PII & hallucination detection', audit: 'Audit only', retainer: 'Real-time', enterprise: 'Real-time' },
  { feature: 'Action policies & kill switch', audit: false, retainer: true, enterprise: true },
  { feature: 'HITL approval workflows', audit: false, retainer: true, enterprise: true },
  { feature: 'Black Box forensics', audit: false, retainer: true, enterprise: true },
  { feature: 'Slack alerts & webhooks', audit: false, retainer: true, enterprise: true },
  { feature: 'Shadow Mode adversarial testing', audit: false, retainer: true, enterprise: true },
  { feature: 'Multi-provider cost tracking', audit: false, retainer: true, enterprise: true },
  { feature: 'VPC / on-prem runtime', audit: false, retainer: false, enterprise: true },
  { feature: 'DPDPA / NIST AI RMF mapping', audit: false, retainer: false, enterprise: true },
  { feature: 'Dedicated governance manager', audit: false, retainer: false, enterprise: true },
  { feature: 'SLA guarantees', audit: '—', retainer: 'Standard', enterprise: 'Custom' },
];

const FAQS = [
  {
    q: 'What counts as a gateway request?',
    a: 'Each call to the Zapheit LLM gateway counts as one request — regardless of model, token count, or provider. Streaming responses count as one request.',
  },
  {
    q: 'Can I use Zapheit without routing traffic through the gateway?',
    a: 'Yes. The Audit plan and standalone governance features (fleet management, audit logs, policy editor) work without the gateway. The gateway is required for real-time incident detection and cost tracking.',
  },
  {
    q: 'Which LLM providers does Zapheit support?',
    a: 'OpenAI (GPT-4o family), Anthropic (Claude 3.5/3 Haiku), and 300+ models via OpenRouter including Gemini, Llama, and Mistral.',
  },
  {
    q: 'Can I self-host or run Zapheit in my VPC?',
    a: 'Yes — the Runtime Worker can be deployed inside your private network. The agent jobs are pulled from the queue securely without inbound firewall rules. Enterprise plan includes VPC deployment support.',
  },
  {
    q: 'How does the Audit-to-Retainer upgrade work?',
    a: 'After an Audit, your governance action plan maps directly to Retainer setup tasks. We can usually complete onboarding in under a week. The Audit fee is credited toward the first Retainer month.',
  },
];

const INDIA_TAGS = ['Aadhaar detection', 'PAN card protection', 'UPI ID masking', 'DPDPA compliance', 'INR billing'];

const NEXT_STEPS = [
  { num: '01', title: 'You message us', body: 'Tell us how many agents you run and what you need to govern.' },
  { num: '02', title: 'We review your setup', body: 'Within one business day we map your AI footprint and recommend a plan.' },
  { num: '03', title: 'Onboarding in 5 days', body: 'Agents connected, policies live, first incident report delivered.' },
];

function CellValue({ val }: { val: boolean | string }) {
  if (val === true) return <Check className="w-4 h-4 text-emerald-400 mx-auto" />;
  if (val === false) return <span className="text-slate-700 mx-auto block text-center">—</span>;
  return <span className="text-slate-300 text-sm text-center block">{val}</span>;
}

export default function PricingPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
              onClick={() => openWhatsApp('Zapheit', "Hi, I'd like to learn more about Zapheit AI governance. Can we connect?")}
              className="text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:from-cyan-400 hover:to-blue-500 transition-all flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Talk to us
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-20 space-y-24">

        {/* Header */}
        <div className="text-center space-y-5 max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Pricing</p>
          <h1 className="text-5xl font-bold tracking-tight leading-tight">
            Govern your AI agents.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              From day one.
            </span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Start with a health scan. Scale to continuous governance across your agents and connected apps. INR billing, no per-seat surprises.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={[
                'relative rounded-3xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-sm p-8 flex flex-col gap-6',
                plan.popular ? 'ring-2 ring-cyan-500/50 ring-offset-2 ring-offset-[#020617]' : '',
              ].join(' ')}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 whitespace-nowrap">
                    Most popular
                  </span>
                </div>
              )}

              {/* Plan identity */}
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">{plan.name}</h2>
                <p className="text-sm text-slate-500">{plan.subtitle}</p>
              </div>

              {/* Price */}
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold font-mono text-white">{plan.price}</span>
                  {plan.cadence && (
                    <span className="text-slate-500 text-sm">{plan.cadence}</span>
                  )}
                </div>
                <p className="text-sm text-slate-500 italic mt-1">{plan.bestFor}</p>
              </div>

              <div className="border-t border-slate-800/60" />

              {/* Features */}
              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => openWhatsApp(plan.name, plan.waText)}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${plan.ctaClass}`}
              >
                <MessageCircle className="w-4 h-4" />
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* India trust tags */}
        <div className="flex flex-wrap justify-center gap-2">
          <span className="text-xs text-slate-600 flex items-center pr-1">🇮🇳 Built for India —</span>
          {INDIA_TAGS.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 rounded-full border border-slate-800 bg-slate-900/60 text-slate-400 text-xs"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Feature comparison table */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center tracking-tight">Full feature comparison</h2>
          <div className="rounded-2xl border border-slate-800/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/60 bg-slate-900/60">
                  <th className="text-left px-6 py-4 text-slate-400 font-medium w-1/2">Feature</th>
                  <th className="px-4 py-4 text-center text-slate-300 font-semibold">The Audit</th>
                  <th className="px-4 py-4 text-center text-cyan-300 font-semibold">The Retainer</th>
                  <th className="px-4 py-4 text-center text-emerald-300 font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={`border-b border-slate-800/40 ${i % 2 === 0 ? 'bg-slate-950/20' : ''}`}
                  >
                    <td className="px-6 py-3.5 text-slate-300">{row.feature}</td>
                    <td className="px-4 py-3.5"><CellValue val={row.audit} /></td>
                    <td className="px-4 py-3.5"><CellValue val={row.retainer} /></td>
                    <td className="px-4 py-3.5"><CellValue val={row.enterprise} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ — accordion */}
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-center tracking-tight">Common questions</h2>
          <div className="space-y-2">
            {FAQS.map(({ q, a }, idx) => (
              <div
                key={q}
                className="rounded-2xl border border-slate-800/50 bg-slate-900/40 overflow-hidden"
              >
                <button
                  className="w-full flex items-center justify-between px-6 py-5 text-left gap-4"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                >
                  <span className="font-semibold text-white text-sm">{q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-200 ${openFaq === idx ? 'rotate-180' : ''}`}
                  />
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

        {/* CTA footer */}
        <div className="text-center space-y-6 pb-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Not sure where to start?</h2>
            <p className="text-slate-400 text-sm">Book a 30-minute governance review. We'll map your AI footprint and recommend the right plan.</p>
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => openWhatsApp('Zapheit', "Hi, I'd like to book a 30-minute AI governance review with Zapheit. Can we find a time?")}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2 text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              Talk to us on WhatsApp
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-3 rounded-xl border border-slate-700 text-slate-300 font-semibold hover:border-slate-600 hover:text-white transition-all text-sm"
            >
              Log in
            </button>
          </div>

          {/* Inline next steps */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-0 pt-4 max-w-2xl mx-auto">
            {NEXT_STEPS.map((step, i) => (
              <div key={step.num} className="flex items-center gap-0">
                <div className="px-6 py-4 text-center space-y-1 flex-1">
                  <p className="text-xs font-mono font-bold text-cyan-500">{step.num}</p>
                  <p className="text-xs font-semibold text-white">{step.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-[160px] mx-auto">{step.body}</p>
                </div>
                {i < NEXT_STEPS.length - 1 && (
                  <div className="hidden sm:block h-px w-8 bg-slate-800 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Floating WhatsApp button */}
      <button
        onClick={() => openWhatsApp('Zapheit', "Hi, I'd like to learn more about Zapheit AI governance. Can we connect?")}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-xl shadow-emerald-900/50 transition-all hover:scale-105"
      >
        <MessageCircle className="w-4 h-4" />
        Chat with us
      </button>
    </div>
  );
}
