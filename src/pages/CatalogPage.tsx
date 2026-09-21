import { useState, useEffect, useMemo } from 'react';
import { listRepositories, RegistryError } from '../api/registry';
import { buildPullCommand } from '../utils/formatters';
import { useConfig } from '../context/ConfigContext';
import { CopyBadge } from '../components/CopyBadge';
import {
  Search,
  FolderGit2,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface CatalogPageProps {
  onSelectRepo: (repo: string) => void;
}

export function CatalogPage({ onSelectRepo }: CatalogPageProps) {
  const { config } = useConfig();
  const [repositories, setRepositories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCatalog = async () => {
    setLoading(true);
    setError(null);
    setStatusCode(null);
    try {
      const repos = await listRepositories();
      setRepositories(repos);
    } catch (err) {
      if (err instanceof RegistryError) {
        setStatusCode(err.status);
        setError(
          err.status === 401
            ? 'Authentication required by registry. Please provide valid credentials.'
            : `Failed to load catalog (HTTP ${err.status})`,
        );
      } else {
        setError('Network error: unable to reach registry endpoint /v2/_catalog');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const filteredRepos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return repositories;
    return repositories.filter((r) => r.toLowerCase().includes(q));
  }, [repositories, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FolderGit2 className="w-5 h-5 text-indigo-400" />
            Repositories
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse repositories in the Distribution V2 container registry
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCatalog}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors disabled:opacity-50"
            title="Refresh repository list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Search & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs text-slate-400">
          {!loading && (
            <span>
              Showing <strong className="text-slate-200">{filteredRepos.length}</strong> of{' '}
              <strong className="text-slate-200">{repositories.length}</strong> repositories
            </span>
          )}
        </div>

        <div className="relative min-w-[260px] sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/40 flex items-start gap-3">
          {statusCode === 401 ? (
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-rose-300">Catalog Request Failed</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{error}</p>
            <button
              onClick={fetchCatalog}
              className="mt-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 animate-pulse space-y-3"
            >
              <div className="h-4 bg-slate-800 rounded w-3/4" />
              <div className="h-3 bg-slate-800/60 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredRepos.length === 0 && (
        <div className="p-12 text-center rounded-xl border border-slate-800/60 bg-slate-900/30 space-y-3">
          <FolderGit2 className="w-8 h-8 text-slate-600 mx-auto" />
          <div className="text-sm font-medium text-slate-300">
            {searchQuery ? 'No repositories matching search query' : 'No repositories found in registry'}
          </div>
          <p className="text-xs text-slate-500">
            Push an image to this registry to see it displayed here.
          </p>
        </div>
      )}

      {/* Repository Grid / List */}
      {!loading && !error && filteredRepos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredRepos.map((repo) => {
            const pullExample = buildPullCommand(config.registryPublicUrl, repo, 'latest');
            return (
              <div
                key={repo}
                onClick={() => onSelectRepo(repo)}
                className="group relative p-4 rounded-xl border border-slate-800 hover:border-indigo-600/50 bg-slate-900/50 hover:bg-slate-900/80 transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-mono text-sm font-semibold text-slate-200 group-hover:text-indigo-300 truncate transition-colors">
                      {repo}
                    </h3>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-mono truncate max-w-[190px]">
                    {repo}
                  </span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <CopyBadge
                      text="copy pull"
                      copyValue={pullExample}
                      variant="mono"
                      title={`Copy: ${pullExample}`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
