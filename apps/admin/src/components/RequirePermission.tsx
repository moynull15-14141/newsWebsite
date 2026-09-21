import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';

/**
 * Client-side courtesy: shows an explanation instead of a page whose API calls would all return 403.
 * Security is enforced by the API (JWT + permission on every route); this never replaces that.
 */
export default function RequirePermission({ permission, children }: { permission: string; children: React.ReactNode }) {
  const allowed = useAuthStore((state) => state.hasPermission(permission));

  if (!allowed) {
    return (
      <div role="alert" className="mx-auto mt-16 max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-gray-400" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-bold text-gray-900">You do not have access to this page</h1>
        <p className="mt-1 text-sm text-gray-600">Managing the homepage requires the “{permission}” permission. Ask an administrator if you need it.</p>
        <Link to="/" className="mt-4 inline-block rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Back to dashboard</Link>
      </div>
    );
  }
  return <>{children}</>;
}
