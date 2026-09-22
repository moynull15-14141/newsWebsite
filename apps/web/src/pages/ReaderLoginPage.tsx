import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { useReaderAuthStore } from '@/stores/reader-auth-store';
import SeoHead from '@/components/SeoHead';
import { useLanguage } from '@/lib/i18n';

interface ReaderAuthResponse { user: { id: string; name: string; email: string }; accessToken: string; refreshToken: string; }

export default function ReaderLoginPage() {
  const navigate = useNavigate();
  const { t, code, pathFor } = useLanguage();
  const setAuth = useReaderAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); try { const data = await apiFetch<ReaderAuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); setAuth(data.user, data.accessToken, data.refreshToken); navigate(pathFor('/account', code)); } catch (err) { setError(err instanceof Error ? err.message : t('auth.unableToSignIn')); } };
  return <><SeoHead title={t('auth.signIn')} noIndex /><AuthShell title={t('auth.welcomeBack')}><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">{t('auth.email')}<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" /></label><label className="block text-sm font-medium">{t('auth.password')}<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" /></label>{error && <p className="text-sm text-red-600" role="alert">{error}</p>}<button className="w-full rounded bg-primary-500 px-4 py-2 font-semibold text-white">{t('auth.signIn')}</button><div className="flex justify-between text-sm"><Link to={pathFor('/register', code)} className="text-primary-600">{t('auth.createAccount')}</Link><Link to={pathFor('/account/settings', code)} className="text-gray-500">{t('auth.forgotPassword')}</Link></div></form></AuthShell></>;
}

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) { return <main className="container-narrow py-16"><div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm"><h1 className="mb-6 text-2xl font-bold text-gray-900">{title}</h1>{children}</div></main>; }
