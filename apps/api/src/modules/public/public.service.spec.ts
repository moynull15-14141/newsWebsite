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
      tag: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      location: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
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
      prisma.tag.findUnique.mockResolvedValue({ id: 't1', slug: 'news' });
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
            id: { not: '1' },
            status: 'PUBLISHED',
          }),
        }),
      );
    });
  });
});
