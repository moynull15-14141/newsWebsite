import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Second gate, not just LoginPage's: a session persisted before this check existed (or a token minted
  // for the shared /auth/login used elsewhere) should not keep working just because isAuthenticated is
  // already true. Same rule as LoginPage — STAFF with at least one role, nothing less.
  if (user && (user.accountType !== 'STAFF' || user.roles.length === 0)) {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
