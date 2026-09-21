import { Test, TestingModule } from '@nestjs/testing';
import { PublishingService } from './publishing.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PublishingService', () => {
  let service: PublishingService;
  let prisma: any;

  const mockApprovedArticle = {
    id: 'article-1',
    title: 'Approved Article',
    slug: 'approved-article',
    status: 'APPROVED',
    publishedAt: null,
    scheduledAt: null,
    archivedAt: null,
    isBreaking: false,
    breakingStartedAt: null,
    breakingEndsAt: null,
    breakingPriority: null,
  };

  const mockPublishedArticle = {
    ...mockApprovedArticle,
    status: 'PUBLISHED',
    publishedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      article: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublishingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PublishingService>(PublishingService);
  });

  describe('publish', () => {
    it('should publish approved article', async () => {
      prisma.article.findUnique.mockResolvedValue(mockApprovedArticle);
      prisma.article.update.mockResolvedValue(mockPublishedArticle);

      const result = await service.publish('article-1', 'user-1');

      expect(prisma.article.update).toHaveBeenCalledWith({
        where: { id: 'article-1' },
        data: expect.objectContaining({
          status: 'PUBLISHED',
          publishedAt: expect.any(Date),
        }),
      });
      expect(result.status).toBe('PUBLISHED');
    });

    it('should throw BadRequestException for non-approved article', async () => {
      prisma.article.findUnique.mockResolvedValue({
        ...mockApprovedArticle,
        status: 'DRAFT',
      });

      await expect(
        service.publish('article-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent article', async () => {
      prisma.article.findUnique.mockResolvedValue(null);

      await expect(
        service.publish('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('schedule', () => {
    it('should schedule approved article', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      prisma.article.findUnique.mockResolvedValue(mockApprovedArticle);
      prisma.article.update.mockResolvedValue({
        ...mockApprovedArticle,
        scheduledAt: futureDate,
      });

      const result = await service.schedule('article-1', futureDate, 'user-1');

      expect(prisma.article.update).toHaveBeenCalledWith({
        where: { id: 'article-1' },
        data: { scheduledAt: futureDate },
      });
      expect(result.scheduledAt).toEqual(futureDate);
    });

    it('should throw BadRequestException for past date', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      prisma.article.findUnique.mockResolvedValue(mockApprovedArticle);

      await expect(
        service.schedule('article-1', pastDate, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-approved article', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      prisma.article.findUnique.mockResolvedValue({
        ...mockApprovedArticle,
        status: 'DRAFT',
      });

      await expect(
        service.schedule('article-1', futureDate, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelSchedule', () => {
    it('should remove scheduled time', async () => {
      prisma.article.findUnique.mockResolvedValue({
        ...mockApprovedArticle,
        scheduledAt: new Date(),
      });
      prisma.article.update.mockResolvedValue(mockApprovedArticle);

      const result = await service.cancelSchedule('article-1');

      expect(prisma.article.update).toHaveBeenCalledWith({
        where: { id: 'article-1' },
        data: { scheduledAt: null },
      });
      expect(result.scheduledAt).toBeNull();
    });
  });

  describe('archive', () => {
    it('should archive published article', async () => {
      prisma.article.findUnique.mockResolvedValue(mockPublishedArticle);
      prisma.article.update.mockResolvedValue({
        ...mockPublishedArticle,
        status: 'ARCHIVED',
        archivedAt: new Date(),
      });

      const result = await service.archive('article-1');

      expect(prisma.article.update).toHaveBeenCalledWith({
        where: { id: 'article-1' },
        data: expect.objectContaining({
          status: 'ARCHIVED',
          archivedAt: expect.any(Date),
          isBreaking: false,
          breakingStartedAt: null,
          breakingEndsAt: null,
          breakingPriority: null,
        }),
      });
      expect(result.status).toBe('ARCHIVED');
    });

    it('should throw BadRequestException for non-published article', async () => {
      prisma.article.findUnique.mockResolvedValue(mockApprovedArticle);

      await expect(service.archive('article-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for non-existent article', async () => {
      prisma.article.findUnique.mockResolvedValue(null);

      await expect(service.archive('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('executeScheduledPublications', () => {
    it('should publish articles past scheduled time', async () => {
      const pastScheduled = {
        ...mockApprovedArticle,
        scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
      };
      prisma.article.findMany.mockResolvedValue([pastScheduled]);
      prisma.article.update.mockResolvedValue({
        ...pastScheduled,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        scheduledAt: null,
      });

      const result = await service.executeScheduledPublications();

      expect(prisma.article.findMany).toHaveBeenCalledWith({
        where: {
          status: 'APPROVED',
          scheduledAt: { lte: expect.any(Date) },
        },
      });
      expect(prisma.article.update).toHaveBeenCalledWith({
        where: { id: 'article-1' },
        data: expect.objectContaining({
          status: 'PUBLISHED',
          publishedAt: expect.any(Date),
          scheduledAt: null,
        }),
      });
      expect(result).toHaveLength(1);
    });

    it('should not publish future articles', async () => {
      prisma.article.findMany.mockResolvedValue([]);

      const result = await service.executeScheduledPublications();

      expect(result).toHaveLength(0);
      expect(prisma.article.update).not.toHaveBeenCalled();
    });
  });
});
