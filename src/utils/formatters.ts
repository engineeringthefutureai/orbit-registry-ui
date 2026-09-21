// Data formatting utilities for size, time, digests, and pull commands

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  if (!bytes || isNaN(bytes)) return '-';

  const k = 1000; // Docker / OCI typically use 1000 or 1024, standard decimal MB/GB
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0) return `${bytes} B`;
  const index = Math.min(i, sizes.length - 1);

  const value = bytes / Math.pow(k, index);
  // Avoid trailing .0 if integer
  const formatted = value >= 10 || index === 0 ? Math.round(value) : value.toFixed(dm);
  return `${formatted} ${sizes[index]}`;
}

export function formatRelativeTime(dateString?: string, baseTime = Date.now()): string {
  if (!dateString) return '-';
  const timestamp = Date.parse(dateString);
  if (Number.isNaN(timestamp)) return '-';

  const diffMs = baseTime - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 0) return 'in the future';
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1 month ago';
  if (diffMonths < 12) return `${diffMonths} months ago`;
  const diffYears = Math.floor(diffDays / 365);
  if (diffYears === 1) return '1 year ago';
  return `${diffYears} years ago`;
}

export function formatExactTime(dateString?: string): string {
  if (!dateString) return '';
  const timestamp = Date.parse(dateString);
  if (Number.isNaN(timestamp)) return dateString;
  return new Date(timestamp).toUTCString();
}

export function truncateDigest(digest: string, hashLen = 8): string {
  if (!digest) return '';
  const parts = digest.split(':');
  if (parts.length === 2) {
    return `${parts[0]}:${parts[1].substring(0, hashLen)}`;
  }
  return digest.substring(0, hashLen);
}

export function buildPullCommand(
  registryHost: string,
  repo: string,
  tagOrDigest: string,
): string {
  const hostPrefix = registryHost.trim() ? `${registryHost.trim()}/` : '';
  const isDigest = tagOrDigest.startsWith('sha256:') || tagOrDigest.startsWith('sha512:') || tagOrDigest.includes(':');
  if (isDigest) {
    return `docker pull ${hostPrefix}${repo}@${tagOrDigest}`;
  }
  return `docker pull ${hostPrefix}${repo}:${tagOrDigest}`;
}
