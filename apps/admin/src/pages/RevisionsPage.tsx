import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { ArrowLeft, RotateCcw } from 'lucide-react';

interface Revision {
  id: string;
  version: number;
  title: string;
  excerpt: string | null;
  slug: string;
  status: string;
  changeReason: string | null;
  createdAt: string;
  changedBy: { id: string; name: string; email: string };
}

export default function RevisionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: revisions, isLoading } = useQuery<Revision[]>({
    queryKey: ['revisions', id],
    queryFn: () => apiFetch(`/articles/${id}/revisions`),
    enabled: !!id,
  });

  const { data: article } = useQuery<{ id: string; title: string }>({
    queryKey: ['article', id],
    queryFn: () => apiFetch(`/articles/${id}`),
    enabled: !!id,
  });

  const restoreMutation = useMutation({
    mutationFn: (revisionId: string) =>
      apiFetch(`/articles/${id}/revisions/${revisionId}/restore`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      queryClient.invalidateQueries({ queryKey: ['revisions', id] });
      navigate(`/articles/${id}/edit`);
    },
  });

  const handleRestore = (revisionId: string, version: number) => {
    if (confirm(`Are you sure you want to restore revision #${version}? This will overwrite the current article content.`)) {
      restoreMutation.mutate(revisionId);
    }
  };

  if (isLoading) {
    return <div className="text-center text-gray-500">Loading revisions...</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/articles')} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revisions</h1>
          {article && (
            <p className="text-sm text-gray-500">{article.title}</p>
          )}
        </div>
      </div>

      {id && (
        <div className="mt-4">
          <Link
            to={`/articles/${id}/edit`}
            className="text-sm font-medium text-primary-500 hover:text-primary-600"
          >
            Back to editor
          </Link>
        </div>
      )}

      {!revisions?.length ? (
        <div className="mt-8 text-center text-gray-500">No revisions found</div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Version</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Editor</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {revisions.map((revision) => (
                <tr key={revision.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    #{revision.version}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{revision.title}</div>
                    {revision.excerpt && (
                      <div className="mt-1 text-xs text-gray-500 line-clamp-1">{revision.excerpt}</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {revision.changedBy?.name || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                      {revision.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {revision.changeReason || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(revision.createdAt).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => handleRestore(revision.id, revision.version)}
                        disabled={restoreMutation.isPending}
                        className="inline-flex items-center gap-1 rounded bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                        title="Restore this revision"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
