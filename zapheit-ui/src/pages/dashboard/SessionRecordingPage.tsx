import { useState, useEffect } from 'react';
import { Shield, Save, Info, Lock } from 'lucide-react';
import { api } from '../../lib/api';

const RETENTION_OPTIONS = [
  { value: 30, label: '30 days', description: 'Free tier maximum', tier: 'free' },
  { value: 90, label: '90 days', description: 'Pro default', tier: 'pro' },
  { value: 365, label: '1 year', description: 'Business & Enterprise', tier: 'business' },
] as const;

export default function SessionRecordingPage() {
  const [enabled, setEnabled] = useState(true);
  const [retentionDays, setRetentionDays] = useState<30 | 90 | 365>(90);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.sessionRecording.get().then((res) => {
      if (res.data) {
        setEnabled(res.data.enabled);
        const days = res.data.retention_days;
        if (days === 30 || days === 90 || days === 365) setRetentionDays(days);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await api.sessionRecording.update({ enabled, retention_days: retentionDays });
    setSaving(false);
    if (res.error) {
      setError(res.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-48" />
          <div className="h-32 bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-400" />
          Session Recording
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Control whether your AI assistants store full conversation content for forensics and compliance.
        </p>
      </div>

      {/* Recording toggle */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-white">Record conversations</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              When enabled, full message content is stored. When disabled, only metadata (agent ID, timestamp, token count) is kept.
            </p>
          </div>
          <button
            onClick={() => setEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              enabled ? 'bg-purple-600' : 'bg-slate-600'
            }`}
            role="switch"
            aria-checked={enabled}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {!enabled && (
          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Disabling recording means you cannot replay conversations or generate compliance reports for past sessions. Incidents will still be detected in real-time.
            </span>
          </div>
        )}
      </div>

      {/* Retention period */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-5 space-y-3">
        <div>
          <h2 className="text-sm font-medium text-white">Retention period</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Conversations older than this window are automatically deleted by the nightly cleanup job.
          </p>
        </div>

        <div className="space-y-2">
          {RETENTION_OPTIONS.map((opt) => {
            const isSelected = retentionDays === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex items-center justify-between gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-purple-500/60 bg-purple-500/10'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="retention"
                    value={opt.value}
                    checked={isSelected}
                    onChange={() => setRetentionDays(opt.value)}
                    className="accent-purple-500"
                    disabled={!enabled}
                  />
                  <div>
                    <span className={`text-sm font-medium ${!enabled ? 'text-slate-500' : 'text-white'}`}>
                      {opt.label}
                    </span>
                    <p className="text-xs text-slate-500">{opt.description}</p>
                  </div>
                </div>
                {opt.tier !== 'free' && opt.tier !== 'pro' && (
                  <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-700 rounded px-2 py-0.5">
                    <Lock className="w-3 h-3" /> Business+
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* What gets stored */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
        <p className="text-xs font-medium text-slate-400 mb-2">What is stored in a session recording</p>
        <ul className="space-y-1 text-xs text-slate-500">
          <li>• Full message content (user + assistant turns)</li>
          <li>• Tool calls and their results</li>
          <li>• Model used, token counts, latency</li>
          <li>• Any PII detection events triggered during the session</li>
          <li>• Agent ID, organization ID, timestamp</li>
        </ul>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && (
          <span className="text-sm text-green-400">Settings saved.</span>
        )}
      </div>
    </div>
  );
}
