import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import type { EmployerApplicationDetail } from './types';

const STATUS_OPTIONS = ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'REJECTED', 'ACCEPTED'];

export default function EmployerApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, pathFor, code } = useLanguage();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<EmployerApplicationDetail>({
    queryKey: ['employer-application', id],
    queryFn: () => apiFetch(`/employer-portal/applications/${id}`),
  });

  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const updateStatus = useMutation({
    mutationFn: () => apiFetch(`/employer-portal/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note: note || undefined }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employer-application', id] }); queryClient.invalidateQueries({ queryKey: ['employer-applications'] }); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, t('employer.applicationDetail.updateError'))),
  });

  if (isLoading) return <p className="text-neutral-500">{t('common.loading')}</p>;
  if (isError || !data) return <p className="text-red-600">{t('common.somethingWrong')}</p>;

  return (
    <div>
      <button type="button" onClick={() => navigate(pathFor('/employer/applications', code))} className="text-sm text-neutral-500 hover:text-neutral-800">&larr; {t('employer.applicationDetail.back')}</button>

      <h1 className="mt-2 text-2xl font-bold text-neutral-900">{data.applicant.name}</h1>
      <p className="text-sm text-neutral-500">{data.applicant.email} &middot; {t('employer.applicationDetail.appliedFor')} {data.job.title}</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {data.coverLetter && (
            <section className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{t('jobs.coverLetter')}</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">{data.coverLetter}</p>
            </section>
          )}
          {data.resume && (
            <section className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{t('jobs.selectResume')}</h2>
              <a href={data.resume.publicUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium text-primary-600 hover:underline">{data.resume.fileName}</a>
            </section>
          )}
        </div>

        <div>
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{t('employer.applicationDetail.status')}</h2>
            <p className="mt-2 text-sm font-medium text-neutral-800">{data.status.replace(/_/g, ' ')}</p>

            {data.status !== 'WITHDRAWN' && (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => { e.preventDefault(); setFormError(null); if (status) updateStatus.mutate(); }}
              >
                <div>
                  <label htmlFor="app-new-status" className="block text-sm font-medium text-neutral-700">{t('employer.applicationDetail.changeStatus')}</label>
                  <select id="app-new-status" value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
                    <option value="">{t('employer.applicationDetail.selectStatus')}</option>
                    {STATUS_OPTIONS.map((s) => (<option key={s} value={s}>{s.replace(/_/g, ' ')}</option>))}
                  </select>
                </div>
                <div>
                  <label htmlFor="app-note" className="block text-sm font-medium text-neutral-700">{t('employer.applicationDetail.note')}</label>
                  <textarea id="app-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                </div>
                {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
                <button type="submit" disabled={!status || updateStatus.isPending} className="w-full rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">
                  {t('employer.applicationDetail.save')}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
