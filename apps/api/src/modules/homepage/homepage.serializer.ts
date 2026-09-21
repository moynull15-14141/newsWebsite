import { HomepageConfigurationStatus, Prisma, PrismaClient } from '@prisma/client';
import { isPubliclyEligible, publicArticleWhere } from '../articles/public-eligibility';
import { ARTICLE_SELECT } from '../public/public-article-select';
import { HomepageLayoutPreset, MAX_SECTION_ITEMS, normalizeLayoutPreset } from './homepage.constants';

/**
 * The ONE serializer for configured homepages. The public endpoint (ACTIVE configuration) and the
 * admin preview (DRAFT configuration) both go through it, so they cannot drift apart.
 */

export function homepageSectionInclude(now: Date) {
  return {
    category: { select: { id: true, name: true, slug: true } },
    placements: {
      // Query-level eligibility; the serializer re-checks every row (defense in depth).
      where: { article: publicArticleWhere(now) },
      orderBy: { sortOrder: 'asc' as const },
      take: MAX_SECTION_ITEMS,
      include: { article: { select: ARTICLE_SELECT } },
    },
  } satisfies Prisma.HomepageSectionInclude;
}

export interface LoadedHomepageSection {
  key: string;
  type: string;
  title: string;
  enabled: boolean;
  maxItems: number;
  layoutType: string;
  category?: { id: string; name: string; slug: string } | null;
  placements: Array<{ article: any }>;
}

export interface PublicHomepageSection {
  key: string;
  type: string;
  title: string;
  layout: HomepageLayoutPreset;
  category: { id: string; name: string; slug: string } | null;
  articles: any[];
}

export interface SerializedHomepageContent {
  hero: any | null;
  latest: any[];
  /** Backward-compatible map keyed by section key (type in lower case for singleton types). */
  sections: Record<string, any[]>;
  /** Ordered, self-describing sections: identity, title, layout preset, category link, articles. */
  sectionList: PublicHomepageSection[];
}

export function serializeHomepageSections(sections: LoadedHomepageSection[], now: Date = new Date()): SerializedHomepageContent {
  let hero: any | null = null;
  const legacy: Record<string, any[]> = {};
  const sectionList: PublicHomepageSection[] = [];

  for (const section of sections) {
    if (!section.enabled) continue;
    const articles = section.placements
      .map((placement) => placement.article)
      .filter((article) => isPubliclyEligible(article, now))
      .slice(0, section.maxItems);

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
        title: section.title,
        layout: normalizeLayoutPreset(section.layoutType),
        category: section.category ?? null,
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
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
