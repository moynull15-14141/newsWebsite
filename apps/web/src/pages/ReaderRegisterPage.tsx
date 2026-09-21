import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { AuthShell } from './ReaderLoginPage';
import SeoHead from '@/components/SeoHead';

interface RegisterResponse { message: string; verificationToken?: string; }

export default function ReaderRegisterPage() {
  const navigate = useNavigate(); const [displayName, setDisplayName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [message, setMessage] = useState(''); const [token, setToken] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); try { const data = await apiFetch<RegisterResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ displayName, email, password }) }); setMessage(data.message); if (data.verificationToken) setToken(data.verificationToken); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to register'); } };
  const verify = async () => { await apiFetch('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }); navigate('/login'); };
  return <><SeoHead title="Create reader account" noIndex /><AuthShell title="Create your reader account"><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">Display name<input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" /></label><label className="block text-sm font-medium">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" /></label><label className="block text-sm font-medium">Password<input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" /></label><button className="w-full rounded bg-primary-500 px-4 py-2 font-semibold text-white">Register</button></form>{message && <p className="mt-4 text-sm text-gray-600" role="status">{message}</p>}{token && <button onClick={verify} className="mt-3 rounded border border-primary-500 px-3 py-2 text-sm text-primary-600">Verify development account</button>}<p className="mt-5 text-sm text-gray-500">Already registered? <Link to="/login" className="text-primary-600">Sign in</Link></p></AuthShell></>;
}
