import { useState } from 'react';
import { AlertCircle, CheckCircle2, Key, Loader2, X, Zap } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import type { UnifiedApp } from '../types';
import { AppLogo } from './AppLogo';

interface ConnectModalProps {
  app: UnifiedApp;
  onConnect: (app: UnifiedApp, creds: Record<string, string>) => Promise<void>;
  onDisconnect: (app: UnifiedApp) => Promise<void>;
  onClose: () => void;
}

export function ConnectModal({ app, onConnect, onDisconnect, onClose }: ConnectModalProps) {
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const handleConnect = async () => {
    setBusy(true);
    try { await onConnect(app, creds); }
    finally { setBusy(false); }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try { await onDisconnect(app); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0e1117] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/8">
          <div className="flex items-center gap-3">
            <AppLogo appId={app.appId} logoLetter={app.logoLetter} colorHex={app.colorHex} size="md" />
            <div>
              <p className="font-bold text-white text-sm">{app.name}</p>
              {app.developer && <p className="text-xs text-slate-500">{app.developer}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Description */}
          {app.description && (
            <p className="text-sm text-slate-400 leading-relaxed">{app.description}</p>
          )}

          {/* Status */}
          {app.connected && (
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
              app.status === 'error'
                ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
            )}>
              {app.status === 'error'
                ? <><AlertCircle className="w-3.5 h-3.5" />Connection error — reconfigure below</>
                : <><CheckCircle2 className="w-3.5 h-3.5" />Connected and active</>
              }
            </div>
          )}

          {/* What you can do */}
          {(app.actionsUnlocked?.length || app.permissions?.length) ? (
            <div className="space-y-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">What you can do</p>
              <ul className="space-y-1.5">
                {app.actionsUnlocked?.slice(0, 4).map((a) => (
                  <li key={a} className="flex items-start gap-2 text-xs text-slate-300">
                    <Zap className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />{a}
                  </li>
                ))}
                {app.permissions?.slice(0, 3).map((p) => (
                  <li key={p} className="flex items-start gap-2 text-xs text-slate-400">
                    <Key className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />{p}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Credentials form (api_key, not yet connected) */}
          {!app.comingSoon && !app.connected && app.authType === 'api_key' && app.requiredFields && (
            <div className="space-y-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                <Key className="w-3 h-3" /> Credentials
              </p>
              {app.requiredFields.map((f) => (
                <div key={f.name}>
                  <label className="text-xs text-slate-400 block mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={creds[f.name] || ''}
                    onChange={(e: { target: { value: string } }) => setCreds((p: Record<string, string>) => ({ ...p, [f.name]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-600 outline-none focus:border-cyan-500/40 transition-colors"
                  />
                </div>
              ))}
            </div>
          )}

          {/* OAuth hint */}
          {!app.comingSoon && !app.connected && app.authType === 'oauth2' && (
            <div className="px-3 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
              You'll be redirected to {app.name} to authorize access.
            </div>
          )}

          {/* Coming soon */}
          {app.comingSoon && (
            <div className="px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 text-center">
              Coming soon — we'll notify you when it's ready.
            </div>
          )}

          {/* Actions */}
          {!app.comingSoon && (
            app.connected ? (
              <div className="flex gap-2 pt-1">
                {app.authType === 'api_key' && (
                  <button
                    onClick={() => void handleConnect()}
                    disabled={busy}
                    className="flex-1 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                  >
                    {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                    Reconfigure
                  </button>
                )}
                <button
                  onClick={() => void handleDisconnect()}
                  disabled={busy}
                  className="flex-1 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                >
                  {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => void handleConnect()}
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {app.authType === 'oauth2' ? `Connect with ${app.name}` : 'Connect'}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
