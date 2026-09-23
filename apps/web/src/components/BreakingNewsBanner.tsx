import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { resolveBackground, computeTrackDurationMs, type BackgroundMode, type GradientDirection } from '@/lib/breaking-news';

interface BreakingTickerEntry {
  id: string;
  headline: string;
  articleSlug: string | null;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientStart: string | null;
  gradientEnd: string | null;
  gradientDirection: GradientDirection | null;
  textColor: string;
  badgeBackgroundColor: string;
  badgeTextColor: string;
  animationSpeedMs: number;
}

/**
 * Admin-controlled, database-driven live ticker (Phase 2L). All active items scroll together as one
 * continuous strip — see the bn-track-scroll keyframes in index.css for why (a single infinite
 * animation instead of one-item-at-a-time avoids getting stuck, and keeps several headlines visibly on
 * screen at once instead of reading as sparse). Each headline is its own colored chip that fades in and
 * out at its edges, so per-item colors blend into each other instead of cutting abruptly.
 * Reduced-motion users get every headline listed at once instead, with no movement at all.
 */
export default function BreakingNewsBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // The floor each duplicated "set" needs (see the JSX below) has to be a real measured pixel value,
  // not a CSS percentage: `.bn-ticker-track-inner`'s own width is content-driven (`width: max-content`),
  // so a percentage min-width on its children has no definite containing-block size to resolve against
  // and is effectively ignored by the CSS spec — confirmed by testing, this is exactly why a single
  // short headline used to just wiggle by its own text width instead of crossing the whole bar.
  const [minSetWidth, setMinSetWidth] = useState(0);
  // A callback ref, not useRef+useEffect([]): the ticker renders null until the breaking-news query
  // resolves, so the track element doesn't exist in the DOM yet on first mount — a one-time effect with
  // an empty dependency array would run against a still-null ref and never observe anything once the
  // element actually appears. A callback ref re-fires exactly when React attaches (or detaches) the
  // real node, whichever render that happens on.
  const [trackNode, setTrackNode] = useState<HTMLDivElement | null>(null);
  const trackRef = useCallback((node: HTMLDivElement | null) => setTrackNode(node), []);

  useEffect(() => {
    if (!trackNode) return undefined;
    const observer = new ResizeObserver(([entry]) => setMinSetWidth(entry.contentRect.width));
    observer.observe(trackNode);
    return () => observer.disconnect();
  }, [trackNode]);

  const { data: items } = useQuery<BreakingTickerEntry[]>({
    queryKey: ['breaking-news-ticker'],
    queryFn: () => apiFetch('/public/breaking-news-ticker'),
    // Admin changes should show up promptly without polling every second (Phase 2L item 20).
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  if (dismissed || !items?.length) return null;

  const renderHeadline = (item: BreakingTickerEntry) =>
    item.articleSlug ? (
      <Link to={`/article/${item.articleSlug}`} className="hover:underline">{item.headline}</Link>
    ) : (
      <span>{item.headline}</span>
    );

  const chip = (item: BreakingTickerEntry, copy: 1 | 2) => (
    <div
      key={`${item.id}-${copy}`}
      className="bn-ticker-chip flex shrink-0 items-center gap-2 whitespace-nowrap rounded px-4 py-1.5"
      style={{ background: resolveBackground(item), marginRight: '2.5rem' }}
    >
      <span
        className="shrink-0 rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider"
        style={{ backgroundColor: item.badgeBackgroundColor, color: item.badgeTextColor }}
      >
        Breaking
      </span>
      <span className="text-sm font-medium" style={{ color: item.textColor }}>{renderHeadline(item)}</span>
    </div>
  );

  return (
    <div className="border-b border-neutral-200" role="region" aria-label="Breaking news">
      <div className="flex items-stretch">
        {/* min-w-0: without it, this flex child's default min-width:auto lets the wide (intentionally
          * overflowing, by design) .bn-ticker-track-inner content push the whole PAGE into horizontal
          * scroll instead of being clipped by .bn-ticker-track's own overflow-hidden — the classic
          * "flex child won't shrink below its content's width" issue, same class of bug fixed earlier
          * on the related-articles grid. */}
        <div className="min-w-0 flex-1">
          {reducedMotion ? (
            <ul className="flex flex-col gap-1 px-4 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              {items.map((item) => (
                <li key={item.id} className="flex min-w-0 items-center gap-2 rounded px-2 py-1" style={{ background: resolveBackground(item) }}>
                  <span
                    className="shrink-0 rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider"
                    style={{ backgroundColor: item.badgeBackgroundColor, color: item.badgeTextColor }}
                  >
                    Breaking
                  </span>
                  <span className="min-w-0 break-words text-sm font-medium" style={{ color: item.textColor }}>{renderHeadline(item)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div ref={trackRef} className="bn-ticker-track relative h-10 overflow-hidden">
              <div
                className="bn-ticker-track-inner flex h-full w-max items-center"
                style={{ animationDuration: `${computeTrackDurationMs(items)}ms` }}
              >
                {/* Each "set" (one full pass of every active item) is forced to at least the ticker
                  * bar's own measured width — the animation always travels exactly one set's width
                  * (see bn-track-scroll), so without this floor, a single short headline (or few short
                  * ones) would only be as wide as its own text and the whole strip would just wiggle by
                  * that tiny amount instead of actually crossing the bar from left to right. shrink-0
                  * keeps it from being compressed back down below that floor. */}
                <div className="flex shrink-0 items-center" style={{ minWidth: minSetWidth || undefined }}>{items.map((item) => chip(item, 1))}</div>
                <div className="flex shrink-0 items-center" style={{ minWidth: minSetWidth || undefined }}>{items.map((item) => chip(item, 2))}</div>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center bg-neutral-50 px-1">
          <IconButton variant="default" size="sm" aria-label="Dismiss breaking news" onClick={() => setDismissed(true)}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
