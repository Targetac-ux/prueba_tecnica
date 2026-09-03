import { useCallback, useState } from 'react';
import { getApiKey, clearApiKey } from './lib/auth';
import ApiKeyGate from './components/ApiKeyGate';
import EventTable from './components/EventTable';
import Filters from './components/Filters';
import EventChart from './components/EventChart';
import LastUpdated from './components/LastUpdated';
import ThemeToggle from './components/ThemeToggle';
import { useEvents } from './hooks/useEvents';
import { useStats } from './hooks/useStats';
import { useFilters } from './hooks/useFilters';
import { usePolling } from './hooks/usePolling';
import { useDarkMode } from './hooks/useDarkMode';
import styles from './App.module.css';

const POLL_INTERVAL_MS = 5000;

function App() {
  const [hasKey, setHasKey] = useState(() => Boolean(getApiKey()));
  const [authInvalid, setAuthInvalid] = useState(false);
  const { filters, setFilters } = useFilters();
  const { theme, toggleTheme } = useDarkMode();

  const handleAuthError = useCallback(() => {
    clearApiKey();
    setHasKey(false);
    setAuthInvalid(true);
  }, []);

  function handleKeySubmit() {
    setHasKey(true);
    setAuthInvalid(false);
  }

  const { events, loading, error, hasMore, lastUpdated, loadMore, refresh } = useEvents(
    hasKey,
    filters,
    handleAuthError
  );
  const { stats, refresh: refreshStats } = useStats(hasKey, filters, handleAuthError);

  const pollTick = useCallback(() => {
    refresh();
    refreshStats();
  }, [refresh, refreshStats]);

  usePolling(pollTick, POLL_INTERVAL_MS, hasKey);

  if (!hasKey) {
    return (
      <>
        <div className={styles.floatingToggle}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <ApiKeyGate onSubmit={handleKeySubmit} wasInvalid={authInvalid} />
      </>
    );
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>Event Logger</h1>
        <span className={styles.lastUpdated}>
          <LastUpdated date={lastUpdated} />
        </span>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>
      <main className={styles.main}>
        <Filters filters={filters} onChange={setFilters} />
        <EventChart stats={stats} />
        <EventTable events={events} loading={loading} error={error} />
        {hasMore && (
          <button className={styles.loadMore} onClick={loadMore} disabled={loading}>
            {loading ? 'Cargando...' : 'Cargar más'}
          </button>
        )}
      </main>
    </div>
  );
}

export default App;
