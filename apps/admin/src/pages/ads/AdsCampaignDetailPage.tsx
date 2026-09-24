import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Edit, Monitor, Smartphone, ImagePlus } from 'lucide-react';
import { apiFetch, getApiErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/auth-store';
import AdPreview from '../../components/AdPreview';
import CreativeFormModal from '../../components/CreativeFormModal';

interface Creative {
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
  nativeSponsorLabel: string;
  active: boolean;
  rotationWeight: number;
}

interface PlacementAssignment {
  id: string;
  priority: number | null;
  enabled: boolean;
  placement: { id: string; key: string; label: string; group: string; enabled: boolean };
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  startAt: string | null;
  endAt: string | null;
  priority: number;
  targetUrl: string | null;
  notes: string | null;
  deviceTarget: string;
  pageTarget: string;
  category: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  language: { id: string; code: string; nativeName: string } | null;
  frequencyCapPerDay: number | null;
  advertiser: { id: string; name: string };
  createdBy: { id: string; name: string };
  approvedBy: { id: string; name: string } | null;
  updatedAt: string;
  creatives: Creative[];
  placements: PlacementAssignment[];
}

interface AuditEntry { id: string; action: string; fromStatus: string | null; toStatus: string | null; note: string | null; createdAt: string; actor: { id: string; name: string } | null }
interface Stats { totalImpressions: number; impressionsToday: number; totalClicks: number; clicksToday: number; ctr: number }
interface PlacementOption { id: string; key: string; label: string; group: string }

const WORKFLOW_ACTIONS: Record<string, { action: string; label: string; permission: string; className: string }[]> = {
  DRAFT: [{ action: 'submit-review', label: 'Submit for review', permission: 'ads.create', className: 'bg-primary-500 text-white hover:bg-primary-600' }],
  PENDING_REVIEW: [
    { action: 'approve', label: 'Approve', permission: 'ads.approve', className: 'bg-green-600 text-white hover:bg-green-700' },
    { action: 'reject', label: 'Reject', permission: 'ads.approve', className: 'bg-red-600 text-white hover:bg-red-700' },
  ],
  APPROVED: [
    { action: 'activate', label: 'Activate now', permission: 'ads.publish', className: 'bg-green-600 text-white hover:bg-green-700' },
    { action: 'schedule', label: 'Schedule', permission: 'ads.publish', className: 'bg-purple-600 text-white hover:bg-purple-700' },
  ],
  SCHEDULED: [
    { action: 'cancel-schedule', label: 'Cancel schedule', permission: 'ads.publish', className: 'border border-gray-300 text-gray-700 hover:bg-gray-50' },
    { action: 'activate', label: 'Activate now', permission: 'ads.publish', className: 'bg-green-600 text-white hover:bg-green-700' },
  ],
  ACTIVE: [
    { action: 'pause', label: 'Pause', permission: 'ads.publish', className: 'bg-orange-500 text-white hover:bg-orange-600' },
    { action: 'archive', label: 'Archive', permission: 'ads.publish', className: 'border border-gray-300 text-gray-700 hover:bg-gray-50' },
  ],
  PAUSED: [
    { action: 'resume', label: 'Resume', permission: 'ads.publish', className: 'bg-green-600 text-white hover:bg-green-700' },
    { action: 'archive', label: 'Archive', permission: 'ads.publish', className: 'border border-gray-300 text-gray-700 hover:bg-gray-50' },
  ],
  EXPIRED: [{ action: 'archive', label: 'Archive', permission: 'ads.publish', className: 'border border-gray-300 text-gray-700 hover:bg-gray-50' }],
  ARCHIVED: [],
};

export default function AdsCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const [actionError, setActionError] = useState<string | null>(null);
  const [creativeFormMode, setCreativeFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingCreative, setEditingCreative] = useState<Creative | null>(null);
  const [assignPlacementId, setAssignPlacementId] = useState('');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: campaign, isLoading } = useQuery<Campaign>({ queryKey: ['ad-campaign', id], queryFn: () => apiFetch(`/ad-campaigns/${id}`), enabled: !!id });
  const { data: placementOptions } = useQuery<PlacementOption[]>({ queryKey: ['ad-placements-all'], queryFn: () => apiFetch('/ad-placements') });
  const { data: stats } = useQuery<Stats>({ queryKey: ['ad-campaign-stats', id], queryFn: () => apiFetch(`/ad-campaigns/${id}/stats`), enabled: !!id && hasPermission('ads.analytics.view') });
  const { data: auditLog } = useQuery<{ data: AuditEntry[] }>({ queryKey: ['ad-campaign-audit', id], queryFn: () => apiFetch(`/ad-campaigns/${id}/audit-log?limit=30`), enabled: !!id });

  const actionMutation = useMutation({
    mutationFn: (action: string) => apiFetch(`/ad-campaigns/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ad-campaign', id] }); queryClient.invalidateQueries({ queryKey: ['ad-campaign-audit', id] }); setActionError(null); },
    onError: (err: unknown) => setActionError(getApiErrorMessage(err, 'Action failed')),
  });

  const toggleCreativeMutation = useMutation({
    mutationFn: ({ creativeId, active }: { creativeId: string; active: boolean }) => apiFetch(`/ad-creatives/${creativeId}`, { method: 'PATCH', body: JSON.stringify({ active }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ad-campaign', id] }),
  });
  const removeCreativeMutation = useMutation({
    mutationFn: (creativeId: string) => apiFetch(`/ad-creatives/${creativeId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ad-campaign', id] }),
  });

  const assignPlacementMutation = useMutation({
    mutationFn: () => apiFetch('/ad-placements/assignments', { method: 'POST', body: JSON.stringify({ campaignId: id, placementId: assignPlacementId }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ad-campaign', id] }); setAssignPlacementId(''); },
  });
  const toggleAssignmentMutation = useMutation({
    mutationFn: ({ assignmentId, enabled }: { assignmentId: string; enabled: boolean }) => apiFetch(`/ad-placements/assignments/${assignmentId}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ad-campaign', id] }),
  });
  const removeAssignmentMutation = useMutation({
    mutationFn: (assignmentId: string) => apiFetch(`/ad-placements/assignments/${assignmentId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ad-campaign', id] }),
  });

  // Permanent, unlike Archive — the backend only allows this for DRAFT/ARCHIVED campaigns (never one
  // that's ever gone live), so mistakes are recoverable via Archive; this is for cleaning those up for
  // good once you're sure.
  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/ad-campaigns/${id}`, { method: 'DELETE' }),
    onSuccess: () => navigate('/ads/campaigns'),
    onError: (err: unknown) => { setActionError(getApiErrorMessage(err, 'Delete failed')); setConfirmingDelete(false); },
  });

  if (isLoading || !campaign) return <div className="text-center text-gray-500">Loading...</div>;

  const availablePlacements = (placementOptions ?? []).filter((p) => !campaign.placements.some((cp) => cp.placement.id === p.id));
  const activeCreatives = campaign.creatives.filter((c) => c.active);
  const previewCreative = activeCreatives[0];

  return (
    <div>
      <button onClick={() => navigate('/ads/campaigns')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to campaigns
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{campaign.advertiser.name} &middot; Priority {campaign.priority} &middot; Status <span className="font-semibold">{campaign.status.replace('_', ' ')}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(WORKFLOW_ACTIONS[campaign.status] ?? []).filter((a) => hasPermission(a.permission)).map((a) => (
            <button
              key={a.action}
              onClick={() => { if (a.action === 'schedule' && !campaign.startAt) { setActionError('Set a future start date before scheduling.'); return; } actionMutation.mutate(a.action); }}
              disabled={actionMutation.isPending}
              className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50 ${a.className}`}
            >
              {a.label}
            </button>
          ))}
          {(campaign.status === 'DRAFT' || campaign.status === 'ARCHIVED') && hasPermission('ads.delete') && (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              aria-label={`Delete campaign ${campaign.name}`}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
      </div>
      {actionError && <p role="alert" className="mt-2 text-sm text-red-600">{actionError}</p>}

      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === 'Escape' && setConfirmingDelete(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="delete-campaign-title" className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 id="delete-campaign-title" className="text-lg font-semibold text-gray-900">Delete "{campaign.name}"?</h2>
            <p className="mt-2 text-sm text-gray-600">This permanently removes the campaign and its creatives. This cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmingDelete(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Details */}
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Details</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-gray-500">Schedule</dt><dd className="font-medium text-gray-900">{campaign.startAt ? new Date(campaign.startAt).toLocaleString() : 'Not set'} – {campaign.endAt ? new Date(campaign.endAt).toLocaleString() : 'Open'}</dd></div>
              <div><dt className="text-gray-500">Target URL</dt><dd className="truncate font-medium text-gray-900">{campaign.targetUrl || '-'}</dd></div>
              <div><dt className="text-gray-500">Device targeting</dt><dd className="font-medium text-gray-900">{campaign.deviceTarget}</dd></div>
              <div><dt className="text-gray-500">Page targeting</dt><dd className="font-medium text-gray-900">{campaign.pageTarget}</dd></div>
              <div><dt className="text-gray-500">Language</dt><dd className="font-medium text-gray-900">{campaign.language?.nativeName || 'All languages'}</dd></div>
              <div><dt className="text-gray-500">Category</dt><dd className="font-medium text-gray-900">{campaign.category?.name || 'All categories'}</dd></div>
              <div><dt className="text-gray-500">Location</dt><dd className="font-medium text-gray-900">{campaign.location?.name || 'All locations'}</dd></div>
              <div><dt className="text-gray-500">Frequency cap</dt><dd className="font-medium text-gray-900">{campaign.frequencyCapPerDay ? `${campaign.frequencyCapPerDay} / session / day` : 'Uncapped'}</dd></div>
              <div><dt className="text-gray-500">Created by</dt><dd className="font-medium text-gray-900">{campaign.createdBy.name}</dd></div>
              <div><dt className="text-gray-500">Approved by</dt><dd className="font-medium text-gray-900">{campaign.approvedBy?.name || '-'}</dd></div>
            </dl>
            {campaign.notes && <p className="mt-3 rounded bg-gray-50 p-3 text-sm text-gray-600">{campaign.notes}</p>}
          </section>

          {/* Creatives */}
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Creatives</h2>
              {hasPermission('ads.create') && (
                <button onClick={() => { setEditingCreative(null); setCreativeFormMode('create'); }} className="inline-flex items-center gap-1 rounded-md border border-primary-300 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50">
                  <Plus className="h-4 w-4" /> Add creative
                </button>
              )}
            </div>
            {!campaign.creatives.length ? (
              <p className="mt-3 text-sm text-gray-500">No creatives yet. A campaign needs at least one active creative before it can be submitted for review.</p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100">
                {campaign.creatives.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-3">
                    {c.desktopMedia ? <img src={c.desktopMedia.publicUrl} alt={c.altText || ''} className="h-12 w-16 rounded object-cover" /> : <div className="flex h-12 w-16 items-center justify-center rounded bg-gray-100 text-gray-400"><ImagePlus className="h-5 w-5" /></div>}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{c.type.replace('_', ' ')}{c.nativeHeadline ? `: ${c.nativeHeadline}` : ''}</p>
                      <p className="truncate text-xs text-gray-500">{c.targetUrl || campaign.targetUrl || 'No target URL'} &middot; weight {c.rotationWeight}</p>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600">
                      <input type="checkbox" checked={c.active} onChange={(e) => toggleCreativeMutation.mutate({ creativeId: c.id, active: e.target.checked })} disabled={!hasPermission('ads.update')} /> Active
                    </label>
                    {hasPermission('ads.update') && (
                      <button onClick={() => { setEditingCreative(c); setCreativeFormMode('edit'); }} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Edit creative"><Edit className="h-4 w-4" /></button>
                    )}
                    {hasPermission('ads.delete') && (
                      <button onClick={() => { if (confirm('Remove this creative?')) removeCreativeMutation.mutate(c.id); }} className="rounded p-1.5 text-red-600 hover:bg-red-50" aria-label="Remove creative"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Placements */}
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Placement assignments</h2>
            {hasPermission('ads.placement.manage') && (
              <div className="mt-3 flex gap-2">
                <select value={assignPlacementId} onChange={(e) => setAssignPlacementId(e.target.value)} className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Select a placement to assign...</option>
                  {availablePlacements.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.key})</option>)}
                </select>
                <button onClick={() => assignPlacementMutation.mutate()} disabled={!assignPlacementId || assignPlacementMutation.isPending} className="rounded-md bg-primary-500 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">Assign</button>
              </div>
            )}
            {!campaign.placements.length ? (
              <p className="mt-3 text-sm text-gray-500">Not assigned to any placement yet — it will never appear publicly until assigned.</p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100">
                {campaign.placements.map((cp) => (
                  <li key={cp.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{cp.placement.label}</span>
                      <span className="ml-2 text-xs text-gray-400">{cp.placement.key}</span>
                      {!cp.placement.enabled && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">PLACEMENT DISABLED</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-gray-600">
                        <input type="checkbox" checked={cp.enabled} onChange={(e) => toggleAssignmentMutation.mutate({ assignmentId: cp.id, enabled: e.target.checked })} disabled={!hasPermission('ads.placement.manage')} /> Enabled here
                      </label>
                      {hasPermission('ads.placement.manage') && (
                        <button onClick={() => removeAssignmentMutation.mutate(cp.id)} className="rounded p-1 text-red-600 hover:bg-red-50" aria-label={`Remove from ${cp.placement.label}`}><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Audit log */}
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Audit log</h2>
            {!auditLog?.data.length ? (
              <p className="mt-3 text-sm text-gray-500">No audit entries yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {auditLog.data.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <span className="font-medium text-gray-900">{entry.action.replace(/_/g, ' ')}</span>
                    <span className="text-gray-500"> by {entry.actor?.name ?? 'system'} on {new Date(entry.createdAt).toLocaleString()}</span>
                    {entry.note && <p className="text-xs text-gray-500">{entry.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {stats && (
            <section className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Performance (30 days)</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-gray-500">Impressions</dt><dd className="text-lg font-bold text-gray-900">{stats.totalImpressions}</dd></div>
                <div><dt className="text-gray-500">Clicks</dt><dd className="text-lg font-bold text-gray-900">{stats.totalClicks}</dd></div>
                <div><dt className="text-gray-500">CTR</dt><dd className="text-lg font-bold text-gray-900">{stats.ctr}%</dd></div>
                <div><dt className="text-gray-500">Today</dt><dd className="text-lg font-bold text-gray-900">{stats.impressionsToday} imp / {stats.clicksToday} clk</dd></div>
              </dl>
            </section>
          )}

          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Preview</h2>
              <div className="flex rounded-md border border-gray-300 p-0.5">
                <button onClick={() => setPreviewDevice('desktop')} className={`rounded p-1.5 ${previewDevice === 'desktop' ? 'bg-primary-500 text-white' : 'text-gray-500'}`} aria-label="Preview desktop"><Monitor className="h-4 w-4" /></button>
                <button onClick={() => setPreviewDevice('mobile')} className={`rounded p-1.5 ${previewDevice === 'mobile' ? 'bg-primary-500 text-white' : 'text-gray-500'}`} aria-label="Preview mobile"><Smartphone className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-3">
              {previewCreative ? (
                <AdPreview creative={previewCreative} campaignTargetUrl={campaign.targetUrl} device={previewDevice} />
              ) : (
                <p className="text-sm text-gray-500">Add an active creative to see a preview.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {creativeFormMode && (
        <CreativeFormModal
          mode={creativeFormMode}
          creative={editingCreative ?? undefined}
          campaignId={id}
          onClose={() => { setCreativeFormMode(null); setEditingCreative(null); }}
          onSaved={() => { setCreativeFormMode(null); setEditingCreative(null); }}
        />
      )}

      <p className="mt-6 text-right text-xs text-gray-400">
        <Link to={`/ads/campaigns`} className="hover:underline">All campaigns</Link>
      </p>
    </div>
  );
}
