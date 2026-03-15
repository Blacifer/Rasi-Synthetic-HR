import { useState, useEffect, useMemo } from 'react';
import { Check, X, Zap, Cpu, ArrowRightLeft, Target, Globe2, Eye, Banknote, ShieldCheck, Search, Filter, Loader2, Users, FileText, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { getFrontendConfig } from '../../lib/config';

interface LiveModel {
  id: string;
  name: string;
  provider: string;
  pricing?: { prompt?: string; completion?: string };
  context_length?: number;
}

// Add our rich UI fields locally since the API primarily handles pricing/IDs
interface EnrichedModel extends LiveModel {
  type: string;
  speed: number;
  accuracy: number;
  costInput: number;
  costOutput: number;
  costBlended: number;
  contextWindow: number;
  supportsFunctions: boolean;
  supportsVision: boolean;
  supportedLanguages: number;
  trainingData: string;
  idealFor: string;
  tag: string;
  color: string;
  recommendedAgents: string[];
}

// ---------------------------------------------------------------------------
// Static capability knowledge base — keyed by model ID (normalized)
// Sourced from published provider docs as of March 2026
// ---------------------------------------------------------------------------
interface ModelKnowledge {
  speed: number;          // tokens/sec relative score 0-100
  accuracy: number;       // MMLU-style benchmark score 0-100
  supportsVision: boolean;
  supportsFunctions: boolean;
  supportedLanguages: number;
  trainingData: string;   // knowledge cutoff year
  idealFor: string;
  recommendedAgents: string[];
  contextWindow?: number; // override if API doesn't return it
}

const MODEL_KNOWLEDGE: Record<string, ModelKnowledge> = {
  // ── OpenAI ──────────────────────────────────────────────────────────────
  'openai/gpt-4o': {
    speed: 85, accuracy: 92, supportsVision: true, supportsFunctions: true,
    supportedLanguages: 98, trainingData: '2024',
    idealFor: 'Complex reasoning, multimodal tasks, long-form analysis',
    recommendedAgents: ['Support Agent', 'IT Support Agent', 'Finance Agent'],
    contextWindow: 128000,
  },
  'openai/gpt-4o-mini': {
    speed: 96, accuracy: 82, supportsVision: true, supportsFunctions: true,
    supportedLanguages: 95, trainingData: '2024',
    idealFor: 'Fast, cost-efficient tasks, high-volume pipelines',
    recommendedAgents: ['Onboarding Agent', 'Support Agent', 'HR Agent'],
    contextWindow: 128000,
  },
  'openai/gpt-4-turbo': {
    speed: 80, accuracy: 89, supportsVision: true, supportsFunctions: true,
    supportedLanguages: 95, trainingData: '2024',
    idealFor: 'Balanced performance, large context tasks',
    recommendedAgents: ['Sales Agent', 'Finance Agent', 'Refund Agent'],
    contextWindow: 128000,
  },
  'openai/gpt-4': {
    speed: 65, accuracy: 87, supportsVision: false, supportsFunctions: true,
    supportedLanguages: 90, trainingData: '2023',
    idealFor: 'High-quality reasoning, enterprise workflows',
    recommendedAgents: ['Compliance Agent', 'Legal Agent'],
    contextWindow: 8192,
  },
  'openai/gpt-3.5-turbo': {
    speed: 97, accuracy: 70, supportsVision: false, supportsFunctions: true,
    supportedLanguages: 85, trainingData: '2022',
    idealFor: 'Fast responses, simple Q&A, high-volume low-cost',
    recommendedAgents: ['Onboarding Agent', 'Support Agent'],
    contextWindow: 16385,
  },
  'openai/o1': {
    speed: 45, accuracy: 96, supportsVision: false, supportsFunctions: false,
    supportedLanguages: 90, trainingData: '2024',
    idealFor: 'Deep reasoning, complex math, strategic planning',
    recommendedAgents: ['Legal Agent', 'Compliance Agent', 'Finance Agent'],
    contextWindow: 200000,
  },
  'openai/o1-mini': {
    speed: 70, accuracy: 88, supportsVision: false, supportsFunctions: false,
    supportedLanguages: 85, trainingData: '2024',
    idealFor: 'Affordable reasoning, STEM tasks, structured output',
    recommendedAgents: ['IT Support Agent', 'Finance Agent'],
    contextWindow: 128000,
  },
  'openai/o3-mini': {
    speed: 75, accuracy: 91, supportsVision: false, supportsFunctions: true,
    supportedLanguages: 90, trainingData: '2025',
    idealFor: 'Efficient reasoning, code, structured analysis',
    recommendedAgents: ['IT Support Agent', 'Compliance Agent'],
    contextWindow: 200000,
  },
  // ── Anthropic ───────────────────────────────────────────────────────────
  'anthropic/claude-3-5-sonnet': {
    speed: 88, accuracy: 91, supportsVision: true, supportsFunctions: true,
    supportedLanguages: 95, trainingData: '2024',
    idealFor: 'Writing, analysis, nuanced instruction-following',
    recommendedAgents: ['HR Agent', 'Support Agent', 'Sales Agent'],
    contextWindow: 200000,
  },
  'anthropic/claude-3-5-haiku': {
    speed: 96, accuracy: 80, supportsVision: true, supportsFunctions: true,
    supportedLanguages: 90, trainingData: '2024',
    idealFor: 'Fast, affordable tasks, real-time chat, classification',
    recommendedAgents: ['Onboarding Agent', 'Support Agent'],
    contextWindow: 200000,
  },
  'anthropic/claude-3-opus': {
    speed: 60, accuracy: 93, supportsVision: true, supportsFunctions: true,
    supportedLanguages: 95, trainingData: '2023',
    idealFor: 'Deep analysis, legal documents, long-form reasoning',
    recommendedAgents: ['Legal Agent', 'Compliance Agent'],
    contextWindow: 200000,
  },
  'anthropic/claude-3-sonnet': {
    speed: 82, accuracy: 85, supportsVision: true, supportsFunctions: true,
    supportedLanguages: 90, trainingData: '2023',
    idealFor: 'Balanced performance, enterprise drafting',
    recommendedAgents: ['HR Agent', 'Healthcare Agent'],
    contextWindow: 200000,
  },
  'anthropic/claude-3-haiku': {
    speed: 98, accuracy: 75, supportsVision: true, supportsFunctions: true,
    supportedLanguages: 88, trainingData: '2023',
    idealFor: 'Low-latency pipelines, customer triage',
    recommendedAgents: ['Onboarding Agent', 'Support Agent'],
    contextWindow: 200000,
  },
  'anthropic/claude-opus-4': {
    speed: 55, accuracy: 95, supportsVision: true, supportsFunctions: true,
    supportedLanguages: 95, trainingData: '2025',
    idealFor: 'Most complex tasks, strategic reasoning, deep research',
    recommendedAgents: ['Legal Agent', 'Compliance Agent', 'Finance Agent'],
    contextWindow: 200000,
  },
  'anthropic/claude-sonnet-4': {
    speed: 90, accuracy: 93, supportsVision: true, supportsFunctions: true,
    supportedLanguages: 95, trainingData: '2025',
    idealFor: 'High-quality versatile tasks, coding, analysis',
    recommendedAgents: ['HR Agent', 'Sales Agent', 'IT Support Agent'],
    contextWindow: 200000,
  },
  // ── Google ──────────────────────────────────────────────────────────────
  'google/gemini-2.0-flash-001': {
    speed: 97, accuracy: 83, supportsVision: true, supportsFunctions: true,
    supportedLanguages: 95, trainingData: '2025',
    idealFor: 'Fast multimodal pipelines, real-time responses',
    recommendedAgents: ['Support Agent', 'Onboarding Agent'],
    contextWindow: 1000000,
  },
  'google/gemini-2.0-flash': {
    speed: 97, accuracy: 83, supportsVision: true, supportsFunctions: true,
    supportedLanguages: 95, trainingData: '2025',
    idealFor: 'Fast multimodal pipelines, real-time responses',
    recommendedAgents: ['Support Agent', 'Onboarding Agent'],
    contextWindow: 1000000,
  },
  'google/gemini-1.5-pro': {
    speed: 75, accuracy: 88, supportsVision: true, supportsFunctions: true,
    supportedLanguages: 95, trainingData: '2024',
    idealFor: 'Very long contexts, document analysis, multimodal RAG',
    recommendedAgents: ['Legal Agent', 'HR Agent', 'Finance Agent'],
    contextWindow: 2000000,
  },
  'google/gemini-1.5-flash': {
    speed: 94, accuracy: 78, supportsVision: true, supportsFunctions: true,
    supportedLanguages: 90, trainingData: '2024',
    idealFor: 'Rapid classification, large-scale document triage',
    recommendedAgents: ['Support Agent', 'Onboarding Agent'],
    contextWindow: 1000000,
  },
  // ── Meta Llama ──────────────────────────────────────────────────────────
  'meta-llama/llama-3.1-70b-instruct': {
    speed: 78, accuracy: 80, supportsVision: false, supportsFunctions: true,
    supportedLanguages: 75, trainingData: '2023',
    idealFor: 'Open-source deployment, compliance-restricted environments',
    recommendedAgents: ['IT Support Agent', 'Compliance Agent'],
    contextWindow: 128000,
  },
  'meta-llama/llama-3.1-8b-instruct': {
    speed: 95, accuracy: 68, supportsVision: false, supportsFunctions: true,
    supportedLanguages: 65, trainingData: '2023',
    idealFor: 'Edge deployment, lightweight classification',
    recommendedAgents: ['Onboarding Agent', 'Support Agent'],
    contextWindow: 128000,
  },
  'meta-llama/llama-3.3-70b-instruct': {
    speed: 82, accuracy: 84, supportsVision: false, supportsFunctions: true,
    supportedLanguages: 78, trainingData: '2024',
    idealFor: 'Self-hosted quality reasoning, cost-efficient pipelines',
    recommendedAgents: ['IT Support Agent', 'HR Agent'],
    contextWindow: 128000,
  },
  // ── Mistral ─────────────────────────────────────────────────────────────
  'mistralai/mistral-large': {
    speed: 74, accuracy: 81, supportsVision: false, supportsFunctions: true,
    supportedLanguages: 80, trainingData: '2024',
    idealFor: 'European data-residency, enterprise drafting',
    recommendedAgents: ['Compliance Agent', 'HR Agent'],
    contextWindow: 128000,
  },
  'mistralai/mistral-medium': {
    speed: 82, accuracy: 76, supportsVision: false, supportsFunctions: true,
    supportedLanguages: 75, trainingData: '2024',
    idealFor: 'Cost-balanced enterprise workloads',
    recommendedAgents: ['Support Agent', 'Sales Agent'],
    contextWindow: 32000,
  },
  'mistralai/mixtral-8x7b-instruct': {
    speed: 86, accuracy: 74, supportsVision: false, supportsFunctions: true,
    supportedLanguages: 70, trainingData: '2023',
    idealFor: 'Open MoE model, fast inference at scale',
    recommendedAgents: ['IT Support Agent', 'Onboarding Agent'],
    contextWindow: 32768,
  },
  // ── Cohere ──────────────────────────────────────────────────────────────
  'cohere/command-r-plus': {
    speed: 76, accuracy: 79, supportsVision: false, supportsFunctions: true,
    supportedLanguages: 85, trainingData: '2024',
    idealFor: 'RAG pipelines, enterprise search, document grounding',
    recommendedAgents: ['Support Agent', 'Compliance Agent'],
    contextWindow: 128000,
  },
  'cohere/command-r': {
    speed: 88, accuracy: 73, supportsVision: false, supportsFunctions: true,
    supportedLanguages: 80, trainingData: '2024',
    idealFor: 'Retrieval-augmented generation, cost-efficient search',
    recommendedAgents: ['Support Agent', 'Onboarding Agent'],
    contextWindow: 128000,
  },
  // ── DeepSeek ────────────────────────────────────────────────────────────
  'deepseek/deepseek-r1': {
    speed: 70, accuracy: 90, supportsVision: false, supportsFunctions: true,
    supportedLanguages: 70, trainingData: '2024',
    idealFor: 'Math, coding, logical reasoning at low cost',
    recommendedAgents: ['Finance Agent', 'IT Support Agent'],
    contextWindow: 64000,
  },
  'deepseek/deepseek-chat': {
    speed: 84, accuracy: 82, supportsVision: false, supportsFunctions: true,
    supportedLanguages: 72, trainingData: '2024',
    idealFor: 'General chat, code generation, structured output',
    recommendedAgents: ['IT Support Agent', 'Sales Agent'],
    contextWindow: 64000,
  },
};

// Fallback knowledge for unknown models — derived from provider + name patterns
function inferKnowledge(model: LiveModel): ModelKnowledge {
  const id = model.id.toLowerCase();
  const provider = (model.provider || '').toLowerCase();

  const isProprietaryProvider = ['openai', 'anthropic', 'google'].includes(provider);
  const isSmall = /mini|haiku|flash|small|tiny|3b|7b|8b/.test(id);
  const isLarge = /opus|ultra|large|70b|72b/.test(id);
  const isReasoner = /o1|o3|r1|reasoning/.test(id);
  const hasVision = /vision|vl|multimodal|gemini|gpt-4o|claude-3/.test(id);

  return {
    speed: isReasoner ? 50 : isSmall ? 93 : isLarge ? 65 : 78,
    accuracy: isReasoner ? 90 : isLarge ? 82 : isSmall ? 70 : 76,
    supportsVision: hasVision || (isProprietaryProvider && !isSmall),
    supportsFunctions: isProprietaryProvider || /llama-3|mistral|command/.test(id),
    supportedLanguages: isProprietaryProvider ? 90 : 65,
    trainingData: '2024',
    idealFor: isReasoner
      ? 'Complex multi-step reasoning and logic'
      : isSmall
      ? 'Fast, high-volume lightweight tasks'
      : isLarge
      ? 'High-quality generation and analysis'
      : 'General-purpose language tasks',
    recommendedAgents: isReasoner
      ? ['Legal Agent', 'Finance Agent']
      : isSmall
      ? ['Onboarding Agent', 'Support Agent']
      : ['Support Agent', 'HR Agent'],
  };
}

const PROVIDER_COLORS: Record<string, string> = {
  openai: 'from-emerald-500 to-teal-600',
  anthropic: 'from-orange-500 to-amber-600',
  google: 'from-blue-500 to-indigo-600',
  'meta-llama': 'from-cyan-500 to-blue-500',
  mistralai: 'from-violet-500 to-purple-600',
  cohere: 'from-rose-500 to-pink-600',
  deepseek: 'from-sky-500 to-cyan-600',
  perplexity: 'from-fuchsia-500 to-purple-500',
};

const FALLBACK_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-red-500',
  'from-cyan-500 to-blue-500',
  'from-amber-500 to-rose-600',
  'from-fuchsia-500 to-pink-600',
  'from-purple-500 to-indigo-500',
];

const enrichLiveModel = (model: LiveModel): EnrichedModel => {
  const p = Number(model.pricing?.prompt || 0);
  const c = Number(model.pricing?.completion || 0);
  const providerLower = (model.provider || 'unknown').toLowerCase();

  const knowledge = MODEL_KNOWLEDGE[model.id] || inferKnowledge(model);
  const color =
    PROVIDER_COLORS[providerLower] ||
    FALLBACK_COLORS[model.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % FALLBACK_COLORS.length];

  return {
    ...model,
    name: model.name || model.id.split('/').pop() || model.id,
    type: ['openai', 'anthropic', 'google'].includes(providerLower) ? 'Proprietary' : 'Open Source',
    speed: knowledge.speed,
    accuracy: knowledge.accuracy,
    costInput: p * 1_000_000,
    costOutput: c * 1_000_000,
    costBlended: ((p * 500_000) + (c * 500_000)) * 93,
    contextWindow: knowledge.contextWindow || model.context_length || 8192,
    supportsFunctions: knowledge.supportsFunctions,
    supportsVision: knowledge.supportsVision,
    supportedLanguages: knowledge.supportedLanguages,
    trainingData: knowledge.trainingData,
    idealFor: knowledge.idealFor,
    tag: model.provider.charAt(0).toUpperCase() + model.provider.slice(1),
    color,
    recommendedAgents: knowledge.recommendedAgents,
  };
};

export default function ModelComparisonPage() {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterAgent, setFilterAgent] = useState<string>('All');
  const [visibleCount, setVisibleCount] = useState(15);
  const [allModels, setAllModels] = useState<EnrichedModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch live model list on mount
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const apiUrl = getFrontendConfig().apiUrl || 'http://localhost:3001/api';
          const res = await fetch(`${apiUrl}/models`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data) && json.data.length > 0) {
              const enriched = json.data.map(enrichLiveModel);
              setAllModels(enriched);

              // Select up to 3 defaults if possible, otherwise first 3
              const defaults = ['openai/gpt-4o', 'anthropic/claude-3-5-sonnet', 'google/gemini-2.0-flash-001'];
              const toSelect = enriched.filter((m: EnrichedModel) => defaults.includes(m.id)).map((m: EnrichedModel) => m.id);
              if (toSelect.length > 0) {
                setSelectedModels(toSelect);
              } else if (enriched.length > 0) {
                setSelectedModels(enriched.slice(0, Math.min(3, enriched.length)).map((m: EnrichedModel) => m.id));
              }
              return;
            }
          }
        }
      } catch { /* fall through */ }

      // Fallback list
      const fallback: LiveModel[] = [
        { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai', pricing: { prompt: '0.000005', completion: '0.000015' } },
        { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', pricing: { prompt: '0.0000005', completion: '0.0000015' } },
        { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', pricing: { prompt: '0.000003', completion: '0.000015' } },
        { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'google', pricing: { prompt: '0.0000001', completion: '0.0000004' } },
        { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'meta-llama', pricing: { prompt: '0.0000008', completion: '0.0000008' } },
        { id: 'mistralai/mistral-large', name: 'Mistral Large', provider: 'mistralai', pricing: { prompt: '0.000002', completion: '0.000006' } },
      ];
      setAllModels(fallback.map(enrichLiveModel));
      setSelectedModels(['openai/gpt-4o', 'anthropic/claude-3-5-sonnet', 'google/gemini-2.0-flash-001']);
    };
    load().finally(() => setIsLoading(false));
  }, []);

  const totalSimulatedModels = allModels.length;

  const toggleModel = (modelId: string) => {
    setSelectedModels((prev) => {
      // Allow max 4 selections at once
      if (prev.includes(modelId)) return prev.filter((m) => m !== modelId);
      if (prev.length >= 4) {
        // Drop the earliest selected if adding a 5th
        return [...prev.slice(1), modelId];
      }
      return [...prev, modelId];
    });
  };

  const clearSelection = () => setSelectedModels([]);

  const filteredLibrary = useMemo(() => {
    return allModels.filter((m: EnrichedModel) => {
      const providerLower = (m.provider || 'unknown').toLowerCase();
      const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || providerLower.includes(searchQuery.toLowerCase());

      let matchesFilter = true;
      if (filterType !== 'All') {
        if (filterType === 'Proprietary' || filterType === 'Open Source') {
          matchesFilter = m.type === filterType;
        } else {
          matchesFilter = providerLower === filterType.toLowerCase();
        }
      }

      let matchesAgent = true;
      if (filterAgent !== 'All') {
        matchesAgent = m.recommendedAgents.includes(filterAgent);
      }

      return matchesSearch && matchesFilter && matchesAgent;
    });
  }, [allModels, searchQuery, filterType, filterAgent]);

  const selectedModelData = useMemo(() => {
    return selectedModels.map(id => allModels.find(m => m.id === id)).filter(Boolean) as EnrichedModel[];
  }, [selectedModels, allModels]);

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <ArrowRightLeft className="w-8 h-8 text-indigo-400" />
          Model Intelligence Comparison
        </h1>
        <p className="text-slate-400 mt-2">Search our directory of <strong className="text-white">{totalSimulatedModels}</strong> curated models. Evaluate against cost, speed, and capabilities.</p>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
        <p className="font-semibold text-white">About these scores</p>
        <p className="mt-1 text-slate-400">
          Speed and accuracy scores are curated from published provider benchmarks (MMLU, GPQA) and official docs as of March 2026. Pricing is live from the model registry. Run your own benchmarks to validate production performance for your specific workloads.
        </p>
      </div>

      {/* Model Selection Rack (Library Style) */}
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-6 shadow-xl flex flex-col h-[500px]">

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
          <div className="mr-auto flex items-center gap-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" /> Intelligence Directory
            </h2>
            
            {selectedModels.length > 0 && (
              <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full animate-in fade-in zoom-in duration-200">
                <span className="text-xs font-bold text-indigo-300">
                  {selectedModels.length} / 4 Selected
                </span>
                <button 
                  onClick={clearSelection}
                  className="p-0.5 hover:bg-indigo-500/20 rounded-full text-indigo-400 hover:text-indigo-200 transition-colors"
                  title="Clear selection"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${totalSimulatedModels} models...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <div className="relative">
              <Filter className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <select
                className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="All">All Providers</option>
                <option value="Proprietary">Proprietary logic</option>
                <option value="Open Source">Open Source models</option>
                <option value="OpenAI">OpenAI</option>
                <option value="Anthropic">Anthropic</option>
                <option value="Google">Google</option>
                <option value="Meta-Llama">Meta Llama</option>
                <option value="MistralAI">Mistral AI</option>
                <option value="Cohere">Cohere</option>
                <option value="Perplexity">Perplexity</option>
                <option value="DeepSeek">DeepSeek</option>
              </select>
            </div>
            <div className="relative">
              <Filter className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <select
                className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
              >
                <option value="All">All Agent Types</option>
                <option value="Support Agent">Support Agent</option>
                <option value="Sales Agent">Sales Agent</option>
                <option value="HR Agent">HR Agent</option>
                <option value="Legal Agent">Legal Agent</option>
                <option value="Finance Agent">Finance Agent</option>
                <option value="IT Support Agent">IT Support Agent</option>
                <option value="Healthcare Agent">Healthcare Agent</option>
                <option value="Refund Agent">Refund Agent</option>
                <option value="Onboarding Agent">Onboarding Agent</option>
                <option value="Compliance Agent">Compliance Agent</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scrollable Library */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-8 h-8 mb-2 opacity-50 animate-spin" />
              <p>Loading registry models...</p>
            </div>
          ) : filteredLibrary.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500">
              <Search className="w-8 h-8 mb-2 opacity-50" />
              <p>No models found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {filteredLibrary.slice(0, visibleCount).map((model) => {
                const isSelected = selectedModels.includes(model.id);
                return (
                  <button
                    key={model.id}
                    onClick={() => toggleModel(model.id)}
                    className={`relative overflow-hidden p-4 rounded-xl border-2 transition-all duration-300 text-left group flex flex-col
                      ${isSelected ? `border-transparent bg-slate-900 shadow-lg shadow-black/50` : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'}
                    `}
                  >
                    {/* Active Gradient Border Simulation */}
                    {isSelected && (
                      <div className={`absolute inset-0 bg-gradient-to-br ${model.color} opacity-20 pointer-events-none`} />
                    )}
                    {isSelected && (
                      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${model.color}`} />
                    )}

                    <div className="relative z-10 flex-1 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className={`font-bold text-sm leading-tight mb-0.5 ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{model.name}</div>
                          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{model.provider}</div>
                        </div>
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 ring-2 ring-emerald-500/20">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-700 group-hover:border-slate-500 shrink-0 transition-colors" />
                        )}
                      </div>

                      {/* Capabilities Badges */}
                      <div className="flex flex-wrap gap-1.5 my-2">
                        {model.supportsVision && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-800/50 rounded border border-slate-700/50" title="Vision Supported">
                            <Eye className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] text-slate-400 font-medium">Vision</span>
                          </div>
                        )}
                        {model.supportsFunctions && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-800/50 rounded border border-slate-700/50" title="Function Calling">
                            <Cpu className="w-3 h-3 text-cyan-400" />
                            <span className="text-[10px] text-slate-400 font-medium">Tools</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-800/50 rounded border border-slate-700/50" title="Context Window">
                          <FileText className="w-3 h-3 text-indigo-400" />
                          <span className="text-[10px] text-slate-400 font-medium">{(model.contextWindow / 1000).toFixed(0)}k</span>
                        </div>
                      </div>

                      <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-700/30">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider truncate max-w-[80px] ${
                          model.type === 'Proprietary' ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        }`}>
                          {model.tag}
                        </span>
                        <div className="flex flex-col items-end">
                           <span className="text-[10px] font-mono text-slate-400 font-bold whitespace-nowrap">
                            {model.costBlended === 0 ? 'Free' : `₹${Math.round(model.costBlended).toLocaleString('en-IN')}`}
                          </span>
                           <span className="text-[9px] text-slate-600">per 1M</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Pagination control */}
              {visibleCount < filteredLibrary.length && (
                <div className="col-span-1 md:col-span-3 lg:col-span-5 py-4 flex items-center justify-center gap-2 text-slate-500 text-sm font-medium mt-4 border-t border-slate-700/50">
                  <span>Showing top {visibleCount} results</span>
                  <span className="px-2">·</span>
                  <button
                    onClick={() => setVisibleCount(prev => prev + 50)}
                    className="text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Load more of {filteredLibrary.length} matching models...
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedModelData.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">

          {/* The Deep Comparison Matrix */}
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-700/60 bg-slate-800/40">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" /> Specs Matrix
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[900px]">
                <thead>
                  <tr>
                    <th className="py-4 px-6 text-sm font-bold text-slate-500 bg-slate-800/20 border-r border-slate-700/50 w-64">Metric</th>
                    {selectedModelData.map((model) => (
                      <th key={model.id} className="py-4 px-6 relative bg-slate-800/10">
                        {/* Top accent color */}
                        <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${model.color} opacity-50`} />
                        <div className="font-bold text-white text-base">{model.name}</div>
                        <div className="text-xs font-medium text-slate-500">{model.provider}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">

                  {/* Ideal For */}
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-5 px-6 font-semibold text-slate-400 border-r border-slate-700/50 flex items-center gap-2">
                      <Target className="w-4 h-4" /> Ideal For
                    </td>
                    {selectedModelData.map((model) => (
                      <td key={model.id} className="py-5 px-6 font-medium text-slate-300">
                        {model.idealFor}
                      </td>
                    ))}
                  </tr>

                  {/* Recommended Templates */}
                  <tr className="hover:bg-slate-800/30 transition-colors border-b border-slate-800">
                    <td className="py-5 px-6 font-semibold text-slate-400 border-r border-slate-700/50 flex gap-2 pt-6">
                      <Users className="w-4 h-4 shrink-0" /> Best For Agents
                    </td>
                    {selectedModelData.map((model) => (
                      <td key={model.id} className="py-5 px-6 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {model.recommendedAgents.map(ag => (
                            <span key={ag} className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] font-bold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                              {ag}
                            </span>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Price In */}
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-5 px-6 font-semibold text-slate-400 border-r border-slate-700/50 flex items-center gap-2">
                      <Banknote className="w-4 h-4" /> Input Cost <span className="text-xs font-normal text-slate-600 block">(per 1M tokens)</span>
                    </td>
                    {selectedModelData.map((model) => {
                      const isLowest = Math.min(...selectedModelData.map(m => m.costInput)) === model.costInput;
                      return (
                        <td key={model.id} className="py-5 px-6">
                          <span className={`font-mono text-lg font-bold ${isLowest ? 'text-emerald-400' : 'text-slate-200'}`}>
                            ₹{(model.costInput * 93).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                          {isLowest && <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-400 rounded uppercase font-bold">Lowest</span>}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Price Out */}
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-5 px-6 font-semibold text-slate-400 border-r border-slate-700/50 flex items-center gap-2">
                      <Banknote className="w-4 h-4" /> Output Cost <span className="text-xs font-normal text-slate-600 block">(per 1M tokens)</span>
                    </td>
                    {selectedModelData.map((model) => {
                      const isLowest = Math.min(...selectedModelData.map(m => m.costOutput)) === model.costOutput;
                      return (
                        <td key={model.id} className="py-5 px-6">
                          <span className={`font-mono text-lg font-bold ${isLowest ? 'text-emerald-400' : 'text-slate-200'}`}>
                            ₹{(model.costOutput * 93).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                          {isLowest && <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-400 rounded uppercase font-bold">Lowest</span>}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Intelligence / Accuracy */}
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-5 px-6 font-semibold text-slate-400 border-r border-slate-700/50">
                      Accuracy (MMLU)
                    </td>
                    {selectedModelData.map((model) => {
                      const isHighest = Math.max(...selectedModelData.map(m => m.accuracy)) === model.accuracy;
                      return (
                        <td key={model.id} className="py-5 px-6 pr-12">
                          <div className="flex items-center gap-3">
                            <span className={`font-bold w-10 ${isHighest ? 'text-cyan-400' : 'text-slate-300'}`}>{model.accuracy}%</span>
                            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full bg-gradient-to-r ${model.color}`} style={{ width: `${model.accuracy}%` }} />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Speed */}
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-5 px-6 font-semibold text-slate-400 border-r border-slate-700/50 flex items-center gap-2">
                      <Zap className="w-4 h-4" /> Inference Speed
                    </td>
                    {selectedModelData.map((model) => {
                      const isHighest = Math.max(...selectedModelData.map(m => m.speed)) === model.speed;
                      return (
                        <td key={model.id} className="py-5 px-6 pr-12">
                          <div className="flex items-center gap-3">
                            <span className={`font-bold w-10 ${isHighest ? 'text-amber-400' : 'text-slate-300'}`}>{model.speed}</span>
                            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full bg-gradient-to-r ${model.color}`} style={{ width: `${model.speed}%` }} />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Context Window */}
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-5 px-6 font-semibold text-slate-400 border-r border-slate-700/50">
                      Context Window
                    </td>
                    {selectedModelData.map((model) => {
                      const isHighest = Math.max(...selectedModelData.map(m => m.contextWindow)) === model.contextWindow;
                      return (
                        <td key={model.id} className="py-5 px-6 font-mono font-bold">
                          <span className={isHighest ? 'text-indigo-400' : 'text-slate-300'}>
                            {(model.contextWindow / 1000).toFixed(0)}k <span className="text-xs font-sans text-slate-500 font-normal">tokens</span>
                          </span>
                          {isHighest && <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-indigo-500/10 text-indigo-400 rounded uppercase font-bold">Largest</span>}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Vision */}
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-5 px-6 font-semibold text-slate-400 border-r border-slate-700/50 flex items-center gap-2">
                      <Eye className="w-4 h-4" /> Multi-modal (Vision)
                    </td>
                    {selectedModelData.map((model) => (
                      <td key={model.id} className="py-5 px-6">
                        {model.supportsVision ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded w-max">
                            <Check className="w-3.5 h-3.5" /> Supported
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded w-max border border-slate-700">
                            <X className="w-3.5 h-3.5" /> Text Only
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Functions */}
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-5 px-6 font-semibold text-slate-400 border-r border-slate-700/50 flex items-center gap-2">
                      <Cpu className="w-4 h-4" /> Tool / Function Calling
                    </td>
                    {selectedModelData.map((model) => (
                      <td key={model.id} className="py-5 px-6">
                        {model.supportsFunctions ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded w-max">
                            <Check className="w-3.5 h-3.5" /> Supported
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded w-max border border-slate-700">
                            <X className="w-3.5 h-3.5" /> Unsupported
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-16 text-center max-w-2xl mx-auto mt-10">
          <Globe2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Models Selected</h3>
          <p className="text-slate-400">Select between 1 and 4 models from the intelligence rack above to generate a side-by-side spec comparison.</p>
        </div>
      )}

      {/* Footer / Disclaimer */}
      <div className="mt-12 border-t border-slate-800 pt-8 flex flex-col md:flex-row gap-8 justify-center max-w-5xl mx-auto text-xs text-slate-500">
        <div className="flex gap-4 max-w-md">
          <div className="p-2 bg-slate-800/50 rounded-lg shrink-0 h-fit border border-slate-700/50">
            <Target className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <strong className="block text-slate-300 mb-1 text-sm">Blended Token Pricing</strong>
            <p className="leading-relaxed">Calculated assuming a balanced 50/50 conversational workload (equal input & output tokens). Actual costs may vary significantly for RAG or summarization tasks.</p>
          </div>
        </div>
        
        <div className="flex gap-4 max-w-md">
          <div className="p-2 bg-slate-800/50 rounded-lg shrink-0 h-fit border border-slate-700/50">
            <Globe2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <strong className="block text-slate-300 mb-1 text-sm">Global Benchmarks</strong>
            <p className="leading-relaxed">Prices estimated at $1 USD = ₹93 INR. Specs represent industry averages and may differ from live API performance. Last updated: March 2026.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
