import { useAuthStore } from '../stores/auth-store';
import { parseApiError } from './api-error';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

// Existing pages import these from './lib/api'; the implementations live in api-error.ts.
export { ApiError, getApiErrorMessage, isApiError, isDraftConflict } from './api-error';
export type { ApiIssue } from './api-error';

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const { accessToken, refreshToken, setAuth, clearAuth } = useAuthStore.getState();

  const headers = new Headers(options?.headers);
  if (!(options?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && refreshToken) {
    const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshResponse.ok) {
      const data = await refreshResponse.json();
      setAuth(data.user, data.accessToken, data.refreshToken);

      headers.set('Authorization', `Bearer ${data.accessToken}`);
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    } else {
      clearAuth();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!response.ok) {
    throw parseApiError(response.status, await response.text().catch(() => ''));
  }

  // Tolerate empty success bodies (e.g. 204) instead of failing inside response.json().
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
