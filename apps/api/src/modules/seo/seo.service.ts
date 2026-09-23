import { Injectable, NotFoundException } from '@nestjs/common';
import { analyzeArticleSeo, SeoAnalysis, SeoArticleInput } from '@news-platform/seo';
import { PrismaService } from '../../prisma/prisma.service';
import { LanguagesService } from '../languages/languages.service';

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
type SitemapUrl = { loc: string; lastmod?: Date };

@Injectable()
export class SeoService {
  constructor(private readonly prisma: PrismaService, private readonly languagesService: LanguagesService) {}
  private get siteUrl() { return (process.env.WEB_URL || 'http://localhost:5173').replace(/\/$/, ''); }
  private get publicationName() { return process.env.GOOGLE_NEWS_PUBLICATION_NAME || 'BD News'; }
  private get seoEndpoint() { return `${this.siteUrl}/seo`; }

  getRobots() {
    return ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /api/', 'Disallow: /search', 'Disallow: /login', 'Disallow: /register', 'Disallow: /account', `Sitemap: ${this.seoEndpoint}/sitemap.xml`].join('\n');
  }

  getSitemapIndex() {
    return this.toIndexXml(['page-sitemap.xml', 'article-sitemap.xml', 'category-sitemap.xml', 'tag-sitemap.xml', 'author-sitemap.xml', 'location-sitemap.xml', 'news-sitemap.xml', 'job-sitemap.xml']);
  }

  /** Same cursor-paginated shape as getArticleSitemap — only PUBLISHED jobs whose deadline hasn't
   * passed (a job the eligibility check would already exclude from public listings has no business
   * being indexable either; see job-eligibility.ts's publicJobWhere, mirrored here at the DB level
   * rather than imported, since Prisma's generated WhereInput types differ per model). */
  async getJobSitemap() {
    const now = new Date();
    const urls: SitemapUrl[] = [];
    let cursor: string | undefined;
    do {
      const jobs = await this.prisma.job.findMany({
        where: { status: 'PUBLISHED', OR: [{ publishedAt: null }, { publishedAt: { lte: now } }], AND: [{ OR: [{ deadline: null }, { deadline: { gt: now } }] }] },
        select: { id: true, slug: true, updatedAt: true },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      urls.push(...jobs.map((job) => ({ loc: `/jobs/${job.slug}`, lastmod: job.updatedAt })));
      cursor = jobs.length === 500 ? jobs[jobs.length - 1].id : undefined;
    } while (cursor);
    return this.toUrlXml(urls);
  }

  getPageSitemap() { return this.toUrlXml([{ loc: '/' }, { loc: '/latest' }, { loc: '/bangladesh' }]); }

  async getArticleSitemap() {
    const defaultLanguage = await this.languagesService.getDefault();
    const urls: SitemapUrl[] = [];
    let cursor: string | undefined;
    do {
      const articles = await this.prisma.article.findMany({ where: { status: 'PUBLISHED', noIndex: false, publishedAt: { not: null } }, select: { id: true, slug: true, updatedAt: true, language: { select: { code: true } } }, orderBy: { id: 'asc' }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
      urls.push(...articles.map((article) => ({ loc: `${this.languagePrefix(article.language?.code, defaultLanguage.code)}/article/${article.slug}`, lastmod: article.updatedAt })));
      cursor = articles.length === 500 ? articles[articles.length - 1].id : undefined;
    } while (cursor);
    return this.toUrlXml(urls);
  }

  /** Backwards-compatible service alias; the public sitemap.xml route now serves the sitemap index. */
  getSitemap() { return this.getArticleSitemap(); }

  async getCategorySitemap() {
    const rows = await this.prisma.category.findMany({ where: { status: 'ACTIVE', articles: { some: { status: 'PUBLISHED', noIndex: false } } }, select: { slug: true, updatedAt: true } });
    return this.toUrlXml(rows.map((item) => ({ loc: `/category/${item.slug}`, lastmod: item.updatedAt })));
  }
  async getTagSitemap() {
    const rows = await this.prisma.tag.findMany({ where: { status: 'ACTIVE', articleTags: { some: { article: { status: 'PUBLISHED', noIndex: false } } } }, select: { slug: true, updatedAt: true } });
    return this.toUrlXml(rows.map((item) => ({ loc: `/tag/${item.slug}`, lastmod: item.updatedAt })));
  }
  async getAuthorSitemap() {
    const rows = await this.prisma.user.findMany({ where: { authoredArticles: { some: { status: 'PUBLISHED', noIndex: false } } }, select: { id: true, updatedAt: true } });
    return this.toUrlXml(rows.map((item) => ({ loc: `/author/${item.id}`, lastmod: item.updatedAt })));
  }
  async getLocationSitemap() {
    const rows = await this.prisma.location.findMany({ where: { status: 'ACTIVE', articles: { some: { status: 'PUBLISHED', noIndex: false } } }, select: { slug: true, type: true, updatedAt: true } });
    return this.toUrlXml(rows.map((item) => ({ loc: item.type === 'COUNTRY' && item.slug === 'bangladesh' ? '/bangladesh' : item.type === 'DIVISION' ? `/division/${item.slug}` : item.type === 'DISTRICT' ? `/district/${item.slug}` : `/location/${item.slug}`, lastmod: item.updatedAt })));
  }

  async getNewsSitemap() {
    const defaultLanguage = await this.languagesService.getDefault();
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const articles = await this.prisma.article.findMany({ where: { status: 'PUBLISHED', noIndex: false, publishedAt: { gte: since } }, select: { slug: true, title: true, publishedAt: true, language: { select: { code: true } } }, orderBy: { publishedAt: 'desc' }, take: 1000 });
    const body = articles.map((article) => { const code = article.language?.code ?? defaultLanguage.code; return `<url><loc>${escapeXml(`${this.siteUrl}${this.languagePrefix(code, defaultLanguage.code)}/article/${article.slug}`)}</loc><news:news><news:publication><news:name>${escapeXml(this.publicationName)}</news:name><news:language>${escapeXml(code)}</news:language></news:publication><news:publication_date>${article.publishedAt?.toISOString() || ''}</news:publication_date><news:title>${escapeXml(article.title)}</news:title></news:news></url>`; }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${body}</urlset>`;
  }

  async analyzeArticle(id: string): Promise<SeoAnalysis> {
    const article = await this.prisma.article.findUnique({ where: { id }, select: this.articleSeoSelect() });
    if (!article) throw new NotFoundException('Article not found');
    const duplicates = await this.duplicateFlags(article);
    const translationsCount = article.translationGroupId ? await this.prisma.article.count({ where: { translationGroupId: article.translationGroupId, status: 'PUBLISHED', id: { not: article.id } } }) : 0;
    return analyzeArticleSeo(this.toAnalyzerInput(article, { ...duplicates, translationsCount }));
  }

  async getSiteHealth() {
    const articles = await this.prisma.article.findMany({ where: { status: { not: 'ARCHIVED' } }, select: this.articleSeoSelect(), orderBy: { updatedAt: 'desc' }, take: 2000 });
    const titleCounts = new Map<string, number>(); const descriptionCounts = new Map<string, number>(); const slugCounts = new Map<string, number>();
    for (const item of articles) { this.bump(titleCounts, (item.seoTitle || item.title).trim().toLocaleLowerCase()); this.bump(descriptionCounts, (item.seoDescription || item.excerpt || '').trim().toLocaleLowerCase()); this.bump(slugCounts, item.slug.trim().toLocaleLowerCase()); }
    const analyses = articles.map((item) => analyzeArticleSeo(this.toAnalyzerInput(item, { duplicateTitle: (titleCounts.get((item.seoTitle || item.title).trim().toLocaleLowerCase()) || 0) > 1, duplicateDescription: !!(item.seoDescription || item.excerpt) && (descriptionCounts.get((item.seoDescription || item.excerpt || '').trim().toLocaleLowerCase()) || 0) > 1, duplicateSlug: (slugCounts.get(item.slug.trim().toLocaleLowerCase()) || 0) > 1, translationsCount: item.translationGroupId ? 1 : 0 })));
    const issueMap = new Map<string, { id: string; label: string; severity: 'ERROR' | 'WARNING'; affected: number; recommendation?: string }>();
    analyses.flatMap((analysis) => analysis.checks).filter((item) => item.status === 'ERROR' || item.status === 'WARNING').forEach((item) => { const current = issueMap.get(item.id); if (current) current.affected += 1; else issueMap.set(item.id, { id: item.id, label: item.label, severity: item.status as 'ERROR' | 'WARNING', affected: 1, recommendation: item.recommendation }); });
    const distribution = { excellent: 0, good: 0, needsAttention: 0, critical: 0 };
    analyses.forEach((item) => { if (item.grade === 'EXCELLENT') distribution.excellent += 1; else if (item.grade === 'GOOD') distribution.good += 1; else if (item.grade === 'NEEDS_ATTENTION') distribution.needsAttention += 1; else distribution.critical += 1; });
    return { score: analyses.length ? Math.round(analyses.reduce((sum, item) => sum + item.score, 0) / analyses.length) : 0, completion: analyses.length ? Math.round(analyses.reduce((sum, item) => sum + item.completion, 0) / analyses.length) : 0, analyzedArticles: analyses.length, distribution, issues: [...issueMap.values()].sort((a, b) => a.severity === b.severity ? b.affected - a.affected : a.severity === 'ERROR' ? -1 : 1).slice(0, 12), technical: { robots: true, sitemap: true, canonical: true, openGraph: true, twitterCard: true, structuredData: true, indexablePublishedArticles: articles.filter((item) => item.status === 'PUBLISHED' && !item.noIndex).length }, generatedAt: new Date().toISOString(), limited: articles.length === 2000 };
  }

  private articleSeoSelect() { return { id: true, title: true, slug: true, excerpt: true, content: true, seoTitle: true, seoDescription: true, seoKeywords: true, canonicalUrl: true, noIndex: true, status: true, publishedAt: true, updatedAt: true, categoryId: true, locationId: true, authorId: true, translationGroupId: true, media: { select: { publicUrl: true, altText: true } } } as const; }
  private toAnalyzerInput(article: any, extra: Partial<SeoArticleInput> = {}): SeoArticleInput { return { title: article.title, slug: article.slug, excerpt: article.excerpt, content: article.content, seoTitle: article.seoTitle, seoDescription: article.seoDescription, focusKeyword: article.seoKeywords, canonicalUrl: article.canonicalUrl, noIndex: article.noIndex, status: article.status, featuredImageUrl: article.media?.publicUrl, featuredImageAlt: article.media?.altText, category: !!article.categoryId, location: !!article.locationId, author: !!article.authorId, publishedAt: article.publishedAt, updatedAt: article.updatedAt, hasOpenGraph: true, hasTwitterCard: true, hasArticleSchema: true, hasBreadcrumbSchema: true, hasPublisher: true, hasHreflang: true, ...extra }; }
  private async duplicateFlags(article: any) { const [title, slug, description] = await Promise.all([this.prisma.article.count({ where: { id: { not: article.id }, OR: [{ seoTitle: article.seoTitle || article.title }, { title: article.seoTitle || article.title }] } }), this.prisma.article.count({ where: { id: { not: article.id }, slug: article.slug } }), article.seoDescription || article.excerpt ? this.prisma.article.count({ where: { id: { not: article.id }, OR: [{ seoDescription: article.seoDescription || article.excerpt }, { excerpt: article.seoDescription || article.excerpt }] } }) : Promise.resolve(0)]); return { duplicateTitle: title > 0, duplicateSlug: slug > 0, duplicateDescription: description > 0 }; }
  private bump(map: Map<string, number>, value: string) { if (value) map.set(value, (map.get(value) || 0) + 1); }
  private languagePrefix(code: string | undefined, defaultCode: string) { return !code || code === defaultCode ? '' : `/${code}`; }
  private toUrlXml(urls: SitemapUrl[]) { const unique = [...new Map(urls.map((item) => [item.loc, item])).values()]; return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${unique.map(({ loc, lastmod }) => `<url><loc>${escapeXml(`${this.siteUrl}${loc}`)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ''}</url>`).join('')}</urlset>`; }
  private toIndexXml(files: string[]) { return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${files.map((file) => `<sitemap><loc>${escapeXml(`${this.seoEndpoint}/${file}`)}</loc></sitemap>`).join('')}</sitemapindex>`; }
}
