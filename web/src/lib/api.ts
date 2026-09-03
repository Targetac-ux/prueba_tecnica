import { getApiKey } from './auth';
import type { PaginatedResponse, Stats } from '@event-logger/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export class ApiAuthError extends Error {}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const apiKey = getApiKey();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    throw new ApiAuthError('API key inválida o faltante');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `Error de red: ${res.status}`);
  }

  return res.json();
}

export function checkHealth(): Promise<{ status: string; db: string }> {
  return request('/health');
}

export function fetchEvents(params: URLSearchParams): Promise<PaginatedResponse> {
  return request(`/events?${params.toString()}`);
}

export function fetchStats(params: URLSearchParams): Promise<Stats> {
  return request(`/events/stats?${params.toString()}`);
}
