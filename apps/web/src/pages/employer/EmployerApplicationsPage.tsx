import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import type { EmployerApplicationListItem, EmployerJobListItem, Paginated } from './types';

const STATUSES = ['', 'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'REJECTED', 'ACCEPTED', 'WITHDRAWN'];

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
  SHORTLISTED: 'bg-purple-100 text-purple-700',
  REJECTED: 'bg-red-100 text-red-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  WITHDRAWN: 'bg-neutral-100 text-neutral-600',
};

export default function EmployerApplicationsPage() {
  const { t, code, pathFor } = useLanguage();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [jobId, setJobId] = useState('');

  const { data: jobsResp } = useQuery<Paginated<EmployerJobListItem>>({ queryKey: ['employer-jobs', 'all-for-filter'], queryFn: () => apiFetch('/employer-portal/jobs?limit=100') });
  const { data, isLoading, isError } = useQuery<Paginated<EmployerApplicationListItem>>({
    queryKey: ['employer-applications', page, status, jobId],
    queryFn: () => apiFetch(`/employer-portal/applications?page=${page}&limit=20${status ? `&status=${status}` : ''}${jobId ? `&jobId=${jobId}` : ''}`),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900">{t('employer.applications.title')}</h1>

      <div className="mt-4 flex flex-wrap gap-3">
        <div>
          <label htmlFor="app-filter-status" className="sr-only">{t('employer.applications.filterStatus')}</label>
          <select id="app-filter-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
            {STATUSES.map((s) => (<option key={s || 'all'} value={s}>{s ? s.replace(/_/g, ' ') : t('employer.applications.allStatuses')}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor="app-filter-job" className="sr-only">{t('employer.applications.filterJob')}</label>
          <select id="app-filter-job" value={jobId} onChange={(e) => { setJobId(e.target.value); setPage(1); }} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
            <option value="">{t('employer.applications.allJobs')}</option>
            {jobsResp?.data?.map((j) => (<option key={j.id} value={j.id}>{j.title}</option>))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-6 text-neutral-500">{t('common.loading')}</p>
      ) : isError ? (
        <p className="mt-6 text-red-600">{t('common.somethingWrong')}</p>
      ) : !data?.data?.length ? (
        <p className="mt-6 text-neutral-500">{t('employer.applications.empty')}</p>
      ) : (
        <div className="mt-6 space-y-3">
          {data.data.map((app) => (
            <Link key={app.id} to={pathFor(`/employer/applications/${app.id}`, code)} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4 hover:border-primary-300">
              <div>
                <p className="font-semibold text-neutral-900">{app.applicant.name}</p>
                <p className="mt-1 text-sm text-neutral-500">{app.job.title} &middot; {new Date(app.createdAt).toLocaleDateString()}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[app.status] || ''}`}>{app.status.replace(/_/g, ' ')}</span>
            </Link>
          ))}
        </div>
      )}

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-neutral-500">{t('common.page')} {data.meta.page} {t('common.of')} {data.meta.totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50">{t('common.previous')}</button>
            <button onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))} disabled={page === data.meta.totalPages} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50">{t('common.next')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
