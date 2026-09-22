import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LanguagesService } from '../languages/languages.service';

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

@Injectable()
export class SeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly languagesService: LanguagesService,
  ) {}

  private get siteUrl() {
    return (process.env.WEB_URL || 'http://localhost:5173').replace(/\/$/, '');
  }

  private get publicationName() {
    return process.env.GOOGLE_NEWS_PUBLICATION_NAME || 'BD News';
  }

  async getRobots() {
    return [`User-agent: *`, `Allow: /`, `Disallow: /admin`, `Disallow: /api/`, `Disallow: /search`, `Sitemap: ${this.siteUrl}/seo/sitemap.xml`, `Sitemap: ${this.siteUrl}/seo/news-sitemap.xml`].join('\n');
  }

  async getSitemap() {
    const defaultLanguage = await this.languagesService.getDefault();
    const urls: { loc: string; lastmod?: Date }[] = [
      { loc: '/' },
      { loc: '/bangladesh' },
    ];
    const pageSize = 500;
    let skip = 0;
    while (true) {
      const articles = await this.prisma.article.findMany({
        where: { status: 'PUBLISHED', noIndex: false, publishedAt: { not: null } },
        select: { slug: true, updatedAt: true, publishedAt: true, language: { select: { code: true } } },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: pageSize,
      });
      urls.push(
        ...articles.map((article) => {
          const code = article.language?.code ?? defaultLanguage.code;
          const prefix = code === defaultLanguage.code ? '' : `/${code}`;
          return { loc: `${prefix}/article/${article.slug}`, lastmod: article.updatedAt || article.publishedAt || undefined };
        }),
      );
      if (articles.length < pageSize) break;
      skip += pageSize;
    }

    return this.toXml(urls);
  }

  async getNewsSitemap() {
    const defaultLanguage = await this.languagesService.getDefault();
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const articles = await this.prisma.article.findMany({
      where: { status: 'PUBLISHED', noIndex: false, publishedAt: { gte: since } },
      select: { slug: true, title: true, publishedAt: true, language: { select: { code: true } } },
      orderBy: { publishedAt: 'desc' },
      take: 1000,
    });
    const body = articles
      .map((article) => {
        const code = article.language?.code ?? defaultLanguage.code;
        const prefix = code === defaultLanguage.code ? '' : `/${code}`;
        return `<url><loc>${escapeXml(`${this.siteUrl}${prefix}/article/${article.slug}`)}</loc><news:news><news:publication><news:name>${escapeXml(this.publicationName)}</news:name><news:language>${escapeXml(code)}</news:language></news:publication><news:publication_date>${article.publishedAt?.toISOString() || ''}</news:publication><news:title>${escapeXml(article.title)}</news:title></news:news></url>`;
      })
      .join('');
    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${body}</urlset>`;
  }

  private toXml(urls: { loc: string; lastmod?: Date }[]) {
    const body = urls.map(({ loc, lastmod }) => `<url><loc>${escapeXml(`${this.siteUrl}${loc}`)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ''}</url>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
  }
}
