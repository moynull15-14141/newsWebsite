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

export interface LayoutMeta {
  label: string;
  hint: string;
}

/** Only presets the public web actually renders (mirrors HOMEPAGE_LAYOUT_PRESETS in the API). */
export const LAYOUT_META: Record<string, LayoutMeta> = {
  FEATURED_STACK: { label: 'Featured + List', hint: '1 lead story + compact supporting stories' },
  THREE_UP: { label: 'Three Columns', hint: 'Equal story grid' },
  COMPACT_LIST: { label: 'Compact List', hint: 'Headline + thumbnail rows' },
};

export const layoutMeta = (preset: string): LayoutMeta => LAYOUT_META[preset] ?? { label: preset, hint: 'Unsupported layout — choose another' };

export const STORY_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In review',
  APPROVED: 'Approved (not published)',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

export const CACHE_NOTICE = 'Public caches may take about a minute to refresh.';
export const ALGORITHMIC_NOTICE = 'Trending, Most read and Breaking news are generated automatically and are not curated here.';
