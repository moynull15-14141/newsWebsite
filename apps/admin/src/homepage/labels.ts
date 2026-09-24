/** Editor-facing wording for backend enums. Raw enum values are never the primary UI text. */

export const SECTION_TYPE_LABELS: Record<string, string> = {
  HERO: 'Hero',
  LATEST: 'Latest',
  BANGLADESH: 'Bangladesh',
  WORLD: 'World',
  POLITICS: 'Politics',
  BUSINESS: 'Business',
  SPORTS: 'Sports',
  TECHNOLOGY: 'Technology',
  ENTERTAINMENT: 'Entertainment',
  TRENDING: 'Trending',
  MOST_READ: 'Most read',
  CUSTOM: 'Custom section',
};

/**
 * Section types an editor may create. TRENDING and MOST_READ exist in the backend enum, but trending, most
 * read and breaking news are produced by algorithms and are deliberately not curated here. HERO is offered
 * separately (only when the draft has none).
 */
export const CREATABLE_SECTION_TYPES = ['LATEST', 'BANGLADESH', 'WORLD', 'POLITICS', 'BUSINESS', 'SPORTS', 'TECHNOLOGY', 'ENTERTAINMENT', 'CUSTOM'] as const;

export const sectionTypeLabel = (type: string) => SECTION_TYPE_LABELS[type] ?? type;

/**
 * Picking a preset "Section type" (e.g. "Bangladesh") only sets the section's title — it does NOT, on
 * its own, scope the section's content. Without this map, an editor who picks the "Bangladesh" type and
 * leaves "Where the stories come from" untouched gets a section titled "Bangladesh" that actually shows
 * unfiltered Latest stories (the SourceType default), with nothing in the UI flagging the mismatch. This
 * is exactly the bug reported: a "Bangladesh" section that "isn't there" — it existed, titled correctly,
 * but wasn't pulling Bangladesh-specific stories.
 *
 * `BANGLADESH` maps to the Location "Bangladesh" (the country), not the like-named Category — same
 * reasoning as the public nav's FIXED_NAV (see apps/web/src/components/Header.tsx): the location
 * aggregates every district tagged under it, which the identically-named category does not.
 */
export const SECTION_TYPE_DEFAULT_SOURCE: Partial<Record<string, { sourceType: 'CATEGORY' | 'LOCATION'; slug: string }>> = {
  BANGLADESH: { sourceType: 'LOCATION', slug: 'bangladesh' },
  WORLD: { sourceType: 'CATEGORY', slug: 'world' },
  POLITICS: { sourceType: 'CATEGORY', slug: 'politics' },
  BUSINESS: { sourceType: 'CATEGORY', slug: 'business' },
  SPORTS: { sourceType: 'CATEGORY', slug: 'sports' },
  TECHNOLOGY: { sourceType: 'CATEGORY', slug: 'technology' },
  ENTERTAINMENT: { sourceType: 'CATEGORY', slug: 'entertainment' },
};

export interface LayoutMeta {
  label: string;
  hint: string;
}

/** Only presets the public web actually renders (mirrors HOMEPAGE_LAYOUT_PRESETS in the API). */
export const LAYOUT_META: Record<string, LayoutMeta> = {
  FEATURED_STACK: { label: 'Featured + List', hint: '1 lead story + compact supporting stories' },
  TWO_UP: { label: 'Two Columns', hint: 'Two equal stories side by side' },
  THREE_UP: { label: 'Three Columns', hint: 'Three equal stories side by side' },
  FOUR_UP: { label: 'Four Columns', hint: 'Four equal stories side by side' },
  GRID: { label: 'Grid', hint: 'Image-led cards that reflow by width' },
  COMPACT_LIST: { label: 'Compact List', hint: 'Headline + thumbnail rows' },
  HORIZONTAL_LIST: { label: 'Horizontal List', hint: 'Thumbnail beside headline and summary' },
  IMAGE_LED: { label: 'Image Led', hint: 'Large lead image + image cards below' },
  TEXT_LED: { label: 'Text Led', hint: 'Headlines only, no images (opinion / analysis)' },
};

export const layoutMeta = (preset: string): LayoutMeta => LAYOUT_META[preset] ?? { label: preset, hint: 'Unsupported layout — choose another' };

/**
 * Where a section's stories come from. MANUAL is the editor-picked list the builder has always had; the
 * others are resolved by the API every time the homepage is served, so they stay current on their own.
 */
export const SOURCE_TYPE_META: Record<string, LayoutMeta> = {
  MANUAL: { label: 'Hand-picked stories', hint: 'You choose each story and its order.' },
  LATEST: { label: 'Latest published', hint: 'Newest published stories, updated automatically.' },
  CATEGORY: { label: 'From a category', hint: 'Newest stories in one category.' },
  TAG: { label: 'From a tag', hint: 'Newest stories carrying one tag.' },
  LOCATION: { label: 'From a location', hint: 'Newest stories from a division or district (includes its districts).' },
};

export const sourceTypeMeta = (source: string): LayoutMeta => SOURCE_TYPE_META[source] ?? { label: source, hint: '' };
export const sourceTypeLabel = (source: string) => sourceTypeMeta(source).label;

/** Editor-facing names for the NewsCard variants a section may force. */
export const CARD_VARIANT_LABELS: Record<string, string> = {
  AUTO: 'Automatic (match the layout)',
  featured: 'Featured (overlay headline)',
  large: 'Large (overlay headline)',
  horizontal: 'Horizontal (thumbnail beside text)',
  compact: 'Compact (small thumbnail)',
  'image-top': 'Image on top',
  'text-only': 'Text only',
  video: 'Video (play badge)',
  opinion: 'Opinion (accent rule)',
  standard: 'Standard',
};

export const cardVariantLabel = (variant: string) => CARD_VARIANT_LABELS[variant] ?? variant;

export const STORY_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In review',
  APPROVED: 'Approved (not published)',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

export const CACHE_NOTICE = 'Public caches may take about a minute to refresh.';
export const ALGORITHMIC_NOTICE = 'Trending, Most read and Breaking news are generated automatically and are not curated here.';
