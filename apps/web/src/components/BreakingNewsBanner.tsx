import { useCallback, useEffect, useRef, useState } from 'react';
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

/** Admin-chosen presentation for the whole banner — see apps/admin/src/pages/BreakingNewsPage.tsx's
 * "Ticker style" picker. Stored as a plain PlatformSetting (via /breaking-news/settings), not per-item.
 * Chips keeps each headline's own colors (that's what per-item colors are for). Marquee/Rotator each
 * show one bar/badge at a time with no natural "whose color wins" when several items are active with
 * different colors, so each has its own dedicated color set (`marquee`/`rotator` below) — headlines
 * still come from whichever items are active, only the coloring is decoupled from the individual items. */
type TickerStyle = 'CHIPS' | 'MARQUEE' | 'ROTATOR';

interface TickerColors {
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientStart: string | null;
  gradientEnd: string | null;
  gradientDirection: GradientDirection | null;
  textColor: string;
  badgeBackgroundColor: string;
  badgeTextColor: string;
}

/** Marquee-only: which way the headline crawls, and how long one full pass takes. RTL (right edge in,
 * left edge out) is the standard news-ticker convention and the default; the bn-marquee-scroll keyframes
 * always animate RTL, so LTR is played back via `animation-direction: reverse` rather than needing a
 * second set of keyframes. `speedMs` is its own setting, not derived from any item's animationSpeedMs
 * (that field was designed for Chips — summing several different items' speeds together made the
 * marquee's pace an accident of how many items happened to be active, not a deliberate choice). */
type TickerDirection = 'LTR' | 'RTL';
interface MarqueeSettings extends TickerColors {
  direction: TickerDirection;
  speedMs: number;
}

/** Rotator-only: how long each headline holds before fading to the next — its own setting, not derived
 * from any item's animationSpeedMs (same reasoning as colors: no single active item's speed should win). */
interface RotatorSettings extends TickerColors {
  holdMs: number;
}

interface TickerSettings {
  style: TickerStyle;
  marquee: MarqueeSettings;
  rotator: RotatorSettings;
}

function renderHeadline(item: BreakingTickerEntry, className?: string) {
  return item.articleSlug ? (
    <Link to={`/article/${item.articleSlug}`} className={`hover:underline ${className ?? ''}`}>{item.headline}</Link>
  ) : (
    <span className={className}>{item.headline}</span>
  );
}

function Badge({ backgroundColor, color }: { backgroundColor: string; color: string }) {
  return (
    <span className="shrink-0 rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider" style={{ backgroundColor, color }}>
      Breaking News
    </span>
  );
}

/** Every headline listed at once, no movement — used both for prefers-reduced-motion and as the shared
 * fallback list any style variant below can degrade to. */
function StaticList({ items }: { items: BreakingTickerEntry[] }) {
  return (
    <ul className="flex flex-col gap-1 px-4 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
      {items.map((item) => (
        <li key={item.id} className="flex min-w-0 items-center gap-2 rounded px-2 py-1" style={{ background: resolveBackground(item) }}>
          <Badge backgroundColor={item.badgeBackgroundColor} color={item.badgeTextColor} />
          <span className="min-w-0 break-words text-sm font-medium" style={{ color: item.textColor }}>{renderHeadline(item)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Original style (Phase 2L): all active items scroll together as one continuous strip, each headline its
 * own colored chip that fades in/out at its edges so adjacent colors blend instead of cutting abruptly.
 */
function ChipsTicker({ items }: { items: BreakingTickerEntry[] }) {
  const [minSetWidth, setMinSetWidth] = useState(0);
  const [trackNode, setTrackNode] = useState<HTMLDivElement | null>(null);
  const trackRef = useCallback((node: HTMLDivElement | null) => setTrackNode(node), []);

  useEffect(() => {
    if (!trackNode) return undefined;
    const observer = new ResizeObserver(([entry]) => setMinSetWidth(entry.contentRect.width));
    observer.observe(trackNode);
    return () => observer.disconnect();
  }, [trackNode]);

  const chip = (item: BreakingTickerEntry, copy: 1 | 2) => (
    <div
      key={`${item.id}-${copy}`}
      className="bn-ticker-chip flex shrink-0 items-center gap-2 whitespace-nowrap rounded px-4 py-1.5"
      style={{ background: resolveBackground(item), marginRight: '2.5rem' }}
    >
      <Badge backgroundColor={item.badgeBackgroundColor} color={item.badgeTextColor} />
      <span className="text-sm font-medium" style={{ color: item.textColor }}>{renderHeadline(item)}</span>
    </div>
  );

  return (
    <div ref={trackRef} className="bn-ticker-track relative h-10 overflow-hidden">
      <div className="bn-ticker-track-inner flex h-full w-max items-center" style={{ animationDuration: `${computeTrackDurationMs(items)}ms` }}>
        {/* Each "set" is forced to at least the bar's own measured width so a single short headline
          * doesn't just wiggle by its own text width instead of crossing the whole bar. */}
        <div className="flex shrink-0 items-center" style={{ minWidth: minSetWidth || undefined }}>{items.map((item) => chip(item, 1))}</div>
        <div className="flex shrink-0 items-center" style={{ minWidth: minSetWidth || undefined }}>{items.map((item) => chip(item, 2))}</div>
      </div>
    </div>
  );
}

/**
 * New style: one solid-color bar, using its OWN dedicated color set (`colors`, from admin's ticker
 * settings) — not any active item's colors — with a single fixed "Breaking News" badge on the left.
 * Only the headline TEXT scrolls past it, joined into one continuous line, instead of each headline
 * being its own moving colored block.
 */
function MarqueeTicker({ items, colors }: { items: BreakingTickerEntry[]; colors: MarqueeSettings }) {
  const [minSetWidth, setMinSetWidth] = useState(0);
  const [trackNode, setTrackNode] = useState<HTMLDivElement | null>(null);
  const trackRef = useCallback((node: HTMLDivElement | null) => setTrackNode(node), []);

  useEffect(() => {
    if (!trackNode) return undefined;
    const observer = new ResizeObserver(([entry]) => setMinSetWidth(entry.contentRect.width));
    observer.observe(trackNode);
    return () => observer.disconnect();
  }, [trackNode]);

  const line = (copy: 1 | 2) => (
    <div key={copy} className="flex shrink-0 items-center whitespace-nowrap" style={{ minWidth: minSetWidth || undefined }}>
      {items.map((item, index) => (
        <span key={`${item.id}-${copy}`} className="flex items-center whitespace-nowrap text-sm font-medium" style={{ color: colors.textColor }}>
          {renderHeadline(item)}
          {index < items.length - 1 && <span className="mx-6 opacity-60" aria-hidden="true">•</span>}
        </span>
      ))}
      <span className="mx-6 opacity-60" aria-hidden="true">•</span>
    </div>
  );

  return (
    <div className="flex h-10 items-center gap-3 overflow-hidden px-4" style={{ background: resolveBackground(colors) }}>
      <Badge backgroundColor={colors.badgeBackgroundColor} color={colors.badgeTextColor} />
      <div ref={trackRef} className="min-w-0 flex-1 overflow-hidden">
        <div
          className="bn-marquee-track flex w-max items-center"
          style={{ animationDuration: `${colors.speedMs}ms`, animationDirection: colors.direction === 'LTR' ? 'reverse' : 'normal' }}
        >
          {line(1)}
          {line(2)}
        </div>
      </div>
    </div>
  );
}

/**
 * New style, aimed at "read it in a glance": no scrolling motion at all. One headline shows at a time,
 * centered, and cross-fades to the next after `colors.holdMs` — its own dedicated setting, not any
 * item's animationSpeedMs (that field means "how fast to scroll", not "how long to stand still"; same
 * reasoning as colors — see MarqueeTicker's comment for why no single active item's setting should win).
 */
function RotatorTicker({ items, colors }: { items: BreakingTickerEntry[]; colors: RotatorSettings }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = items[index % items.length];

  useEffect(() => {
    setIndex(0);
    setVisible(true);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return undefined;
    const holdMs = Math.max(colors.holdMs || 4000, 1000);
    const fadeOutTimer = setTimeout(() => setVisible(false), holdMs);
    timeoutRef.current = fadeOutTimer;
    return () => clearTimeout(fadeOutTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items.length, colors.holdMs]);

  const onFadeOutEnd = () => {
    if (visible) return; // only advance once opacity has actually reached 0
    setIndex((i) => (i + 1) % items.length);
    setVisible(true);
  };

  return (
    <div className="flex h-10 items-center justify-center gap-3 overflow-hidden px-4" style={{ background: resolveBackground(colors) }}>
      <div
        className="flex min-w-0 items-center gap-3 transition-opacity duration-300 ease-in-out"
        style={{ opacity: visible ? 1 : 0 }}
        onTransitionEnd={onFadeOutEnd}
      >
        <Badge backgroundColor={colors.badgeBackgroundColor} color={colors.badgeTextColor} />
        <span className="min-w-0 truncate text-sm font-medium" style={{ color: colors.textColor }}>{renderHeadline(current)}</span>
      </div>
    </div>
  );
}

/**
 * Admin-controlled, database-driven live ticker (Phase 2L; multi-style Phase 2S). Which of the three
 * presentation styles below renders is a single global choice (see TickerStyle) — the admin's "Ticker
 * style" picker keeps exactly one active at a time. Reduced-motion users always get the static list
 * regardless of style, since every style variant here involves either motion or a timed auto-advance.
 */
export default function BreakingNewsBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const { data: items } = useQuery<BreakingTickerEntry[]>({
    queryKey: ['breaking-news-ticker'],
    queryFn: () => apiFetch('/public/breaking-news-ticker'),
    // Admin changes should show up promptly without polling every second (Phase 2L item 20).
    refetchInterval: 60_000,
  });

  const { data: tickerSettings } = useQuery<TickerSettings>({
    queryKey: ['breaking-news-ticker-settings'],
    queryFn: () => apiFetch('/public/breaking-news-ticker/settings'),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  if (dismissed || !items?.length) return null;

  const style: TickerStyle = tickerSettings?.style ?? 'CHIPS';

  return (
    <div className="border-b border-neutral-200" role="region" aria-label="Breaking news">
      <div className="flex items-stretch">
        {/* min-w-0: without it, this flex child's default min-width:auto lets the wide (intentionally
          * overflowing, by design) scrolling content push the whole PAGE into horizontal scroll instead
          * of being clipped by the ticker's own overflow-hidden. */}
        <div className="min-w-0 flex-1">
          {reducedMotion ? (
            <StaticList items={items} />
          ) : style === 'MARQUEE' && tickerSettings ? (
            <MarqueeTicker items={items} colors={tickerSettings.marquee} />
          ) : style === 'ROTATOR' && tickerSettings ? (
            <RotatorTicker items={items} colors={tickerSettings.rotator} />
          ) : (
            <ChipsTicker items={items} />
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
