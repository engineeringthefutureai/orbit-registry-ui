import { createContext, useContext, useEffect, useState } from 'react';
import { loadConfig, RuntimeConfig } from '../api/config';

interface ConfigContextValue {
  config: RuntimeConfig;
  isLoading: boolean;
}

const ConfigContext = createContext<ConfigContextValue>({
  config: { registryPublicUrl: window.location.host },
  isLoading: true,
});

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<RuntimeConfig>({
    registryPublicUrl: window.location.host,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConfig().then((cfg) => {
      setConfig(cfg);
      setIsLoading(false);
    });
  }, []);

  return (
    <ConfigContext.Provider value={{ config, isLoading }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext);
}
