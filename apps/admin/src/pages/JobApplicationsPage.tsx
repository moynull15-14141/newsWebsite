import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, X, FileText } from 'lucide-react';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';

interface ApplicationRow {
  id: string;
  status: string;
  method: string;
  createdAt: string;
  applicant: { id: string; name: string; email: string };
  job: { id: string; title: string; slug: string };
  resume?: { id: string; fileName: string; publicUrl: string } | null;
  reviewedBy?: { id: string; name: string } | null;
}

const STATUS_TABS = ['', 'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'REJECTED', 'ACCEPTED', 'WITHDRAWN'];
const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
  SHORTLISTED: 'bg-purple-100 text-purple-700',
  REJECTED: 'bg-red-100 text-red-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  WITHDRAWN: 'bg-gray-100 text-gray-600',
};

export default function JobApplicationsPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('job_application.manage');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<ApplicationRow | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ data: ApplicationRow[]; meta: { page: number; totalPages: number; total: number } }>({
    queryKey: ['job-applications-admin', page, search, statusFilter],
    queryFn: () => apiFetch(`/job-applications?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}${statusFilter ? `&status=${statusFilter}` : ''}`),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      apiFetch(`/job-applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['job-applications-admin'] }); setSelected(null); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, 'Failed to update application status')),
  });

  function openDetail(app: ApplicationRow) {
    setSelected(app); setStatusDraft(app.status); setNoteDraft(''); setFormError(null);
  }

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Users size={24} /> Job Applications</h1>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {STATUS_TABS.map((status) => (
          <button
            key={status || 'all'}
            onClick={() => { setStatusFilter(status); setPage(1); }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${statusFilter === status ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {status || 'All'}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <input
          type="text" placeholder="Search applicant name, email, or job title..." aria-label="Search applications"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {isLoading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : !data?.data?.length ? (
        <div className="mt-8 text-center text-gray-500">No applications found</div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Applicant</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Job</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Applied</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{app.applicant.name}</div>
                    <div className="text-xs text-gray-500">{app.applicant.email}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{app.job.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(app.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[app.status] || ''}`}>{app.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openDetail(app)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} applications)</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))} disabled={page === data.meta.totalPages} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === 'Escape' && setSelected(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="application-modal-title" className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="application-modal-title" className="text-lg font-semibold text-gray-900">Application — {selected.applicant.name}</h2>
              <button onClick={() => setSelected(null)} aria-label="Close dialog" className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Job</dt><dd className="font-medium text-gray-900">{selected.job.title}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Email</dt><dd className="font-medium text-gray-900">{selected.applicant.email}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Applied</dt><dd className="font-medium text-gray-900">{new Date(selected.createdAt).toLocaleString()}</dd></div>
              {selected.resume && (
                <div className="flex justify-between"><dt className="text-gray-500">Resume</dt>
                  <dd><a href={selected.resume.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary-600 hover:underline"><FileText className="h-3.5 w-3.5" /> {selected.resume.fileName}</a></dd>
                </div>
              )}
              {selected.reviewedBy && (
                <div className="flex justify-between"><dt className="text-gray-500">Last reviewed by</dt><dd className="font-medium text-gray-900">{selected.reviewedBy.name}</dd></div>
              )}
            </dl>

            {canManage ? (
              <form
                onSubmit={(e) => { e.preventDefault(); updateStatusMutation.mutate({ id: selected.id, status: statusDraft, note: noteDraft || undefined }); }}
                className="mt-4 space-y-3 border-t border-gray-200 pt-4"
              >
                <div>
                  <label htmlFor="app-status" className="block text-sm font-medium text-gray-700">Status</label>
                  <select id="app-status" value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    {['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'REJECTED', 'ACCEPTED'].map((s) => (<option key={s} value={s}>{s.replace('_', ' ')}</option>))}
                  </select>
                </div>
                <div>
                  <label htmlFor="app-note" className="block text-sm font-medium text-gray-700">Internal note <span className="font-normal text-gray-400">(staff only — never shown to the applicant)</span></label>
                  <textarea id="app-note" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
                {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setSelected(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
                  <button type="submit" disabled={updateStatusMutation.isPending || selected.status === 'WITHDRAWN'} className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">
                    Save Status
                  </button>
                </div>
                {selected.status === 'WITHDRAWN' && <p className="text-xs text-gray-500">This application was withdrawn by the applicant and can no longer be updated.</p>}
              </form>
            ) : (
              <div className="mt-4 border-t border-gray-200 pt-4 text-right">
                <button onClick={() => setSelected(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
