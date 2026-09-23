/**
 * Pure helpers for the public Breaking News ticker (Phase 2L). Mirrors
 * apps/admin/src/lib/breaking-news.ts's resolveBackground exactly — there is no shared UI package
 * between the two apps, so the admin live preview and the real public ticker are only guaranteed to
 * look the same by keeping this function identical on both sides.
 */

export type BackgroundMode = 'SOLID' | 'GRADIENT';
export type GradientDirection = 'LEFT_RIGHT' | 'RIGHT_LEFT' | 'TOP_BOTTOM' | 'BOTTOM_TOP' | 'DIAGONAL';

export interface BreakingNewsAppearance {
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientStart?: string | null;
  gradientEnd?: string | null;
  gradientDirection?: GradientDirection | null;
}

const GRADIENT_ANGLES: Record<GradientDirection, string> = {
  LEFT_RIGHT: 'to right',
  RIGHT_LEFT: 'to left',
  TOP_BOTTOM: 'to bottom',
  BOTTOM_TOP: 'to top',
  DIAGONAL: 'to bottom right',
};

export function resolveBackground(appearance: BreakingNewsAppearance): string {
  if (appearance.backgroundMode === 'GRADIENT' && appearance.gradientStart && appearance.gradientEnd) {
    const direction = GRADIENT_ANGLES[appearance.gradientDirection || 'LEFT_RIGHT'];
    return `linear-gradient(${direction}, ${appearance.gradientStart}, ${appearance.gradientEnd})`;
  }
  return appearance.backgroundColor;
}

export interface BreakingTickerItem {
  animationSpeedMs: number;
}

/** Total duration for one full loop of the continuous ticker strip (all active items concatenated,
 * see BreakingNewsBanner). One-item-at-a-time cycling (advance on animationEnd) used to get stuck
 * whenever an interaction — a hover pause, a tab going to the background — interrupted the animation
 * event for the current item, since nothing else would ever trigger the next one. A single continuous
 * CSS animation that never depends on a per-item completion event can't get stuck that way, and summing
 * each item's own speed means more/slower items simply make one full loop take proportionally longer,
 * instead of always covering the same distance in the same time (which would make many items fly by
 * unreadably fast). Falls back to a sane default so a single item without one still gets a normal pace. */
export function computeTrackDurationMs(items: BreakingTickerItem[]): number {
  const DEFAULT_MS = 18000;
  if (items.length === 0) return DEFAULT_MS;
  const total = items.reduce((sum, item) => sum + (item.animationSpeedMs || DEFAULT_MS), 0);
  return Math.max(total, 4000);
}
