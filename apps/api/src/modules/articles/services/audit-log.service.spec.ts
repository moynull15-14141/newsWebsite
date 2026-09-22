import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      articleAuditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditLogService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  describe('record', () => {
    it('persists the actor, action and status transition', async () => {
      prisma.articleAuditLog.create.mockResolvedValue({ id: 'log-1' });

      await service.record({ articleId: 'article-1', actorId: 'user-1', action: 'PUBLISHED', fromStatus: 'APPROVED', toStatus: 'PUBLISHED' });

      expect(prisma.articleAuditLog.create).toHaveBeenCalledWith({
        data: {
          articleId: 'article-1',
          actorId: 'user-1',
          action: 'PUBLISHED',
          fromStatus: 'APPROVED',
          toStatus: 'PUBLISHED',
          note: null,
        },
      });
    });

    it('truncates an overly long note instead of failing', async () => {
      prisma.articleAuditLog.create.mockResolvedValue({ id: 'log-1' });
      const longNote = 'x'.repeat(3000);

      await service.record({ articleId: 'article-1', action: 'RETURNED_TO_DRAFT', note: longNote });

      const data = prisma.articleAuditLog.create.mock.calls[0][0].data;
      expect(data.note.length).toBe(2000);
    });

    it('allows a null actor for system-driven events', async () => {
      prisma.articleAuditLog.create.mockResolvedValue({ id: 'log-1' });

      await service.record({ articleId: 'article-1', action: 'PUBLISHED' });

      expect(prisma.articleAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ actorId: null }),
      });
    });
  });

  describe('listForArticle', () => {
    it('returns paginated results ordered newest-first', async () => {
      prisma.articleAuditLog.findMany.mockResolvedValue([{ id: 'log-2' }, { id: 'log-1' }]);
      prisma.articleAuditLog.count.mockResolvedValue(2);

      const result = await service.listForArticle('article-1');

      expect(prisma.articleAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { articleId: 'article-1' }, orderBy: { createdAt: 'desc' } }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });
});
