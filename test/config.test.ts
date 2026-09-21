import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig } from '../src/api/config';

describe('loadConfig', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads registryPublicUrl from /config.json when available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ registryPublicUrl: 'custom.registry.internal:5000' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const config = await loadConfig();
    expect(config.registryPublicUrl).toBe('custom.registry.internal:5000');
  });

  it('falls back to window.location.host when /config.json returns 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 404 }),
    );

    const config = await loadConfig();
    expect(config.registryPublicUrl).toBe(window.location.host);
  });

  it('falls back to window.location.host when /config.json has empty string', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ registryPublicUrl: '' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const config = await loadConfig();
    expect(config.registryPublicUrl).toBe(window.location.host);
  });

  it('falls back to window.location.host on fetch network exception', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network failure'));

    const config = await loadConfig();
    expect(config.registryPublicUrl).toBe(window.location.host);
  });
});
