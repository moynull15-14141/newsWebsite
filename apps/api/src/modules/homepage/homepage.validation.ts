import { ineligibleReason, IneligibleReason } from '../articles/public-eligibility';
import {
  HERO_MAX_PLACEMENTS,
  isCardVariant,
  isLayoutPreset,
  isManualSource,
  isRepeatableType,
  MAX_SECTION_ITEMS,
  REQUIRED_SOURCE_LINK,
} from './homepage.constants';

export interface HomepageIssue {
  code:
    | 'EMPTY_TITLE'
    | 'INVALID_LAYOUT'
    | 'INVALID_CARD_VARIANT'
    | 'INVALID_MAX_ITEMS'
    | 'INVALID_SOURCE_TYPE'
    | 'SOURCE_LINK_MISSING'
    | 'PLACEMENT_LIMIT_EXCEEDED'
    | 'HERO_PLACEMENT_LIMIT'
    | 'HERO_MULTIPLE'
    | 'DUPLICATE_SECTION_TYPE'
    | 'DUPLICATE_SECTION_KEY'
    | 'DUPLICATE_PLACEMENT'
    | 'ARTICLE_INELIGIBLE';
  message: string;
  sectionKey?: string;
  articleId?: string;
  reason?: IneligibleReason;
}

export interface ValidatableSection {
  key: string;
  type: string;
  title: string;
  layoutType: string;
  maxItems: number;
  /** Absent on legacy callers/fixtures; treated as MANUAL, which is the column default. */
  sourceType?: string;
  cardVariant?: string;
  categoryId?: string | null;
  tagId?: string | null;
  locationId?: string | null;
  placements: Array<{ articleId: string; article: { status: string; publishedAt?: Date | string | null } | null }>;
}

/** Codes that a placement replacement is responsible for (section/type rules are checked at publish). */
export const PLACEMENT_ISSUE_CODES: ReadonlySet<HomepageIssue['code']> = new Set([
  'DUPLICATE_PLACEMENT',
  'PLACEMENT_LIMIT_EXCEEDED',
  'HERO_PLACEMENT_LIMIT',
  'ARTICLE_INELIGIBLE',
]);

/**
 * Validates a whole configuration. Pure (no I/O) so publish, preview readiness and unit tests all share
 * the exact same rules. Returns every problem instead of stopping at the first, so an editor can fix
 * them in one pass.
 */
export function validateHomepageSections(sections: ValidatableSection[], now: Date = new Date()): HomepageIssue[] {
  const issues: HomepageIssue[] = [];

  const keyCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  for (const section of sections) {
    keyCounts.set(section.key, (keyCounts.get(section.key) ?? 0) + 1);
    typeCounts.set(section.type, (typeCounts.get(section.type) ?? 0) + 1);
  }
  for (const [key, count] of keyCounts) {
    if (count > 1) issues.push({ code: 'DUPLICATE_SECTION_KEY', sectionKey: key, message: `Section key "${key}" is used ${count} times.` });
  }
  for (const [type, count] of typeCounts) {
    if (count < 2) continue;
    if (type === 'HERO') issues.push({ code: 'HERO_MULTIPLE', message: `Only one HERO section is allowed (found ${count}).` });
    else if (!isRepeatableType(type)) issues.push({ code: 'DUPLICATE_SECTION_TYPE', message: `Only one ${type} section is allowed (found ${count}).` });
  }

  for (const section of sections) {
    const at = { sectionKey: section.key };
    const sourceType = section.sourceType ?? 'MANUAL';
    if (!section.title.trim()) issues.push({ code: 'EMPTY_TITLE', message: 'Section title must not be empty.', ...at });
    if (!isLayoutPreset(section.layoutType)) issues.push({ code: 'INVALID_LAYOUT', message: `Unknown layout preset "${section.layoutType}".`, ...at });
    if (section.cardVariant !== undefined && !isCardVariant(section.cardVariant)) {
      issues.push({ code: 'INVALID_CARD_VARIANT', message: `Unknown card presentation "${section.cardVariant}".`, ...at });
    }
    if (!Number.isInteger(section.maxItems) || section.maxItems < 1 || section.maxItems > MAX_SECTION_ITEMS) {
      issues.push({ code: 'INVALID_MAX_ITEMS', message: `maxItems must be between 1 and ${MAX_SECTION_ITEMS}.`, ...at });
    }

    // An automatic source must have the link it queries by, otherwise it would silently render nothing.
    if (!(sourceType in REQUIRED_SOURCE_LINK)) {
      issues.push({ code: 'INVALID_SOURCE_TYPE', message: `Unknown content source "${sourceType}".`, ...at });
    } else {
      const required = REQUIRED_SOURCE_LINK[sourceType as keyof typeof REQUIRED_SOURCE_LINK];
      if (required && !section[required]) {
        issues.push({
          code: 'SOURCE_LINK_MISSING',
          message: `A ${sourceType} section needs a ${required === 'categoryId' ? 'category' : required === 'tagId' ? 'tag' : 'location'} to pull stories from.`,
          ...at,
        });
      }
    }

    // Placement rules only apply to MANUAL sections. Automatic sources hold no placements (the service
    // clears them when the source changes) and are capped at read time by the resolver.
    if (!isManualSource(sourceType)) continue;

    if (section.placements.length > section.maxItems) {
      issues.push({ code: 'PLACEMENT_LIMIT_EXCEEDED', message: `${section.placements.length} articles placed but the section shows at most ${section.maxItems}.`, ...at });
    }
    if (section.type === 'HERO' && section.placements.length > HERO_MAX_PLACEMENTS) {
      issues.push({ code: 'HERO_PLACEMENT_LIMIT', message: `The HERO section can hold at most ${HERO_MAX_PLACEMENTS} article.`, ...at });
    }

    const seen = new Set<string>();
    for (const placement of section.placements) {
      if (seen.has(placement.articleId)) {
        issues.push({ code: 'DUPLICATE_PLACEMENT', articleId: placement.articleId, message: 'The same article is placed more than once in this section.', ...at });
      }
      seen.add(placement.articleId);

      const reason = ineligibleReason(placement.article, now);
      if (reason) {
        issues.push({ code: 'ARTICLE_INELIGIBLE', articleId: placement.articleId, reason, message: describeIneligibility(reason), ...at });
      }
    }
  }

  return issues;
}

export function describeIneligibility(reason: IneligibleReason): string {
  switch (reason) {
    case 'NOT_FOUND':
      return 'Article does not exist.';
    case 'ARCHIVED':
      return 'Article is archived and cannot appear on the homepage.';
    case 'SCHEDULED':
      return 'Article is scheduled for the future and is not public yet.';
    default:
      return 'Only published articles can appear on the homepage.';
  }
}

/** Stable fingerprint of a configuration's content (ignores ids/timestamps) to detect unpublished changes. */
export function configurationSignature(
  sections: Array<ValidatableSection & { enabled: boolean }>,
): string {
  return JSON.stringify(
    sections.map((section) => [
      section.key,
      section.type,
      section.title,
      section.enabled,
      section.maxItems,
      section.layoutType,
      section.cardVariant ?? 'AUTO',
      section.sourceType ?? 'MANUAL',
      section.categoryId ?? null,
      section.locationId ?? null,
      section.tagId ?? null,
      section.placements.map((placement) => placement.articleId),
    ]),
  );
}
