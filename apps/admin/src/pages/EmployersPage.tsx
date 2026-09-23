import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Edit, X, ShieldCheck, ShieldX, Ban, RotateCcw, Info } from 'lucide-react';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';

interface EmployerPayload {
  name?: string;
  website?: string;
  industry?: string;
  contactEmail?: string;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

interface EmployerItem {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  industry: string | null;
  contactEmail: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  logo?: { publicUrl: string } | null;
  location?: { name: string } | null;
  _count?: { jobs: number };
  isSelfService?: boolean;
  verificationStatus?: VerificationStatus;
  verificationNote?: string | null;
}

interface AuditLogEntry {
  id: string;
  action: string;
  note: string | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
}

interface MemberRow {
  id: string;
  role: string;
  status: string;
  user: { id: string; name: string; email: string };
}

const VERIFICATION_COLORS: Record<VerificationStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  VERIFIED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export default function EmployersPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('job.manage_employers');
  const canVerify = hasPermission('employer.verify');
  const canSuspend = hasPermission('employer.suspend');

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

  const [verifyTarget, setVerifyTarget] = useState<EmployerItem | null>(null);
  const [verifyDecision, setVerifyDecision] = useState<'VERIFIED' | 'REJECTED'>('VERIFIED');
  const [verifyNote, setVerifyNote] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [detailTarget, setDetailTarget] = useState<EmployerItem | null>(null);

  const { data, isLoading } = useQuery<{ data: EmployerItem[]; meta: { page: number; totalPages: number; total: number } }>({
    queryKey: ['employers-admin', page, search],
    queryFn: () => apiFetch(`/employers?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  });

  const { data: auditLog, isLoading: auditLoading } = useQuery<{ data: AuditLogEntry[] }>({
    queryKey: ['employer-audit-log', detailTarget?.id],
    queryFn: () => apiFetch(`/employers/${detailTarget!.id}/audit-log?limit=20`),
    enabled: !!detailTarget,
  });
  const { data: members, isLoading: membersLoading } = useQuery<MemberRow[]>({
    queryKey: ['employer-members', detailTarget?.id],
    queryFn: () => apiFetch(`/employers/${detailTarget!.id}/members`),
    enabled: !!detailTarget,
  });

  const createMutation = useMutation({
    mutationFn: (payload: EmployerPayload) => apiFetch('/employers', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employers-admin'] }); closeModal(); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, 'Failed to create employer')),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: EmployerPayload & { id: string }) => apiFetch(`/employers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employers-admin'] }); closeModal(); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, 'Failed to update employer')),
  });
  const verifyMutation = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'VERIFIED' | 'REJECTED'; note?: string }) =>
      apiFetch(`/employers/${id}/verify`, { method: 'PATCH', body: JSON.stringify({ decision, note: note || undefined }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employers-admin'] }); setVerifyTarget(null); },
    onError: (err: unknown) => setVerifyError(getApiErrorMessage(err, 'Failed to record verification decision')),
  });
  const suspendMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/employers/${id}/suspend`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employers-admin'] }),
  });
  const reactivateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/employers/${id}/reactivate`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employers-admin'] }),
  });

  function openCreate() {
    setEditing(null); setName(''); setWebsite(''); setIndustry(''); setDescription(''); setContactEmail(''); setStatus('ACTIVE'); setFormError(null); setModalOpen(true);
  }
  function openEdit(emp: EmployerItem) {
    setEditing(emp); setName(emp.name); setWebsite(emp.website || ''); setIndustry(emp.industry || '');
    setDescription(''); setContactEmail(emp.contactEmail || ''); setStatus(emp.status === 'SUSPENDED' ? 'INACTIVE' : emp.status); setFormError(null); setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function openVerify(emp: EmployerItem) {
    setVerifyTarget(emp); setVerifyDecision('VERIFIED'); setVerifyNote(''); setVerifyError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setFormError('Company name is required');
    const payload: EmployerPayload = { name, website: website || undefined, industry: industry || undefined, contactEmail: contactEmail || undefined };
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
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Industry</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Jobs</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Verification</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{emp.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{emp.industry || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{emp._count?.jobs ?? 0}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${emp.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : emp.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{emp.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    {emp.verificationStatus ? (
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${VERIFICATION_COLORS[emp.verificationStatus]}`}>{emp.verificationStatus}</span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setDetailTarget(emp)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Details" aria-label={`View details for ${emp.name}`}><Info className="h-4 w-4" /></button>
                      {canManage && (
                        <button onClick={() => openEdit(emp)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Edit" aria-label={`Edit ${emp.name}`}><Edit className="h-4 w-4" /></button>
                      )}
                      {canVerify && emp.verificationStatus !== 'VERIFIED' && (
                        <button onClick={() => openVerify(emp)} className="rounded p-1.5 text-green-600 hover:bg-green-50" title="Verify" aria-label={`Review verification for ${emp.name}`}><ShieldCheck className="h-4 w-4" /></button>
                      )}
                      {canVerify && emp.verificationStatus === 'VERIFIED' && (
                        <button onClick={() => openVerify(emp)} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Reject verification" aria-label={`Reject verification for ${emp.name}`}><ShieldX className="h-4 w-4" /></button>
                      )}
                      {canSuspend && emp.status !== 'SUSPENDED' && (
                        <button onClick={() => { if (confirm(`Suspend ${emp.name}? They will not be able to post or manage jobs while suspended.`)) suspendMutation.mutate(emp.id); }} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Suspend" aria-label={`Suspend ${emp.name}`}><Ban className="h-4 w-4" /></button>
                      )}
                      {canSuspend && emp.status === 'SUSPENDED' && (
                        <button onClick={() => reactivateMutation.mutate(emp.id)} className="rounded p-1.5 text-green-600 hover:bg-green-50" title="Reactivate" aria-label={`Reactivate ${emp.name}`}><RotateCcw className="h-4 w-4" /></button>
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

      {verifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === 'Escape' && setVerifyTarget(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="verify-modal-title" className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="verify-modal-title" className="text-lg font-semibold text-gray-900">Verification — {verifyTarget.name}</h2>
              <button onClick={() => setVerifyTarget(null)} aria-label="Close dialog" className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); verifyMutation.mutate({ id: verifyTarget.id, decision: verifyDecision, note: verifyNote }); }}
              className="mt-4 space-y-3"
            >
              <fieldset>
                <legend className="block text-sm font-medium text-gray-700">Decision</legend>
                <div className="mt-1 flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="radio" name="verify-decision" checked={verifyDecision === 'VERIFIED'} onChange={() => setVerifyDecision('VERIFIED')} /> Verify
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="radio" name="verify-decision" checked={verifyDecision === 'REJECTED'} onChange={() => setVerifyDecision('REJECTED')} /> Reject
                  </label>
                </div>
              </fieldset>
              <div>
                <label htmlFor="verify-note" className="block text-sm font-medium text-gray-700">Note <span className="font-normal text-gray-400">(shown to the employer if rejected)</span></label>
                <textarea id="verify-note" value={verifyNote} onChange={(e) => setVerifyNote(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              {verifyError && <p role="alert" className="text-sm text-red-600">{verifyError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setVerifyTarget(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={verifyMutation.isPending} className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">Save decision</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === 'Escape' && setDetailTarget(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="detail-modal-title" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="detail-modal-title" className="text-lg font-semibold text-gray-900">{detailTarget.name}</h2>
              <button onClick={() => setDetailTarget(null)} aria-label="Close dialog" className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>

            {detailTarget.verificationStatus === 'REJECTED' && detailTarget.verificationNote && (
              <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">Rejection note: {detailTarget.verificationNote}</p>
            )}

            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">Team members</h3>
            {membersLoading ? (
              <p className="mt-2 text-sm text-gray-500">Loading...</p>
            ) : !members?.length ? (
              <p className="mt-2 text-sm text-gray-500">No members</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100">
                {members.map((m) => (
                  <li key={m.id} className="py-2 text-sm">
                    <span className="font-medium text-gray-900">{m.user.name}</span> <span className="text-gray-500">({m.user.email})</span>
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">{m.role}</span>
                    <span className="ml-1 text-xs text-gray-400">{m.status}</span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">Audit log</h3>
            {auditLoading ? (
              <p className="mt-2 text-sm text-gray-500">Loading...</p>
            ) : !auditLog?.data?.length ? (
              <p className="mt-2 text-sm text-gray-500">No audit log entries</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {auditLog.data.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <span className="font-medium text-gray-900">{entry.action}</span>
                    <span className="text-gray-500"> by {entry.actor?.name ?? 'system'} on {new Date(entry.createdAt).toLocaleString()}</span>
                    {entry.note && <p className="text-xs text-gray-500">{entry.note}</p>}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 flex justify-end">
              <button onClick={() => setDetailTarget(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
