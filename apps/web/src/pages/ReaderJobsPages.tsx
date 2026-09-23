import { Link, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useReaderAuthStore } from '@/stores/reader-auth-store';
import { useLanguage } from '@/lib/i18n';
import SeoHead from '@/components/SeoHead';

interface SavedJobItem {
  id: string;
  jobId: string;
  job: { id: string; title: string; slug: string; status: string; deadline: string | null; employmentType: string; employer?: { name: string } | null; location?: { name: string } | null };
}
interface ApplicationItem {
  id: string;
  status: string;
  method: string;
  createdAt: string;
  job: { id: string; title: string; slug: string; status: string; deadline: string | null; employer?: { name: string } | null };
}
interface PaginatedResponse<T> { data: T[] }

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
  SHORTLISTED: 'bg-purple-100 text-purple-700',
  REJECTED: 'bg-red-100 text-red-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  WITHDRAWN: 'bg-neutral-100 text-neutral-600',
};

function Protected({ children }: { children: React.ReactNode }) {
  const { code, pathFor } = useLanguage();
  return useReaderAuthStore.getState().user ? <>{children}</> : <Navigate to={pathFor('/login', code)} replace />;
}

export function SavedJobsPage() {
  const queryClient = useQueryClient();
  const { t, code, pathFor } = useLanguage();
  const { data } = useQuery<PaginatedResponse<SavedJobItem>>({ queryKey: ['reader-saved-jobs'], queryFn: () => apiFetch('/reader/saved-jobs') });
  const remove = useMutation({
    mutationFn: (jobId: string) => apiFetch(`/reader/saved-jobs/${jobId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reader-saved-jobs'] }),
  });

  return (
    <Protected>
      <SeoHead title={t('jobs.savedJobs')} noIndex />
      <main className="container-wide py-10">
        <h1 className="text-3xl font-bold">{t('jobs.savedJobs')}</h1>
        {!data?.data?.length ? (
          <p className="mt-6 text-neutral-500">{t('jobs.noSavedJobs')}</p>
        ) : (
          <div className="mt-6 space-y-3">
            {data.data.map((item) => {
              const expired = item.job.status !== 'PUBLISHED' || (item.job.deadline && new Date(item.job.deadline).getTime() < Date.now());
              return (
                <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 py-4">
                  <div>
                    <Link to={pathFor(`/jobs/${item.job.slug}`, code)} className="font-semibold text-neutral-900 hover:text-primary-600">{item.job.title}</Link>
                    <p className="mt-1 text-sm text-neutral-500">
                      {item.job.employer?.name}{item.job.location?.name ? ` · ${item.job.location.name}` : ''}
                      {expired && <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-500">Unavailable</span>}
                    </p>
                  </div>
                  <button onClick={() => remove.mutate(item.jobId)} className="text-sm text-neutral-500 hover:text-red-600">{t('account.remove')}</button>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </Protected>
  );
}

export function JobApplicationsPage() {
  const { t, code, pathFor } = useLanguage();
  const queryClient = useQueryClient();
  const { data } = useQuery<PaginatedResponse<ApplicationItem>>({ queryKey: ['reader-job-applications'], queryFn: () => apiFetch('/reader/job-applications') });
  const withdraw = useMutation({
    mutationFn: (id: string) => apiFetch(`/reader/job-applications/${id}/withdraw`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reader-job-applications'] }),
  });

  return (
    <Protected>
      <SeoHead title={t('jobs.myApplications')} noIndex />
      <main className="container-wide py-10">
        <h1 className="text-3xl font-bold">{t('jobs.myApplications')}</h1>
        {!data?.data?.length ? (
          <p className="mt-6 text-neutral-500">{t('jobs.noApplications')}</p>
        ) : (
          <div className="mt-6 space-y-3">
            {data.data.map((app) => (
              <article key={app.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 py-4">
                <div>
                  <Link to={pathFor(`/jobs/${app.job.slug}`, code)} className="font-semibold text-neutral-900 hover:text-primary-600">{app.job.title}</Link>
                  <p className="mt-1 text-sm text-neutral-500">
                    {app.job.employer?.name} · {t('jobs.appliedOn')} {new Date(app.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[app.status] || ''}`}>{app.status.replace('_', ' ')}</span>
                  {['SUBMITTED', 'UNDER_REVIEW'].includes(app.status) && (
                    <button onClick={() => { if (confirm('Withdraw this application?')) withdraw.mutate(app.id); }} className="text-sm text-neutral-500 hover:text-red-600">{t('jobs.withdraw')}</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </Protected>
  );
}
