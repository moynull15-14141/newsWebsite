import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Eye } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuthStore } from '../../stores/auth-store';
import AdPreview from '../../components/AdPreview';

interface PlacementRow {
  id: string;
  key: string;
  label: string;
  group: string;
  description: string | null;
  recommendedWidth: number | null;
  recommendedHeight: number | null;
  enabled: boolean;
  assignedCampaignCount: number;
  liveCampaignCount: number;
  scheduledCampaignCount: number;
}

interface PreviewCreative {
  type: string;
  desktopMedia?: { publicUrl: string } | null;
  mobileMedia?: { publicUrl: string } | null;
  targetUrl: string | null;
  ctaText: string | null;
  altText: string | null;
  nativeHeadline: string | null;
  nativeBody: string | null;
  nativeSponsorLabel: string;
}

interface PlacementDetail {
  id: string;
  key: string;
  label: string;
  campaignPlacements: { id: string; enabled: boolean; campaign: { id: string; name: string; status: string; creatives?: PreviewCreative[] } }[];
}

const GROUP_ORDER = ['GLOBAL', 'HOMEPAGE', 'ARTICLE', 'CATEGORY', 'SEARCH', 'GENERIC'];

export default function AdsPlacementsPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('ads.placement.manage');
  const [previewId, setPreviewId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PlacementRow[]>({ queryKey: ['ad-placements'], queryFn: () => apiFetch('/ad-placements') });
  const { data: previewDetail } = useQuery<PlacementDetail>({
    queryKey: ['ad-placement-detail', previewId],
    queryFn: () => apiFetch(`/ad-placements/${previewId}`),
    enabled: !!previewId,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => apiFetch(`/ad-placements/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ad-placements'] }),
  });

  const grouped = (data ?? []).reduce<Record<string, PlacementRow[]>>((acc, p) => {
    (acc[p.group] ??= []).push(p);
    return acc;
  }, {});

  const previewCampaign = previewDetail?.campaignPlacements?.find((cp) => cp.enabled && cp.campaign.status === 'ACTIVE' && cp.campaign.creatives?.length);
  const previewCreative = previewCampaign?.campaign.creatives?.[0];

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><LayoutGrid size={24} /> Placements</h1>
      <p className="mt-1 text-sm text-gray-500">The controlled inventory of where an ad can ever appear. Disabling a placement here hides every campaign from it immediately, everywhere.</p>

      {isLoading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : (
        <div className="mt-6 space-y-8">
          {GROUP_ORDER.filter((g) => grouped[g]?.length).map((group) => (
            <section key={group}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{group}</h2>
              <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Placement', 'Recommended size', 'Assigned', 'Live', 'Scheduled', 'Enabled', ''].map((h) => (
                        <th key={h} className="whitespace-nowrap px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {grouped[group].map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{p.label}</p>
                          <p className="text-xs text-gray-400">{p.key}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{p.recommendedWidth && p.recommendedHeight ? `${p.recommendedWidth}×${p.recommendedHeight}` : '-'}</td>
                        <td className="px-4 py-3">{p.assignedCampaignCount}</td>
                        <td className="px-4 py-3"><span className={p.liveCampaignCount ? 'font-semibold text-green-700' : 'text-gray-400'}>{p.liveCampaignCount}</span></td>
                        <td className="px-4 py-3">{p.scheduledCampaignCount}</td>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={p.enabled} onChange={(e) => toggleMutation.mutate({ id: p.id, enabled: e.target.checked })} disabled={!canManage} aria-label={`Enable ${p.label}`} />
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setPreviewId(p.id)} className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"><Eye className="h-3.5 w-3.5" /> Preview</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {previewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === 'Escape' && setPreviewId(null)}>
          <div role="dialog" aria-modal="true" aria-label="Placement preview" className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{previewDetail?.label}</h2>
              <button onClick={() => setPreviewId(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Close">✕</button>
            </div>
            <div className="mt-4">
              {previewCreative ? (
                <>
                  <p className="mb-2 text-xs text-gray-500">Currently winning campaign: <span className="font-medium text-gray-700">{previewCampaign.campaign.name}</span></p>
                  <AdPreview creative={previewCreative} campaignTargetUrl={null} device="desktop" />
                </>
              ) : (
                <p className="text-sm text-gray-500">No live campaign is currently eligible for this placement.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
