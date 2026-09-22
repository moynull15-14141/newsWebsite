import type { EditorialArticle, HomepageCardVariant, HomepageLayoutPreset } from '@/components/editorial';

/** Self-describing section from GET /public/homepage (`sectionList`). */
export interface HomepageSectionData {
  key: string;
  type: string;
  title: string;
  layout: HomepageLayoutPreset;
  /** Presentation override; absent on older API responses, where the layout decides. */
  cardVariant?: HomepageCardVariant;
  /** Where the section's stories came from. Informational — the articles are already resolved. */
  sourceType?: string;
  category?: { id: string; name: string; slug: string } | null;
  tag?: { id: string; name: string; slug: string } | null;
  location?: { id: string; name: string; slug: string; type: string } | null;
  articles: EditorialArticle[];
}

export interface HomepageEditorialData {
  hero?: EditorialArticle | null;
  latest?: EditorialArticle[];
  trending?: EditorialArticle[];
  mostRead?: EditorialArticle[];
  /** Legacy map keyed by section type in lower case. Always present; superseded by `sectionList`. */
  sections?: Record<string, EditorialArticle[]>;
  /** Ordered sections with title, layout preset and category link. Absent on older API responses. */
  sectionList?: HomepageSectionData[];
}

export interface HomepageSectionView {
  key: string;
  title: string;
  href?: string;
  layout: HomepageLayoutPreset;
  cardVariant: HomepageCardVariant;
  articles: EditorialArticle[];
}

export function uniqueArticles(articles: Array<EditorialArticle | null | undefined>, excluded = new Set<string>()) {
  const seen = new Set(excluded);
  return articles.filter((article): article is EditorialArticle => {
    if (!article || seen.has(article.id)) return false;
    seen.add(article.id);
    return true;
  });
}

const legacySectionLabels: Record<string, string> = { bangladesh: 'Bangladesh', world: 'World', politics: 'Politics', business: 'Business', sports: 'Sports', technology: 'Technology', entertainment: 'Entertainment' };
const categoryTypes = new Set(['BANGLADESH', 'WORLD', 'POLITICS', 'BUSINESS', 'SPORTS', 'TECHNOLOGY', 'ENTERTAINMENT']);

/**
 * Sections to render below the lead. Prefers the API's `sectionList` (real titles, layout presets, stable
 * keys). When it is absent (older API / cached response) it degrades to the legacy `sections` map and the
 * original Step 02 alternation of "featured + stack" and "three-up".
 */
export function selectHomepageSections(data?: HomepageEditorialData): HomepageSectionView[] {
  if (data?.sectionList) {
    return data.sectionList
      .filter((section) => section.articles?.length)
      .map((section) => ({
        key: section.key,
        title: section.title,
        href: sectionHref(section),
        layout: section.layout,
        cardVariant: section.cardVariant ?? 'AUTO',
        articles: section.articles,
      }));
  }
  return Object.entries(data?.sections || {})
    .filter(([, articles]) => articles?.length)
    .map(([key, articles], index) => ({
      key,
      title: legacySectionLabels[key] || key,
      href: key === 'custom' || key === 'latest' ? undefined : `/category/${key}`,
      layout: index % 2 === 0 ? ('FEATURED_STACK' as const) : ('THREE_UP' as const),
      cardVariant: 'AUTO' as const,
      articles,
    }));
}

/**
 * "View all" target for a section: whichever taxonomy it is bound to, falling back to the category route
 * implied by a standard section type. All three routes already exist on the public site.
 */
function sectionHref(section: HomepageSectionData): string | undefined {
  if (section.category) return `/category/${section.category.slug}`;
  if (section.tag) return `/tag/${section.tag.slug}`;
  if (section.location) return `/location/${section.location.slug}`;
  if (categoryTypes.has(section.type)) return `/category/${section.type.toLowerCase()}`;
  return undefined;
}

export function selectHomepageStories(data?: HomepageEditorialData) {
  const latest = data?.latest || [];
  const trending = data?.trending || [];
  const mostRead = data?.mostRead || [];
  const sectionArticles = Object.values(data?.sections || {}).flat();
  const hero = data?.hero || latest[0] || trending[0] || mostRead[0] || sectionArticles[0] || null;
  const heroIds = new Set(hero ? [hero.id] : []);
  const briefs = uniqueArticles(latest.filter((article) => article.id !== hero?.id), heroIds).slice(0, 5);
  const secondaryIds = new Set([...heroIds, ...briefs.map((article) => article.id)]);
  const secondary = uniqueArticles([...latest.slice(1), ...trending, ...sectionArticles, ...mostRead], secondaryIds).slice(0, 4);
  const used = new Set([...(hero ? [hero.id] : []), ...briefs.map((article) => article.id), ...secondary.map((article) => article.id)]);
  const ranked = uniqueArticles(mostRead, used).slice(0, 5);

  return { hero, briefs, secondary, ranked };
}
