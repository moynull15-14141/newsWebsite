import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag as TagIcon, Plus, Edit, Trash2, Search, X, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';

interface TagTranslation {
  languageId: string;
  name: string;
}

interface TagItem {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  _count?: { articleTags: number };
  translations?: TagTranslation[];
}

interface LanguageOption {
  id: string;
  code: string;
  name: string;
  nativeName: string;
}

interface TagsResponse {
  data: TagItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function generateSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function TagsPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canEdit = hasPermission('article.edit');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [translationNames, setTranslationNames] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<TagsResponse>({
    queryKey: ['tags-admin', page, search, statusFilter],
    queryFn: () =>
      apiFetch<TagsResponse>(
        `/tags?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}${
          statusFilter !== 'ACTIVE' ? '&all=true' : ''
        }`,
      ),
  });

  const { data: languages = [] } = useQuery<LanguageOption[]>({ queryKey: ['languages'], queryFn: () => apiFetch('/languages') });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; slug: string; status: string; translations?: TagTranslation[] }) =>
      apiFetch('/tags', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags-admin'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      closeModal();
    },
    onError: (err: unknown) => {
      setFormError(getApiErrorMessage(err, 'Failed to create tag'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name: string; slug: string; status: string; translations?: TagTranslation[] }) =>
      apiFetch(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags-admin'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      closeModal();
    },
    onError: (err: unknown) => {
      setFormError(getApiErrorMessage(err, 'Failed to update tag'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags-admin'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (err: unknown) => {
      alert(getApiErrorMessage(err, 'Failed to delete tag'));
    },
  });

  const openCreateModal = () => {
    setEditingTag(null);
    setName('');
    setSlug('');
    setSlugManuallyEdited(false);
    setStatus('ACTIVE');
    setTranslationNames({});
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (tag: TagItem) => {
    setEditingTag(tag);
    setName(tag.name);
    setSlug(tag.slug);
    setSlugManuallyEdited(true);
    setStatus(tag.status);
    setTranslationNames(Object.fromEntries((tag.translations ?? []).map((t) => [t.languageId, t.name])));
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTag(null);
    setFormError(null);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugManuallyEdited) {
      setSlug(generateSlug(val));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Tag name is required');
      return;
    }
    if (!slug.trim()) {
      setFormError('Slug is required');
      return;
    }

    const translations = languages
      .map((lang) => ({ languageId: lang.id, name: (translationNames[lang.id] || '').trim() }))
      .filter((t) => t.name);

    const payload = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      status,
      translations,
    };

    if (editingTag) {
      updateMutation.mutate({ id: editingTag.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (tag: TagItem) => {
    const usageCount = tag._count?.articleTags || 0;
    const confirmMessage =
      usageCount > 0
        ? `Tag "${tag.name}" is attached to ${usageCount} article(s). Deleting it will remove the tag from those articles. Are you sure you want to delete it?`
        : `Are you sure you want to delete tag "${tag.name}"?`;

    if (confirm(confirmMessage)) {
      deleteMutation.mutate(tag.id);
    }
  };

  const tags = data?.data || [];
  const meta = data?.meta || { page: 1, totalPages: 1, total: 0 };

  const displayedTags =
    statusFilter === 'ALL'
      ? tags
      : tags.filter((t) => t.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <TagIcon className="h-6 w-6 text-primary-500" />
            Tags
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage keywords and topics for cross-referencing news stories.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition"
          >
            <Plus className="h-4 w-4" />
            New Tag
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tags by name or slug..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE');
              setPage(1);
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          <button
            onClick={() => refetch()}
            title="Refresh list"
            className="rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 transition"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tags Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading tags...</div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-500">Failed to load tags. Please try again.</div>
        ) : displayedTags.length === 0 ? (
          <div className="p-12 text-center">
            <TagIcon className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-900">No tags found</p>
            <p className="mt-1 text-sm text-gray-500">
              {search ? 'Try adjusting your search criteria.' : 'Create tags to organize topics and stories.'}
            </p>
            {canEdit && !search && (
              <button
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                <Plus className="h-4 w-4" />
                Add Tag
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Name & Slug</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Articles Tagged</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {displayedTags.map((tag) => (
                  <tr key={tag.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{tag.name}</div>
                      <div className="text-xs text-gray-500 font-mono">#{tag.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                        {tag._count?.articleTags ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          tag.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {tag.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                          <>
                            <button
                              onClick={() => openEditModal(tag)}
                              title="Edit Tag"
                              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-primary-600"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(tag)}
                              title="Delete Tag"
                              className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <div className="text-xs text-gray-500">
              Showing page {meta.page} of {meta.totalPages} ({meta.total} tags)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={meta.page <= 1}
                className="rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={meta.page >= meta.totalPages}
                className="rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tag Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingTag ? 'Edit Tag' : 'Create New Tag'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Tag Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Bangladesh Cricket, Metro Rail"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugManuallyEdited(true);
                  }}
                  placeholder="e.g. bangladesh-cricket"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              {languages.length > 0 && (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-700">Localized names</p>
                  <p className="mt-0.5 text-xs text-gray-500">Optional — the same tag, shown in each language.</p>
                  <div className="mt-2 space-y-2">
                    {languages.map((lang) => (
                      <label key={lang.id} className="flex items-center gap-2 text-sm">
                        <span className="w-16 shrink-0 text-xs font-semibold text-gray-500">{lang.nativeName}</span>
                        <input
                          value={translationNames[lang.id] || ''}
                          onChange={(e) => setTranslationNames({ ...translationNames, [lang.id]: e.target.value })}
                          placeholder={lang.code === 'bn' ? 'যেমন নির্বাচন' : name || lang.name}
                          className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {editingTag ? 'Save Changes' : 'Create Tag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

