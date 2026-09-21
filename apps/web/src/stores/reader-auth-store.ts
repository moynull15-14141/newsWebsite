import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ReaderUser { id: string; name: string; email: string; accountType?: string; verifiedAt?: string | null }
interface ReaderAuthState {
  user: ReaderUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: ReaderUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useReaderAuthStore = create<ReaderAuthState>()(persist((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
  clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
}), { name: 'reader-auth-storage' }));
