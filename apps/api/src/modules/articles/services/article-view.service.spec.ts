import { Test, TestingModule } from '@nestjs/testing';
import { ArticleViewService } from './article-view.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('ArticleViewService', () => {
  let service: ArticleViewService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      articleView: {
        create: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      article: {
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleViewService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ArticleViewService>(ArticleViewService);
  });

  describe('recordView', () => {
    it('should record a new view', async () => {
      prisma.articleView.findFirst.mockResolvedValue(null);
      prisma.articleView.create.mockResolvedValue({ id: 'view-1' });
      prisma.article.update.mockResolvedValue({});

      const result = await service.recordView('article-1', 'session-1', 'fp-1');

      expect(prisma.articleView.create).toHaveBeenCalledWith({
        data: { articleId: 'article-1', sessionId: 'session-1', fingerprint: 'fp-1' },
      });
      expect(result.counted).toBe(true);
    });

    it('should increment viewCount on article', async () => {
      prisma.articleView.findFirst.mockResolvedValue(null);
      prisma.articleView.create.mockResolvedValue({ id: 'view-1' });
      prisma.article.update.mockResolvedValue({});

      await service.recordView('article-1', 'session-1', 'fp-1');

      expect(prisma.article.update).toHaveBeenCalledWith({
        where: { id: 'article-1' },
        data: { viewCount: { increment: 1 } },
      });
    });

    it('should deduplicate within 30 minutes', async () => {
      prisma.articleView.findFirst.mockResolvedValue({
        id: 'existing-view',
        articleId: 'article-1',
        fingerprint: 'fp-1',
      });

      const result = await service.recordView('article-1', 'session-1', 'fp-1');

      expect(prisma.articleView.findFirst).toHaveBeenCalledWith({
        where: {
          articleId: 'article-1',
          fingerprint: 'fp-1',
          viewedAt: { gte: expect.any(Date) },
        },
      });
      expect(prisma.articleView.create).not.toHaveBeenCalled();
      expect(prisma.article.update).not.toHaveBeenCalled();
      expect(result.counted).toBe(false);
    });

    it('should allow same fingerprint after 30 minutes', async () => {
      prisma.articleView.findFirst.mockResolvedValue(null);
      prisma.articleView.create.mockResolvedValue({ id: 'view-2' });
      prisma.article.update.mockResolvedValue({});

      // Find first returns null (no recent view)
      const result = await service.recordView('article-1', 'session-1', 'fp-1');

      expect(prisma.articleView.findFirst).toHaveBeenCalled();
      expect(prisma.articleView.create).toHaveBeenCalled();
      expect(result.counted).toBe(true);
    });
  });

  describe('getArticleViews', () => {
    it('should return total, today, and 7-day counts', async () => {
      prisma.articleView.count
        .mockResolvedValueOnce(150) // totalViews
        .mockResolvedValueOnce(25) // viewsToday
        .mockResolvedValueOnce(100); // viewsLast7Days

      const result = await service.getArticleViews('article-1');

      expect(prisma.articleView.count).toHaveBeenCalledTimes(3);
      expect(prisma.articleView.count).toHaveBeenCalledWith({
        where: { articleId: 'article-1' },
      });
      expect(prisma.articleView.count).toHaveBeenCalledWith({
        where: {
          articleId: 'article-1',
          viewedAt: { gte: expect.any(Date) },
        },
      });
      expect(result).toEqual({
        totalViews: 150,
        viewsToday: 25,
        viewsLast7Days: 100,
      });
    });
  });
});
