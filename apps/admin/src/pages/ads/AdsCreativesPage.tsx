import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ImagePlus, ImageOff, Plus, Edit, Trash2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuthStore } from '../../stores/auth-store';
import CreativeFormModal from '../../components/CreativeFormModal';

interface CreativeRow {
  id: string;
  campaignId: string;
  type: string;
  desktopMedia?: { id: string; publicUrl: string } | null;
  mobileMedia?: { id: string; publicUrl: string } | null;
  targetUrl: string | null;
  ctaText: string | null;
  altText: string | null;
  nativeHeadline: string | null;
  nativeBody: string | null;
  active: boolean;
  rotationWeight: number;
  campaign: { id: string; name: string; status: string; advertiser: { id: string; name: string } };
}

export default function AdsCreativesPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate = hasPermission('ads.create');
  const canUpdate = hasPermission('ads.update');
  const canDelete = hasPermission('ads.delete');
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingCreative, setEditingCreative] = useState<CreativeRow | null>(null);

  const { data, isLoading } = useQuery<{ data: CreativeRow[]; meta: { page: number; totalPages: number; total: number } }>({
    queryKey: ['ad-creatives-all', page],
    queryFn: () => apiFetch(`/ad-creatives?page=${page}&limit=20`),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => apiFetch(`/ad-creatives/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ad-creatives-all'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/ad-creatives/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ad-creatives-all'] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><ImagePlus size={24} /> Creatives</h1>
          <p className="mt-1 text-sm text-gray-500">Every creative across every campaign.</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditingCreative(null); setFormMode('create'); }} className="inline-flex items-center gap-2 rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">
            <Plus className="h-4 w-4" /> Add creative
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : !data?.data?.length ? (
        <div className="mt-8 text-center text-gray-500">No creatives yet</div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Preview', 'Type', 'Campaign', 'Advertiser', 'Weight', 'Active', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {c.desktopMedia ? <img src={c.desktopMedia.publicUrl} alt="" className="h-10 w-14 rounded object-cover" /> : <div className="flex h-10 w-14 items-center justify-center rounded bg-gray-100 text-gray-400"><ImageOff className="h-4 w-4" /></div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3"><Link to={`/ads/campaigns/${c.campaign.id}`} className="font-medium text-primary-600 hover:underline">{c.campaign.name}</Link></td>
                  <td className="px-4 py-3 text-gray-600">{c.campaign.advertiser.name}</td>
                  <td className="px-4 py-3">{c.rotationWeight}</td>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={c.active} onChange={(e) => toggleMutation.mutate({ id: c.id, active: e.target.checked })} disabled={!canUpdate} aria-label="Active" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {canUpdate && (
                        <button onClick={() => { setEditingCreative(c); setFormMode('edit'); }} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Edit creative"><Edit className="h-4 w-4" /></button>
                      )}
                      {canDelete && (
                        <button onClick={() => { if (confirm('Delete this creative?')) deleteMutation.mutate(c.id); }} className="rounded p-1.5 text-red-600 hover:bg-red-50" aria-label="Delete creative"><Trash2 className="h-4 w-4" /></button>
                      )}
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
          <p className="text-sm text-gray-500">Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} creatives)</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))} disabled={page === data.meta.totalPages} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {formMode && (
        <CreativeFormModal
          mode={formMode}
          creative={editingCreative ?? undefined}
          onClose={() => { setFormMode(null); setEditingCreative(null); }}
          onSaved={() => { setFormMode(null); setEditingCreative(null); }}
        />
      )}
    </div>
  );
}
