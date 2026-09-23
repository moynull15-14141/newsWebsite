import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Plus, Edit, Archive, X } from 'lucide-react';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';

interface JobCategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  sortOrder: number;
  _count?: { jobs: number };
}

function generateSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function JobCategoriesPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('job.manage_categories');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JobCategoryItem | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery<JobCategoryItem[]>({
    queryKey: ['job-categories-admin'],
    queryFn: () => apiFetch('/job-categories?includeInactive=true'),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; slug: string; description?: string; sortOrder?: number }) =>
      apiFetch('/job-categories', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['job-categories-admin'] }); queryClient.invalidateQueries({ queryKey: ['job-categories'] }); closeModal(); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, 'Failed to create category')),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; description?: string; sortOrder?: number; status?: string }) =>
      apiFetch(`/job-categories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['job-categories-admin'] }); queryClient.invalidateQueries({ queryKey: ['job-categories'] }); closeModal(); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, 'Failed to update category')),
  });
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/job-categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-categories-admin'] }),
  });

  function openCreate() {
    setEditing(null); setName(''); setSlug(''); setDescription(''); setSortOrder(0); setFormError(null); setModalOpen(true);
  }
  function openEdit(cat: JobCategoryItem) {
    setEditing(cat); setName(cat.name); setSlug(cat.slug); setDescription(cat.description || ''); setSortOrder(cat.sortOrder); setFormError(null); setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setFormError('Name is required');
    if (editing) updateMutation.mutate({ id: editing.id, name, description: description || undefined, sortOrder });
    else createMutation.mutate({ name, slug: slug || generateSlug(name), description: description || undefined, sortOrder });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><FolderKanban size={24} /> Job Categories</h1>
        {canManage && (
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-md border border-primary-500 bg-primary-500 px-4 py-2 text-sm font-bold text-black hover:bg-primary-600 hover:text-white">
            <Plus className="h-4 w-4" /> New Category
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Slug</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Jobs</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{cat.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{cat.slug}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{cat._count?.jobs ?? 0}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${cat.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{cat.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(cat)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Edit" aria-label={`Edit ${cat.name}`}><Edit className="h-4 w-4" /></button>
                        {cat.status === 'ACTIVE' && (
                          <button onClick={() => { if (confirm(`Deactivate "${cat.name}"? It will be hidden from public filters.`)) deactivateMutation.mutate(cat.id); }} className="rounded p-1.5 text-red-600 hover:bg-gray-100" title="Deactivate" aria-label={`Deactivate ${cat.name}`}><Archive className="h-4 w-4" /></button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === 'Escape' && closeModal()}>
          <div role="dialog" aria-modal="true" aria-labelledby="job-category-modal-title" className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="job-category-modal-title" className="text-lg font-semibold text-gray-900">{editing ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={closeModal} aria-label="Close dialog" className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="jc-name" className="block text-sm font-medium text-gray-700">Name</label>
                <input id="jc-name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              {!editing && (
                <div>
                  <label htmlFor="jc-slug" className="block text-sm font-medium text-gray-700">Slug (optional)</label>
                  <input id="jc-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={generateSlug(name) || 'auto-generated'} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
              )}
              <div>
                <label htmlFor="jc-desc" className="block text-sm font-medium text-gray-700">Description</label>
                <textarea id="jc-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="jc-order" className="block text-sm font-medium text-gray-700">Sort order</label>
                <input id="jc-order" type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">
                  {editing ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
