import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';
import { buildJobListQuery, getJobActions, JOB_STATUS_LABELS, JOB_STATUS_COLORS, formatSalary } from '../lib/jobs';
import { Plus, Edit, Trash2, Send, Check, Globe, Archive, RotateCcw, Clock, Star, StarOff, CalendarClock } from 'lucide-react';

const actionIcons = {
  edit: Edit,
  'submit-review': Send,
  approve: Check,
  'return-to-draft': RotateCcw,
  publish: Globe,
  schedule: CalendarClock,
  'cancel-schedule': Clock,
  archive: Archive,
  delete: Trash2,
  feature: Star,
  unfeature: StarOff,
} as const;

interface JobRow {
  id: string;
  title: string;
  status: string;
  featured: boolean;
  employmentType: string;
  deadline: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  category?: { id: string; name: string };
  employer?: { id: string; name: string };
  location?: { id: string; name: string };
  createdBy?: { id: string; name: string };
  _count?: { applications: number };
}

const STATUS_TABS = ['', 'DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'EXPIRED', 'ARCHIVED'];

export default function JobsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', page, search, statusFilter, categoryFilter],
    queryFn: () =>
      apiFetch<{ data: JobRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
        buildJobListQuery({ page, search, status: statusFilter, categoryId: categoryFilter }),
      ),
  });

  const { data: categories } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['job-categories', 'all'],
    queryFn: () => apiFetch('/job-categories?includeInactive=true'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/jobs/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });
  const workflowMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => apiFetch(`/jobs/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });
  const returnToDraftMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => apiFetch(`/jobs/${id}/return-to-draft`, { method: 'POST', body: JSON.stringify({ reason: reason || undefined }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });
  const scheduleMutation = useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) => apiFetch(`/jobs/${id}/schedule`, { method: 'POST', body: JSON.stringify({ scheduledAt }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });
  const featureMutation = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) => apiFetch(`/jobs/${id}/featured`, { method: 'POST', body: JSON.stringify({ featured }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });

  const handleAction = (job: JobRow, action: string) => {
    if (action === 'edit') return navigate(`/jobs/${job.id}/edit`);
    if (action === 'delete') {
      if (confirm(`Delete "${job.title}"? This cannot be undone.`)) deleteMutation.mutate(job.id);
      return;
    }
    if (action === 'return-to-draft') {
      const reason = window.prompt('Why is this job being sent back to draft?');
      if (reason === null) return;
      return returnToDraftMutation.mutate({ id: job.id, reason });
    }
    if (action === 'schedule') {
      const when = window.prompt('Schedule publish for (YYYY-MM-DD HH:MM, local time):');
      if (!when) return;
      const iso = new Date(when).toISOString();
      return scheduleMutation.mutate({ id: job.id, scheduledAt: iso });
    }
    if (action === 'feature') return featureMutation.mutate({ id: job.id, featured: true });
    if (action === 'unfeature') return featureMutation.mutate({ id: job.id, featured: false });
    workflowMutation.mutate({ id: job.id, action });
  };

  const anyError = workflowMutation.error ?? deleteMutation.error ?? returnToDraftMutation.error ?? scheduleMutation.error ?? featureMutation.error;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        {hasPermission('job.create') && (
          <Link to="/jobs/new" className="inline-flex items-center gap-2 rounded-md border border-primary-500 bg-primary-500 px-4 py-2 text-sm font-bold text-black hover:bg-primary-600 hover:text-white">
            <Plus className="h-4 w-4" /> New Job
          </Link>
        )}
      </div>

      {anyError && (
        <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {getApiErrorMessage(anyError, 'Action failed. Please try again.')}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {STATUS_TABS.map((status) => (
          <button
            key={status || 'all'}
            onClick={() => { setStatusFilter(status); setPage(1); }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${statusFilter === status ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {status ? JOB_STATUS_LABELS[status] : 'All'}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Search jobs..."
          aria-label="Search jobs"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="min-w-[200px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          aria-label="Filter by category"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All Categories</option>
          {categories?.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
        </select>
      </div>

      {isLoading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : !data?.data?.length ? (
        <div className="mt-8 text-center text-gray-500">No jobs found</div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Employer</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Deadline</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Apps</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                      {job.featured && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Featured" />}
                      {job.title}
                    </div>
                    <div className="text-xs text-gray-500">{formatSalary(job.salaryMin, job.salaryMax)}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{job.employer?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{job.category?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{job.location?.name || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${JOB_STATUS_COLORS[job.status] || ''}`}>
                      {JOB_STATUS_LABELS[job.status] || job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{job.deadline ? new Date(job.deadline).toLocaleDateString() : '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{job._count?.applications ?? 0}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      {getJobActions(job, hasPermission, currentUserId).map((a) => {
                        const Icon = actionIcons[a.action];
                        return (
                          <button
                            key={a.action}
                            onClick={() => handleAction(job, a.action)}
                            className={`rounded p-1.5 hover:bg-gray-100 ${a.action === 'delete' ? 'text-red-600' : 'text-gray-500'}`}
                            title={a.label}
                            aria-label={`${a.label} — ${job.title}`}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} jobs)</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))} disabled={page === data.meta.totalPages} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
