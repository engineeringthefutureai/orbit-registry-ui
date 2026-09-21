import { useState, useMemo } from 'react';
import {
  Artifact,
  ArtifactDetails,
  TagFailure,
} from '../api/registry';
import {
  formatBytes,
  formatRelativeTime,
  formatExactTime,
  truncateDigest,
  buildPullCommand,
} from '../utils/formatters';
import { CopyBadge } from './CopyBadge';
import { DetailsDrawer } from './DetailsDrawer';
import { FailuresModal } from './FailuresModal';
import { useConfig } from '../context/ConfigContext';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  Loader2,
} from 'lucide-react';

interface ArtifactTableProps {
  repo: string;
  artifacts: Artifact[];
  detailsMap: Map<string, ArtifactDetails>;
  failures: TagFailure[];
  loadingDetails: boolean;
  totalTagsCount: number;
}

type SortField = 'built' | 'size' | 'digest' | 'tags';
type SortOrder = 'asc' | 'desc';

export function ArtifactTable({
  repo,
  artifacts,
  detailsMap,
  failures,
  loadingDetails,
  totalTagsCount,
}: ArtifactTableProps) {
  const { config } = useConfig();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('built');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [showFailuresModal, setShowFailuresModal] = useState(false);

  // Sorting is enabled once every row has details
  const allDetailsLoaded = artifacts.length > 0 && artifacts.every((a) => detailsMap.has(a.digest));

  // Filter rows based on search query
  const filteredArtifacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return artifacts;

    return artifacts.filter((a) => {
      if (a.digest.toLowerCase().includes(query)) return true;
      if (a.tags.some((t) => t.toLowerCase().includes(query))) return true;
      const details = detailsMap.get(a.digest);
      if (details) {
        if (
          details.platforms.some((p) =>
            `${p.os}/${p.architecture}${p.variant ? `/${p.variant}` : ''}`
              .toLowerCase()
              .includes(query),
          )
        ) {
          return true;
        }
      }
      return false;
    });
  }, [artifacts, searchQuery, detailsMap]);

  // Sort rows
  const sortedArtifacts = useMemo(() => {
    // If not all details are loaded yet, only allow digest or tags sorting, otherwise keep order
    if (!allDetailsLoaded && (sortField === 'built' || sortField === 'size')) {
      return filteredArtifacts;
    }

    return [...filteredArtifacts].sort((a, b) => {
      const detailsA = detailsMap.get(a.digest);
      const detailsB = detailsMap.get(b.digest);

      let comparison = 0;
      if (sortField === 'built') {
        const timeA = detailsA?.created ? Date.parse(detailsA.created) : 0;
        const timeB = detailsB?.created ? Date.parse(detailsB.created) : 0;
        comparison = timeA - timeB;
      } else if (sortField === 'size') {
        const sizeA = detailsA?.sizeBytes ?? 0;
        const sizeB = detailsB?.sizeBytes ?? 0;
        comparison = sizeA - sizeB;
      } else if (sortField === 'digest') {
        comparison = a.digest.localeCompare(b.digest);
      } else if (sortField === 'tags') {
        const tagA = a.tags[0] ?? '';
        const tagB = b.tags[0] ?? '';
        comparison = tagA.localeCompare(tagB);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredArtifacts, detailsMap, allDetailsLoaded, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // For built and size, default to descending (newest / largest first)
      setSortOrder(field === 'built' || field === 'size' ? 'desc' : 'asc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Header Stats Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Subheader counts */}
        <div className="text-sm text-slate-300 flex items-center flex-wrap gap-2">
          <span className="font-semibold text-slate-100">{artifacts.length}</span>
          <span>{artifacts.length === 1 ? 'artifact' : 'artifacts'}</span>
          <span className="text-slate-600">·</span>
          <span className="font-semibold text-slate-100">{totalTagsCount}</span>
          <span>{totalTagsCount === 1 ? 'tag' : 'tags'}</span>

          {failures.length > 0 && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-amber-400 font-medium">
                {failures.length} {failures.length === 1 ? 'tag' : 'tags'} failed to resolve
              </span>
              <button
                onClick={() => setShowFailuresModal(true)}
                className="text-xs font-mono text-amber-400 hover:text-amber-300 underline underline-offset-2 ml-0.5"
              >
                [show]
              </button>
            </>
          )}

          {loadingDetails && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 ml-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Resolving details...</span>
            </div>
          )}
        </div>

        {/* Search input */}
        <div className="relative min-w-[260px] sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tags or digests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Artifacts Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none">
              {/* Built */}
              <th className="py-3 px-4 w-36">
                <button
                  onClick={() => handleSort('built')}
                  disabled={!allDetailsLoaded}
                  className={`flex items-center gap-1.5 hover:text-slate-200 transition-colors ${
                    !allDetailsLoaded ? 'cursor-not-allowed opacity-60' : ''
                  }`}
                  title={allDetailsLoaded ? 'Sort by Build Time' : 'Sorting enabled once all details load'}
                >
                  <span>Built</span>
                  {sortField === 'built' && allDetailsLoaded ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </button>
              </th>

              {/* Size */}
              <th className="py-3 px-4 w-28">
                <button
                  onClick={() => handleSort('size')}
                  disabled={!allDetailsLoaded}
                  className={`flex items-center gap-1.5 hover:text-slate-200 transition-colors ${
                    !allDetailsLoaded ? 'cursor-not-allowed opacity-60' : ''
                  }`}
                  title={allDetailsLoaded ? 'Sort by Compressed Size' : 'Sorting enabled once all details load'}
                >
                  <span>Size</span>
                  {sortField === 'size' && allDetailsLoaded ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </button>
              </th>

              {/* Digest */}
              <th className="py-3 px-4 w-44">
                <button
                  onClick={() => handleSort('digest')}
                  className="flex items-center gap-1.5 hover:text-slate-200 transition-colors"
                >
                  <span>Digest</span>
                  {sortField === 'digest' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </button>
              </th>

              {/* Tags */}
              <th className="py-3 px-4 min-w-[240px]">
                <button
                  onClick={() => handleSort('tags')}
                  className="flex items-center gap-1.5 hover:text-slate-200 transition-colors"
                >
                  <span>Tags</span>
                  {sortField === 'tags' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </button>
              </th>

              {/* Platforms */}
              <th className="py-3 px-4 w-40">
                <span>Platforms</span>
              </th>

              {/* Actions */}
              <th className="py-3 px-4 w-24 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-xs">
            {sortedArtifacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  {searchQuery ? 'No artifacts matching search query' : 'No artifacts found in this repository'}
                </td>
              </tr>
            ) : (
              sortedArtifacts.map((artifact) => {
                const details = detailsMap.get(artifact.digest);
                const pullByDigest = buildPullCommand(config.registryPublicUrl, repo, artifact.digest);

                return (
                  <tr
                    key={artifact.digest}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    {/* Built Column */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-300">
                      {details ? (
                        <span
                          title={formatExactTime(details.created)}
                          className="cursor-help underline decoration-dotted decoration-slate-600 underline-offset-4"
                        >
                          {formatRelativeTime(details.created)}
                        </span>
                      ) : (
                        <div className="h-4 w-16 bg-slate-800/60 rounded animate-pulse" />
                      )}
                    </td>

                    {/* Size Column */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-300">
                      {details ? (
                        <span title={`${details.sizeBytes.toLocaleString()} bytes compressed`}>
                          {formatBytes(details.sizeBytes)}
                        </span>
                      ) : (
                        <div className="h-4 w-12 bg-slate-800/60 rounded animate-pulse" />
                      )}
                    </td>

                    {/* Digest Column */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <CopyBadge
                        text={truncateDigest(artifact.digest, 8)}
                        copyValue={pullByDigest}
                        variant="digest"
                        title={`Click to copy: ${pullByDigest}`}
                      />
                    </td>

                    {/* Tags Column */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {artifact.tags.length === 0 ? (
                          <span className="text-slate-500 italic text-[11px]">(untagged)</span>
                        ) : (
                          artifact.tags.map((tag) => {
                            const pullByTag = buildPullCommand(config.registryPublicUrl, repo, tag);
                            return (
                              <CopyBadge
                                key={tag}
                                text={tag}
                                copyValue={pullByTag}
                                variant="tag"
                                title={`Click to copy: ${pullByTag}`}
                              />
                            );
                          })
                        )}
                      </div>
                    </td>

                    {/* Platforms Column */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {details ? (
                        <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                          {details.platforms.map((p, pIdx) => {
                            const label = `${p.architecture}${p.variant ? `/${p.variant}` : ''}`;
                            return (
                              <span
                                key={`${p.digest}-${pIdx}`}
                                className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60"
                                title={`${p.os}/${label} (${formatBytes(p.sizeBytes)})`}
                              >
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="h-4 w-14 bg-slate-800/60 rounded animate-pulse" />
                      )}
                    </td>

                    {/* Details Action */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => setSelectedArtifact(artifact)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 hover:bg-indigo-950/80 hover:text-indigo-300 text-slate-300 border border-slate-700/60 hover:border-indigo-700/60 transition-colors"
                      >
                        <Info className="w-3 h-3" />
                        <span>Details</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Details Drawer */}
      {selectedArtifact && (
        <DetailsDrawer
          repo={repo}
          artifact={selectedArtifact}
          details={detailsMap.get(selectedArtifact.digest)}
          onClose={() => setSelectedArtifact(null)}
        />
      )}

      {/* Failures Modal */}
      {showFailuresModal && (
        <FailuresModal
          failures={failures}
          repository={repo}
          onClose={() => setShowFailuresModal(false)}
        />
      )}
    </div>
  );
}
