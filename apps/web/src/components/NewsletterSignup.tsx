import { FormEvent, useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function NewsletterSignup() {
  const [email, setEmail] = useState(''); const [message, setMessage] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await apiFetch('/public/newsletter/subscribe', { method: 'POST', body: JSON.stringify({ email }) }); setMessage('You are subscribed to BD News updates.'); setEmail(''); } catch { setMessage('Please enter a valid email address.'); } };
  return <section className="border-y border-gray-200 bg-gray-50 py-8"><div className="container-wide flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-bold text-gray-900">Stay informed</h2><p className="mt-1 text-sm text-gray-600">Get a concise selection of important stories.</p></div><form onSubmit={submit} className="flex w-full max-w-md gap-2"><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm" /><button className="rounded bg-primary-500 px-4 py-2 text-sm font-semibold text-white">Subscribe</button></form>{message && <p className="text-sm text-gray-600">{message}</p>}</div></section>;
}
