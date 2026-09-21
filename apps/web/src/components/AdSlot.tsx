import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Ad {
  id: string;
  name: string;
  slot: string;
  targetUrl?: string;
  htmlContent?: string;
  media?: { publicUrl: string; altText?: string };
}

function getSessionId() {
  const key = 'bd-news-session';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  window.localStorage.setItem(key, value);
  return value;
}

export default function AdSlot({ slot, pageType, categoryId, locationId }: { slot: string; pageType?: string; categoryId?: string; locationId?: string }) {
  const device = window.innerWidth < 768 ? 'mobile' : 'desktop';
  const { data: ad } = useQuery<Ad | null>({
    queryKey: ['ad-slot', slot, pageType, categoryId, locationId, device],
    queryFn: () => apiFetch(`/public/ads/slot?slot=${slot}&pageType=${pageType || ''}&categoryId=${categoryId || ''}&locationId=${locationId || ''}&device=${device}`),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (ad) {
      apiFetch(`/public/ads/${ad.id}/impression`, {
        method: 'POST',
        body: JSON.stringify({ slot, sessionId: getSessionId() }),
      }).catch(() => {});
    }
  }, [ad, slot]);

  if (!ad) return null;
  const content = ad.media ? (
    <img src={ad.media.publicUrl} alt={ad.media.altText || ad.name} className="max-h-28 w-full object-contain" />
  ) : ad.htmlContent ? (
    <p className="text-sm text-gray-700">{ad.htmlContent}</p>
  ) : (
    <span className="inline-flex items-center gap-2 text-sm text-gray-700">{ad.name} <ExternalLink size={14} /></span>
  );

  return (
    <aside className="my-6 overflow-hidden border-y border-gray-200 bg-gray-50 px-4 py-3" aria-label="Advertisement">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Advertisement</p>
      {ad.targetUrl ? (
        <a
          href={ad.targetUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => apiFetch(`/public/ads/${ad.id}/click`, { method: 'POST', body: JSON.stringify({ slot, sessionId: getSessionId() }) }).catch(() => {})}
        >
          {content}
        </a>
      ) : content}
    </aside>
  );
}
