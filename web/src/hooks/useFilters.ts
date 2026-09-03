import { useCallback, useState } from 'react';
import type { EventLevel } from '@event-logger/shared';

const ALL_LEVELS: EventLevel[] = ['debug', 'info', 'warning', 'error', 'fatal'];

export interface FilterState {
  level: EventLevel[];
  from: string;
  to: string;
  q: string;
}

function readFiltersFromUrl(): FilterState {
  const params = new URLSearchParams(window.location.search);
  const level = params.getAll('level').filter((l): l is EventLevel => ALL_LEVELS.includes(l as EventLevel));
  return {
    level,
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    q: params.get('q') ?? '',
  };
}

function writeFiltersToUrl(filters: FilterState) {
  const params = new URLSearchParams();
  for (const level of filters.level) params.append('level', level);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.q) params.set('q', filters.q);

  const query = params.toString();
  const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, '', newUrl);
}

export function useFilters() {
  const [filters, setFiltersState] = useState<FilterState>(readFiltersFromUrl);

  const setFilters = useCallback((next: FilterState) => {
    setFiltersState(next);
    writeFiltersToUrl(next);
  }, []);

  return { filters, setFilters };
}
