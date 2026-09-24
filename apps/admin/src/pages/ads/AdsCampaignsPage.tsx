import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Rocket, Plus, X } from 'lucide-react';
import { apiFetch, getApiErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/auth-store';

interface Campaign {
  id: string;
  name: string;
  status: string;
  startAt: string | null;
  endAt: string | null;
  priority: number;
  advertiser: { id: string; name: string };
  _count: { creatives: number; placements: number };
}

interface Advertiser { id: string; name: string }

const STATUSES = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED'];
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING_REVIEW: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  SCHEDULED: 'bg-purple-100 text-purple-700',
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-orange-100 text-orange-700',
  EXPIRED: 'bg-red-100 text-red-700',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

export default function AdsCampaignsPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate = hasPermission('ads.create');

  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const status = searchParams.get('status') || '';
  const advertiserId = searchParams.get('advertiserId') || '';

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', advertiserId: '', startAt: '', endAt: '', priority: '0', targetUrl: '' });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: advertisers } = useQuery<{ data: Advertiser[] }>({ queryKey: ['advertisers-all'], queryFn: () => apiFetch('/advertisers?limit=100') });

  const { data, isLoading } = useQuery<{ data: Campaign[]; meta: { page: number; totalPages: number; total: number } }>({
    queryKey: ['ad-campaigns', page, search, status, advertiserId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (advertiserId) params.set('advertiserId', advertiserId);
      return apiFetch(`/ad-campaigns?${params.toString()}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: () => apiFetch('/ad-campaigns', {
      method: 'POST',
      body: JSON.stringify({
        name: form.name, advertiserId: form.advertiserId,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
        priority: Number(form.priority) || 0,
        targetUrl: form.targetUrl || undefined,
      }),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ad-campaigns'] }); setModalOpen(false); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, 'Failed to create campaign')),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setFormError('Campaign name is required');
    if (!form.advertiserId) return setFormError('Select an advertiser');
    createMutation.mutate();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Rocket size={24} /> Campaigns</h1>
        {canCreate && (
          <button onClick={() => { setForm({ name: '', advertiserId: '', startAt: '', endAt: '', priority: '0', targetUrl: '' }); setFormError(null); setModalOpen(true); }} className="inline-flex items-center gap-2 rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">
            <Plus className="h-4 w-4" /> New campaign
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          type="text" placeholder="Search campaigns..." aria-label="Search campaigns"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <select
          value={status} aria-label="Filter by status"
          onChange={(e) => { setSearchParams((p) => { const n = new URLSearchParams(p); if (e.target.value) n.set('status', e.target.value); else n.delete('status'); return n; }); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select
          value={advertiserId} aria-label="Filter by advertiser"
          onChange={(e) => { setSearchParams((p) => { const n = new URLSearchParams(p); if (e.target.value) n.set('advertiserId', e.target.value); else n.delete('advertiserId'); return n; }); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All advertisers</option>
          {advertisers?.data.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : !data?.data?.length ? (
        <div className="mt-8 text-center text-gray-500">No campaigns found</div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Campaign', 'Advertiser', 'Status', 'Schedule', 'Priority', 'Creatives', 'Placements'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><Link to={`/ads/campaigns/${c.id}`} className="font-medium text-primary-600 hover:underline">{c.name}</Link></td>
                  <td className="px-4 py-3 text-gray-600">{c.advertiser.name}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[c.status] || ''}`}>{c.status.replace('_', ' ')}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{c.startAt ? new Date(c.startAt).toLocaleDateString() : 'Not set'} – {c.endAt ? new Date(c.endAt).toLocaleDateString() : 'Open'}</td>
                  <td className="px-4 py-3">{c.priority}</td>
                  <td className="px-4 py-3">{c._count.creatives}</td>
                  <td className="px-4 py-3">{c._count.placements}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} campaigns)</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))} disabled={page === data.meta.totalPages} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === 'Escape' && setModalOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="campaign-modal-title" className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="campaign-modal-title" className="text-lg font-semibold text-gray-900">New Campaign</h2>
              <button onClick={() => setModalOpen(false)} aria-label="Close dialog" className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="camp-name" className="block text-sm font-medium text-gray-700">Campaign name</label>
                <input id="camp-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="camp-advertiser" className="block text-sm font-medium text-gray-700">Advertiser</label>
                <select id="camp-advertiser" required value={form.advertiserId} onChange={(e) => setForm({ ...form, advertiserId: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Select advertiser...</option>
                  {advertisers?.data.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="camp-start" className="block text-sm font-medium text-gray-700">Start date</label>
                  <input id="camp-start" type="date" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label htmlFor="camp-end" className="block text-sm font-medium text-gray-700">End date</label>
                  <input id="camp-end" type="date" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label htmlFor="camp-target-url" className="block text-sm font-medium text-gray-700">Target URL</label>
                <input id="camp-target-url" type="url" placeholder="https://example.com" value={form.targetUrl} onChange={(e) => setForm({ ...form, targetUrl: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="camp-priority" className="block text-sm font-medium text-gray-700">Priority</label>
                <input id="camp-priority" type="number" min={0} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
