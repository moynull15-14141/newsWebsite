import { Test, TestingModule } from '@nestjs/testing';
import { PublicService } from './public.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ArticleViewService } from '../articles/services/article-view.service';
import { TrendingService } from '../articles/services/trending.service';
import { MostReadService } from '../articles/services/most-read.service';
import { BreakingNewsService } from '../articles/services/breaking-news.service';
import { LanguagesService } from '../languages/languages.service';
import { NotFoundException } from '@nestjs/common';

const DEFAULT_LANGUAGE = { id: 'lang-bn', code: 'bn', isDefault: true };

describe('PublicService', () => {
  let service: PublicService;
  let prisma: any;
  let articleViewService: any;
  let trendingService: any;
  let mostReadService: any;
  let breakingNewsService: any;
  let languagesService: any;

  const mockArticle = {
    id: '1',
    title: 'Test Article',
    slug: 'test-article',
    excerpt: 'Test excerpt',
    content: 'Test content',
    status: 'PUBLISHED',
    publishedAt: new Date(),
    createdAt: new Date(),
    author: { id: 'a1', name: 'Author' },
    category: { id: 'c1', name: 'Tech', slug: 'tech' },
    location: { id: 'l1', name: 'Dhaka', slug: 'dhaka', type: 'DISTRICT' },
    articleTags: [],
  };

  beforeEach(async () => {
    prisma = {
      article: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      category: { findUnique: jest.fn() },
      tag: { findUnique: jest.fn(), findFirst: jest.fn() },
      user: { findUnique: jest.fn() },
      location: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
      articleRelated: { findMany: jest.fn().mockResolvedValue([]) },
      // Homepage snapshot loader: no ACTIVE configuration -> dynamic fallback (configured paths are covered in public-homepage.spec.ts).
      $transaction: jest.fn((fn: (tx: any) => unknown) => fn({ homepageConfiguration: { findUnique: jest.fn().mockResolvedValue(null) }, homepageSection: { findMany: jest.fn() } })),
    };

    articleViewService = { recordView: jest.fn(), getArticleViews: jest.fn() };
    trendingService = { getTrending: jest.fn() };
    mostReadService = { getMostRead: jest.fn() };
    breakingNewsService = { getActiveBreakingNews: jest.fn() };
    languagesService = {
      resolveRequested: jest.fn().mockResolvedValue(DEFAULT_LANGUAGE),
      getDefault: jest.fn().mockResolvedValue(DEFAULT_LANGUAGE),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicService,
        { provide: PrismaService, useValue: prisma },
        { provide: ArticleViewService, useValue: articleViewService },
        { provide: TrendingService, useValue: trendingService },
        { provide: MostReadService, useValue: mostReadService },
        { provide: BreakingNewsService, useValue: breakingNewsService },
        { provide: LanguagesService, useValue: languagesService },
      ],
    }).compile();

    service = module.get<PublicService>(PublicService);
  });

  describe('getArticles', () => {
    it('returns only PUBLISHED articles', async () => {
      prisma.article.findMany.mockResolvedValue([mockArticle]);
      prisma.article.count.mockResolvedValue(1);

      const result = await service.getArticles({ page: 1, limit: 20 });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PUBLISHED' }),
        }),
      );
      expect(result.data).toEqual([mockArticle]);
      expect(result.meta.total).toBe(1);
    });

    it('matches a search term against title OR excerpt', async () => {
      prisma.article.findMany.mockResolvedValue([mockArticle]);
      prisma.article.count.mockResolvedValue(1);

      await service.getArticles({ page: 1, limit: 20, search: 'bangladesh' });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'bangladesh', mode: 'insensitive' } },
              { excerpt: { contains: 'bangladesh', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('never fabricates relevance: default order is deterministic (newest published first)', async () => {
      prisma.article.findMany.mockResolvedValue([]);
      prisma.article.count.mockResolvedValue(0);

      await service.getArticles({ page: 1, limit: 20, search: 'anything' });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { publishedAt: 'desc' } }),
      );
    });

    it('applies database-level pagination (skip/take), never fetching everything', async () => {
      prisma.article.findMany.mockResolvedValue([]);
      prisma.article.count.mockResolvedValue(0);

      await service.getArticles({ page: 3, limit: 10, search: 'x' });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('resolves and filters by the requested language', async () => {
      prisma.article.findMany.mockResolvedValue([]);
      prisma.article.count.mockResolvedValue(0);

      await service.getArticles({ page: 1, limit: 20, search: 'x', lang: 'en' });

      expect(languagesService.resolveRequested).toHaveBeenCalledWith('en');
    });

    it('selects only public-safe fields (no password/permission/internal workflow data)', async () => {
      prisma.article.findMany.mockResolvedValue([mockArticle]);
      prisma.article.count.mockResolvedValue(1);

      await service.getArticles({ page: 1, limit: 20, search: 'x' });

      const call = prisma.article.findMany.mock.calls[0][0];
      expect(call.select).toBeDefined();
      const selectedKeys = Object.keys(call.select);
      expect(selectedKeys).not.toContain('passwordHash');
      expect(selectedKeys).not.toContain('reviewedById');
    });
  });

  describe('getArticleBySlug', () => {
    it('returns published article', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);

      const result = await service.getArticleBySlug('test-article');
      // No translationGroupId on the fixture -> no sibling lookup, translations always [].
      expect(result).toEqual({ ...mockArticle, translations: [] });
    });

    it('throws NotFoundException for non-existent', async () => {
      prisma.article.findUnique.mockResolvedValue(null);

      await expect(service.getArticleBySlug('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getArticlesByCategory', () => {
    it('filters by category', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1', slug: 'tech' });
      prisma.article.findMany.mockResolvedValue([mockArticle]);
      prisma.article.count.mockResolvedValue(1);

      await service.getArticlesByCategory('tech', { page: 1, limit: 20 });
      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: 'c1' }),
        }),
      );
    });
  });

  describe('getArticlesByTag', () => {
    it('filters by tag', async () => {
      prisma.tag.findFirst.mockResolvedValue({ id: 't1', slug: 'news' });
      prisma.article.findMany.mockResolvedValue([mockArticle]);
      prisma.article.count.mockResolvedValue(1);

      await service.getArticlesByTag('news', { page: 1, limit: 20 });
      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            articleTags: { some: { tagId: 't1' } },
          }),
        }),
      );
    });
  });

  describe('getTag', () => {
    it('selects only public metadata and requires an active tag', async () => {
      prisma.tag.findFirst.mockResolvedValue({ id: 't1', name: 'News', slug: 'news', translations: [] });

      await service.getTag('news');

      const call = prisma.tag.findFirst.mock.calls[0][0];
      expect(call.where).toEqual({ slug: 'news', status: 'ACTIVE' });
      expect(call.select).toBeDefined();
      expect(Object.keys(call.select)).toEqual(['id', 'name', 'slug', 'translations']);
    });
  });

  describe('getArticlesByAuthor', () => {
    it('filters by author', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'a1' });
      prisma.article.findMany.mockResolvedValue([mockArticle]);
      prisma.article.count.mockResolvedValue(1);

      await service.getArticlesByAuthor('a1', { page: 1, limit: 20 });
      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ authorId: 'a1' }),
        }),
      );
    });
  });

  describe('getAuthorProfile', () => {
    it('returns the real author record, not something derived from a first article', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'a1', name: 'Real Author Name' });

      const result = await service.getAuthorProfile('a1');

      expect(result).toEqual({ id: 'a1', name: 'Real Author Name' });
    });

    it('selects only the safe public fields — never email, passwordHash, status, or sessions', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'a1', name: 'Real Author Name' });

      await service.getAuthorProfile('a1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'a1' },
        select: { id: true, name: true },
      });
    });

    it('throws NotFoundException for an unknown author id (a real 404, not a silent fallback)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getAuthorProfile('does-not-exist')).rejects.toThrow(NotFoundException);
    });

    it('returns the real name even for an author with zero published articles', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'a2', name: 'Prolific But Unpublished' });

      const result = await service.getAuthorProfile('a2');

      expect(result.name).toBe('Prolific But Unpublished');
    });
  });

  describe('getArticlesByLocation', () => {
    it('filters by location', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'l1', slug: 'dhaka' });
      prisma.location.findMany.mockResolvedValue([]);
      prisma.article.findMany.mockResolvedValue([mockArticle]);
      prisma.article.count.mockResolvedValue(1);

      await service.getArticlesByLocation('dhaka', { page: 1, limit: 20 });
      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            locationId: { in: ['l1'] },
          }),
        }),
      );
    });

    it('includes district-level (and deeper) descendants for a COUNTRY-level page — a /bangladesh page must show district-tagged articles, not just ones tagged at the country row itself', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'bd', slug: 'bangladesh', type: 'COUNTRY' });
      prisma.location.findMany
        .mockResolvedValueOnce([{ id: 'dhaka-division' }]) // children of Bangladesh
        .mockResolvedValueOnce([{ id: 'dhaka-district' }]) // children of Dhaka division
        .mockResolvedValueOnce([]); // Dhaka district has no further children
      prisma.article.findMany.mockResolvedValue([mockArticle]);
      prisma.article.count.mockResolvedValue(1);

      await service.getArticlesByLocation('bangladesh', { page: 1, limit: 20 }, 'COUNTRY');

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            locationId: { in: expect.arrayContaining(['bd', 'dhaka-division', 'dhaka-district']) },
          }),
        }),
      );
    });
  });

  describe('getLocation', () => {
    it('returns only public hierarchy metadata and requires an active location', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'l1', name: 'Dhaka', slug: 'dhaka', type: 'DISTRICT', translations: [], parent: null });

      await service.getLocation('dhaka', 'DISTRICT');

      const call = prisma.location.findFirst.mock.calls[0][0];
      expect(call.where).toEqual({ slug: 'dhaka', status: 'ACTIVE', type: 'DISTRICT' });
      expect(Object.keys(call.select)).toEqual(['id', 'name', 'slug', 'type', 'translations', 'parent']);
      expect(call.select).not.toHaveProperty('countryCode');
      expect(call.select).not.toHaveProperty('latitude');
    });
  });

  describe('getLocations', () => {
    it('lists only active locations with the minimal public navigation shape', async () => {
      prisma.location.findMany.mockResolvedValue([]);

      await service.getLocations();

      const call = prisma.location.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ status: 'ACTIVE' });
      expect(Object.keys(call.select)).toEqual(['id', 'name', 'slug', 'type', 'parentId', 'translations']);
    });
  });

  describe('search', () => {
    it('searches by title/excerpt and returns only PUBLISHED articles, paginated', async () => {
      prisma.article.findMany.mockResolvedValue([mockArticle]);
      prisma.article.count.mockResolvedValue(1);

      const result = await service.search({ page: 1, limit: 20, search: 'bangladesh' });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PUBLISHED',
            OR: [
              { title: { contains: 'bangladesh', mode: 'insensitive' } },
              { excerpt: { contains: 'bangladesh', mode: 'insensitive' } },
            ],
          }),
        }),
      );
      expect(result.data).toEqual([mockArticle]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('matches Bangla search terms unchanged (no mangling of non-Latin text)', async () => {
      prisma.article.findMany.mockResolvedValue([]);
      prisma.article.count.mockResolvedValue(0);

      await service.search({ page: 1, limit: 20, search: 'বাংলাদেশ' });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'বাংলাদেশ', mode: 'insensitive' } },
              { excerpt: { contains: 'বাংলাদেশ', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('resolves a category slug filter into the article query', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', slug: 'world' });
      prisma.article.findMany.mockResolvedValue([]);
      prisma.article.count.mockResolvedValue(0);

      await service.search({ page: 1, limit: 20, search: 'x', category: 'world' });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ categoryId: 'cat-1' }) }),
      );
    });

    it('ignores an unknown category slug rather than throwing (falls back to unfiltered search)', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      prisma.article.findMany.mockResolvedValue([]);
      prisma.article.count.mockResolvedValue(0);

      await expect(service.search({ page: 1, limit: 20, search: 'x', category: 'not-real' })).resolves.toBeDefined();
    });

    it('applies a publishedAt date range when dateFrom/dateTo are given', async () => {
      prisma.article.findMany.mockResolvedValue([]);
      prisma.article.count.mockResolvedValue(0);

      await service.search({ page: 1, limit: 20, search: 'x', dateFrom: '2026-01-01', dateTo: '2026-01-31' });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            publishedAt: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') },
          }),
        }),
      );
    });

    it('resolves the requested language for a search request', async () => {
      prisma.article.findMany.mockResolvedValue([]);
      prisma.article.count.mockResolvedValue(0);

      await service.search({ page: 1, limit: 20, search: 'x', lang: 'en' });

      expect(languagesService.resolveRequested).toHaveBeenCalledWith('en');
    });
  });

  describe('getHomepageData', () => {
    it('returns all sections', async () => {
      prisma.article.findFirst.mockResolvedValue(mockArticle);
      prisma.article.findMany.mockResolvedValue([mockArticle]);
      prisma.category.findUnique.mockResolvedValue({ id: 'c1', slug: 'bangladesh' });
      prisma.article.count.mockResolvedValue(1);
      breakingNewsService.getActiveBreakingNews.mockResolvedValue([]);
      trendingService.getTrending.mockResolvedValue([]);
      mostReadService.getMostRead.mockResolvedValue([]);

      const result = await service.getHomepageData();
      expect(result).toHaveProperty('latest');
      expect(result).toHaveProperty('sections');
    });
  });

  describe('getRelatedArticles', () => {
    it('excludes current article, prioritizes same category', async () => {
      prisma.article.findMany.mockResolvedValue([mockArticle]);

      const result = await service.getRelatedArticles('1', 'c1', [], 'l1');
      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { notIn: ['1'] },
            status: 'PUBLISHED',
          }),
        }),
      );
    });

    it('returns eligible manual stories first and removes them from automatic results', async () => {
      const manual = { ...mockArticle, id: 'manual', slug: 'manual' };
      const automatic = { ...mockArticle, id: 'auto', slug: 'auto' };
      prisma.articleRelated.findMany.mockResolvedValue([{ relatedArticle: manual }]);
      prisma.article.findMany.mockResolvedValue([automatic]);
      const result = await service.getRelatedArticles('1', 'c1', [], 'l1');
      expect(result.map((article) => article.id)).toEqual(['manual', 'auto']);
      expect(prisma.article.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: { notIn: ['1', 'manual'] } }),
        take: 4,
      }));
    });
  });
});
