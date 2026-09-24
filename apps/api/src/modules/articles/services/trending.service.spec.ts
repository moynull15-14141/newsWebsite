import { Test, TestingModule } from '@nestjs/testing';
import { TrendingService } from './trending.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('TrendingService', () => {
  let service: TrendingService;
  let prisma: any;

  const mockArticle1 = {
    id: 'article-1',
    title: 'Old Popular Article',
    slug: 'old-popular',
    excerpt: 'Old excerpt',
    publishedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
    viewCount: 1000,
    author: { id: 'user-1', name: 'Author 1' },
    category: { id: 'cat-1', name: 'Tech', slug: 'tech' },
    location: { id: 'loc-1', name: 'Dhaka', slug: 'dhaka', type: 'DISTRICT' },
  };

  const mockArticle2 = {
    id: 'article-2',
    title: 'New Popular Article',
    slug: 'new-popular',
    excerpt: 'New excerpt',
    publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    viewCount: 500,
    author: { id: 'user-2', name: 'Author 2' },
    category: { id: 'cat-2', name: 'Sports', slug: 'sports' },
    location: { id: 'loc-2', name: 'Chittagong', slug: 'chittagong', type: 'DIVISION' },
  };

  beforeEach(async () => {
    prisma = {
      article: {
        findMany: jest.fn(),
      },
      location: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrendingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TrendingService>(TrendingService);
  });

  describe('getTrending', () => {
    it('should return articles sorted by score', async () => {
      prisma.article.findMany.mockResolvedValue([mockArticle1, mockArticle2]);

      const result = await service.getTrending();

      expect(result).toHaveLength(2);
      // Both should have trendingScore
      expect(result[0]).toHaveProperty('trendingScore');
      expect(result[1]).toHaveProperty('trendingScore');
      // Higher score first
      expect(result[0].trendingScore).toBeGreaterThanOrEqual(result[1].trendingScore);
    });

    it('should rank recent articles higher', async () => {
      // Article 2 is newer (1 day) but has fewer views (500)
      // Article 1 is older (6 days) but has more views (1000)
      // Recent articles should score higher due to recency factor
      prisma.article.findMany.mockResolvedValue([mockArticle1, mockArticle2]);

      const result = await service.getTrending();

      // Newer article should generally rank higher
      expect(result[0].id).toBe('article-2');
    });

    it('should rank articles with more views higher', async () => {
      // Both articles published at the same time, but different views
      const sameTime = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
      const highViewArticle = {
        ...mockArticle1,
        publishedAt: sameTime,
        viewCount: 1000,
      };
      const lowViewArticle = {
        ...mockArticle2,
        publishedAt: sameTime,
        viewCount: 10,
      };
      prisma.article.findMany.mockResolvedValue([highViewArticle, lowViewArticle]);

      const result = await service.getTrending();

      expect(result[0].id).toBe('article-1');
      expect(result[0].trendingScore).toBeGreaterThan(result[1].trendingScore);
    });

    it('should respect limit', async () => {
      prisma.article.findMany.mockResolvedValue([mockArticle1, mockArticle2]);

      const result = await service.getTrending({ limit: 1 });

      expect(result).toHaveLength(1);
    });

    it('should filter by location', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'loc-1', slug: 'dhaka' });
      prisma.location.findMany.mockResolvedValue([{ id: 'loc-child' }]);
      prisma.article.findMany.mockResolvedValue([mockArticle1]);

      await service.getTrending({ locationSlug: 'dhaka' });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            locationId: { in: ['loc-1', 'loc-child'] },
          }),
        }),
      );
    });

    // Regression: the homepage's "Top stories" rail (StoryRow, via HomePage's `secondary` list) renders
    // whichever of trending/most-read/latest happened to fill that slot — a trending article missing
    // `media` here silently showed no thumbnail even though the same article's own page had one,
    // because that page fetches it through a different, correctly-selected query.
    it('selects the media relation so trending articles carry a featured-image thumbnail', async () => {
      prisma.article.findMany.mockResolvedValue([mockArticle1]);

      await service.getTrending();

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            media: { select: { id: true, publicUrl: true, altText: true, width: true, height: true } },
          }),
        }),
      );
    });
  });
});
