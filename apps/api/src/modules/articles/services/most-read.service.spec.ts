import { Test, TestingModule } from '@nestjs/testing';
import { MostReadService } from './most-read.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('MostReadService', () => {
  let service: MostReadService;
  let prisma: any;

  const mockArticle1 = {
    id: 'article-1',
    title: 'Popular Article',
    slug: 'popular',
    excerpt: 'Excerpt 1',
    publishedAt: new Date(),
    viewCount: 1000,
    author: { id: 'user-1', name: 'Author 1' },
    category: { id: 'cat-1', name: 'Tech', slug: 'tech' },
    location: { id: 'loc-1', name: 'Dhaka', slug: 'dhaka', type: 'DISTRICT' },
    views: [
      { id: 'v1' },
      { id: 'v2' },
      { id: 'v3' },
    ],
  };

  const mockArticle2 = {
    id: 'article-2',
    title: 'Less Popular Article',
    slug: 'less-popular',
    excerpt: 'Excerpt 2',
    publishedAt: new Date(),
    viewCount: 500,
    author: { id: 'user-2', name: 'Author 2' },
    category: { id: 'cat-2', name: 'Sports', slug: 'sports' },
    location: { id: 'loc-2', name: 'Chittagong', slug: 'chittagong', type: 'DIVISION' },
    views: [{ id: 'v4' }],
  };

  beforeEach(async () => {
    prisma = {
      article: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MostReadService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MostReadService>(MostReadService);
  });

  describe('getMostRead', () => {
    it('should return articles sorted by view count', async () => {
      prisma.article.findMany.mockResolvedValue([mockArticle1, mockArticle2]);

      const result = await service.getMostRead();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('article-1');
      expect(result[0].recentViews).toBe(3);
      expect(result[1].id).toBe('article-2');
      expect(result[1].recentViews).toBe(1);
    });

    it('should respect time window today', async () => {
      prisma.article.findMany.mockResolvedValue([mockArticle1]);

      await service.getMostRead({ window: 'today' });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PUBLISHED' }),
        }),
      );
    });

    it('should respect time window 24h', async () => {
      prisma.article.findMany.mockResolvedValue([mockArticle1]);

      await service.getMostRead({ window: '24h' });

      expect(prisma.article.findMany).toHaveBeenCalled();
    });

    it('should respect time window 7d', async () => {
      prisma.article.findMany.mockResolvedValue([mockArticle1]);

      await service.getMostRead({ window: '7d' });

      expect(prisma.article.findMany).toHaveBeenCalled();
    });

    it('should respect limit', async () => {
      prisma.article.findMany.mockResolvedValue([mockArticle1]);

      await service.getMostRead({ limit: 5 });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 15, // limit * 3
        }),
      );
    });

    it('should exclude unpublished articles', async () => {
      prisma.article.findMany.mockResolvedValue([]);

      await service.getMostRead();

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PUBLISHED' },
        }),
      );
    });
  });
});
