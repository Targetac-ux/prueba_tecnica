import { useCallback, useEffect, useState } from 'react';
import type { Stats } from '@event-logger/shared';
import { fetchStats, ApiAuthError } from '../lib/api';
import { buildFilterParams } from '../lib/queryParams';
import type { FilterState } from './useFilters';

interface UseStatsResult {
  stats: Stats | null;
  refresh: () => void;
}

export function useStats(enabled: boolean, filters: FilterState, onAuthError: () => void): UseStatsResult {
  const [stats, setStats] = useState<Stats | null>(null);
  const filtersKey = JSON.stringify(filters);

  const load = useCallback(async () => {
    try {
      const params = buildFilterParams(filters);
      const res = await fetchStats(params);
      setStats(res);
    } catch (err) {
      if (err instanceof ApiAuthError) {
        onAuthError();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, onAuthError]);

  useEffect(() => {
    if (enabled) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, filtersKey]);

  return { stats, refresh: load };
}
