import { Test, TestingModule } from '@nestjs/testing';
import { BreakingNewsService } from './breaking-news.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('BreakingNewsService', () => {
  let service: BreakingNewsService;
  let prisma: any;

  const mockPublishedArticle = {
    id: 'article-1',
    title: 'Breaking Test',
    slug: 'breaking-test',
    status: 'PUBLISHED',
    isBreaking: false,
    breakingStartedAt: null,
    breakingPriority: null,
    breakingEndsAt: null,
  };

  const mockBreakingArticle = {
    ...mockPublishedArticle,
    isBreaking: true,
    breakingStartedAt: new Date('2026-09-05T10:00:00Z'),
    breakingPriority: 1,
    breakingEndsAt: new Date('2026-09-06T10:00:00Z'),
  };

  beforeEach(async () => {
    prisma = {
      article: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BreakingNewsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<BreakingNewsService>(BreakingNewsService);
  });

  describe('markBreaking', () => {
    it('should mark a published article as breaking', async () => {
      prisma.article.findUnique.mockResolvedValue(mockPublishedArticle);
      prisma.article.update.mockResolvedValue({
        ...mockPublishedArticle,
        isBreaking: true,
        breakingStartedAt: expect.any(Date),
        breakingPriority: 0,
      });

      const result = await service.markBreaking('article-1');

      expect(prisma.article.findUnique).toHaveBeenCalledWith({
        where: { id: 'article-1' },
      });
      expect(prisma.article.update).toHaveBeenCalledWith({
        where: { id: 'article-1' },
        data: expect.objectContaining({
          isBreaking: true,
          breakingStartedAt: expect.any(Date),
          breakingPriority: 0,
        }),
      });
      expect(result.isBreaking).toBe(true);
    });

    it('should throw BadRequestException for non-published article', async () => {
      prisma.article.findUnique.mockResolvedValue({
        ...mockPublishedArticle,
        status: 'DRAFT',
      });

      await expect(
        service.markBreaking('article-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent article', async () => {
      prisma.article.findUnique.mockResolvedValue(null);

      await expect(
        service.markBreaking('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set priority and expiration', async () => {
      const endsAt = new Date('2026-09-06T12:00:00Z');
      prisma.article.findUnique.mockResolvedValue(mockPublishedArticle);
      prisma.article.update.mockResolvedValue({
        ...mockPublishedArticle,
        isBreaking: true,
        breakingPriority: 5,
        breakingEndsAt: endsAt,
      });

      await service.markBreaking('article-1', 5, endsAt);

      expect(prisma.article.update).toHaveBeenCalledWith({
        where: { id: 'article-1' },
        data: expect.objectContaining({
          isBreaking: true,
          breakingPriority: 5,
          breakingEndsAt: endsAt,
        }),
      });
    });
  });

  describe('removeBreaking', () => {
    it('should remove breaking status', async () => {
      prisma.article.findUnique.mockResolvedValue(mockBreakingArticle);
      prisma.article.update.mockResolvedValue(mockPublishedArticle);

      const result = await service.removeBreaking('article-1');

      expect(prisma.article.update).toHaveBeenCalledWith({
        where: { id: 'article-1' },
        data: {
          isBreaking: false,
          breakingStartedAt: null,
          breakingPriority: null,
          breakingEndsAt: null,
        },
      });
      expect(result.isBreaking).toBe(false);
    });

    it('should throw NotFoundException for non-existent article', async () => {
      prisma.article.findUnique.mockResolvedValue(null);

      await expect(
        service.removeBreaking('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getActiveBreakingNews', () => {
    it('should return active breaking items', async () => {
      prisma.article.findMany.mockResolvedValue([mockBreakingArticle]);

      const result = await service.getActiveBreakingNews();

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isBreaking: true,
            status: 'PUBLISHED',
          }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('should exclude expired items', async () => {
      const expiredArticle = {
        ...mockBreakingArticle,
        breakingEndsAt: new Date('2026-01-01T00:00:00Z'),
      };
      prisma.article.findMany.mockResolvedValue([]);

      const result = await service.getActiveBreakingNews();

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isBreaking: true,
            OR: [
              { breakingEndsAt: null },
              { breakingEndsAt: { gt: expect.any(Date) } },
            ],
          }),
        }),
      );
      expect(result).toHaveLength(0);
    });

    it('should respect limit', async () => {
      prisma.article.findMany.mockResolvedValue([mockBreakingArticle]);

      await service.getActiveBreakingNews(3);

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 3,
        }),
      );
    });
  });

  describe('clearExpiredBreaking', () => {
    it('should clear expired items', async () => {
      const expiredArticle = {
        ...mockBreakingArticle,
        breakingEndsAt: new Date('2026-01-01T00:00:00Z'),
      };
      prisma.article.findMany.mockResolvedValue([expiredArticle]);
      prisma.article.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.clearExpiredBreaking();

      expect(prisma.article.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          isBreaking: true,
          breakingEndsAt: { lte: expect.any(Date) },
        }),
        data: {
          isBreaking: false,
          breakingStartedAt: null,
          breakingPriority: null,
          breakingEndsAt: null,
        },
      });
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no expired items', async () => {
      prisma.article.findMany.mockResolvedValue([]);

      const result = await service.clearExpiredBreaking();

      expect(prisma.article.updateMany).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });
  });
});
