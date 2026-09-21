import { useState } from 'react';
import { Settings, Layers, Copy, Check } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import { useToast } from '../context/ToastContext';
import { copyToClipboard } from '../utils/clipboard';
import { SettingsModal } from './SettingsModal';

interface HeaderProps {
  currentRepo?: string;
  onNavigateHome: () => void;
}

export function Header({ currentRepo, onNavigateHome }: HeaderProps) {
  const { config } = useConfig();
  const { showToast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [copiedHost, setCopiedHost] = useState(false);

  const handleCopyHost = async () => {
    if (!config.registryPublicUrl) return;
    const success = await copyToClipboard(config.registryPublicUrl);
    if (success) {
      setCopiedHost(true);
      showToast(`Copied registry host: ${config.registryPublicUrl}`);
      setTimeout(() => setCopiedHost(false), 1500);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left: Brand & Breadcrumbs */}
          <div className="flex items-center gap-4">
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-2.5 group focus:outline-none"
              title="Return to Catalog"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600/30 transition-colors">
                <Layers className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-base font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
                  Orbit
                </span>
                <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase -mt-0.5">
                  Registry UI
                </span>
              </div>
            </button>

            {currentRepo && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-600">/</span>
                <button
                  onClick={onNavigateHome}
                  className="text-slate-400 hover:text-slate-200 transition-colors text-xs"
                >
                  Repositories
                </button>
                <span className="text-slate-600">/</span>
                <span className="text-indigo-300 font-mono text-xs font-semibold px-2 py-0.5 rounded bg-indigo-950/40 border border-indigo-800/40">
                  {currentRepo}
                </span>
              </div>
            )}
          </div>

          {/* Right: Registry Host & Settings */}
          <div className="flex items-center gap-3">
            {config.registryPublicUrl && (
              <button
                onClick={handleCopyHost}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
                title="Registry Host (used in pull commands) - Click to copy"
              >
                <span className="text-slate-500">host:</span>
                <span>{config.registryPublicUrl}</span>
                {copiedHost ? (
                  <Check className="w-3 h-3 text-emerald-400 ml-1 shrink-0" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-500 hover:text-slate-300 ml-1 shrink-0" />
                )}
              </button>
            )}

            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
              title="Settings & Cache"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
