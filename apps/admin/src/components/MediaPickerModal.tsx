import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Upload, Search } from 'lucide-react';
import { apiFetch } from '../lib/api';

export interface MediaItem {
  id: string;
  publicUrl: string;
  altText?: string | null;
  originalFilename?: string;
}

interface MediaResponse {
  data: MediaItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** Small reusable image picker (search existing library + upload new) — reuses the existing Media
 * abstraction (`GET/POST /media`) rather than inventing ad-specific upload plumbing, same pattern
 * ArticleEditorPage inlines for its own featured-image picker, pulled out here so Ad creatives (and any
 * future caller) share one implementation instead of a second copy. */
export default function MediaPickerModal({ onSelect, onClose }: { onSelect: (media: MediaItem) => void; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<MediaResponse>({
    queryKey: ['media-picker', page, search],
    queryFn: () => apiFetch(`/media?page=${page}&limit=15${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch<MediaItem>('/media', { method: 'POST', body: formData });
    },
    onSuccess: (media) => {
      queryClient.invalidateQueries({ queryKey: ['media-picker'] });
      onSelect(media);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Select media" className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Select image</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text" placeholder="Search media..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={upload.isPending}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" /> {upload.isPending ? 'Uploading...' : 'Upload'}
          </button>
          <input
            ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }}
          />
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-gray-500">Loading...</p>
          ) : !data?.data?.length ? (
            <p className="py-8 text-center text-sm text-gray-500">No media found</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {data.data.map((m) => (
                <button
                  key={m.id} type="button" onClick={() => onSelect(m)}
                  className="group relative aspect-square overflow-hidden rounded border border-gray-200 hover:border-primary-500"
                  title={m.originalFilename || m.altText || ''}
                >
                  <img src={m.publicUrl} alt={m.altText || ''} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {data?.meta && data.meta.totalPages > 1 && (
          <div className="mt-3 flex justify-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))} disabled={page === data.meta.totalPages} className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
