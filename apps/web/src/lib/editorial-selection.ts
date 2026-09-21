import type { EditorialArticle, HomepageLayoutPreset } from '@/components/editorial';

/** Self-describing section from GET /public/homepage (`sectionList`). */
export interface HomepageSectionData {
  key: string;
  type: string;
  title: string;
  layout: HomepageLayoutPreset;
  category?: { id: string; name: string; slug: string } | null;
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
        href: section.category ? `/category/${section.category.slug}` : categoryTypes.has(section.type) ? `/category/${section.type.toLowerCase()}` : undefined,
        layout: section.layout,
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
      articles,
    }));
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
