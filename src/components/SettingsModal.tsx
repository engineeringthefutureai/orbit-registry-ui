import { useState, useEffect } from 'react';
import { X, Database, Trash2, CheckCircle2, ShieldCheck, HardDrive } from 'lucide-react';
import { getCacheStats, clearDetailCache } from '../api/registry';
import { formatBytes } from '../utils/formatters';
import { useConfig } from '../context/ConfigContext';
import { useToast } from '../context/ToastContext';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { config } = useConfig();
  const { showToast } = useToast();
  const [stats, setStats] = useState({ count: 0, estimatedSizeBytes: 0 });
  const [cleared, setCleared] = useState(false);

  const refreshStats = () => {
    setStats(getCacheStats());
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const handleClear = () => {
    const count = clearDetailCache();
    refreshStats();
    setCleared(true);
    showToast(`Cleared ${count} cached artifacts from browser storage`);
    setTimeout(() => setCleared(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 id="settings-modal-title" className="text-base font-semibold text-slate-100">
                Orbit Settings & Cache
              </h3>
              <p className="text-xs text-slate-400">Browser cache & runtime parameters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Detail Cache Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-medium text-slate-200">Immutable Detail Cache</h4>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                localStorage
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Manifest digests are content-addressed hashes that never change once built.
              Orbit permanently caches manifest sizes, platforms, and build times in the browser,
              saving roundtrips on every subsequent visit.
            </p>

            <div className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-lg border border-slate-800">
              <div>
                <div className="text-lg font-mono font-semibold text-slate-100">
                  {stats.count} <span className="text-xs text-slate-400 font-sans">digests</span>
                </div>
                <div className="text-xs text-slate-500">
                  ~{formatBytes(stats.estimatedSizeBytes)} used
                </div>
              </div>

              <button
                onClick={handleClear}
                disabled={stats.count === 0}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60"
              >
                {cleared ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cleared</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Cache</span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Runtime Configuration */}
          <section className="space-y-3 pt-4 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-medium text-slate-200">Runtime Contract</h4>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded border border-slate-800/60">
                <span className="text-slate-400 font-sans">Public Registry Host</span>
                <span className="text-indigo-300">{config.registryPublicUrl || '(same origin)'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded border border-slate-800/60">
                <span className="text-slate-400 font-sans">Proxy Mode</span>
                <span className="text-emerald-400">Mode A (Pass-through Basic Auth)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded border border-slate-800/60">
                <span className="text-slate-400 font-sans">API Endpoint</span>
                <span className="text-slate-300">/v2/ (Read-Only: GET/HEAD)</span>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
