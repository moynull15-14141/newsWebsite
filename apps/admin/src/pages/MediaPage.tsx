import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';
import { formatFileSize } from '../lib/media';
import { Upload, Search, Trash2, Edit, X, Image as ImageIcon, RefreshCw } from 'lucide-react';

interface MediaItem {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  publicUrl: string;
  altText: string | null;
  caption: string | null;
  credit: string | null;
  width: number | null;
  height: number | null;
  status: 'UPLOADING' | 'READY' | 'FAILED' | 'DELETED';
  uploadedBy: { id: string; name: string };
  createdAt: string;
}

const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function MediaPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [status, setStatus] = useState('');
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [altText, setAltText] = useState('');
  const [caption, setCaption] = useState('');
  const [credit, setCredit] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const { data, isLoading } = useQuery({
    queryKey: ['media', page, search, mimeType, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (mimeType) params.set('mimeType', mimeType);
      if (status) params.set('status', status);
      return apiFetch<{
        data: MediaItem[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      }>(`/media?${params.toString()}`);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch('/media', { method: 'POST', body: formData, headers: {} });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media'] }),
  });

  const replaceMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch(`/media/${id}/replace`, { method: 'POST', body: formData, headers: {} });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...dto }: { id: string; altText?: string; caption?: string; credit?: string }) =>
      apiFetch(`/media/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setEditingItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/media/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media'] }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleEdit = (item: MediaItem) => {
    setEditingItem(item);
    setAltText(item.altText || '');
    setCaption(item.caption || '');
    setCredit(item.credit || '');
  };

  const handleSaveEdit = () => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, altText, caption, credit });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this media item?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleReplaceClick = (id: string) => {
    setReplaceTargetId(id);
    replaceInputRef.current?.click();
  };

  const handleReplaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && replaceTargetId) {
      replaceMutation.mutate({ id: replaceTargetId, file });
      if (replaceInputRef.current) replaceInputRef.current.value = '';
      setReplaceTargetId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
        {hasPermission('media.upload') && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleReplaceFileChange}
          className="hidden"
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search media..."
            aria-label="Search media"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <select
          value={mimeType}
          onChange={(e) => { setMimeType(e.target.value); setPage(1); }}
          aria-label="Filter by file type"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All types</option>
          {MIME_TYPES.map((m) => <option key={m} value={m}>{m.replace('image/', '')}</option>)}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          aria-label="Filter by status"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All statuses</option>
          <option value="READY">Ready</option>
          <option value="UPLOADING">Uploading</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {uploadMutation.isError && (
        <div role="alert" className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
          Upload failed: {getApiErrorMessage(uploadMutation.error, 'Please try again.')}
        </div>
      )}

      {replaceMutation.isError && (
        <div role="alert" className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
          Replace failed: {getApiErrorMessage(replaceMutation.error, 'Please try again.')}
        </div>
      )}

      {deleteMutation.isError && (
        <div role="alert" className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
          {getApiErrorMessage(deleteMutation.error, 'Delete failed. Please try again.')}
        </div>
      )}

      {isLoading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : !data?.data?.length ? (
        <div className="mt-16 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-500">No media files found</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {data.data.map((item) => (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white"
            >
              <div className="aspect-square overflow-hidden bg-gray-100">
                {item.status === 'READY' ? (
                  <img
                    src={item.publicUrl}
                    alt={item.altText || item.originalFilename}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase text-gray-400">{item.status}</div>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-xs text-gray-700" title={item.originalFilename}>
                  {item.originalFilename}
                </p>
                <p className="text-xs text-gray-400">
                  {item.width && item.height ? `${item.width}×${item.height}` : 'N/A'} · {formatFileSize(item.size)}
                </p>
                <p className="text-xs text-gray-400">{item.uploadedBy?.name}</p>
                <p className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {hasPermission('media.upload') && (
                  <button
                    onClick={() => handleReplaceClick(item.id)}
                    aria-label={`Replace ${item.originalFilename}`}
                    className="rounded bg-white p-1.5 shadow-sm hover:bg-gray-100"
                  >
                    <RefreshCw className="h-3 w-3 text-gray-600" />
                  </button>
                )}
                {hasPermission('media.manage') && (
                  <button
                    onClick={() => handleEdit(item)}
                    aria-label={`Edit ${item.originalFilename}`}
                    className="rounded bg-white p-1.5 shadow-sm hover:bg-gray-100"
                  >
                    <Edit className="h-3 w-3 text-gray-600" />
                  </button>
                )}
                {hasPermission('media.manage') && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    aria-label={`Delete ${item.originalFilename}`}
                    className="rounded bg-white p-1.5 shadow-sm hover:bg-gray-100"
                  >
                    <Trash2 className="h-3 w-3 text-red-600" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} items)
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

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="edit-media-title">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="edit-media-title" className="text-lg font-semibold text-gray-900">Edit Media</h2>
              <button onClick={() => setEditingItem(null)} aria-label="Close" className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4">
              <img
                src={editingItem.publicUrl}
                alt={editingItem.altText || editingItem.originalFilename}
                className="mb-4 w-full rounded-md object-cover"
                style={{ maxHeight: 200 }}
              />
              <div className="space-y-4">
                <div>
                  <label htmlFor="media-alt-text" className="block text-sm font-medium text-gray-700">Alt Text</label>
                  <input
                    id="media-alt-text"
                    type="text"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="media-caption" className="block text-sm font-medium text-gray-700">Caption</label>
                  <textarea
                    id="media-caption"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="media-credit" className="block text-sm font-medium text-gray-700">Credit</label>
                  <input
                    id="media-credit"
                    type="text"
                    value={credit}
                    onChange={(e) => setCredit(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditingItem(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={updateMutation.isPending}
                className="rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
