import { Test, TestingModule } from '@nestjs/testing';
import { BreakingNewsService } from './breaking-news.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('BreakingNewsService', () => {
  let service: BreakingNewsService;
  let prisma: any;

  const mockItem = {
    id: 'bn-1',
    headline: 'Dhaka Metro announces new schedule',
    articleId: null,
    isActive: false,
    priority: 1,
    startAt: null,
    endAt: null,
    backgroundMode: 'SOLID',
    backgroundColor: '#D32F2F',
    gradientStart: null,
    gradientEnd: null,
    gradientDirection: null,
    textColor: '#FFFFFF',
    badgeBackgroundColor: '#FFFFFF',
    badgeTextColor: '#D32F2F',
    animationSpeedMs: 18000,
  };

  beforeEach(async () => {
    prisma = {
      breakingNews: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      breakingNewsAuditLog: { create: jest.fn().mockResolvedValue({}) },
      article: { findUnique: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BreakingNewsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(BreakingNewsService);
  });

  describe('create', () => {
    it('creates with sensible defaults and logs CREATED', async () => {
      prisma.breakingNews.findFirst.mockResolvedValue(null);
      prisma.breakingNews.create.mockResolvedValue(mockItem);

      const result = await service.create({ headline: mockItem.headline }, 'editor-1');
      expect(result.headline).toBe(mockItem.headline);
      expect(prisma.breakingNews.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false, backgroundMode: 'SOLID', backgroundColor: '#D32F2F' }) }),
      );
      expect(prisma.breakingNewsAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'CREATED' }) }),
      );
    });

    it('defaults a new item to the back of the queue, not priority 0', async () => {
      prisma.breakingNews.findFirst.mockResolvedValue({ priority: 3 });
      prisma.breakingNews.create.mockResolvedValue({ ...mockItem, priority: 4 });

      await service.create({ headline: 'Another headline' }, 'editor-1');
      expect(prisma.breakingNews.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ priority: 4 }) }));
    });

    it('rejects a link to an article that does not exist', async () => {
      prisma.article.findUnique.mockResolvedValue(null);
      await expect(service.create({ headline: 'x', articleId: 'ghost' }, 'editor-1')).rejects.toThrow(BadRequestException);
      expect(prisma.breakingNews.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid schedule window', async () => {
      await expect(service.create({ headline: 'x', startAt: '2026-06-02T00:00:00Z', endAt: '2026-06-01T00:00:00Z' }, 'editor-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('update / remove', () => {
    it('throws NotFoundException updating a missing item', async () => {
      prisma.breakingNews.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { headline: 'x' }, 'editor-1')).rejects.toThrow(NotFoundException);
    });

    it('rejects an update that makes the existing schedule window invalid', async () => {
      prisma.breakingNews.findUnique.mockResolvedValue({ ...mockItem, startAt: new Date('2026-06-01T00:00:00Z'), endAt: new Date('2026-06-03T00:00:00Z') });
      await expect(service.update('bn-1', { endAt: '2026-05-01T00:00:00Z' }, 'editor-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException deleting a missing item', async () => {
      prisma.breakingNews.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing', 'editor-1')).rejects.toThrow(NotFoundException);
    });

    it('archives an existing item and preserves its audit trail', async () => {
      prisma.breakingNews.findUnique.mockResolvedValue(mockItem);
      prisma.breakingNews.update.mockResolvedValue(mockItem);
      const result = await service.remove('bn-1', 'editor-1');
      expect(result.message).toBe('Breaking news item archived');
      expect(prisma.breakingNews.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: false, archivedAt: expect.any(Date) }) }));
      expect(prisma.breakingNewsAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'ARCHIVED' }) }));
    });
  });

  describe('activate / deactivate / publishNow / stop', () => {
    it('activates and logs ACTIVATED', async () => {
      prisma.breakingNews.findUnique.mockResolvedValue(mockItem);
      prisma.breakingNews.update.mockResolvedValue({ ...mockItem, isActive: true });
      await service.setActive('bn-1', true, 'editor-1');
      expect(prisma.breakingNewsAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'ACTIVATED' }) }));
    });

    it('publishNow turns the item on immediately regardless of a future startAt', async () => {
      prisma.breakingNews.findUnique.mockResolvedValue({ ...mockItem, startAt: new Date('2099-01-01') });
      prisma.breakingNews.update.mockResolvedValue({ ...mockItem, isActive: true });
      await service.publishNow('bn-1', 'editor-1');
      expect(prisma.breakingNews.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: true, startAt: expect.any(Date) }) }),
      );
    });

    it('stop deactivates AND closes the schedule window (endAt = now)', async () => {
      prisma.breakingNews.findUnique.mockResolvedValue({ ...mockItem, isActive: true });
      prisma.breakingNews.update.mockResolvedValue({ ...mockItem, isActive: false });
      await service.stop('bn-1', 'editor-1');
      expect(prisma.breakingNews.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false, endAt: expect.any(Date) }) }),
      );
    });
  });

  describe('schedule', () => {
    it('rejects an end time at or before the start time', async () => {
      prisma.breakingNews.findUnique.mockResolvedValue(mockItem);
      await expect(
        service.schedule('bn-1', '2026-06-01T12:00:00Z', '2026-06-01T10:00:00Z', 'editor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not touch isActive — schedule only sets the window', async () => {
      prisma.breakingNews.findUnique.mockResolvedValue(mockItem);
      prisma.breakingNews.update.mockResolvedValue(mockItem);
      await service.schedule('bn-1', '2026-06-01T10:00:00Z', '2026-06-02T10:00:00Z', 'editor-1');
      const data = prisma.breakingNews.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('isActive');
    });
  });

  describe('reorder', () => {
    it('rejects reordering with an id that does not exist', async () => {
      prisma.breakingNews.findMany.mockResolvedValue([{ id: 'bn-1' }]);
      await expect(service.reorder(['bn-1', 'ghost'], 'editor-1')).rejects.toThrow(BadRequestException);
    });

    it('assigns priority by position in the given order', async () => {
      prisma.breakingNews.findMany
        .mockResolvedValueOnce([{ id: 'bn-1' }, { id: 'bn-2' }])
        .mockResolvedValueOnce([mockItem]);
      prisma.breakingNews.update.mockResolvedValue(mockItem);

      await service.reorder(['bn-2', 'bn-1'], 'editor-1');
      expect(prisma.breakingNews.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: 'bn-2' }, data: expect.objectContaining({ priority: 1 }) }));
      expect(prisma.breakingNews.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: 'bn-1' }, data: expect.objectContaining({ priority: 2 }) }));
    });
  });

  describe('getActiveTicker (public)', () => {
    it('queries only active, in-window items ordered by priority', async () => {
      prisma.breakingNews.findMany.mockResolvedValue([]);
      await service.getActiveTicker();
      expect(prisma.breakingNews.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        }),
      );
    });

    it('includes the article slug when the linked article is publicly eligible (PUBLISHED, not future-dated)', async () => {
      prisma.breakingNews.findMany.mockResolvedValue([
        { ...mockItem, isActive: true, article: { id: 'a1', slug: 'metro-opens', title: 'x', status: 'PUBLISHED', publishedAt: new Date('2020-01-01') } },
      ]);
      const result = await service.getActiveTicker();
      expect(result[0].articleSlug).toBe('metro-opens');
    });

    it('never exposes a slug for a DRAFT-linked article — headline stays, link is stripped', async () => {
      prisma.breakingNews.findMany.mockResolvedValue([
        { ...mockItem, isActive: true, headline: 'Developing story', article: { id: 'a1', slug: 'secret-draft', title: 'x', status: 'DRAFT', publishedAt: null } },
      ]);
      const result = await service.getActiveTicker();
      expect(result[0].articleSlug).toBeNull();
      expect(result[0].headline).toBe('Developing story');
    });

    it('never exposes a slug for an ARCHIVED-linked article', async () => {
      prisma.breakingNews.findMany.mockResolvedValue([
        { ...mockItem, isActive: true, article: { id: 'a1', slug: 'old-story', title: 'x', status: 'ARCHIVED', publishedAt: new Date('2020-01-01') } },
      ]);
      const result = await service.getActiveTicker();
      expect(result[0].articleSlug).toBeNull();
    });

    it('never exposes a slug for a scheduled-but-not-yet-published article', async () => {
      prisma.breakingNews.findMany.mockResolvedValue([
        { ...mockItem, isActive: true, article: { id: 'a1', slug: 'future-story', title: 'x', status: 'PUBLISHED', publishedAt: new Date('2099-01-01') } },
      ]);
      const result = await service.getActiveTicker();
      expect(result[0].articleSlug).toBeNull();
    });

    it('returns appearance fields for the public ticker to render', async () => {
      prisma.breakingNews.findMany.mockResolvedValue([{ ...mockItem, isActive: true, backgroundMode: 'GRADIENT', gradientStart: '#111111', gradientEnd: '#222222', gradientDirection: 'LEFT_RIGHT', article: null }]);
      const result = await service.getActiveTicker();
      expect(result[0]).toMatchObject({ backgroundMode: 'GRADIENT', gradientStart: '#111111', gradientEnd: '#222222', gradientDirection: 'LEFT_RIGHT', animationSpeedMs: 18000 });
    });
  });
});
