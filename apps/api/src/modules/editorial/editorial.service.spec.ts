import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EditorialService } from './editorial.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('EditorialService', () => {
  let service: EditorialService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      article: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
      articleNote: { create: jest.fn(), findMany: jest.fn() },
      articleCorrection: { create: jest.fn(), findMany: jest.fn() },
      articleAuditLog: { create: jest.fn() },
      platformSetting: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EditorialService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<EditorialService>(EditorialService);
  });

  describe('addNote', () => {
    it('creates a trimmed internal note', async () => {
      prisma.article.findUniqueOrThrow.mockResolvedValue({ id: 'article-1' });
      prisma.articleNote.create.mockResolvedValue({ id: 'note-1', content: 'Check the second source' });

      await service.addNote('article-1', 'user-1', '  Check the second source  ');

      expect(prisma.articleNote.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { articleId: 'article-1', authorId: 'user-1', content: 'Check the second source' } }),
      );
    });
  });

  describe('addCorrection', () => {
    it('rejects a correction on an article that is not published', async () => {
      prisma.article.findUnique.mockResolvedValue(null);

      await expect(service.addCorrection('article-1', 'editor-1', 'Fixed a date')).rejects.toThrow(NotFoundException);
      expect(prisma.articleCorrection.create).not.toHaveBeenCalled();
    });

    it('records the correction and an audit log entry for a published article', async () => {
      prisma.article.findUnique.mockResolvedValue({ id: 'article-1', status: 'PUBLISHED' });
      prisma.articleCorrection.create.mockResolvedValue({ id: 'correction-1', description: 'Fixed a date' });

      const result = await service.addCorrection('article-1', 'editor-1', 'Fixed a date');

      expect(result.id).toBe('correction-1');
      expect(prisma.articleAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ articleId: 'article-1', actorId: 'editor-1', action: 'CORRECTED' }) }),
      );
    });
  });

  describe('getCorrections', () => {
    it('returns corrections newest-first with the editor who made them', async () => {
      prisma.articleCorrection.findMany.mockResolvedValue([{ id: 'correction-1' }]);

      const result = await service.getCorrections('article-1');

      expect(prisma.articleCorrection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { articleId: 'article-1' }, orderBy: { correctedAt: 'desc' } }),
      );
      expect(result).toHaveLength(1);
    });
  });
});
