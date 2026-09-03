import type { FilterState } from '../hooks/useFilters';

export function buildFilterParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  for (const level of filters.level) params.append('level', level);
  if (filters.from) params.set('from', new Date(filters.from).toISOString());
  if (filters.to) {
    const end = new Date(filters.to);
    end.setHours(23, 59, 59, 999);
    params.set('to', end.toISOString());
  }
  if (filters.q) params.set('q', filters.q);
  return params;
}
