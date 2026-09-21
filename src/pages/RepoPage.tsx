import { useState, useEffect, useCallback, useRef } from 'react';
import {
  listArtifacts,
  loadAllDetails,
  Artifact,
  ArtifactDetails,
  TagFailure,
  RegistryError,
} from '../api/registry';
import { ArtifactTable } from '../components/ArtifactTable';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  FolderGit2,
  ShieldAlert,
} from 'lucide-react';

interface RepoPageProps {
  repoName: string;
  onBack: () => void;
}

export function RepoPage({ repoName, onBack }: RepoPageProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [detailsMap, setDetailsMap] = useState<Map<string, ArtifactDetails>>(new Map());
  const [failures, setFailures] = useState<TagFailure[]>([]);
  const [totalTagsCount, setTotalTagsCount] = useState(0);

  const [loadingListing, setLoadingListing] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  // Keep track of active fetch cancellation
  const cancelRef = useRef(false);

  const loadRepositoryData = useCallback(async () => {
    cancelRef.current = false;
    setLoadingListing(true);
    setLoadingDetails(false);
    setError(null);
    setStatusCode(null);
    setArtifacts([]);
    setDetailsMap(new Map());
    setFailures([]);
    setTotalTagsCount(0);

    try {
      // 1. Resolve tags to digest groups and failures
      const listing = await listArtifacts(repoName);
      if (cancelRef.current) return;

      const totalTags =
        listing.artifacts.reduce((acc, a) => acc + a.tags.length, 0) + listing.failures.length;

      setArtifacts(listing.artifacts);
      setFailures(listing.failures);
      setTotalTagsCount(totalTags);
      setLoadingListing(false);

      // 2. Progressively fetch details for each distinct digest
      if (listing.artifacts.length > 0) {
        setLoadingDetails(true);

        loadAllDetails(
          repoName,
          listing.artifacts,
          (details) => {
            if (!cancelRef.current) {
              setDetailsMap((prev) => {
                const next = new Map(prev);
                next.set(details.digest, details);
                return next;
              });
            }
          },
          (digest, err) => {
            console.error(`Failed to load details for digest ${digest}:`, err);
          },
        ).finally(() => {
          if (!cancelRef.current) {
            setLoadingDetails(false);
          }
        });
      }
    } catch (err) {
      if (cancelRef.current) return;
      setLoadingListing(false);
      if (err instanceof RegistryError) {
        setStatusCode(err.status);
        setError(
          err.status === 401
            ? 'Authentication required by registry to access this repository.'
            : err.status === 404
            ? 'Repository or manifests not found.'
            : `Failed to load repository (HTTP ${err.status})`,
        );
      } else {
        setError('Network error: unable to load tags and manifests for this repository.');
      }
    }
  }, [repoName]);

  useEffect(() => {
    loadRepositoryData();
    return () => {
      cancelRef.current = true;
    };
  }, [loadRepositoryData]);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800 transition-colors"
            title="Back to Repositories"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-indigo-400" />
              <span>{repoName}</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadRepositoryData}
            disabled={loadingListing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors disabled:opacity-50"
            title="Refresh repository"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingListing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/40 flex items-start gap-3">
          {statusCode === 401 ? (
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-rose-300">Repository Load Error</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{error}</p>
            <button
              onClick={loadRepositoryData}
              className="mt-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Listing Loading Skeleton */}
      {loadingListing && (
        <div className="space-y-4">
          <div className="h-6 w-48 bg-slate-900 rounded animate-pulse" />
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40 p-4 space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-800/50 rounded" />
            ))}
          </div>
        </div>
      )}

      {/* Table view */}
      {!loadingListing && !error && (
        <ArtifactTable
          repo={repoName}
          artifacts={artifacts}
          detailsMap={detailsMap}
          failures={failures}
          loadingDetails={loadingDetails}
          totalTagsCount={totalTagsCount}
        />
      )}
    </div>
  );
}
