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

/** Renders a creative the same way the public AdSlot component will (see apps/web/src/components/AdSlot.tsx)
 * — same "Advertisement"/"Sponsored" labeling, same image-vs-native branching — so what an admin approves
 * here is what a reader actually sees, not an admin-only mockup that can drift from the real renderer. */
export default function AdPreview({ creative, campaignTargetUrl, device }: { creative: PreviewCreative; campaignTargetUrl: string | null; device: 'desktop' | 'mobile' }) {
  const media = (device === 'mobile' ? creative.mobileMedia : null) ?? creative.desktopMedia;
  const targetUrl = creative.targetUrl ?? campaignTargetUrl;
  const frameClass = device === 'mobile' ? 'w-[320px]' : 'w-full';

  if (creative.type === 'NATIVE_SPONSORED') {
    return (
      <div className={`mx-auto ${frameClass} rounded-lg border border-gray-200 bg-white p-4`}>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-amber-600">{creative.nativeSponsorLabel || 'Sponsored'}</p>
        <p className="text-sm font-semibold text-gray-900">{creative.nativeHeadline || 'Headline'}</p>
        {creative.nativeBody && <p className="mt-1 text-xs text-gray-600">{creative.nativeBody}</p>}
        {targetUrl && <p className="mt-2 truncate text-[10px] text-gray-400">{targetUrl}</p>}
      </div>
    );
  }

  return (
    <div className={`mx-auto ${frameClass} overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-3`}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Advertisement</p>
      {media ? (
        <img src={media.publicUrl} alt={creative.altText || ''} className="max-h-40 w-full rounded object-contain" />
      ) : (
        <div className="flex h-24 items-center justify-center rounded bg-gray-200 text-xs text-gray-500">No image selected</div>
      )}
      {targetUrl && <p className="mt-2 truncate text-[10px] text-gray-400">{targetUrl}</p>}
    </div>
  );
}
