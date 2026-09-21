import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { CatalogPage } from './pages/CatalogPage';
import { RepoPage } from './pages/RepoPage';
import { ConfigProvider } from './context/ConfigContext';
import { ToastProvider } from './context/ToastContext';

type Route =
  | { type: 'catalog' }
  | { type: 'repo'; repo: string };

function parseRoute(): Route {
  const path = window.location.pathname;
  if (path.startsWith('/repo/')) {
    const repo = decodeURIComponent(path.slice(6));
    if (repo) return { type: 'repo', repo };
  }
  return { type: 'catalog' };
}

export function AppContent() {
  const [route, setRoute] = useState<Route>(parseRoute);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToCatalog = useCallback(() => {
    window.history.pushState(null, '', '/');
    setRoute({ type: 'catalog' });
  }, []);

  const navigateToRepo = useCallback((repo: string) => {
    window.history.pushState(null, '', `/repo/${encodeURIComponent(repo)}`);
    setRoute({ type: 'repo', repo });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
      <Header
        currentRepo={route.type === 'repo' ? route.repo : undefined}
        onNavigateHome={navigateToCatalog}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {route.type === 'catalog' ? (
          <CatalogPage onSelectRepo={navigateToRepo} />
        ) : (
          <RepoPage repoName={route.repo} onBack={navigateToCatalog} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>Orbit Registry UI</span>
            <span>·</span>
            <span>Read-Only OCI &amp; Docker Distribution V2</span>
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            Immutable detail cache enabled
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ConfigProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ConfigProvider>
  );
}
