const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
import { useReaderAuthStore } from '@/stores/reader-auth-store';

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
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}
