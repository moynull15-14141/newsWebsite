import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch, ApiError } from '@/lib/api';
import SeoHead from '@/components/SeoHead';
import { AuthShell } from './ReaderLoginPage';

/** Never echoes the backend's own error text (could leak DB/internal detail) — maps a request failure
 * to one of a small set of reader-safe messages. */
function friendlyAuthError(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) return 'Too many attempts. Please wait a few minutes and try again.';
  return 'Something went wrong. Please try again.';
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    try {
      const result = await apiFetch<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage(result.message);
    } catch (error) {
      setMessage(friendlyAuthError(error));
    }
  };
  return (
    <>
      <SeoHead title="Forgot password" noIndex />
      <AuthShell title="Reset your password">
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <button className="w-full rounded bg-primary-500 px-4 py-2 font-semibold text-white">
            Send reset instructions
          </button>
          {message && (
            <p role="status" className="text-sm text-gray-600">
              {message}
            </p>
          )}
        </form>
      </AuthShell>
    </>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    if (password !== confirm) return setMessage('Passwords do not match.');
    if (password.length < 8) return setMessage('Password must be at least 8 characters.');
    try {
      const result = await apiFetch<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setMessage(result.message);
    } catch (error) {
      setMessage(
        error instanceof ApiError && error.status === 401
          ? 'That reset link is invalid or has expired. Please request a new one.'
          : friendlyAuthError(error),
      );
    }
  };
  return (
    <>
      <SeoHead title="Reset password" noIndex />
      <AuthShell title="Choose a new password">
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">
            Reset token
            <input
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            New password
            <input
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Confirm password
            <input
              required
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <button className="w-full rounded bg-primary-500 px-4 py-2 font-semibold text-white">
            Reset password
          </button>
          {message && (
            <p role="status" className="text-sm text-gray-600">
              {message}
            </p>
          )}
          <Link to="/login" className="block text-sm text-primary-600">
            Back to login
          </Link>
        </form>
      </AuthShell>
    </>
  );
}
