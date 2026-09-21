import { X, AlertTriangle, HelpCircle } from 'lucide-react';
import { TagFailure } from '../api/registry';

interface FailuresModalProps {
  failures: TagFailure[];
  repository: string;
  onClose: () => void;
}

export function FailuresModal({ failures, repository, onClose }: FailuresModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-title" className="text-base font-semibold text-slate-100">
                Tag Resolution Failures
              </h3>
              <p className="text-xs text-slate-400 font-mono">{repository}</p>
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

        {/* Informational note */}
        <div className="p-4 bg-amber-500/5 border-b border-amber-500/10 flex items-start gap-2 text-xs text-amber-300/90">
          <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <p>
            These tags exist in the tag list but failed to resolve via HEAD manifests.
            Orbit displays them as failures and strictly avoids merging them into fake artifact rows.
          </p>
        </div>

        {/* List of failures */}
        <div className="p-6 overflow-y-auto space-y-2">
          {failures.map((f) => (
            <div
              key={f.tag}
              className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 text-sm font-mono"
            >
              <span className="text-indigo-300 font-medium">{f.tag}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded border ${
                  f.status === 404
                    ? 'bg-rose-950/50 text-rose-300 border-rose-800/50'
                    : f.status === 0
                    ? 'bg-amber-950/50 text-amber-300 border-amber-800/50'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {f.status === 0 ? 'network / missing digest' : `HTTP ${f.status}`}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
