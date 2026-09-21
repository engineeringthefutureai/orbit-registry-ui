import { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Clock,
  HardDrive,
  Copy,
  Check,
  Tag,
  Cpu,
  ExternalLink,
  FileText,
  Loader2,
  Terminal,
} from 'lucide-react';
import {
  Artifact,
  ArtifactDetails,
  PlatformDetails,
  PlatformExtendedDetails,
  fetchPlatformExtendedDetails,
} from '../api/registry';
import {
  formatBytes,
  formatRelativeTime,
  formatExactTime,
  truncateDigest,
  buildPullCommand,
} from '../utils/formatters';
import { copyToClipboard } from '../utils/clipboard';
import { useConfig } from '../context/ConfigContext';
import { useToast } from '../context/ToastContext';

interface DetailsDrawerProps {
  repo: string;
  artifact: Artifact;
  details?: ArtifactDetails;
  onClose: () => void;
}

export function DetailsDrawer({ repo, artifact, details, onClose }: DetailsDrawerProps) {
  const { config } = useConfig();
  const { showToast } = useToast();

  const [selectedPlatformIndex, setSelectedPlatformIndex] = useState(0);
  const [platformExtended, setPlatformExtended] = useState<PlatformExtendedDetails | null>(null);
  const [loadingExtended, setLoadingExtended] = useState(false);
  const [copiedDigest, setCopiedDigest] = useState(false);
  const [copiedPullCmd, setCopiedPullCmd] = useState(false);

  const platforms: PlatformDetails[] = details?.platforms ?? [];
  const currentPlatform = platforms[selectedPlatformIndex];

  // Fetch build history and layer details when drawer opens or platform changes
  useEffect(() => {
    const targetDigest = currentPlatform?.digest ?? artifact.digest;
    if (!targetDigest) return;

    let cancelled = false;
    setLoadingExtended(true);
    setPlatformExtended(null);

    fetchPlatformExtendedDetails(repo, targetDigest)
      .then((ext) => {
        if (!cancelled) {
          setPlatformExtended(ext);
        }
      })
      .catch((err) => {
        console.error('Failed to load platform history:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingExtended(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repo, currentPlatform?.digest, artifact.digest]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const pullCommand = buildPullCommand(config.registryPublicUrl, repo, artifact.digest);

  const handleCopy = async (text: string, type: 'digest' | 'pull') => {
    const success = await copyToClipboard(text);
    if (success) {
      if (type === 'digest') {
        setCopiedDigest(true);
        showToast(`Copied digest`);
        setTimeout(() => setCopiedDigest(false), 1500);
      } else {
        setCopiedPullCmd(true);
        showToast(`Copied pull command`);
        setTimeout(() => setCopiedPullCmd(false), 1500);
      }
    }
  };

  const annotations = {
    ...(details?.annotations ?? {}),
    ...(platformExtended?.annotations ?? {}),
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/90 flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                  {details?.isIndex ? 'Multi-arch Index' : 'Image Manifest'}
                </span>
                <span className="text-xs text-slate-400 font-mono truncate">{repo}</span>
              </div>
              <h2 className="text-lg font-mono font-semibold text-slate-100 break-all">
                {artifact.digest}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
              aria-label="Close details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Quick Pull Command Box */}
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  Pull by Digest
                </span>
                <button
                  onClick={() => handleCopy(pullCommand, 'pull')}
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {copiedPullCmd ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy command</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre p-2 bg-slate-900 rounded border border-slate-800/80">
                {pullCommand}
              </pre>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/80">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                  Total Size
                </div>
                <div className="text-base font-semibold font-mono text-slate-200">
                  {details ? formatBytes(details.sizeBytes) : '-'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">compressed as stored</div>
              </div>

              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/80">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  Built
                </div>
                <div
                  className="text-base font-semibold text-slate-200"
                  title={formatExactTime(details?.created)}
                >
                  {details ? formatRelativeTime(details.created) : '-'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate" title={formatExactTime(details?.created)}>
                  {formatExactTime(details?.created) || 'unknown'}
                </div>
              </div>

              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/80 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  Platforms
                </div>
                <div className="text-base font-semibold font-mono text-slate-200">
                  {platforms.length || 1}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {details?.isIndex ? 'Multi-arch index' : 'Single platform'}
                </div>
              </div>
            </div>

            {/* Attached Tags */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                Tags pointing to this digest ({artifact.tags.length})
              </div>
              {artifact.tags.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No tags point to this digest</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {artifact.tags.map((t) => (
                    <button
                      key={t}
                      onClick={() =>
                        handleCopy(
                          buildPullCommand(config.registryPublicUrl, repo, t),
                          'pull',
                        )
                      }
                      className="group flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-800/50 text-indigo-200 text-xs font-mono transition-colors"
                      title={`Click to copy: docker pull ${buildPullCommand(config.registryPublicUrl, repo, t)}`}
                    >
                      <span>{t}</span>
                      <Copy className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Manifest Annotations */}
            {Object.keys(annotations).length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  Manifest Annotations
                </div>
                <div className="bg-slate-950/60 rounded-lg border border-slate-800 divide-y divide-slate-800/60 overflow-hidden text-xs">
                  {Object.entries(annotations).map(([key, value]) => {
                    const isUrl = typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));
                    return (
                      <div key={key} className="p-2.5 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                        <span className="font-mono text-slate-400 font-medium shrink-0">{key}</span>
                        <div className="text-slate-200 break-all">
                          {isUrl ? (
                            <a
                              href={value}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                            >
                              <span>{value}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span>{value}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Platform Selection Tabs (if index) */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  Platform Details & Build History
                </div>
              </div>

              {platforms.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {platforms.map((p, idx) => {
                    const name = `${p.os}/${p.architecture}${p.variant ? `/${p.variant}` : ''}`;
                    const isSelected = idx === selectedPlatformIndex;
                    return (
                      <button
                        key={`${p.digest}-${idx}`}
                        onClick={() => setSelectedPlatformIndex(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Active Platform Metadata */}
              {currentPlatform && (
                <div className="p-4 bg-slate-950/40 rounded-lg border border-slate-800/80 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">Platform</span>
                      <span className="font-mono font-medium text-slate-200">
                        {currentPlatform.os}/{currentPlatform.architecture}
                        {currentPlatform.variant ? `/${currentPlatform.variant}` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Size</span>
                      <span className="font-mono font-medium text-slate-200">
                        {formatBytes(currentPlatform.sizeBytes)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Layers</span>
                      <span className="font-mono font-medium text-slate-200">
                        {currentPlatform.layerCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Built</span>
                      <span
                        className="font-medium text-slate-200"
                        title={formatExactTime(currentPlatform.created)}
                      >
                        {formatRelativeTime(currentPlatform.created)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-500">Platform Digest:</span>
                    <button
                      onClick={() => handleCopy(currentPlatform.digest, 'digest')}
                      className="flex items-center gap-1.5 text-slate-300 hover:text-indigo-300 transition-colors"
                      title={currentPlatform.digest}
                    >
                      <span>{truncateDigest(currentPlatform.digest, 12)}</span>
                      {copiedDigest ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Build History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Build History
                  </span>
                  {loadingExtended && (
                    <div className="flex items-center gap-1 text-xs text-indigo-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Fetching config history...</span>
                    </div>
                  )}
                </div>

                {loadingExtended ? (
                  <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2 bg-slate-950/20 rounded-lg border border-slate-800/40">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                    <span>Loading image config blob and history...</span>
                  </div>
                ) : !platformExtended || platformExtended.history.length === 0 ? (
                  <div className="p-4 text-xs text-slate-500 italic bg-slate-950/20 rounded-lg border border-slate-800/40">
                    No history array found in the image config blob.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {platformExtended.history.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-950/50 rounded-lg border border-slate-800/80 text-xs font-mono space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 font-bold">#{idx + 1}</span>
                          <div className="flex items-center gap-2">
                            {step.empty_layer && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                                empty_layer
                              </span>
                            )}
                            {step.created && (
                              <span
                                className="text-[11px] text-slate-500"
                                title={formatExactTime(step.created)}
                              >
                                {formatRelativeTime(step.created)}
                              </span>
                            )}
                          </div>
                        </div>

                        {step.created_by && (
                          <div className="text-slate-300 break-all whitespace-pre-wrap font-mono text-[11px] leading-relaxed bg-slate-900/80 p-2 rounded border border-slate-800/60">
                            {step.created_by}
                          </div>
                        )}

                        {step.comment && (
                          <div className="text-[11px] text-slate-400 italic">
                            Comment: {step.comment}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Layer breakdown */}
              {platformExtended && platformExtended.layers.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Layers ({platformExtended.layers.length})
                  </span>
                  <div className="bg-slate-950/50 rounded-lg border border-slate-800 overflow-hidden divide-y divide-slate-800/60 text-xs font-mono">
                    {platformExtended.layers.map((layer, idx) => (
                      <div
                        key={layer.digest}
                        className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-900/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-slate-500 text-[11px]">#{idx + 1}</span>
                          <span className="text-slate-300 truncate" title={layer.digest}>
                            {truncateDigest(layer.digest, 10)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-slate-400 text-right">
                            {formatBytes(layer.size)}
                          </span>
                          <button
                            onClick={() => handleCopy(layer.digest, 'digest')}
                            className="p-1 text-slate-500 hover:text-slate-300 rounded"
                            title={`Copy layer digest: ${layer.digest}`}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-mono">
              {details?.mediaType || 'OCI / Docker V2'}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
