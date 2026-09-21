// Orbit registry client: same-origin /v2/ access, digest grouping, content-addressed detail cache.

export const MT = {
  ociIndex: 'application/vnd.oci.image.index.v1+json',
  dockerList: 'application/vnd.docker.distribution.manifest.list.v2+json',
  ociManifest: 'application/vnd.oci.image.manifest.v1+json',
  dockerManifest: 'application/vnd.docker.distribution.manifest.v2+json',
} as const;

// All four types, or multi-arch tags 404 / resolve to the wrong digest.
export const MANIFEST_ACCEPT = [MT.ociIndex, MT.dockerList, MT.ociManifest, MT.dockerManifest].join(', ');
export const INDEX_TYPES = new Set<string>([MT.ociIndex, MT.dockerList]);

export const CONCURRENCY = 6; // browser HTTP/1.1 per-origin limit; raise behind HTTP/2
export const PAGE_SIZE = 1000;
export const CACHE_PREFIX = 'orbit:details:v1:';

// ---------- Types ----------

export interface Artifact {
  digest: string;
  mediaType: string;
  tags: string[];
}

export interface TagFailure {
  tag: string;
  status: number; // 0 = network error or missing digest header
}

export interface RepoListing {
  repository: string;
  artifacts: Artifact[];
  failures: TagFailure[];
}

export interface PlatformDetails {
  os: string;
  architecture: string;
  variant?: string;
  digest: string;
  sizeBytes: number; // compressed: config + layers, as stored
  layerCount: number;
  created?: string;
}

export interface ArtifactDetails {
  digest: string;
  mediaType: string;
  isIndex: boolean;
  sizeBytes: number; // sum over platforms
  created?: string;  // latest platform build time
  platforms: PlatformDetails[];
  annotations: Record<string, string>;
}

export interface Descriptor {
  mediaType?: string;
  digest: string;
  size: number;
  platform?: { os: string; architecture: string; variant?: string };
  annotations?: Record<string, string>;
}

export interface ImageManifest {
  mediaType?: string;
  config: Descriptor;
  layers: Descriptor[];
  annotations?: Record<string, string>;
}

export interface IndexManifest {
  mediaType?: string;
  manifests: Descriptor[];
  annotations?: Record<string, string>;
}

export interface ImageHistoryEntry {
  created?: string;
  created_by?: string;
  empty_layer?: boolean;
  comment?: string;
  author?: string;
}

export interface ImageConfig {
  created?: string;
  os?: string;
  architecture?: string;
  variant?: string;
  history?: ImageHistoryEntry[];
  config?: Record<string, unknown>;
}

export interface PlatformExtendedDetails {
  platformDigest: string;
  configDigest: string;
  history: ImageHistoryEntry[];
  layers: Descriptor[];
  annotations: Record<string, string>;
}

export class RegistryError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

// ---------- Helpers ----------

export async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function baseMediaType(header: string | null): string {
  return (header ?? '').split(';')[0].trim();
}

// Registry emits `</v2/...?last=x&n=1000>; rel="next"`. Keep path + query only,
// so an absolute Link with an internal host still goes through the proxy.
export function nextLink(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/<([^>]+)>\s*;\s*rel="?next"?/i);
  if (!m) return null;
  const u = new URL(m[1], 'http://placeholder');
  return u.pathname + u.search;
}

async function listPaginated(firstUrl: string, key: 'repositories' | 'tags'): Promise<string[]> {
  const out: string[] = [];
  let url: string | null = firstUrl;
  while (url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new RegistryError(`${res.status} on ${url}`, res.status);
    const body = (await res.json()) as Record<string, string[] | null>;
    out.push(...(body[key] ?? []));
    url = nextLink(res.headers.get('Link'));
  }
  return out;
}

async function getJSON<T>(url: string, accept: string): Promise<{ body: T; mediaType: string }> {
  const res = await fetch(url, { headers: { Accept: accept } });
  if (!res.ok) throw new RegistryError(`${res.status} on ${url}`, res.status);
  return { body: (await res.json()) as T, mediaType: baseMediaType(res.headers.get('Content-Type')) };
}

// ---------- Catalog and tag resolution ----------

export function listRepositories(): Promise<string[]> {
  return listPaginated(`/v2/_catalog?n=${PAGE_SIZE}`, 'repositories');
}

type Resolution =
  | { ok: true; tag: string; digest: string; mediaType: string }
  | { ok: false; tag: string; status: number };

async function resolveTag(repo: string, tag: string): Promise<Resolution> {
  try {
    const res = await fetch(`/v2/${repo}/manifests/${tag}`, {
      method: 'HEAD',
      headers: { Accept: MANIFEST_ACCEPT },
    });
    const digest = res.headers.get('Docker-Content-Digest');
    if (!res.ok || !digest) return { ok: false, tag, status: res.ok ? 0 : res.status };
    return { ok: true, tag, digest, mediaType: baseMediaType(res.headers.get('Content-Type')) };
  } catch {
    return { ok: false, tag, status: 0 };
  }
}

export async function listArtifacts(repo: string): Promise<RepoListing> {
  const tags = await listPaginated(`/v2/${repo}/tags/list?n=${PAGE_SIZE}`, 'tags');
  const resolved = await mapConcurrent(tags, CONCURRENCY, (t) => resolveTag(repo, t));

  const byDigest = new Map<string, Artifact>();
  const failures: TagFailure[] = [];
  for (const r of resolved) {
    if (!r.ok) {
      failures.push({ tag: r.tag, status: r.status });
      continue;
    }
    let a = byDigest.get(r.digest);
    if (!a) {
      a = { digest: r.digest, mediaType: r.mediaType, tags: [] };
      byDigest.set(r.digest, a);
    }
    a.tags.push(r.tag);
  }
  for (const a of byDigest.values()) a.tags.sort();
  return { repository: repo, artifacts: [...byDigest.values()], failures };
}

// ---------- Details (content-addressed, cached forever) ----------

const inflight = new Map<string, Promise<ArtifactDetails>>();

function cacheGet(digest: string): ArtifactDetails | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + digest);
    return raw ? (JSON.parse(raw) as ArtifactDetails) : null;
  } catch {
    return null;
  }
}

function cachePut(d: ArtifactDetails): void {
  try {
    localStorage.setItem(CACHE_PREFIX + d.digest, JSON.stringify(d));
  } catch {
    /* quota or disabled storage: details are just refetched next time */
  }
}

function isAttestation(d: Descriptor): boolean {
  return d.platform?.os === 'unknown' || d.annotations?.['vnd.docker.reference.type'] !== undefined;
}

async function platformDetails(repo: string, digest: string, m: ImageManifest): Promise<PlatformDetails> {
  const { body: cfg } = await getJSON<ImageConfig>(`/v2/${repo}/blobs/${m.config.digest}`, '*/*');
  return {
    os: cfg.os ?? 'unknown',
    architecture: cfg.architecture ?? 'unknown',
    variant: cfg.variant,
    digest,
    sizeBytes: m.config.size + m.layers.reduce((s, l) => s + l.size, 0),
    layerCount: m.layers.length,
    created: cfg.created,
  };
}

async function fetchDetails(repo: string, digest: string): Promise<ArtifactDetails> {
  const { body, mediaType: headerType } = await getJSON<ImageManifest | IndexManifest>(
    `/v2/${repo}/manifests/${digest}`,
    MANIFEST_ACCEPT,
  );
  const mediaType = body.mediaType ?? headerType;
  const isIndex = INDEX_TYPES.has(mediaType) || 'manifests' in body;

  let platforms: PlatformDetails[];
  if (isIndex) {
    const children = (body as IndexManifest).manifests.filter((d) => !isAttestation(d));
    platforms = await mapConcurrent(children, CONCURRENCY, async (d) => {
      const { body: m } = await getJSON<ImageManifest>(`/v2/${repo}/manifests/${d.digest}`, MANIFEST_ACCEPT);
      const p = await platformDetails(repo, d.digest, m);
      // Index platform fields are authoritative for os/arch/variant.
      return d.platform ? { ...p, ...d.platform } : p;
    });
  } else {
    platforms = [await platformDetails(repo, digest, body as ImageManifest)];
  }

  const created = platforms
    .map((p) => p.created)
    .filter((c): c is string => !!c && !Number.isNaN(Date.parse(c)))
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .at(-1);

  return {
    digest,
    mediaType,
    isIndex,
    sizeBytes: platforms.reduce((s, p) => s + p.sizeBytes, 0),
    created,
    platforms,
    annotations: body.annotations ?? {},
  };
}

export function getDetails(repo: string, digest: string): Promise<ArtifactDetails> {
  const hit = cacheGet(digest);
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(digest);
  if (!p) {
    p = fetchDetails(repo, digest)
      .then((d) => {
        cachePut(d);
        return d;
      })
      .finally(() => inflight.delete(digest));
    inflight.set(digest, p);
  }
  return p;
}

// Progressive: call onDetails as each digest resolves, so rows fill in without blocking the table.
export async function loadAllDetails(
  repo: string,
  artifacts: Artifact[],
  onDetails: (d: ArtifactDetails) => void,
  onError: (digest: string, err: unknown) => void,
): Promise<void> {
  await mapConcurrent(artifacts, CONCURRENCY, async (a) => {
    try {
      onDetails(await getDetails(repo, a.digest));
    } catch (err) {
      onError(a.digest, err);
    }
  });
}

// ---------- History and Blob inspection for Details Drawer ----------

// Build history comes from the config blob's history array, fetched again
// when the drawer opens (it is not kept in the cache).
export async function fetchPlatformExtendedDetails(
  repo: string,
  platformDigest: string,
): Promise<PlatformExtendedDetails> {
  const { body: manifest } = await getJSON<ImageManifest>(
    `/v2/${repo}/manifests/${platformDigest}`,
    MANIFEST_ACCEPT,
  );
  const configDigest = manifest.config.digest;
  const { body: config } = await getJSON<ImageConfig>(
    `/v2/${repo}/blobs/${configDigest}`,
    '*/*',
  );
  return {
    platformDigest,
    configDigest,
    history: config.history ?? [],
    layers: manifest.layers ?? [],
    annotations: manifest.annotations ?? {},
  };
}

// ---------- Cache inspection & clearing ----------

export function getCacheStats(): { count: number; estimatedSizeBytes: number } {
  let count = 0;
  let estimatedSizeBytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        count++;
        const val = localStorage.getItem(key);
        if (val) {
          estimatedSizeBytes += (key.length + val.length) * 2; // approx UTF-16 bytes
        }
      }
    }
  } catch {
    // localStorage might be unavailable or disabled
  }
  return { count, estimatedSizeBytes };
}

export function clearDetailCache(): number {
  let cleared = 0;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
      cleared++;
    }
  } catch {
    // ignore
  }
  return cleared;
}
