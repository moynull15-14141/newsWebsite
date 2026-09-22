import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';
import { buildArticleListQuery, getArticleActions } from '../lib/articles';
import { Plus, Edit, Trash2, Send, Check, Globe, Archive, ArchiveRestore, EyeOff, RotateCcw, Clock } from 'lucide-react';

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
  slug: string;
  status: string;
  scheduledAt: string | null;
  author: { id: string; name: string };
  category?: { id: string; name: string };
  location?: { id: string; name: string };
  createdAt: string;
  publishedAt: string | null;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  IN_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-red-100 text-red-700',
};

export default function ArticlesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { data, isLoading } = useQuery({
    queryKey: ['articles', page, search, statusFilter, categoryFilter, languageFilter],
    queryFn: () =>
      apiFetch<{
        data: Article[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      }>(buildArticleListQuery({ page, search, status: statusFilter, categoryId: categoryFilter, languageId: languageFilter })),
  });

  const { data: categories } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['categories'],
    queryFn: () => apiFetch('/categories'),
  });

  const { data: languages } = useQuery<{ id: string; code: string; nativeName: string }[]>({
    queryKey: ['languages'],
    queryFn: () => apiFetch('/languages'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/articles/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['articles'] }),
  });

  const workflowMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      apiFetch(`/articles/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['articles'] }),
  });

  const returnToDraftMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/articles/${id}/return-to-draft`, { method: 'POST', body: JSON.stringify({ reason: reason || undefined }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['articles'] }),
  });

  const handleAction = (article: Article, action: string) => {
    if (action === 'edit') {
      navigate(`/articles/${article.id}/edit`);
    } else if (action === 'delete') {
      if (confirm('Are you sure you want to delete this article?')) {
        deleteMutation.mutate(article.id);
      }
    } else if (action === 'return-to-draft') {
      const reason = window.prompt('Why is this being sent back? The author will see this reason.');
      if (reason === null) return; // cancelled
      returnToDraftMutation.mutate({ id: article.id, reason });
    } else {
      workflowMutation.mutate({ id: article.id, action });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Articles</h1>
        {hasPermission('article.create') && (
          <Link
            to="/articles/new"
            className="inline-flex items-center gap-2 rounded-md border border-primary-500 bg-primary-500 px-4 py-2 text-sm font-bold text-black hover:bg-primary-600 hover:text-white"
          >
            <Plus className="h-4 w-4" />
            New Article
          </Link>
        )}
      </div>

      {(workflowMutation.isError || deleteMutation.isError || returnToDraftMutation.isError) && (
        <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {getApiErrorMessage(workflowMutation.error ?? deleteMutation.error ?? returnToDraftMutation.error, 'Action failed. Please try again.')}
        </p>
      )}

      <div className="mt-6 flex gap-4">
        <input
          type="text"
          placeholder="Search articles..."
          aria-label="Search articles"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="Filter by status"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="APPROVED">Approved</option>
          <option value="PUBLISHED">Published</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          aria-label="Filter by category"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All Categories</option>
          {categories?.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <select
          value={languageFilter}
          onChange={(e) => { setLanguageFilter(e.target.value); setPage(1); }}
          aria-label="Filter by language"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All Languages</option>
          {languages?.map((lang) => (
            <option key={lang.id} value={lang.id}>{lang.nativeName}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : !data?.data?.length ? (
        <div className="mt-8 text-center text-gray-500">No articles found</div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Author</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Updated</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Scheduled</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((article) => (
                <tr key={article.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{article.title}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusColors[article.status] || ''}`}>
                      {article.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{article.category?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{article.author?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(article.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {article.scheduledAt ? (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-blue-500" />
                        {new Date(article.scheduledAt).toLocaleString()}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
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
                            aria-label={a.label}
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
          <p className="text-sm text-gray-500">
            Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} articles)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
              disabled={page === data.meta.totalPages}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
