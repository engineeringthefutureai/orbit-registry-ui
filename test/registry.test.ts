import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  nextLink,
  mapConcurrent,
  listRepositories,
  listArtifacts,
  getDetails,
  loadAllDetails,
  fetchPlatformExtendedDetails,
  clearDetailCache,
  getCacheStats,
  MT,
  CACHE_PREFIX,
} from '../src/api/registry';

describe('registry api client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('nextLink helper', () => {
    it('extracts relative path and query from Link header', () => {
      const header = '</v2/_catalog?last=repo2&n=1000>; rel="next"';
      expect(nextLink(header)).toBe('/v2/_catalog?last=repo2&n=1000');
    });

    it('strips internal host from absolute Link header to stay on same origin', () => {
      const header = '<http://internal-registry:5000/v2/tags/list?last=v1.0&n=1000>; rel="next"';
      expect(nextLink(header)).toBe('/v2/tags/list?last=v1.0&n=1000');
    });

    it('returns null if header is missing or does not have rel=next', () => {
      expect(nextLink(null)).toBeNull();
      expect(nextLink('')).toBeNull();
      expect(nextLink('<http://example.com/foo>; rel="prev"')).toBeNull();
    });
  });

  describe('mapConcurrent helper', () => {
    it('executes tasks with concurrency limit', async () => {
      let active = 0;
      let maxActive = 0;

      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const results = await mapConcurrent(items, 3, async (num) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 10));
        active--;
        return num * 2;
      });

      expect(maxActive).toBeLessThanOrEqual(3);
      expect(results).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    });
  });

  describe('listRepositories (with Link pagination)', () => {
    it('follows Link pagination across multiple pages', async () => {
      const mockFetch = vi.fn();

      // Page 1
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ repositories: ['repo-a', 'repo-b'] }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            Link: '</v2/_catalog?last=repo-b&n=1000>; rel="next"',
          },
        }),
      );

      // Page 2 (last page)
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ repositories: ['repo-c'] }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch);

      const repos = await listRepositories();
      expect(repos).toEqual(['repo-a', 'repo-b', 'repo-c']);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(1, '/v2/_catalog?n=1000', {
        headers: { Accept: 'application/json' },
      });
      expect(mockFetch).toHaveBeenNthCalledWith(2, '/v2/_catalog?last=repo-b&n=1000', {
        headers: { Accept: 'application/json' },
      });
    });
  });

  describe('listArtifacts (tag grouping, 404 tag, and network failure)', () => {
    it('groups tags by Docker-Content-Digest and handles failures', async () => {
      const repo = 'agy/antigravity-daemon';
      const mockFetch = vi.fn();

      // 1. Tag listing response: 4 tags
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: repo,
            tags: ['latest', '1.2.7', 'broken-tag', 'network-error-tag'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      // 2. HEAD for 'latest' -> digest sha256:digest-1
      mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/tags/list')) {
          return new Response(
            JSON.stringify({
              name: repo,
              tags: ['latest', '1.2.7', 'broken-tag', 'network-error-tag'],
            }),
            { status: 200 },
          );
        }

        if (init?.method === 'HEAD') {
          if (url.endsWith('/latest')) {
            return new Response(null, {
              status: 200,
              headers: {
                'Docker-Content-Digest': 'sha256:digest-1',
                'Content-Type': MT.ociIndex,
              },
            });
          }
          if (url.endsWith('/1.2.7')) {
            // Points to the SAME digest as 'latest'!
            return new Response(null, {
              status: 200,
              headers: {
                'Docker-Content-Digest': 'sha256:digest-1',
                'Content-Type': MT.ociIndex,
              },
            });
          }
          if (url.endsWith('/broken-tag')) {
            // 404 tag
            return new Response(null, { status: 404 });
          }
          if (url.endsWith('/network-error-tag')) {
            // Network failure
            throw new Error('Connection refused');
          }
        }

        return new Response(null, { status: 500 });
      });

      vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch);

      const listing = await listArtifacts(repo);

      expect(listing.repository).toBe(repo);

      // Only one artifact group created, containing both 'latest' and '1.2.7'
      expect(listing.artifacts).toHaveLength(1);
      expect(listing.artifacts[0].digest).toBe('sha256:digest-1');
      expect(listing.artifacts[0].tags).toEqual(['1.2.7', 'latest']); // sorted

      // Failures should contain both the 404 tag and the network failure tag
      expect(listing.failures).toHaveLength(2);
      const brokenFailure = listing.failures.find((f) => f.tag === 'broken-tag');
      expect(brokenFailure).toBeDefined();
      expect(brokenFailure?.status).toBe(404);

      const netFailure = listing.failures.find((f) => f.tag === 'network-error-tag');
      expect(netFailure).toBeDefined();
      expect(netFailure?.status).toBe(0); // 0 = network error or missing digest
    });
  });

  describe('getDetails (OCI Index with attestation entry & permanent cache)', () => {
    it('filters attestation entries, computes sizes/platforms, and serves second load from cache with zero requests', async () => {
      const repo = 'agy/test-app';
      const indexDigest = 'sha256:index-digest-123';
      const amd64ManifestDigest = 'sha256:amd64-manifest';
      const arm64ManifestDigest = 'sha256:arm64-manifest';
      const attestationDigest = 'sha256:attestation-manifest';

      const amd64ConfigDigest = 'sha256:amd64-config';
      const arm64ConfigDigest = 'sha256:arm64-config';

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        // 1. GET index manifest
        if (url.endsWith(`/manifests/${indexDigest}`)) {
          return new Response(
            JSON.stringify({
              schemaVersion: 2,
              mediaType: MT.ociIndex,
              manifests: [
                {
                  mediaType: MT.ociManifest,
                  digest: amd64ManifestDigest,
                  size: 1000,
                  platform: { os: 'linux', architecture: 'amd64' },
                },
                {
                  mediaType: MT.ociManifest,
                  digest: arm64ManifestDigest,
                  size: 1000,
                  platform: { os: 'linux', architecture: 'arm64', variant: 'v8' },
                },
                // Attestation entry 1: platform.os == "unknown"
                {
                  mediaType: MT.ociManifest,
                  digest: attestationDigest,
                  size: 500,
                  platform: { os: 'unknown', architecture: 'unknown' },
                },
                // Attestation entry 2: annotation vnd.docker.reference.type
                {
                  mediaType: MT.ociManifest,
                  digest: 'sha256:attestation-docker',
                  size: 500,
                  annotations: { 'vnd.docker.reference.type': 'attestation-manifest' },
                },
              ],
              annotations: {
                'org.opencontainers.image.source': 'https://github.com/example/repo',
              },
            }),
            { status: 200, headers: { 'Content-Type': MT.ociIndex } },
          );
        }

        // 2. GET amd64 manifest
        if (url.endsWith(`/manifests/${amd64ManifestDigest}`)) {
          return new Response(
            JSON.stringify({
              schemaVersion: 2,
              mediaType: MT.ociManifest,
              config: { mediaType: 'application/vnd.oci.image.config.v1+json', digest: amd64ConfigDigest, size: 200 },
              layers: [
                { mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', digest: 'sha256:layer-1', size: 10000 },
                { mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', digest: 'sha256:layer-2', size: 20000 },
              ],
            }),
            { status: 200, headers: { 'Content-Type': MT.ociManifest } },
          );
        }

        // 3. GET arm64 manifest
        if (url.endsWith(`/manifests/${arm64ManifestDigest}`)) {
          return new Response(
            JSON.stringify({
              schemaVersion: 2,
              mediaType: MT.ociManifest,
              config: { mediaType: 'application/vnd.oci.image.config.v1+json', digest: arm64ConfigDigest, size: 250 },
              layers: [
                { mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', digest: 'sha256:layer-3', size: 15000 },
              ],
            }),
            { status: 200, headers: { 'Content-Type': MT.ociManifest } },
          );
        }

        // 4. GET amd64 config blob
        if (url.endsWith(`/blobs/${amd64ConfigDigest}`)) {
          return new Response(
            JSON.stringify({
              created: '2026-09-19T10:00:00Z',
              os: 'linux',
              architecture: 'amd64',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        // 5. GET arm64 config blob
        if (url.endsWith(`/blobs/${arm64ConfigDigest}`)) {
          return new Response(
            JSON.stringify({
              created: '2026-09-20T12:00:00Z',
              os: 'linux',
              architecture: 'arm64',
              variant: 'v8',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        throw new Error(`Unexpected URL called: ${url}`);
      });

      vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch);

      // First call: cache miss, must fetch over network
      const details = await getDetails(repo, indexDigest);

      expect(details.digest).toBe(indexDigest);
      expect(details.isIndex).toBe(true);
      expect(details.platforms).toHaveLength(2); // attestations excluded!

      // Platform 1: amd64
      expect(details.platforms[0].architecture).toBe('amd64');
      expect(details.platforms[0].sizeBytes).toBe(200 + 10000 + 20000); // 30200
      expect(details.platforms[0].layerCount).toBe(2);

      // Platform 2: arm64
      expect(details.platforms[1].architecture).toBe('arm64');
      expect(details.platforms[1].variant).toBe('v8');
      expect(details.platforms[1].sizeBytes).toBe(250 + 15000); // 15250
      expect(details.platforms[1].layerCount).toBe(1);

      // Total size is sum over non-attestation platforms
      expect(details.sizeBytes).toBe(30200 + 15250);

      // Created time is latest across platforms (2026-09-20T12:00:00Z)
      expect(details.created).toBe('2026-09-20T12:00:00Z');
      expect(details.annotations['org.opencontainers.image.source']).toBe('https://github.com/example/repo');

      const initialCallCount = mockFetch.mock.calls.length;
      expect(initialCallCount).toBeGreaterThan(0);

      // Check localStorage contains the cached digest
      const cached = localStorage.getItem(CACHE_PREFIX + indexDigest);
      expect(cached).not.toBeNull();

      // SECOND CALL: served entirely from cache!
      mockFetch.mockClear();
      const cachedDetails = await getDetails(repo, indexDigest);

      expect(cachedDetails).toEqual(details);
      expect(mockFetch).toHaveBeenCalledTimes(0); // ZERO requests!
    });
  });

  describe('loadAllDetails progressive loading', () => {
    it('notifies onDetails progressively as each digest finishes', async () => {
      const repo = 'test/repo';
      const a1 = { digest: 'sha256:d1', mediaType: MT.ociManifest, tags: ['v1'] };
      const a2 = { digest: 'sha256:d2', mediaType: MT.ociManifest, tags: ['v2'] };

      // Pre-populate one in localStorage
      const d1Details = {
        digest: 'sha256:d1',
        mediaType: MT.ociManifest,
        isIndex: false,
        sizeBytes: 1000,
        platforms: [],
        annotations: {},
      };
      localStorage.setItem(CACHE_PREFIX + 'sha256:d1', JSON.stringify(d1Details));

      // Mock d2 fetch
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.endsWith('/manifests/sha256:d2')) {
          return new Response(
            JSON.stringify({
              config: { digest: 'sha256:cfg2', size: 100 },
              layers: [{ digest: 'sha256:l1', size: 500 }],
            }),
            { headers: { 'Content-Type': MT.ociManifest } },
          );
        }
        if (url.endsWith('/blobs/sha256:cfg2')) {
          return new Response(JSON.stringify({ os: 'linux', architecture: 'amd64' }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(null, { status: 404 });
      });

      const loadedDigests: string[] = [];
      const errors: string[] = [];

      await loadAllDetails(
        repo,
        [a1, a2],
        (details) => loadedDigests.push(details.digest),
        (digest) => errors.push(digest),
      );

      expect(loadedDigests).toContain('sha256:d1');
      expect(loadedDigests).toContain('sha256:d2');
      expect(errors).toHaveLength(0);
    });
  });

  describe('fetchPlatformExtendedDetails', () => {
    it('fetches manifest and config history for drawer inspection', async () => {
      const repo = 'test/repo';
      const digest = 'sha256:manifest-plat';

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.endsWith(`/manifests/${digest}`)) {
          return new Response(
            JSON.stringify({
              config: { digest: 'sha256:cfg-plat', size: 200 },
              layers: [{ digest: 'sha256:layer-a', size: 12000, mediaType: 'layer' }],
              annotations: { 'com.example.vendor': 'ACME' },
            }),
            { headers: { 'Content-Type': MT.ociManifest } },
          );
        }
        if (url.endsWith('/blobs/sha256:cfg-plat')) {
          return new Response(
            JSON.stringify({
              history: [
                { created: '2026-09-01T00:00:00Z', created_by: 'ADD file', empty_layer: true },
                { created: '2026-09-01T01:00:00Z', created_by: 'RUN build.sh', empty_layer: false },
              ],
            }),
            { headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(null, { status: 404 });
      });

      const ext = await fetchPlatformExtendedDetails(repo, digest);
      expect(ext.platformDigest).toBe(digest);
      expect(ext.configDigest).toBe('sha256:cfg-plat');
      expect(ext.history).toHaveLength(2);
      expect(ext.history[0].empty_layer).toBe(true);
      expect(ext.layers).toHaveLength(1);
      expect(ext.annotations['com.example.vendor']).toBe('ACME');
    });
  });

  describe('Cache management: clearDetailCache and getCacheStats', () => {
    it('tracks cache counts and clears them on demand', () => {
      localStorage.setItem(CACHE_PREFIX + 'sha256:abc', JSON.stringify({ digest: 'abc' }));
      localStorage.setItem(CACHE_PREFIX + 'sha256:def', JSON.stringify({ digest: 'def' }));
      localStorage.setItem('unrelated_key', 'value');

      const stats = getCacheStats();
      expect(stats.count).toBe(2);
      expect(stats.estimatedSizeBytes).toBeGreaterThan(0);

      const cleared = clearDetailCache();
      expect(cleared).toBe(2);

      const afterStats = getCacheStats();
      expect(afterStats.count).toBe(0);
      expect(localStorage.getItem('unrelated_key')).toBe('value');
    });
  });
});
