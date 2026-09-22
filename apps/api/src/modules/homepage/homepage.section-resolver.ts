import { HomepageSourceType, Prisma, PrismaClient } from '@prisma/client';
import { isPubliclyEligible, publicArticleWhere } from '../articles/public-eligibility';
import { ARTICLE_SELECT } from '../public/public-article-select';
import { articleLanguageWhere, LanguageFilter, matchesLanguage } from '../../common/i18n/article-language';
import { loadLocationFamilies } from '../../common/location/location-descendants';
import { isManualSource, MAX_SECTION_ITEMS } from './homepage.constants';

/**
 * The ONE place a homepage section's stories are resolved. Every source type goes through
 * `resolveSectionArticles`, so the public homepage, the admin draft preview and the tests all get the
 * same content for the same configuration, and no section needs its own endpoint or service.
 *
 * Design notes:
 *   - MANUAL sections normally use the editor's ordered HomepagePlacement rows as-is. When a placement's
 *     own article is not in the requested language, its PUBLISHED sibling translation (same
 *     translationGroupId) is substituted; if no such translation exists, the placement is dropped rather
 *     than showing the wrong language — the same "no fake translation" rule Part 15 applies to articles.
 *   - Automatic sources (LATEST / CATEGORY / TAG / LOCATION) are grouped by source signature, so two
 *     sections asking for the same thing cost one query, and every group runs in parallel. A configuration
 *     resolves in a small fixed number of queries rather than one round trip per section.
 *   - Every path filters through `publicArticleWhere` / `isPubliclyEligible`, the project's single
 *     definition of "may be shown publicly", so a draft, scheduled or archived story can never leak.
 */

/** Minimum a section must expose to be resolvable. Matches the loaded Prisma row and the test fixtures. */
export interface ResolvableSection {
  id: string;
  sourceType: HomepageSourceType | string;
  categoryId: string | null;
  locationId: string | null;
  tagId: string | null;
  maxItems: number;
  placements: Array<{ article: (Record<string, unknown> & { id?: string; translationGroupId?: string | null; language?: { id: string } | null }) | null }>;
}

type ArticleReader = Pick<PrismaClient, 'article'>;
type LocationReader = Pick<PrismaClient, 'location'>;

/** Stories a section resolves to, keyed by section id. Always eligible, always capped to maxItems. */
export type ResolvedSectionArticles = Map<string, any[]>;

const clampTake = (value: number) => Math.min(Math.max(Number.isInteger(value) ? value : 1, 1), MAX_SECTION_ITEMS);

/**
 * Identifies an automatic query. Sections sharing a signature share one database round trip; the group's
 * `take` is the largest limit any member asked for and each section slices its own share from the result.
 */
function sourceSignature(section: ResolvableSection): string | null {
  switch (section.sourceType) {
    case 'LATEST':
      return 'LATEST';
    case 'CATEGORY':
      return section.categoryId ? `CATEGORY:${section.categoryId}` : null;
    case 'TAG':
      return section.tagId ? `TAG:${section.tagId}` : null;
    case 'LOCATION':
      return section.locationId ? `LOCATION:${section.locationId}` : null;
    default:
      return null;
  }
}

/**
 * Where-clause for one automatic source, on top of the public eligibility rule.
 * LOCATION includes the location's direct children, matching PublicService.getArticlesByLocation, so a
 * division section also shows its districts' stories. The language filter (when a language is given) is
 * kept inside its own `AND` entry — for the default language it is itself an `OR` (also matches legacy
 * null-language rows), which would silently replace `base`'s eligibility `OR` if merged by a plain
 * object spread instead. No `language` at all means "don't filter by language" (used by callers that
 * predate Phase 2C and by this module's own unit tests).
 */
function sourceWhere(
  sourceType: string,
  linkId: string | null,
  now: Date,
  locationIds: string[],
  language?: LanguageFilter,
): Prisma.ArticleWhereInput {
  const base = publicArticleWhere(now);
  const specific: Prisma.ArticleWhereInput =
    sourceType === 'CATEGORY' ? { categoryId: linkId! }
      : sourceType === 'TAG' ? { articleTags: { some: { tagId: linkId! } } }
        : sourceType === 'LOCATION' ? { locationId: { in: locationIds } }
          : {};
  return language ? { ...base, ...specific, AND: [articleLanguageWhere(language)] } : { ...base, ...specific };
}

/**
 * Batch-resolves the PUBLISHED same-language sibling for every given article, keyed by that article's
 * translationGroupId. One query regardless of how many placements need a swap.
 */
async function loadTranslationSiblings(
  prisma: ArticleReader,
  translationGroupIds: string[],
  language: LanguageFilter,
): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  if (!translationGroupIds.length) return map;
  const siblings = await prisma.article.findMany({
    where: { translationGroupId: { in: translationGroupIds }, status: 'PUBLISHED', ...articleLanguageWhere(language) },
    select: ARTICLE_SELECT,
  });
  for (const sibling of siblings) {
    if (sibling.translationGroupId) map.set(sibling.translationGroupId, sibling);
  }
  return map;
}

/**
 * Resolves every section's stories. Returns a map of section id -> ordered, publicly eligible articles
 * selected with `ARTICLE_SELECT`, so resolved stories are shape-identical to every other public listing.
 *
 * `language` decides which language variant is shown; every article returned matches it (or is dropped
 * for MANUAL sections / excluded by the query for automatic ones). It is optional: omitting it resolves
 * every section exactly as Phase 2B did, with no language filtering at all — every existing caller (and
 * this module's own tests) that predates Phase 2C keeps working unchanged. Production callers
 * (PublicService) always resolve and pass a real language.
 */
export async function resolveSectionArticles(
  prisma: ArticleReader & LocationReader,
  sections: ResolvableSection[],
  now: Date = new Date(),
  language?: LanguageFilter,
): Promise<ResolvedSectionArticles> {
  const resolved: ResolvedSectionArticles = new Map();

  // MANUAL sections: start from the editor's placements, eligible-and-ordered; a wrong-language
  // placement is queued for a sibling swap rather than resolved yet (only when `language` is given).
  const manualPending = new Map<string, Array<Record<string, unknown> & { translationGroupId?: string | null; language?: { id: string } | null }>>();
  const swapGroupIds = new Set<string>();
  const automatic: ResolvableSection[] = [];

  for (const section of sections) {
    if (isManualSource(section.sourceType)) {
      const eligible = section.placements
        .map((placement) => placement.article)
        .filter((article): article is NonNullable<typeof article> => isPubliclyEligible(article as any, now))
        .slice(0, clampTake(section.maxItems));
      manualPending.set(section.id, eligible);
      if (language) {
        for (const article of eligible) {
          if (!matchesLanguage((article.language as any)?.id ?? null, language) && article.translationGroupId) {
            swapGroupIds.add(article.translationGroupId as string);
          }
        }
      }
    } else if (sourceSignature(section)) {
      automatic.push(section);
    } else {
      // Misconfigured automatic section (e.g. CATEGORY with no category): render nothing rather than
      // falling back to unrelated stories. Publishing is blocked separately by the validator.
      resolved.set(section.id, []);
    }
  }

  const siblings = language ? await loadTranslationSiblings(prisma, [...swapGroupIds], language) : new Map<string, any>();
  for (const [sectionId, articles] of manualPending) {
    const final = !language
      ? articles
      : articles
          .map((article) => (matchesLanguage((article.language as any)?.id ?? null, language) ? article : siblings.get(article.translationGroupId as string) ?? null))
          .filter((article): article is NonNullable<typeof article> => article !== null);
    resolved.set(sectionId, final);
  }

  if (!automatic.length) return resolved;

  // Group by source signature so duplicate sources cost one query.
  const groups = new Map<string, { sourceType: string; linkId: string | null; take: number; sectionIds: string[] }>();
  for (const section of automatic) {
    const signature = sourceSignature(section)!;
    const group = groups.get(signature);
    const take = clampTake(section.maxItems);
    if (group) {
      group.take = Math.max(group.take, take);
      group.sectionIds.push(section.id);
    } else {
      const linkId =
        section.sourceType === 'CATEGORY' ? section.categoryId
          : section.sourceType === 'TAG' ? section.tagId
            : section.sourceType === 'LOCATION' ? section.locationId
              : null;
      groups.set(signature, { sourceType: String(section.sourceType), linkId, take, sectionIds: [section.id] });
    }
  }

  const locationParents = [...groups.values()]
    .filter((group) => group.sourceType === 'LOCATION' && group.linkId)
    .map((group) => group.linkId!);
  const families = await loadLocationFamilies(prisma, [...new Set(locationParents)]);

  const entries = [...groups.entries()];
  const results = await Promise.all(
    entries.map(([, group]) =>
      prisma.article.findMany({
        where: sourceWhere(group.sourceType, group.linkId, now, group.linkId ? (families.get(group.linkId) ?? [group.linkId]) : [], language),
        orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        take: group.take,
        select: ARTICLE_SELECT,
      }),
    ),
  );

  entries.forEach(([, group], index) => {
    const articles = results[index];
    for (const sectionId of group.sectionIds) {
      const section = automatic.find((candidate) => candidate.id === sectionId)!;
      resolved.set(sectionId, articles.slice(0, clampTake(section.maxItems)));
    }
  });

  return resolved;
}
