import { Test, TestingModule } from '@nestjs/testing';
import { PublishingService } from './publishing.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';

describe('PublishingService', () => {
  let service: PublishingService;
  let prisma: any;
  let auditLog: any;

  const mockApprovedArticle = {
    id: 'article-1',
    title: 'Approved Article',
    slug: 'approved-article',
    status: 'APPROVED',
    publishedAt: null,
    scheduledAt: null,
  };

  beforeEach(async () => {
    prisma = {
      article: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
    };
    auditLog = { record: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublishingService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<PublishingService>(PublishingService);
  });

  describe('executeScheduledPublications', () => {
    it('should publish articles past scheduled time', async () => {
      const pastScheduled = {
        ...mockApprovedArticle,
        scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
      };
      prisma.article.findMany.mockResolvedValue([pastScheduled]);
      prisma.article.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.executeScheduledPublications();

      expect(prisma.article.findMany).toHaveBeenCalledWith({
        where: {
          status: 'APPROVED',
          scheduledAt: { lte: expect.any(Date) },
        },
      });
      expect(prisma.article.updateMany).toHaveBeenCalledWith({
        where: { id: 'article-1', status: 'APPROVED' },
        data: expect.objectContaining({
          status: 'PUBLISHED',
          publishedAt: expect.any(Date),
          scheduledAt: null,
        }),
      });
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ articleId: 'article-1', action: 'PUBLISHED', toStatus: 'PUBLISHED' }),
      );
      expect(result).toHaveLength(1);
    });

    it('should not publish future articles', async () => {
      prisma.article.findMany.mockResolvedValue([]);

      const result = await service.executeScheduledPublications();

      expect(result).toHaveLength(0);
      expect(prisma.article.updateMany).not.toHaveBeenCalled();
    });

    it('continues past a single failed publish and still returns the successful ones', async () => {
      const ok = { ...mockApprovedArticle, id: 'article-ok', scheduledAt: new Date(Date.now() - 1000) };
      const bad = { ...mockApprovedArticle, id: 'article-bad', scheduledAt: new Date(Date.now() - 1000) };
      prisma.article.findMany.mockResolvedValue([bad, ok]);
      prisma.article.updateMany.mockImplementation(({ where }: { where: { id: string } }) =>
        where.id === 'article-bad' ? Promise.reject(new Error('db error')) : Promise.resolve({ count: 1 }),
      );

      const result = await service.executeScheduledPublications();
      expect(result).toHaveLength(1);
    });

    it('skips an article already published by a concurrent manual publish or overlapping sweep', async () => {
      const raced = { ...mockApprovedArticle, id: 'article-raced', scheduledAt: new Date(Date.now() - 1000) };
      prisma.article.findMany.mockResolvedValue([raced]);
      prisma.article.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.executeScheduledPublications();
      expect(result).toHaveLength(0);
      expect(auditLog.record).not.toHaveBeenCalled();
    });
  });
});
