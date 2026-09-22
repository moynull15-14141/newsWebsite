import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';
import { countQueueWarnings, getArticleActions } from '../lib/articles';
import { Edit, Send, Check, RotateCcw, Globe, Archive, ArchiveRestore, EyeOff, Trash2, Clock, AlertTriangle } from 'lucide-react';

const actionIcons = {
  edit: Edit,
  'submit-review': Send,
  approve: Check,
  'return-to-draft': RotateCcw,
  publish: Globe,
  archive: Archive,
  unpublish: EyeOff,
  restore: ArchiveRestore,
  delete: Trash2,
} as const;

interface Article {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  author: { id: string; name: string };
  category?: { id: string; name: string };
  updatedAt?: string;
  createdAt: string;
  excerpt?: string | null;
  featuredImageId?: string | null;
  seoDescription?: string | null;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  IN_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-red-100 text-red-700',
};

interface QueueDef {
  key: string;
  label: string;
  status?: string;
  mine?: boolean;
  emptyMessage: string;
}

const QUEUES: QueueDef[] = [
  { key: 'needs-review', label: 'Needs Review', status: 'IN_REVIEW', emptyMessage: 'Nothing is waiting for review.' },
  { key: 'approved', label: 'Approved — Ready to Publish', status: 'APPROVED', emptyMessage: 'Nothing is approved and waiting to publish.' },
  { key: 'scheduled', label: 'Scheduled', status: 'SCHEDULED', emptyMessage: 'No articles are scheduled.' },
  { key: 'my-drafts', label: 'My Drafts', status: 'DRAFT', mine: true, emptyMessage: 'You have no drafts in progress.' },
  { key: 'published', label: 'Published', status: 'PUBLISHED', emptyMessage: 'Nothing has been published yet.' },
  { key: 'archived', label: 'Archived', status: 'ARCHIVED', emptyMessage: 'Nothing has been archived.' },
];

function QueueCountBadge({ status, mine, authorId }: { status?: string; mine?: boolean; authorId?: string }) {
  const params = new URLSearchParams({ page: '1', limit: '1' });
  if (status) params.set('status', status);
  if (mine && authorId) params.set('authorId', authorId);
  const { data } = useQuery<{ meta: { total: number } }>({
    queryKey: ['review-queue-count', status, mine, authorId],
    queryFn: () => apiFetch(`/articles?${params.toString()}`),
  });
  if (data === undefined) return null;
  return (
    <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-gray-200 px-1.5 text-xs font-semibold text-gray-700">
      {data.meta.total}
    </span>
  );
}

export default function ReviewQueuePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [activeKey, setActiveKey] = useState(hasPermission('article.review') ? 'needs-review' : 'my-drafts');
  const [page, setPage] = useState(1);

  const activeQueue = QUEUES.find((q) => q.key === activeKey) ?? QUEUES[0];

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (activeQueue.status) params.set('status', activeQueue.status);
  if (activeQueue.mine && currentUserId) params.set('authorId', currentUserId);

  const { data, isLoading } = useQuery<{ data: Article[]; meta: { page: number; totalPages: number; total: number } }>({
    queryKey: ['review-queue', activeKey, page, currentUserId],
    queryFn: () => apiFetch(`/articles?${params.toString()}`),
  });

  const workflowMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => apiFetch(`/articles/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['review-queue-count'] });
    },
  });

  const returnToDraftMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/articles/${id}/return-to-draft`, { method: 'POST', body: JSON.stringify({ reason: reason || undefined }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['review-queue-count'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/articles/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['review-queue-count'] });
    },
  });

  const handleAction = (article: Article, action: string) => {
    if (action === 'edit') {
      navigate(`/articles/${article.id}/edit`);
    } else if (action === 'delete') {
      if (confirm('Delete this draft permanently?')) deleteMutation.mutate(article.id);
    } else if (action === 'return-to-draft') {
      const reason = window.prompt('Why is this being sent back? The author will see this reason.');
      if (reason === null) return;
      returnToDraftMutation.mutate({ id: article.id, reason });
    } else {
      workflowMutation.mutate({ id: article.id, action });
    }
  };

  const anyError = workflowMutation.error ?? returnToDraftMutation.error ?? deleteMutation.error;

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          Everything that needs an editorial decision, in one place — who can act on what is controlled from{' '}
          <button onClick={() => navigate('/users')} className="font-medium text-primary-600 hover:underline">
            Users &amp; Newsroom Staff
          </button>
          .
        </p>
      </div>

      {anyError && (
        <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {getApiErrorMessage(anyError, 'Action failed. Please try again.')}
        </p>
      )}

      <div role="tablist" aria-label="Editorial queues" className="mt-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {QUEUES.filter((q) => q.key !== 'my-drafts' || true).map((q) => (
          <button
            key={q.key}
            role="tab"
            aria-selected={activeKey === q.key}
            onClick={() => { setActiveKey(q.key); setPage(1); }}
            className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeKey === q.key ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {q.label}
            <QueueCountBadge status={q.status} mine={q.mine} authorId={currentUserId} />
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : !data?.data?.length ? (
        <div className="mt-8 text-center text-gray-500">{activeQueue.emptyMessage}</div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Author</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Updated</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((article) => {
                const warningCount = countQueueWarnings(article);
                return (
                <tr key={article.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <button onClick={() => navigate(`/articles/${article.id}/edit`)} className="text-left text-sm font-medium text-gray-900 hover:text-primary-600 hover:underline">
                      {article.title}
                    </button>
                    {article.scheduledAt && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-blue-600">
                        <Clock className="h-3 w-3" />
                        {new Date(article.scheduledAt).toLocaleString()}
                      </div>
                    )}
                    {warningCount > 0 && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-600" title="Missing metadata, stale, or scheduling issue — open the article for details">
                        <AlertTriangle className="h-3 w-3" />
                        {warningCount} warning{warningCount > 1 ? 's' : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusColors[article.status] || ''}`}>
                      {article.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{article.author?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{article.category?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(article.updatedAt || article.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      {getArticleActions(article, hasPermission, currentUserId).map((a) => {
                        const Icon = actionIcons[a.action];
                        return (
                          <button
                            key={a.action}
                            onClick={() => handleAction(article, a.action)}
                            className={`rounded p-1.5 hover:bg-gray-100 ${a.action === 'delete' ? 'text-red-600' : 'text-gray-500'}`}
                            title={a.label}
                            aria-label={`${a.label}: ${article.title}`}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} articles)</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))} disabled={page === data.meta.totalPages} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
