import { useCallback, useEffect, useState } from 'react';
import type { Event } from '@event-logger/shared';
import { fetchEvents, ApiAuthError } from '../lib/api';
import { buildFilterParams } from '../lib/queryParams';
import type { FilterState } from './useFilters';

interface UseEventsResult {
  events: Event[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  lastUpdated: Date | null;
  loadMore: () => void;
  refresh: () => void;
}

export function useEvents(enabled: boolean, filters: FilterState, onAuthError: () => void): UseEventsResult {
  const [events, setEvents] = useState<Event[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const filtersKey = JSON.stringify(filters);

  const load = useCallback(
    async (nextCursor: string | null, append: boolean, silent = false) => {
      if (!silent) setLoading(true);
      if (!silent) setError(null);
      try {
        const params = buildFilterParams(filters);
        if (nextCursor) params.set('cursor', nextCursor);
        const res = await fetchEvents(params);
        setEvents((prev) => (append ? [...prev, ...res.data] : res.data));
        setCursor(res.next_cursor);
        setHasMore(res.has_more);
        setLastUpdated(new Date());
      } catch (err) {
        if (err instanceof ApiAuthError) {
          onAuthError();
          return;
        }
        if (!silent) {
          setError(err instanceof Error ? err.message : 'Error desconocido');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersKey, onAuthError]
  );

  useEffect(() => {
    if (enabled) {
      load(null, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, filtersKey]);

  function loadMore() {
    if (cursor) load(cursor, true);
  }

  function refresh() {
    load(null, false, true);
  }

  return { events, loading, error, hasMore, lastUpdated, loadMore, refresh };
}
