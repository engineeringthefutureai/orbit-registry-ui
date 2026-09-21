export interface RuntimeConfig {
  registryPublicUrl: string; // host used in copied `docker pull` commands
}

export async function loadConfig(): Promise<RuntimeConfig> {
  try {
    const res = await fetch('/config.json', { cache: 'no-cache' });
    if (res.ok) {
      const c = (await res.json()) as Partial<RuntimeConfig>;
      if (c.registryPublicUrl) return { registryPublicUrl: c.registryPublicUrl };
    }
  } catch {
    /* fall through to same-host default */
  }
  return { registryPublicUrl: window.location.host };
}
