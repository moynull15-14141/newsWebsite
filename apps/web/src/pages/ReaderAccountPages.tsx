import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useReaderAuthStore } from '@/stores/reader-auth-store';
import { useLanguage } from '@/lib/i18n';
import SeoHead from '@/components/SeoHead';

interface BookmarkItem { id: string; articleId: string; article: { slug: string; title: string }; }
interface NotificationItem { id: string; title: string; body: string; readAt?: string; createdAt: string; }
interface PaginatedResponse<T> { data: T[]; }

function Protected({ children }: { children: React.ReactNode }) {
  const { code, pathFor } = useLanguage();
  return useReaderAuthStore.getState().user ? <><SeoHead title="Reader account" noIndex />{children}</> : <Navigate to={pathFor('/login', code)} replace />;
}

export function AccountPage() {
  const user = useReaderAuthStore((s) => s.user);
  const { t, code, pathFor } = useLanguage();
  return (
    <Protected>
      <main className="container-narrow py-12">
        <h1 className="text-3xl font-bold">{t('account.hello', { name: user?.name ?? '' })}</h1>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Link className="rounded border border-gray-200 bg-white p-4 font-semibold hover:border-primary-400" to={pathFor('/account/saved', code)}>{t('account.savedArticles')}</Link>
          <Link className="rounded border border-gray-200 bg-white p-4 font-semibold hover:border-primary-400" to={pathFor('/account/notifications', code)}>{t('account.notifications')}</Link>
          <Link className="rounded border border-gray-200 bg-white p-4 font-semibold hover:border-primary-400" to={pathFor('/account/settings', code)}>{t('account.settings')}</Link>
        </div>
      </main>
    </Protected>
  );
}

export function SavedPage() {
  const queryClient = useQueryClient();
  const { t, code, pathFor } = useLanguage();
  const { data } = useQuery<PaginatedResponse<BookmarkItem>>({ queryKey: ['reader-bookmarks'], queryFn: () => apiFetch('/reader/bookmarks') });
  const remove = useMutation({ mutationFn: (id: string) => apiFetch(`/reader/bookmarks/${id}`, { method: 'DELETE' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reader-bookmarks'] }) });
  return (
    <Protected>
      <main className="container-wide py-10">
        <h1 className="text-3xl font-bold">{t('account.savedArticles')}</h1>
        <div className="mt-6 space-y-3">
          {data?.data?.map((item) => (
            <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 py-4">
              <Link to={pathFor(`/article/${item.article.slug}`, code)} className="font-semibold text-gray-900 hover:text-primary-600">{item.article.title}</Link>
              <button onClick={() => remove.mutate(item.articleId)} className="text-sm text-gray-500 hover:text-red-600">{t('account.remove')}</button>
            </article>
          ))}
        </div>
      </main>
    </Protected>
  );
}

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const { t, code } = useLanguage();
  const { data } = useQuery<PaginatedResponse<NotificationItem>>({ queryKey: ['reader-notifications'], queryFn: () => apiFetch('/reader/notifications') });
  const readAll = useMutation({ mutationFn: () => apiFetch('/reader/notifications/read-all', { method: 'POST' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reader-notifications'] }) });
  return (
    <Protected>
      <main className="container-narrow py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t('account.notifications')}</h1>
          <button onClick={() => readAll.mutate()} className="text-sm text-primary-600">{t('account.markAllRead')}</button>
        </div>
        <div className="mt-6 space-y-3">
          {data?.data?.map((notification) => (
            <div key={notification.id} className={`rounded border p-4 ${notification.readAt ? 'border-gray-200' : 'border-primary-300 bg-primary-50'}`}>
              <p className="font-semibold">{notification.title}</p>
              <p className="mt-1 text-sm text-gray-600">{notification.body}</p>
              <time className="mt-2 block text-xs text-gray-400">{new Date(notification.createdAt).toLocaleString(code === 'bn' ? 'bn-BD' : 'en-US')}</time>
            </div>
          ))}
        </div>
      </main>
    </Protected>
  );
}

export function SettingsPage() {
  const user = useReaderAuthStore((s) => s.user);
  const { t } = useLanguage();
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [message, setMessage] = useState('');
  const save = async () => { await apiFetch('/reader/me', { method: 'PATCH', body: JSON.stringify({ displayName }) }); setMessage(t('account.profileUpdated')); };
  return (
    <Protected>
      <main className="container-narrow py-10">
        <h1 className="text-3xl font-bold">{t('account.settings')}</h1>
        <section className="mt-6 rounded border border-gray-200 bg-white p-5">
          <h2 className="font-semibold">{t('account.profile')}</h2>
          <label className="mt-4 block text-sm font-medium">{t('account.displayName')}
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
          </label>
          <button onClick={save} className="mt-4 rounded bg-primary-500 px-4 py-2 text-sm font-semibold text-white">{t('account.saveProfile')}</button>
          {message && <p className="mt-2 text-sm text-green-700">{message}</p>}
        </section>
      </main>
    </Protected>
  );
}
