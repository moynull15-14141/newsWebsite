import { HomepageSectionType } from '@prisma/client';

/**
 * Validated layout presets. Each one maps to a composition that the public web (Step 02 editorial
 * components) actually renders — do not add a preset here before the web implements it.
 *
 *   FEATURED_STACK  one large lead story + a compact stack of the next stories (2 columns)
 *   THREE_UP        up to three equal standard stories side by side
 *   COMPACT_LIST    dense list of compact story rows
 */
export const HOMEPAGE_LAYOUT_PRESETS = ['FEATURED_STACK', 'THREE_UP', 'COMPACT_LIST'] as const;
export type HomepageLayoutPreset = (typeof HOMEPAGE_LAYOUT_PRESETS)[number];
export const DEFAULT_LAYOUT_PRESET: HomepageLayoutPreset = 'FEATURED_STACK';

export function isLayoutPreset(value: unknown): value is HomepageLayoutPreset {
  return typeof value === 'string' && (HOMEPAGE_LAYOUT_PRESETS as readonly string[]).includes(value);
}

/** Layout used on the public page: unknown/legacy stored values degrade to the default instead of leaking. */
export function normalizeLayoutPreset(value: unknown): HomepageLayoutPreset {
  return isLayoutPreset(value) ? value : DEFAULT_LAYOUT_PRESET;
}

/** Display cap and placement cap per section (a section never has more placements than maxItems). */
export const MAX_SECTION_ITEMS = 24;
export const DEFAULT_SECTION_ITEMS = 4;
export const MAX_SECTIONS_PER_CONFIGURATION = 40;

export const HOMEPAGE_SECTION_TYPES = Object.values(HomepageSectionType) as HomepageSectionType[];

/** Only CUSTOM sections may appear more than once in a configuration; every other type is a singleton. */
export const REPEATABLE_SECTION_TYPES: readonly string[] = ['CUSTOM'];

export function isRepeatableType(type: string): boolean {
  return REPEATABLE_SECTION_TYPES.includes(type);
}

export const HERO_MAX_PLACEMENTS = 1;

/** Stable identity of a section inside a configuration: lower(type) for singletons, custom-<suffix> otherwise. */
export function singletonKey(type: HomepageSectionType): string {
  return type.toLowerCase();
}
