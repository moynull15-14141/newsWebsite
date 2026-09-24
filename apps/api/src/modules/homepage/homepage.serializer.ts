import { HomepageConfigurationStatus, Prisma, PrismaClient } from '@prisma/client';
import { publicArticleWhere } from '../articles/public-eligibility';
import { ARTICLE_SELECT } from '../public/public-article-select';
import { localizedName, TranslationRow } from '../../common/i18n/localize';
import {
  HomepageCardVariant,
  HomepageLayoutPreset,
  localizedSectionTitle,
  MAX_SECTION_ITEMS,
  normalizeCardVariant,
  normalizeLayoutPreset,
} from './homepage.constants';
import type { ResolvedSectionArticles } from './homepage.section-resolver';

/**
 * The ONE serializer for configured homepages. The public endpoint (ACTIVE configuration) and the
 * admin preview (DRAFT configuration) both go through it, so they cannot drift apart.
 *
 * Stories reach it already resolved by `resolveSectionArticles` — manual placements and automatic
 * sources are indistinguishable by the time they get here, which is why adding a source type never
 * touches this file or the public components.
 */

const TAXONOMY_LINK_SELECT = { translations: { include: { language: { select: { code: true } } } } } as const;

export function homepageSectionInclude(now: Date) {
  return {
    category: { select: { id: true, name: true, slug: true, ...TAXONOMY_LINK_SELECT } },
    tag: { select: { id: true, name: true, slug: true, ...TAXONOMY_LINK_SELECT } },
    location: { select: { id: true, name: true, slug: true, type: true, ...TAXONOMY_LINK_SELECT } },
    placements: {
      // Query-level eligibility; the resolver re-checks every row (defense in depth).
      where: { article: publicArticleWhere(now) },
      orderBy: { sortOrder: 'asc' as const },
      take: MAX_SECTION_ITEMS,
      include: { article: { select: ARTICLE_SELECT } },
    },
  } satisfies Prisma.HomepageSectionInclude;
}

export interface PublicHomepageSection {
  key: string;
  type: string;
  title: string;
  layout: HomepageLayoutPreset;
  cardVariant: HomepageCardVariant;
  sourceType: string;
  category: { id: string; name: string; slug: string } | null;
  tag: { id: string; name: string; slug: string } | null;
  location: { id: string; name: string; slug: string; type: string } | null;
  articles: any[];
}

export interface SerializedHomepageContent {
  hero: any | null;
  latest: any[];
  /** Backward-compatible map keyed by section key (type in lower case for singleton types). */
  sections: Record<string, any[]>;
  /** Ordered, self-describing sections: identity, title, layout preset, card variant, links, articles. */
  sectionList: PublicHomepageSection[];
}

/** Category/tag/location as loaded by homepageSectionInclude, with its name shown for `languageCode`. */
function localizedLink(link: (Record<string, unknown> & { name: string; translations?: TranslationRow[] }) | null | undefined, languageCode: string | undefined): any {
  if (!link) return null;
  const { translations, ...rest } = link;
  return { ...rest, name: localizedName(link as { name: string }, translations, languageCode) };
}

/**
 * Builds the public payload from loaded sections plus their already-resolved stories.
 * Sections arrive ordered; disabled sections and sections that resolved to nothing are dropped.
 *
 * `languageCode` (e.g. "bn") localizes what the reader SEES without touching the admin's own
 * configuration: a standard section's title (if the editor never customized it away from the English
 * default), and the linked category/tag/location's display name. Stories themselves are already the
 * correct language variant — resolved upstream by `resolveSectionArticles`.
 */
export function serializeHomepageSections(
  sections: any[],
  resolved: ResolvedSectionArticles,
  _now: Date = new Date(),
  languageCode?: string,
): SerializedHomepageContent {
  let hero: any | null = null;
  const legacy: Record<string, any[]> = {};
  const sectionList: PublicHomepageSection[] = [];

  for (const section of sections) {
    if (!section.enabled) continue;
    const articles = resolved.get(section.id) ?? [];

    if (section.type === 'HERO') {
      // Sections arrive ordered, so a (legacy, unvalidated) second HERO can never displace the first.
      if (!hero) hero = articles[0] ?? null;
      continue;
    }

    // Singleton sections keep the historical `sections.<type>` key; repeatable CUSTOM sections use
    // their unique key so several of them no longer overwrite each other.
    legacy[section.type === 'CUSTOM' ? section.key : section.type.toLowerCase()] = articles;
    if (articles.length) {
      sectionList.push({
        key: section.key,
        type: section.type,
        title: localizedSectionTitle(section.type, section.title, languageCode),
        layout: normalizeLayoutPreset(section.layoutType),
        cardVariant: normalizeCardVariant(section.cardVariant),
        sourceType: String(section.sourceType ?? 'MANUAL'),
        category: localizedLink(section.category, languageCode),
        tag: localizedLink(section.tag, languageCode),
        location: localizedLink(section.location, languageCode),
        articles,
      });
    }
  }

  return { hero, latest: legacy.latest ?? [], sections: legacy, sectionList };
}

export interface LoadedConfiguration {
  configuration: { id: string; version: number; updatedAt: Date; publishedAt: Date | null } | null;
  sections: any[];
}

/**
 * Loads a configuration and its enabled sections from ONE repeatable-read snapshot. Publishing replaces
 * the ACTIVE sections in a single transaction; without a snapshot a reader could observe the old
 * section rows but the new (or missing) placement rows.
 */
export async function loadConfiguredSections(
  prisma: Pick<PrismaClient, '$transaction'>,
  status: HomepageConfigurationStatus,
  now: Date = new Date(),
): Promise<LoadedConfiguration> {
  return prisma.$transaction(
    async (tx) => {
      const configuration = await tx.homepageConfiguration.findUnique({
        where: { status },
        select: { id: true, version: true, updatedAt: true, publishedAt: true },
      });
      if (!configuration) return { configuration: null, sections: [] };
      const sections = await tx.homepageSection.findMany({
        where: { configurationId: configuration.id, enabled: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: homepageSectionInclude(now),
      });
      return { configuration, sections };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      // Default (5000ms) is tight enough that normal latency from an app host to a managed Postgres in
      // a different region (e.g. Render -> Aiven) can blow it on this transaction's nested
      // category/tag/location + placements + article include — seen in production as "Transaction
      // already closed" 500s on /public/homepage that never reproduced locally (lower local latency).
      timeout: 15000,
    },
  );
}
