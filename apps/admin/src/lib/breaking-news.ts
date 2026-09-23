/**
 * Pure helpers for the Breaking News ticker (Phase 2L) — kept framework-free so they're unit-testable
 * and so the admin live preview computes its style with the exact same logic the public ticker uses
 * (apps/web/src/lib/breaking-news.ts mirrors this file; there is no shared UI package between the two
 * apps, so keeping both pure and small is what keeps them from drifting apart).
 */

export const HEX_COLOR_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

export type BackgroundMode = 'SOLID' | 'GRADIENT';
export type GradientDirection = 'LEFT_RIGHT' | 'RIGHT_LEFT' | 'TOP_BOTTOM' | 'BOTTOM_TOP' | 'DIAGONAL';

export interface BreakingNewsAppearance {
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientStart?: string | null;
  gradientEnd?: string | null;
  gradientDirection?: GradientDirection | null;
  textColor: string;
}

const GRADIENT_ANGLES: Record<GradientDirection, string> = {
  LEFT_RIGHT: 'to right',
  RIGHT_LEFT: 'to left',
  TOP_BOTTOM: 'to bottom',
  BOTTOM_TOP: 'to top',
  DIAGONAL: 'to bottom right',
};

/** The one place that turns admin-chosen appearance fields into an actual CSS background value.
 * Colors are already hex-validated at the API boundary (class-validator's IsHexColor) before they ever
 * reach here, so this never needs to sanitize — it only needs to pick solid vs. gradient. */
export function resolveBackground(appearance: BreakingNewsAppearance): string {
  if (appearance.backgroundMode === 'GRADIENT' && appearance.gradientStart && appearance.gradientEnd) {
    const direction = GRADIENT_ANGLES[appearance.gradientDirection || 'LEFT_RIGHT'];
    return `linear-gradient(${direction}, ${appearance.gradientStart}, ${appearance.gradientEnd})`;
  }
  return appearance.backgroundColor;
}

export interface BreakingNewsListItem {
  id: string;
  priority: number;
}

/** Move-up/move-down (Phase 2L item 15) instead of a drag-and-drop dependency — returns a new ordered
 * id list with the item at `index` swapped with its neighbor, or the unchanged order at either edge. */
export function reorderByStep<T extends BreakingNewsListItem>(items: T[], index: number, direction: 'up' | 'down'): string[] {
  const ids = items.map((item) => item.id);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return ids;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  return ids;
}
