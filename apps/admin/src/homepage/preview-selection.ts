import type { PreviewArticle, PreviewData } from './types';

/**
 * Story selection for the draft preview. It mirrors apps/web/src/lib/editorial-selection.ts (hero fallback,
 * briefs, top stories, de-duplication) so the preview composes the payload the way the public page does.
 * The apps do not share code, so keep the two in step when the public composition changes.
 */

export function uniqueArticles(articles: Array<PreviewArticle | null | undefined>, excluded = new Set<string>()): PreviewArticle[] {
  const seen = new Set(excluded);
  return articles.filter((article): article is PreviewArticle => {
    if (!article || seen.has(article.id)) return false;
    seen.add(article.id);
    return true;
  });
}

export function selectPreviewStories(data: PreviewData) {
  const sectionArticles = Object.values(data.sections || {}).flat();
  const hero = data.hero || data.latest[0] || data.trending[0] || data.mostRead[0] || sectionArticles[0] || null;
  const heroIds = new Set(hero ? [hero.id] : []);
  const briefs = uniqueArticles(data.latest.filter((article) => article.id !== hero?.id), heroIds).slice(0, 5);
  const secondaryIds = new Set([...heroIds, ...briefs.map((article) => article.id)]);
  const secondary = uniqueArticles([...data.latest.slice(1), ...data.trending, ...sectionArticles, ...data.mostRead], secondaryIds).slice(0, 4);
  const used = new Set([...heroIds, ...briefs.map((article) => article.id), ...secondary.map((article) => article.id)]);
  const ranked = uniqueArticles(data.mostRead, used).slice(0, 5);
  return { hero, briefs, secondary, ranked };
}

export interface PreviewSectionView {
  key: string;
  title: string;
  layout: string;
  articles: PreviewArticle[];
}

/** Sections below the lead: the API's ordered `sectionList`, or the legacy map when the draft has no sections. */
export function selectPreviewSections(data: PreviewData): PreviewSectionView[] {
  if (data.sectionList) {
    return data.sectionList.filter((section) => section.articles.length).map((section) => ({ key: section.key, title: section.title, layout: section.layout, articles: section.articles }));
  }
  return Object.entries(data.sections || {})
    .filter(([, articles]) => articles?.length)
    .map(([key, articles], index) => ({ key, title: key, layout: index % 2 === 0 ? 'FEATURED_STACK' : 'THREE_UP', articles }));
}
