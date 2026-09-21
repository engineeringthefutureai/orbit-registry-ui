import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  formatRelativeTime,
  formatExactTime,
  truncateDigest,
  buildPullCommand,
} from '../src/utils/formatters';

describe('formatters', () => {
  describe('formatBytes', () => {
    it('formats 0 bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('formats kilobytes and megabytes', () => {
      expect(formatBytes(1500)).toBe('1.5 KB');
      expect(formatBytes(713 * 1000 * 1000)).toBe('713 MB');
      expect(formatBytes(1.4 * 1000 * 1000 * 1000)).toBe('1.4 GB');
    });

    it('handles negative or invalid values gracefully', () => {
      expect(formatBytes(NaN)).toBe('-');
    });
  });

  describe('formatRelativeTime', () => {
    it('handles relative intervals', () => {
      const base = 1700000000000;
      expect(formatRelativeTime(new Date(base - 10 * 1000).toISOString(), base)).toBe('just now');
      expect(formatRelativeTime(new Date(base - 5 * 60 * 1000).toISOString(), base)).toBe('5m ago');
      expect(formatRelativeTime(new Date(base - 2 * 3600 * 1000).toISOString(), base)).toBe('2h ago');
      expect(formatRelativeTime(new Date(base - 24 * 3600 * 1000).toISOString(), base)).toBe('1 day ago');
      expect(formatRelativeTime(new Date(base - 48 * 3600 * 1000).toISOString(), base)).toBe('2 days ago');
      expect(formatRelativeTime(new Date(base - 40 * 24 * 3600 * 1000).toISOString(), base)).toBe('1 month ago');
      expect(formatRelativeTime(new Date(base - 400 * 24 * 3600 * 1000).toISOString(), base)).toBe('1 year ago');
    });

    it('handles invalid or empty dates', () => {
      expect(formatRelativeTime(undefined)).toBe('-');
      expect(formatRelativeTime('invalid-date')).toBe('-');
    });
  });

  describe('formatExactTime', () => {
    it('formats to UTC string', () => {
      const utc = formatExactTime('2026-09-20T09:00:00Z');
      expect(utc).toContain('2026');
      expect(utc).toContain('GMT');
    });

    it('handles invalid date', () => {
      expect(formatExactTime('')).toBe('');
      expect(formatExactTime('invalid')).toBe('invalid');
    });
  });

  describe('truncateDigest', () => {
    it('truncates standard sha256 digests', () => {
      const digest = 'sha256:1a440369deadbeef1234567890abcdef1a440369deadbeef1234567890abcdef';
      expect(truncateDigest(digest, 8)).toBe('sha256:1a440369');
      expect(truncateDigest(digest, 12)).toBe('sha256:1a440369dead');
    });

    it('handles empty or non-prefixed digests', () => {
      expect(truncateDigest('')).toBe('');
      expect(truncateDigest('abcdef1234567890')).toBe('abcdef12');
    });
  });

  describe('buildPullCommand', () => {
    it('builds tag pull command with registry host', () => {
      const cmd = buildPullCommand('registry.example.com', 'my-repo/app', '1.2.7');
      expect(cmd).toBe('docker pull registry.example.com/my-repo/app:1.2.7');
    });

    it('builds digest pull command with registry host', () => {
      const cmd = buildPullCommand('registry.example.com:5000', 'my-repo/app', 'sha256:1a440369');
      expect(cmd).toBe('docker pull registry.example.com:5000/my-repo/app@sha256:1a440369');
    });

    it('handles empty registry host', () => {
      const cmdTag = buildPullCommand('', 'my-repo/app', 'latest');
      expect(cmdTag).toBe('docker pull my-repo/app:latest');

      const cmdDigest = buildPullCommand('', 'my-repo/app', 'sha256:ccfe53fa');
      expect(cmdDigest).toBe('docker pull my-repo/app@sha256:ccfe53fa');
    });
  });
});
