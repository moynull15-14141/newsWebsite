import { HomepageSectionType, HomepageSourceType } from '@prisma/client';

/**
 * Validated layout presets. Each one maps to a composition that the public web (Step 02 editorial
 * components + the NewsCard variants) actually renders — do not add a preset here before the web
 * implements it in `SectionBody`.
 *
 *   FEATURED_STACK   one large lead story + a compact stack of the next stories (2 columns)
 *   TWO_UP           up to two equal standard stories side by side
 *   THREE_UP         up to three equal standard stories side by side
 *   FOUR_UP          up to four equal stories side by side
 *   GRID             responsive image-led grid that reflows by available width
 *   COMPACT_LIST     dense list of compact story rows
 *   HORIZONTAL_LIST  stacked horizontal cards (thumbnail beside a headline and excerpt)
 *   IMAGE_LED        large image lead followed by an image-top grid
 *   TEXT_LED         headline-and-excerpt only, no imagery (opinion / analysis style)
 */
export const HOMEPAGE_LAYOUT_PRESETS = [
  'FEATURED_STACK',
  'TWO_UP',
  'THREE_UP',
  'FOUR_UP',
  'GRID',
  'COMPACT_LIST',
  'HORIZONTAL_LIST',
  'IMAGE_LED',
  'TEXT_LED',
] as const;
export type HomepageLayoutPreset = (typeof HOMEPAGE_LAYOUT_PRESETS)[number];
export const DEFAULT_LAYOUT_PRESET: HomepageLayoutPreset = 'FEATURED_STACK';

export function isLayoutPreset(value: unknown): value is HomepageLayoutPreset {
  return typeof value === 'string' && (HOMEPAGE_LAYOUT_PRESETS as readonly string[]).includes(value);
}

/** Layout used on the public page: unknown/legacy stored values degrade to the default instead of leaking. */
export function normalizeLayoutPreset(value: unknown): HomepageLayoutPreset {
  return isLayoutPreset(value) ? value : DEFAULT_LAYOUT_PRESET;
}

/**
 * Card presentation override. 'AUTO' (the default) lets the layout pick the NewsCard variant, which is
 * what most sections want; the explicit values mirror `ArticleCardVariant` in apps/web so an editor can
 * force a presentation (e.g. render a Custom section with the opinion card).
 */
export const HOMEPAGE_CARD_VARIANTS = [
  'AUTO',
  'featured',
  'large',
  'horizontal',
  'compact',
  'image-top',
  'text-only',
  'video',
  'opinion',
  'standard',
] as const;
export type HomepageCardVariant = (typeof HOMEPAGE_CARD_VARIANTS)[number];
export const DEFAULT_CARD_VARIANT: HomepageCardVariant = 'AUTO';

export function isCardVariant(value: unknown): value is HomepageCardVariant {
  return typeof value === 'string' && (HOMEPAGE_CARD_VARIANTS as readonly string[]).includes(value);
}

export function normalizeCardVariant(value: unknown): HomepageCardVariant {
  return isCardVariant(value) ? value : DEFAULT_CARD_VARIANT;
}

/** Display cap and placement cap per section (a section never has more placements than maxItems). */
export const MAX_SECTION_ITEMS = 24;
export const DEFAULT_SECTION_ITEMS = 4;
export const MAX_SECTIONS_PER_CONFIGURATION = 40;

export const HOMEPAGE_SECTION_TYPES = Object.values(HomepageSectionType) as HomepageSectionType[];
export const HOMEPAGE_SOURCE_TYPES = Object.values(HomepageSourceType) as HomepageSourceType[];

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

/**
 * The link each automatic source needs. MANUAL needs none (it uses HomepagePlacement rows); LATEST needs
 * none either (it is simply the newest published articles). Used by both the DTO-level service checks and
 * the pure configuration validator so the rule is stated once.
 */
export const REQUIRED_SOURCE_LINK: Record<HomepageSourceType, 'categoryId' | 'tagId' | 'locationId' | null> = {
  MANUAL: null,
  LATEST: null,
  CATEGORY: 'categoryId',
  TAG: 'tagId',
  LOCATION: 'locationId',
};

/** True when the section's stories come from editor-picked placements rather than a resolved query. */
export function isManualSource(sourceType: HomepageSourceType | string): boolean {
  return sourceType === 'MANUAL';
}

/**
 * English label the admin builder suggests when a standard (non-CUSTOM) section is created — mirrors
 * SECTION_TYPE_LABELS in apps/admin/src/homepage/labels.ts. Used only to detect whether an editor left a
 * section's title at its suggested default; a title an editor typed themselves is never overridden (see
 * `localizedSectionTitle`). CUSTOM section titles are always the editor's own text, in every language.
 */
export const SECTION_TYPE_DEFAULT_TITLE_EN: Partial<Record<HomepageSectionType, string>> = {
  HERO: 'Hero',
  LATEST: 'Latest',
  BANGLADESH: 'Bangladesh',
  WORLD: 'World',
  POLITICS: 'Politics',
  BUSINESS: 'Business',
  SPORTS: 'Sports',
  TECHNOLOGY: 'Technology',
  ENTERTAINMENT: 'Entertainment',
};

/** Bengali counterpart of SECTION_TYPE_DEFAULT_TITLE_EN, shown when the UI language is "bn". */
export const SECTION_TYPE_DEFAULT_TITLE_BN: Partial<Record<HomepageSectionType, string>> = {
  HERO: 'প্রধান খবর',
  LATEST: 'সর্বশেষ',
  BANGLADESH: 'বাংলাদেশ',
  WORLD: 'বিশ্ব',
  POLITICS: 'রাজনীতি',
  BUSINESS: 'ব্যবসা',
  SPORTS: 'খেলা',
  TECHNOLOGY: 'প্রযুক্তি',
  ENTERTAINMENT: 'বিনোদন',
};

const TITLES_BY_LANGUAGE: Record<string, Partial<Record<HomepageSectionType, string>>> = {
  en: SECTION_TYPE_DEFAULT_TITLE_EN,
  bn: SECTION_TYPE_DEFAULT_TITLE_BN,
};

/**
 * A section's display title for `languageCode`. If the stored title is still exactly the English
 * default (the editor never customized it), the localized default is shown instead; any title the
 * editor actually typed — including a Bengali one, or a CUSTOM section's own title — is always honored
 * verbatim, in every language.
 */
export function localizedSectionTitle(type: string, storedTitle: string, languageCode?: string): string {
  const englishDefault = SECTION_TYPE_DEFAULT_TITLE_EN[type as HomepageSectionType];
  if (!languageCode || !englishDefault || storedTitle !== englishDefault) return storedTitle;
  return TITLES_BY_LANGUAGE[languageCode]?.[type as HomepageSectionType] ?? storedTitle;
}
