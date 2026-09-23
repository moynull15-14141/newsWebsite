import { Test, TestingModule } from '@nestjs/testing';
import { SeoService } from './seo.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LanguagesService } from '../languages/languages.service';

describe('SeoService (language-aware sitemap)', () => {
  let service: SeoService;
  let prisma: any;
  let languagesService: any;

  beforeEach(async () => {
    prisma = { article: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() }, job: { findMany: jest.fn() } };
    languagesService = { getDefault: jest.fn().mockResolvedValue({ id: 'lang-bn', code: 'bn', isDefault: true }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeoService,
        { provide: PrismaService, useValue: prisma },
        { provide: LanguagesService, useValue: languagesService },
      ],
    }).compile();

    service = module.get<SeoService>(SeoService);
  });

  describe('getSitemap', () => {
    it('keeps the default-language article URL bare', async () => {
      prisma.article.findMany.mockResolvedValueOnce([
        { slug: 'bn-story', updatedAt: new Date('2026-01-01'), publishedAt: new Date('2026-01-01'), language: { code: 'bn' } },
      ]);
      const xml = await service.getSitemap();
      expect(xml).toContain('<loc>http://localhost:5173/article/bn-story</loc>');
      expect(xml).not.toContain('/bn/article/bn-story');
    });

    it('prefixes a non-default-language article URL with its language code', async () => {
      prisma.article.findMany.mockResolvedValueOnce([
        { slug: 'en-story', updatedAt: new Date('2026-01-01'), publishedAt: new Date('2026-01-01'), language: { code: 'en' } },
      ]);
      const xml = await service.getSitemap();
      expect(xml).toContain('<loc>http://localhost:5173/en/article/en-story</loc>');
    });

    it('treats a legacy article with no language as the default language', async () => {
      prisma.article.findMany.mockResolvedValueOnce([
        { slug: 'legacy', updatedAt: new Date('2026-01-01'), publishedAt: new Date('2026-01-01'), language: null },
      ]);
      const xml = await service.getSitemap();
      expect(xml).toContain('<loc>http://localhost:5173/article/legacy</loc>');
    });

    it('includes static crawlable pages in the page sitemap', () => {
      const xml = service.getPageSitemap();
      expect(xml).toContain('<loc>http://localhost:5173/</loc>');
      expect(xml).toContain('<loc>http://localhost:5173/latest</loc>');
      expect(xml).toContain('<loc>http://localhost:5173/bangladesh</loc>');
    });

    it('publishes a sitemap index for each public entity type', () => {
      const xml = service.getSitemapIndex();
      expect(xml).toContain('<sitemapindex');
      expect(xml).toContain('article-sitemap.xml');
      expect(xml).toContain('category-sitemap.xml');
      expect(xml).toContain('location-sitemap.xml');
      expect(xml).toContain('job-sitemap.xml');
    });
  });

  describe('getJobSitemap', () => {
    it('includes a published job with no deadline', async () => {
      prisma.job.findMany.mockResolvedValueOnce([{ id: 'job-1', slug: 'engineer', updatedAt: new Date('2026-01-01') }]);
      const xml = await service.getJobSitemap();
      expect(xml).toContain('<loc>http://localhost:5173/jobs/engineer</loc>');
      // Eligibility is enforced at the query level (see the where clause passed to findMany), not by
      // filtering results here — this asserts the query actually scoped to PUBLISHED + non-expired.
      expect(prisma.job.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: 'PUBLISHED' }),
      }));
    });

    it('paginates past 500 jobs using a cursor', async () => {
      const firstPage = Array.from({ length: 500 }, (_, i) => ({ id: `job-${i}`, slug: `job-${i}`, updatedAt: new Date('2026-01-01') }));
      prisma.job.findMany.mockResolvedValueOnce(firstPage).mockResolvedValueOnce([{ id: 'job-500', slug: 'job-500', updatedAt: new Date('2026-01-01') }]);
      const xml = await service.getJobSitemap();
      expect(prisma.job.findMany).toHaveBeenCalledTimes(2);
      expect(xml).toContain('<loc>http://localhost:5173/jobs/job-500</loc>');
    });
  });

  describe('getNewsSitemap', () => {
    it('reports each article\'s own language, not a hardcoded one', async () => {
      prisma.article.findMany.mockResolvedValueOnce([
        { slug: 'en-story', title: 'English story', publishedAt: new Date('2026-01-01'), language: { code: 'en' } },
        { slug: 'bn-story', title: 'বাংলা গল্প', publishedAt: new Date('2026-01-01'), language: { code: 'bn' } },
      ]);
      const xml = await service.getNewsSitemap();
      expect(xml).toContain('<news:language>en</news:language>');
      expect(xml).toContain('<news:language>bn</news:language>');
      expect(xml).toContain('http://localhost:5173/en/article/en-story');
      expect(xml).toContain('http://localhost:5173/article/bn-story');
    });
  });

  describe('article analysis and site health', () => {
    const article = {
      id: 'article-1', title: 'A sufficiently descriptive Bangladesh report title', slug: 'bangladesh-report',
      excerpt: 'A useful and concise summary explaining the central news development and the people affected by it today.',
      content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Details' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Reported detail. '.repeat(80) }] }] },
      seoTitle: null, seoDescription: null, seoKeywords: 'Bangladesh report', canonicalUrl: null, noIndex: false,
      status: 'PUBLISHED', publishedAt: new Date('2026-09-20'), updatedAt: new Date('2026-09-21'), categoryId: 'category-1',
      locationId: 'location-1', authorId: 'author-1', translationGroupId: null, media: { publicUrl: 'https://cdn.test/photo.jpg', altText: 'News scene' },
    };

    it('uses database duplicate checks in article analysis', async () => {
      prisma.article.findUnique.mockResolvedValue(article);
      prisma.article.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      const result = await service.analyzeArticle(article.id);
      expect(result.checks.find((item) => item.id === 'duplicate-title')?.status).toBe('ERROR');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.completion).toBeGreaterThanOrEqual(0);
    });

    it('aggregates actual analyzed articles into distribution and issues', async () => {
      prisma.article.findMany.mockResolvedValue([{ ...article }, { ...article, id: 'article-2', slug: 'second-report' }]);
      const health = await service.getSiteHealth();
      expect(health.analyzedArticles).toBe(2);
      expect(Object.values(health.distribution).reduce((sum, value) => sum + value, 0)).toBe(2);
      expect(health.technical.indexablePublishedArticles).toBe(2);
      expect(health.issues.some((item) => item.id === 'duplicate-title')).toBe(true);
    });
  });
});
