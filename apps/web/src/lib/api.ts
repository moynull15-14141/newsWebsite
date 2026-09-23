export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
import { useReaderAuthStore } from '@/stores/reader-auth-store';

/** Appends `?lang=` (or `&lang=`) to a `/public/*` request path — every such DTO accepts it (see PublicArticleQueryDto). */
export function withLang(endpoint: string, code: string): string {
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}lang=${encodeURIComponent(code)}`;
}

/**
 * Failed API call, carrying the real HTTP status. Message stays `API error: <status>` — the format every
 * existing `.message`-only consumer already expects — so this is purely additive. A page that needs to
 * tell "this category doesn't exist" (404) apart from "the API is down" (5xx/network) reads `.status`.
 */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`API error: ${status}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/** apps/web's `ApiError` only ever carries `.status` (no parsed server message — see the class comment
 * above), so unlike admin's `getApiErrorMessage` this can't surface the backend's real text. Employer
 * portal pages that need the backend's explanation (e.g. why registration is disabled) should fetch that
 * reason from a dedicated read endpoint instead of relying on the error message. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const auth = useReaderAuthStore.getState();
  const headers = { 'Content-Type': 'application/json', ...(options?.headers || {}), ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}) };
  let response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  if (response.status === 401 && auth.refreshToken) {
    const refresh = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: auth.refreshToken }) });
    if (refresh.ok) {
      const tokens = await refresh.json();
      useReaderAuthStore.getState().setAuth(auth.user!, tokens.accessToken, tokens.refreshToken);
      response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers: { ...headers, Authorization: `Bearer ${tokens.accessToken}` } });
    } else {
      useReaderAuthStore.getState().clearAuth();
    }
  }
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return response.json();
}
