import type { ApiIssue } from '../lib/api-error';
import { CREATABLE_SECTION_TYPES, sectionTypeLabel, SECTION_TYPE_DEFAULT_SOURCE } from './labels';
import type { CatalogueArticle, Draft, DraftSection, StoryArticle } from './types';

/**
 * Pure builder logic (no React, no network) so the rules can be unit-tested. The backend stays the
 * authority: everything here only decides what to offer/disable in the UI, never what is valid.
 */

/** Mirrors MAX_SECTION_ITEMS in the API (homepage.constants.ts). */
export const MAX_SECTION_ITEMS = 24;
export const HERO_TYPE = 'HERO';
export const REPEATABLE_TYPES: readonly string[] = ['CUSTOM'];

// ----------------------------------------------------------------- ordering

export const canMove = (index: number, length: number, delta: -1 | 1) => index + delta >= 0 && index + delta < length;

/** New array with the item at `index` moved by `delta`; the same array when the move is impossible. */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  if (!canMove(index, items.length, delta)) return [...items];
  const next = [...items];
  [next[index], next[index + delta]] = [next[index + delta], next[index]];
  return next;
}

export const heroSection = (draft: Draft): DraftSection | undefined => draft.sections.find((section) => section.type === HERO_TYPE);

/** Sections shown in the "Homepage sections" list: everything except the Hero, which has its own area. */
export const listedSections = (draft: Draft): DraftSection[] => draft.sections.filter((section) => section.type !== HERO_TYPE);

/**
 * Full ordered section-ID list for PUT /homepage/draft/sections/order after moving one listed section.
 * The backend needs EVERY section id (Hero included), so the moved section swaps places with its
 * neighbour in the visible list while the Hero keeps its slot. Returns null if the move is impossible.
 */
export function reorderSectionIds(draft: Draft, sectionId: string, delta: -1 | 1): string[] | null {
  const listed = listedSections(draft);
  const index = listed.findIndex((section) => section.id === sectionId);
  if (index < 0 || !canMove(index, listed.length, delta)) return null;
  const neighbour = listed[index + delta];
  const ids = draft.sections.map((section) => section.id);
  const a = ids.indexOf(sectionId);
  const b = ids.indexOf(neighbour.id);
  [ids[a], ids[b]] = [ids[b], ids[a]];
  return ids;
}

export const placementIds = (section: DraftSection): string[] => section.placements.map((placement) => placement.articleId);

// ------------------------------------------------------------- section rules

/** Types an editor can still add: singleton types already in the draft are not offered again. */
export function availableSectionTypes(draft: Draft): string[] {
  const present = new Set(draft.sections.map((section) => section.type));
  return CREATABLE_SECTION_TYPES.filter((type) => REPEATABLE_TYPES.includes(type) || !present.has(type));
}

export interface MaxItemsBounds {
  min: number;
  max: number;
  /** True when the value cannot be changed (the Hero always shows exactly one story). */
  fixed: boolean;
}

export function maxItemsBounds(section: Pick<DraftSection, 'type' | 'placements'> & { sourceType?: string }): MaxItemsBounds {
  if (section.type === HERO_TYPE) return { min: 1, max: 1, fixed: true };
  // Only hand-picked sections are pinned by what is already placed; an automatic source has no
  // placements, so its limit can move freely.
  const floor = isManualSource(section.sourceType ?? 'MANUAL') ? Math.max(1, section.placements.length) : 1;
  return { min: floor, max: MAX_SECTION_ITEMS, fixed: false };
}

export const supportsCategoryLink = (type: string) => type === 'CUSTOM';

export interface DefaultSourceResolution {
  sourceType: 'CATEGORY' | 'LOCATION';
  categoryId: string | null;
  locationId: string | null;
}

/**
 * A preset section type (e.g. "Bangladesh", "World") has an obvious real-world source. Without applying
 * it automatically, an editor who picks the type and leaves "Where the stories come from" untouched gets
 * a section titled e.g. "Bangladesh" that silently falls back to unfiltered Latest — exactly the bug
 * reported ("I added a Bangladesh section but it's not there"): it existed, titled correctly, but wasn't
 * scoped to Bangladesh at all. Returns null for LATEST/CUSTOM/HERO (no sensible auto-link) or when the
 * matching category/location hasn't loaded yet — the caller falls back to MANUAL in that case rather than
 * guessing.
 */
export function resolveDefaultSourceForType(
  type: string,
  categories: readonly { id: string; name: string; slug?: string }[] | undefined,
  locations: readonly { id: string; name: string; slug?: string; type: string }[] | undefined,
): DefaultSourceResolution | null {
  const preset = SECTION_TYPE_DEFAULT_SOURCE[type];
  if (!preset) return null;

  if (preset.sourceType === 'CATEGORY') {
    const match = categories?.find((category) => (category.slug ?? category.name.toLowerCase()) === preset.slug);
    if (!match) return null;
    return { sourceType: 'CATEGORY', categoryId: match.id, locationId: null };
  }

  const match = locations?.find((location) => location.type === 'COUNTRY' && (location.slug ?? location.name.toLowerCase()) === preset.slug);
  if (!match) return null;
  return { sourceType: 'LOCATION', categoryId: null, locationId: match.id };
}

// ------------------------------------------------------------- content sources

/** True when the editor picks the stories by hand rather than the API resolving a query. */
export const isManualSource = (sourceType: string) => sourceType === 'MANUAL';

export const isManualSection = (section: Pick<DraftSection, 'sourceType'>) => isManualSource(section.sourceType);

/** Which link an automatic source needs; null when it needs none. Mirrors REQUIRED_SOURCE_LINK in the API. */
export function requiredSourceLink(sourceType: string): 'categoryId' | 'tagId' | 'locationId' | null {
  switch (sourceType) {
    case 'CATEGORY':
      return 'categoryId';
    case 'TAG':
      return 'tagId';
    case 'LOCATION':
      return 'locationId';
    default:
      return null;
  }
}

/** Short description of where a section's stories come from, for the section header. */
export function describeSource(section: Pick<DraftSection, 'sourceType' | 'category' | 'tag' | 'location'>): string {
  switch (section.sourceType) {
    case 'LATEST':
      return 'Latest published';
    case 'CATEGORY':
      return section.category ? `Category: ${section.category.name}` : 'Category: not set';
    case 'TAG':
      return section.tag ? `Tag: ${section.tag.name}` : 'Tag: not set';
    case 'LOCATION':
      return section.location ? `Location: ${section.location.name}` : 'Location: not set';
    default:
      return 'Hand-picked';
  }
}

// ---------------------------------------------------------------- publishing

export type PublishTone = 'ok' | 'warning' | 'danger' | 'neutral';

export interface PublishState {
  canPublish: boolean;
  reason: 'ready' | 'conflict' | 'issues' | 'no-changes' | 'busy';
  label: string;
  tone: PublishTone;
}

/** hasUnpublishedChanges and publishable come from the server; only "busy" and "conflict" are local. */
export function publishState(draft: Draft, local: { pending: boolean; conflict: boolean }): PublishState {
  if (local.conflict) return { canPublish: false, reason: 'conflict', label: 'Conflict — reload required', tone: 'danger' };
  if (!draft.publishable) {
    const count = draft.issues.length;
    return { canPublish: false, reason: 'issues', label: `Cannot publish — ${count} validation issue${count === 1 ? '' : 's'}`, tone: 'danger' };
  }
  if (!draft.hasUnpublishedChanges) return { canPublish: false, reason: 'no-changes', label: 'No unpublished changes', tone: 'ok' };
  if (local.pending) return { canPublish: false, reason: 'busy', label: 'Unpublished changes', tone: 'warning' };
  return { canPublish: true, reason: 'ready', label: 'Unpublished changes', tone: 'warning' };
}

export interface DraftSummary {
  sections: number;
  enabledSections: number;
  stories: number;
  heroTitle: string | null;
}

export function summarizeDraft(draft: Draft): DraftSummary {
  const hero = heroSection(draft);
  return {
    sections: draft.sections.length,
    enabledSections: draft.sections.filter((section) => section.enabled).length,
    stories: draft.sections.reduce((total, section) => total + section.placements.length, 0),
    heroTitle: hero?.placements[0]?.article.title ?? null,
  };
}

// -------------------------------------------------------------------- issues

const REASON_TEXT: Record<string, string> = {
  NOT_PUBLISHED: 'is not published',
  ARCHIVED: 'is archived',
  SCHEDULED: 'is scheduled for the future',
  NOT_FOUND: 'no longer exists',
};

export const issuesForSection = (draft: Draft, sectionKey: string): ApiIssue[] => draft.issues.filter((issue) => issue.sectionKey === sectionKey);
export const generalIssues = (draft: Draft): ApiIssue[] => draft.issues.filter((issue) => !issue.sectionKey);

/** Editor-facing sentence for a backend issue; unknown codes fall back to the server's own message. */
export function describeIssue(issue: ApiIssue, draft?: Draft, articleTitles: Record<string, string> = {}): string {
  const section = issue.sectionKey ? draft?.sections.find((candidate) => candidate.key === issue.sectionKey) : undefined;
  const where = section ? `“${section.title}”` : 'A section';
  const article = issue.articleId ? (articleTitles[issue.articleId] ?? section?.placements.find((placement) => placement.articleId === issue.articleId)?.article.title) : undefined;

  switch (issue.code) {
    case 'ARTICLE_INELIGIBLE': {
      const reason = REASON_TEXT[issue.reason ?? ''] ?? 'cannot appear on the homepage';
      return `${article ? `“${article}”` : 'A story'} in ${where} ${reason}. Remove or replace it.`;
    }
    case 'HERO_MULTIPLE':
      return 'The draft has more than one Hero section. Only one is allowed — delete the extra one.';
    case 'HERO_PLACEMENT_LIMIT':
      return 'The Hero can show only one story.';
    case 'DUPLICATE_SECTION_TYPE':
      return `${issue.message} Delete the extra section.`;
    case 'PLACEMENT_LIMIT_EXCEEDED':
      return `${where} has more stories than it can show. Raise its story limit or remove stories.`;
    case 'INVALID_LAYOUT':
      return `${where} uses a layout that is not supported. Choose one of the available layouts.`;
    case 'EMPTY_TITLE':
      return `${where} needs a title.`;
    case 'INVALID_MAX_ITEMS':
      return `${where} has an invalid story limit.`;
    case 'DUPLICATE_PLACEMENT':
      return `${where} lists the same story more than once.`;
    default:
      return issue.message;
  }
}

// ------------------------------------------------------------ article picker

export const PICKER_PAGE_SIZE = 10;

export interface PickerQuery {
  page: number;
  search: string;
  categoryId: string;
}

/**
 * Request path for the picker. It always asks the existing catalogue endpoint for PUBLISHED articles
 * only, newest first; the backend re-validates eligibility when the placement is saved.
 */
export function buildPickerPath({ page, search, categoryId }: PickerQuery): string {
  const params = new URLSearchParams({ status: 'PUBLISHED', sort: 'publishedAt', order: 'desc', limit: String(PICKER_PAGE_SIZE), page: String(page) });
  if (search.trim()) params.set('search', search.trim());
  if (categoryId) params.set('categoryId', categoryId);
  return `/articles?${params.toString()}`;
}

export type Unselectable = 'NOT_PUBLISHED' | 'SCHEDULED';

/** Client-side mirror of the API's public-eligibility rule, used only to grey out rows. */
export function unselectableReason(article: Pick<CatalogueArticle, 'status' | 'publishedAt'>, now: Date = new Date()): Unselectable | null {
  if (article.status !== 'PUBLISHED') return 'NOT_PUBLISHED';
  if (article.publishedAt && new Date(article.publishedAt).getTime() > now.getTime()) return 'SCHEDULED';
  return null;
}

export const toStoryArticle = (article: CatalogueArticle): StoryArticle => ({
  id: article.id,
  title: article.title,
  slug: article.slug,
  status: article.status,
  publishedAt: article.publishedAt,
  media: article.media ?? null,
  category: article.category ?? null,
  author: article.author ?? null,
});

// ------------------------------------------------------------------- display

export const contentLang = (text: string) => (/[ঀ-৿]/.test(text) ? 'bn' : 'en');

export function formatDate(value?: string | null): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export const sectionDisplayTitle = (section: Pick<DraftSection, 'title' | 'type'>) => section.title || sectionTypeLabel(section.type);
