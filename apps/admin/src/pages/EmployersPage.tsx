import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Edit, X } from 'lucide-react';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';

interface EmployerItem {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  industry: string | null;
  contactEmail: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  logo?: { publicUrl: string } | null;
  location?: { name: string } | null;
  _count?: { jobs: number };
}

export default function EmployersPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('job.manage_employers');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EmployerItem | null>(null);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ data: EmployerItem[]; meta: { page: number; totalPages: number; total: number } }>({
    queryKey: ['employers-admin', page, search],
    queryFn: () => apiFetch(`/employers?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => apiFetch('/employers', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employers-admin'] }); closeModal(); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, 'Failed to create employer')),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: any) => apiFetch(`/employers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employers-admin'] }); closeModal(); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, 'Failed to update employer')),
  });

  function openCreate() {
    setEditing(null); setName(''); setWebsite(''); setIndustry(''); setDescription(''); setContactEmail(''); setStatus('ACTIVE'); setFormError(null); setModalOpen(true);
  }
  function openEdit(emp: EmployerItem) {
    setEditing(emp); setName(emp.name); setWebsite(emp.website || ''); setIndustry(emp.industry || '');
    setDescription(''); setContactEmail(emp.contactEmail || ''); setStatus(emp.status); setFormError(null); setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setFormError('Company name is required');
    const payload: any = { name, website: website || undefined, industry: industry || undefined, contactEmail: contactEmail || undefined };
    if (editing) updateMutation.mutate({ id: editing.id, ...payload, description: description || undefined, status });
    else createMutation.mutate({ ...payload, description: description || undefined });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Building2 size={24} /> Employers</h1>
        {canManage && (
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-md border border-primary-500 bg-primary-500 px-4 py-2 text-sm font-bold text-black hover:bg-primary-600 hover:text-white">
            <Plus className="h-4 w-4" /> New Employer
          </button>
        )}
      </div>

      <div className="mt-4">
        <input
          type="text" placeholder="Search employers..." aria-label="Search employers"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {isLoading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : !data?.data?.length ? (
        <div className="mt-8 text-center text-gray-500">No employers found</div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Industry</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Jobs</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{emp.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{emp.industry || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{emp.location?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{emp._count?.jobs ?? 0}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${emp.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{emp.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {canManage && (
                      <button onClick={() => openEdit(emp)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Edit" aria-label={`Edit ${emp.name}`}><Edit className="h-4 w-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} employers)</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))} disabled={page === data.meta.totalPages} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === 'Escape' && closeModal()}>
          <div role="dialog" aria-modal="true" aria-labelledby="employer-modal-title" className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="employer-modal-title" className="text-lg font-semibold text-gray-900">{editing ? 'Edit Employer' : 'New Employer'}</h2>
              <button onClick={closeModal} aria-label="Close dialog" className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="emp-name" className="block text-sm font-medium text-gray-700">Company name</label>
                <input id="emp-name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="emp-website" className="block text-sm font-medium text-gray-700">Website</label>
                <input id="emp-website" type="url" placeholder="https://example.com" value={website} onChange={(e) => setWebsite(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="emp-industry" className="block text-sm font-medium text-gray-700">Industry</label>
                <input id="emp-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="emp-email" className="block text-sm font-medium text-gray-700">Contact email</label>
                <input id="emp-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="emp-desc" className="block text-sm font-medium text-gray-700">Description</label>
                <textarea id="emp-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              {editing && (
                <div>
                  <label htmlFor="emp-status" className="block text-sm font-medium text-gray-700">Status</label>
                  <select id="emp-status" value={status} onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
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
