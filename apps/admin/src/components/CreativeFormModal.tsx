import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import MediaPickerModal, { type MediaItem } from './MediaPickerModal';

interface CreativeFull {
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
  rotationWeight: number;
}

interface CampaignOption { id: string; name: string; advertiser: { name: string } }

/** Shared creative create/edit form — used both from a campaign's own detail page (campaignId is fixed,
 * no picker needed) and from the standalone Creatives admin page (campaign must be picked explicitly).
 * Pulled out of AdsCampaignDetailPage so the two pages don't carry two copies of the same form/validation. */
export default function CreativeFormModal({
  mode, creative, campaignId, onClose, onSaved,
}: {
  mode: 'create' | 'edit';
  creative?: CreativeFull;
  campaignId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedCampaignId, setSelectedCampaignId] = useState(campaignId ?? creative?.campaignId ?? '');
  const [type, setType] = useState(creative?.type ?? 'IMAGE');
  const [targetUrl, setTargetUrl] = useState(creative?.targetUrl ?? '');
  const [ctaText, setCtaText] = useState(creative?.ctaText ?? '');
  const [altText, setAltText] = useState(creative?.altText ?? '');
  const [nativeHeadline, setNativeHeadline] = useState(creative?.nativeHeadline ?? '');
  const [nativeBody, setNativeBody] = useState(creative?.nativeBody ?? '');
  const [rotationWeight, setRotationWeight] = useState(String(creative?.rotationWeight ?? 1));
  const [desktopMedia, setDesktopMedia] = useState<MediaItem | null>(creative?.desktopMedia ?? null);
  const [mobileMedia, setMobileMedia] = useState<MediaItem | null>(creative?.mobileMedia ?? null);
  const [pickerFor, setPickerFor] = useState<'desktop' | 'mobile' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needsCampaignPicker = mode === 'create' && !campaignId;
  const { data: campaigns } = useQuery<{ data: CampaignOption[] }>({
    queryKey: ['ad-campaigns-picker'],
    queryFn: () => apiFetch('/ad-campaigns?limit=100'),
    enabled: needsCampaignPicker,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['ad-campaign'] });
    queryClient.invalidateQueries({ queryKey: ['ad-creatives-all'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        type,
        desktopMediaId: desktopMedia?.id,
        mobileMediaId: mobileMedia?.id,
        targetUrl: targetUrl || undefined,
        ctaText: ctaText || undefined,
        altText: altText || undefined,
        nativeHeadline: nativeHeadline || undefined,
        nativeBody: nativeBody || undefined,
        rotationWeight: Number(rotationWeight) || 1,
      };
      return mode === 'create'
        ? apiFetch('/ad-creatives', { method: 'POST', body: JSON.stringify({ ...body, campaignId: selectedCampaignId }) })
        : apiFetch(`/ad-creatives/${creative!.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    },
    onSuccess: () => { invalidate(); onSaved(); },
    onError: (err: unknown) => setError(getApiErrorMessage(err, `Failed to ${mode === 'create' ? 'add' : 'update'} creative`)),
  });

  function handleSave() {
    if (needsCampaignPicker && !selectedCampaignId) return setError('Select a campaign');
    if (type !== 'NATIVE_SPONSORED' && !desktopMedia) return setError('Select a desktop image');
    if (type === 'NATIVE_SPONSORED' && !nativeHeadline.trim()) return setError('A native sponsored creative needs a headline');
    saveMutation.mutate();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <div role="dialog" aria-modal="true" aria-labelledby="creative-form-title" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 id="creative-form-title" className="text-lg font-semibold text-gray-900">{mode === 'create' ? 'Add creative' : 'Edit creative'}</h2>
            <button onClick={onClose} aria-label="Close dialog" className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-4 space-y-3">
            {needsCampaignPicker && (
              <div>
                <label htmlFor="creative-campaign" className="block text-sm font-medium text-gray-700">Campaign</label>
                <select id="creative-campaign" value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Select campaign...</option>
                  {campaigns?.data.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.advertiser.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="creative-type" className="block text-sm font-medium text-gray-700">Type</label>
              <select id="creative-type" value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="IMAGE">Image</option>
                <option value="RESPONSIVE_IMAGE">Responsive image</option>
                <option value="NATIVE_SPONSORED">Native sponsored</option>
              </select>
            </div>

            {type !== 'NATIVE_SPONSORED' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="block text-sm font-medium text-gray-700">Desktop image</p>
                  <button type="button" onClick={() => setPickerFor('desktop')} className="mt-1 flex h-20 w-full items-center justify-center rounded-md border border-dashed border-gray-300 text-xs text-gray-500 hover:border-primary-400">
                    {desktopMedia ? <img src={desktopMedia.publicUrl} alt="" className="h-full w-full rounded object-cover" /> : 'Select image'}
                  </button>
                </div>
                <div>
                  <p className="block text-sm font-medium text-gray-700">Mobile image (optional)</p>
                  <button type="button" onClick={() => setPickerFor('mobile')} className="mt-1 flex h-20 w-full items-center justify-center rounded-md border border-dashed border-gray-300 text-xs text-gray-500 hover:border-primary-400">
                    {mobileMedia ? <img src={mobileMedia.publicUrl} alt="" className="h-full w-full rounded object-cover" /> : 'Select image'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="creative-headline" className="block text-sm font-medium text-gray-700">Headline</label>
                  <input id="creative-headline" value={nativeHeadline} onChange={(e) => setNativeHeadline(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label htmlFor="creative-body" className="block text-sm font-medium text-gray-700">Body</label>
                  <textarea id="creative-body" rows={2} value={nativeBody} onChange={(e) => setNativeBody(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </>
            )}

            <div>
              <label htmlFor="creative-target" className="block text-sm font-medium text-gray-700">Target URL <span className="font-normal text-gray-400">(optional — falls back to the campaign's own)</span></label>
              <input id="creative-target" type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="creative-cta" className="block text-sm font-medium text-gray-700">CTA text</label>
                <input id="creative-cta" value={ctaText} onChange={(e) => setCtaText(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="creative-weight" className="block text-sm font-medium text-gray-700">Rotation weight</label>
                <input id="creative-weight" type="number" min={1} value={rotationWeight} onChange={(e) => setRotationWeight(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label htmlFor="creative-alt" className="block text-sm font-medium text-gray-700">Alt text</label>
              <input id="creative-alt" value={altText} onChange={(e) => setAltText(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saveMutation.isPending} className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">
                {mode === 'create' ? 'Add creative' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {pickerFor && (
        <MediaPickerModal
          onClose={() => setPickerFor(null)}
          onSelect={(media) => { if (pickerFor === 'desktop') setDesktopMedia(media); else setMobileMedia(media); setPickerFor(null); }}
        />
      )}
    </>
  );
}
