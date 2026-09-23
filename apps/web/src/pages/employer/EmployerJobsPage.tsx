import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import type { EmployerJobListItem, JobStatus, Paginated } from './types';

const STATUSES: Array<JobStatus | ''> = ['', 'DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'REJECTED', 'EXPIRED', 'ARCHIVED'];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-neutral-100 text-neutral-600',
  IN_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  SCHEDULED: 'bg-indigo-100 text-indigo-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-neutral-100 text-neutral-500',
  ARCHIVED: 'bg-neutral-200 text-neutral-600',
};

export default function EmployerJobsPage() {
  const { t, code, pathFor } = useLanguage();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<JobStatus | ''>('');

  const { data, isLoading, isError } = useQuery<Paginated<EmployerJobListItem>>({
    queryKey: ['employer-jobs', page, status],
    queryFn: () => apiFetch(`/employer-portal/jobs?page=${page}&limit=20${status ? `&status=${status}` : ''}`),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">{t('employer.jobs.title')}</h1>
        <Link to={pathFor('/employer/jobs/new', code)} className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">
          {t('employer.jobs.new')}
        </Link>
      </div>

      <div className="mt-4">
        <label htmlFor="job-status-filter" className="sr-only">{t('employer.jobs.filterStatus')}</label>
        <select id="job-status-filter" value={status} onChange={(e) => { setStatus(e.target.value as JobStatus | ''); setPage(1); }} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
          {STATUSES.map((s) => (<option key={s || 'all'} value={s}>{s ? s.replace(/_/g, ' ') : t('employer.jobs.allStatuses')}</option>))}
        </select>
      </div>

      {isLoading ? (
        <p className="mt-6 text-neutral-500">{t('common.loading')}</p>
      ) : isError ? (
        <p className="mt-6 text-red-600">{t('common.somethingWrong')}</p>
      ) : !data?.data?.length ? (
        <p className="mt-6 text-neutral-500">{t('employer.jobs.empty')}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">{t('employer.jobs.colTitle')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">{t('employer.jobs.colStatus')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">{t('employer.jobs.colApplications')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-neutral-500">{t('employer.jobs.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {data.data.map((job) => (
                <tr key={job.id}>
                  <td className="px-4 py-3 text-sm font-medium text-neutral-900">{job.title}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[job.status] || ''}`}>{job.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{job._count?.applications ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={pathFor(`/employer/jobs/${job.id}/edit`, code)} className="text-sm font-medium text-primary-600 hover:underline">
                      {job.status === 'DRAFT' ? t('employer.jobs.edit') : t('employer.jobs.view')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
