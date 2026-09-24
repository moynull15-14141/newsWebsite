import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Handshake, Plus, Edit, X, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, getApiErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/auth-store';

interface Advertiser {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  active: boolean;
  _count?: { campaigns: number };
}

interface FormState {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  active: boolean;
}

const emptyForm: FormState = { name: '', contactName: '', contactEmail: '', contactPhone: '', notes: '', active: true };

export default function AdsAdvertisersPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate = hasPermission('ads.create');
  const canUpdate = hasPermission('ads.update');
  const canDelete = hasPermission('ads.delete');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Advertiser | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ data: Advertiser[]; meta: { page: number; totalPages: number; total: number } }>({
    queryKey: ['advertisers', page, search],
    queryFn: () => apiFetch(`/advertisers?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  });

  const createMutation = useMutation({
    mutationFn: () => apiFetch('/advertisers', { method: 'POST', body: JSON.stringify({ ...form, contactName: form.contactName || undefined, contactEmail: form.contactEmail || undefined, contactPhone: form.contactPhone || undefined, notes: form.notes || undefined }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['advertisers'] }); closeModal(); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, 'Failed to create advertiser')),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: FormState & { id: string }) => apiFetch(`/advertisers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['advertisers'] }); closeModal(); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, 'Failed to update advertiser')),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/advertisers/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['advertisers'] }),
  });

  function openCreate() { setEditing(null); setForm(emptyForm); setFormError(null); setModalOpen(true); }
  function openEdit(a: Advertiser) {
    setEditing(a);
    setForm({ name: a.name, contactName: a.contactName || '', contactEmail: a.contactEmail || '', contactPhone: a.contactPhone || '', notes: '', active: a.active });
    setFormError(null);
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setFormError('Advertiser name is required');
    if (editing) updateMutation.mutate({ id: editing.id, ...form });
    else createMutation.mutate();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Handshake size={24} /> Advertisers</h1>
        {canCreate && (
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">
            <Plus className="h-4 w-4" /> New advertiser
          </button>
        )}
      </div>

      <div className="mt-4">
        <input
          type="text" placeholder="Search advertisers..." aria-label="Search advertisers"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {isLoading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : !data?.data?.length ? (
        <div className="mt-8 text-center text-gray-500">No advertisers found</div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Contact', 'Campaigns', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                  <td className="px-4 py-3 text-gray-600">{a.contactEmail || a.contactName || '-'}</td>
                  <td className="px-4 py-3">
                    <Link to={`/ads/campaigns?advertiserId=${a.id}`} className="text-primary-600 hover:underline">{a._count?.campaigns ?? 0}</Link>
                  </td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${a.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{a.active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {canUpdate && <button onClick={() => openEdit(a)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Edit" aria-label={`Edit ${a.name}`}><Edit className="h-4 w-4" /></button>}
                      {canDelete && (a._count?.campaigns ?? 0) === 0 && (
                        <button onClick={() => { if (confirm(`Delete ${a.name}?`)) deleteMutation.mutate(a.id); }} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Delete" aria-label={`Delete ${a.name}`}><Trash2 className="h-4 w-4" /></button>
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
          <p className="text-sm text-gray-500">Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} advertisers)</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))} disabled={page === data.meta.totalPages} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === 'Escape' && closeModal()}>
          <div role="dialog" aria-modal="true" aria-labelledby="advertiser-modal-title" className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="advertiser-modal-title" className="text-lg font-semibold text-gray-900">{editing ? 'Edit Advertiser' : 'New Advertiser'}</h2>
              <button onClick={closeModal} aria-label="Close dialog" className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="adv-name" className="block text-sm font-medium text-gray-700">Advertiser name</label>
                <input id="adv-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="adv-contact-name" className="block text-sm font-medium text-gray-700">Contact name</label>
                <input id="adv-contact-name" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="adv-email" className="block text-sm font-medium text-gray-700">Contact email</label>
                <input id="adv-email" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="adv-phone" className="block text-sm font-medium text-gray-700">Contact phone</label>
                <input id="adv-phone" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              {editing && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
                </label>
              )}
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
