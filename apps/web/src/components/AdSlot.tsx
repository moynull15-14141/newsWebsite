import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { markAdShown, getShownAdIds } from '@/lib/ad-session';

interface EligibleAd {
  campaignId: string;
  creativeId: string;
  placementKey: string;
  type: 'IMAGE' | 'RESPONSIVE_IMAGE' | 'NATIVE_SPONSORED' | 'VIDEO' | 'HTML_RICH_MEDIA';
  targetUrl: string | null;
  ctaText: string | null;
  altText: string | null;
  nativeHeadline: string | null;
  nativeBody: string | null;
  nativeSponsorLabel: string;
  desktopMedia: { publicUrl: string; altText: string | null } | null;
  mobileMedia: { publicUrl: string; altText: string | null } | null;
}

/** Reserves roughly the right box before the image loads, so a slot popping in/out doesn't shift page
 * content (matches the recommended sizes seeded onto AdPlacement — see prisma/seed.ts). Slots not
 * listed fall back to a plain banner-shaped minimum. */
const MIN_HEIGHT: Partial<Record<string, string>> = {
  BREAKING_NEWS_BELOW: 'min-h-[90px]',
  TOP_BILLBOARD: 'min-h-[100px]',
  HOME_HERO: 'min-h-[250px]',
  HOME_SIDEBAR: 'min-h-[300px]',
  ARTICLE_SIDEBAR: 'min-h-[300px]',
  CATEGORY_SIDEBAR: 'min-h-[300px]',
  ARTICLE_AFTER_INTRO: 'min-h-[200px]',
  ARTICLE_IN_CONTENT: 'min-h-[200px]',
  ARTICLE_MID: 'min-h-[200px]',
  ARTICLE_RELATED: 'min-h-[200px]',
};

function getSessionId() {
  const key = 'bd-news-session';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  window.localStorage.setItem(key, value);
  return value;
}

interface AdSlotProps {
  /** One of the seeded AdPlacementKey values (see prisma/seed.ts's ad placement registry). */
  slot: string;
  /** Coarse page type for server-side targeting (spec's AdPageTarget). 'ALL' for global slots that
   * render on every page (breaking-news/billboard/mobile-sticky) regardless of page type. */
  pageType?: string;
  categoryId?: string;
  locationId?: string;
  /** A short page identifier (article/category slug) recorded on the event for future per-page
   * analytics — never used for targeting itself. */
  context?: string;
  /** MOBILE_STICKY renders fixed to the viewport bottom instead of inline. */
  sticky?: boolean;
}

export default function AdSlot({ slot, pageType = 'ALL', categoryId, locationId, context, sticky }: AdSlotProps) {
  const { code } = useLanguage();
  const [device, setDevice] = useState<'DESKTOP' | 'TABLET' | 'MOBILE'>('DESKTOP');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const compute = () => setDevice(window.innerWidth < 640 ? 'MOBILE' : window.innerWidth < 1024 ? 'TABLET' : 'DESKTOP');
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  const { data: ad } = useQuery<EligibleAd | null>({
    queryKey: ['ad-slot', slot, pageType, categoryId, locationId, device, code],
    queryFn: () => {
      const params = new URLSearchParams({ placement: slot, device, lang: code });
      if (pageType) params.set('pageType', pageType);
      if (categoryId) params.set('categoryId', categoryId);
      if (locationId) params.set('locationId', locationId);
      if (context) params.set('context', context);
      const excludeIds = getShownAdIds();
      if (excludeIds.length) params.set('excludeCampaignIds', excludeIds.join(','));
      return apiFetch(`/public/ad-placements/eligible?${params.toString()}`);
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!ad) return;
    markAdShown(ad.campaignId);
    apiFetch('/public/ad-events/impression', {
      method: 'POST',
      body: JSON.stringify({ placement: slot, creativeId: ad.creativeId, sessionId: getSessionId(), context, device }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fire when a NEW ad is actually served
  }, [ad?.creativeId]);

  if (!ad || dismissed) return null;

  const recordClick = () => {
    apiFetch('/public/ad-events/click', {
      method: 'POST',
      body: JSON.stringify({ placement: slot, creativeId: ad.creativeId, sessionId: getSessionId(), context, device }),
    }).catch(() => {});
  };

  const media = device === 'MOBILE' ? (ad.mobileMedia ?? ad.desktopMedia) : ad.desktopMedia;
  const minHeight = MIN_HEIGHT[slot] ?? 'min-h-[90px]';

  const body = ad.type === 'NATIVE_SPONSORED' ? (
    <div className={`overflow-hidden rounded-lg border border-gray-200 bg-white p-4 ${minHeight}`}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-amber-600">{ad.nativeSponsorLabel || 'Sponsored'}</p>
      {ad.nativeHeadline && <p className="text-sm font-semibold text-gray-900">{ad.nativeHeadline}</p>}
      {ad.nativeBody && <p className="mt-1 text-sm text-gray-600">{ad.nativeBody}</p>}
      {ad.ctaText && <span className="mt-2 inline-block text-sm font-semibold text-primary-600">{ad.ctaText} &rarr;</span>}
    </div>
  ) : (
    <div className={`overflow-hidden border-y border-neutral-200 bg-neutral-50 px-4 py-3 ${minHeight}`}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Advertisement</p>
      {media ? (
        <img src={media.publicUrl} alt={ad.altText || media.altText || 'Advertisement'} className="mx-auto max-h-40 max-w-full object-contain" />
      ) : (
        <span className="text-sm text-neutral-500">{ad.ctaText || 'Sponsored'}</span>
      )}
    </div>
  );

  const wrapped = ad.targetUrl ? (
    <a href={ad.targetUrl} target="_blank" rel="noreferrer sponsored" onClick={recordClick}>{body}</a>
  ) : body;

  if (sticky) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 sm:hidden">
        <div className="relative">
          <button
            type="button" onClick={() => setDismissed(true)} aria-label="Dismiss advertisement"
            className="absolute -top-3 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 text-xs text-white shadow"
          >
            &times;
          </button>
          {wrapped}
        </div>
      </div>
    );
  }

  return <div className="my-4">{wrapped}</div>;
}
