import { Test, TestingModule } from '@nestjs/testing';
import { ArticlesService } from './articles.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LanguagesService } from '../languages/languages.service';
import { AuditLogService } from './services/audit-log.service';
import { SeoService } from '../seo/seo.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let prisma: any;
  let languagesService: any;
  let auditLog: any;
  let seoService: any;

  const sampleContent = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A real news story with actual body content in it.' }] }] };

  const mockArticle = {
    id: 'article-1',
    title: 'Test Article',
    slug: 'test-article',
    excerpt: 'Test excerpt',
    content: sampleContent,
    status: 'DRAFT',
    authorId: 'user-1',
    categoryId: null,
    locationId: null,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    scheduledAt: null,
    author: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    category: null,
    location: null,
    articleTags: [],
  };

  beforeEach(async () => {
    prisma = {
      article: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      articleTag: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      articleRelated: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      articleRevision: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      language: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn((fn: (tx: any) => unknown) => fn(prisma)),
    };
    languagesService = { getDefault: jest.fn().mockResolvedValue({ id: 'lang-bn', code: 'bn', isDefault: true }) };
    auditLog = { record: jest.fn().mockResolvedValue({}) };
    seoService = { analyzeArticle: jest.fn().mockResolvedValue({ checks: [] }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: PrismaService, useValue: prisma },
        { provide: LanguagesService, useValue: languagesService },
        { provide: AuditLogService, useValue: auditLog },
        { provide: SeoService, useValue: seoService },
      ],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
  });

  describe('manual related stories', () => {
    it('rejects self-reference', async () => {
      prisma.article.findUnique.mockResolvedValue({ id: 'article-1' });
      await expect(service.updateManualRelated('article-1', ['article-1'], 'editor-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects missing targets', async () => {
      prisma.article.findUnique.mockResolvedValue({ id: 'article-1' });
      prisma.article.findMany.mockResolvedValue([]);
      await expect(service.updateManualRelated('article-1', ['11111111-1111-4111-8111-111111111111'], 'editor-1')).rejects.toThrow(BadRequestException);
    });

    it('persists order and writes an audit event', async () => {
      const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
      prisma.article.findUnique.mockResolvedValue({ id: 'article-1' });
      prisma.article.findMany.mockResolvedValue(ids.map((id) => ({ id })));
      prisma.articleRelated.findMany.mockResolvedValue([]);
      await service.updateManualRelated('article-1', ids, 'editor-1');
      expect(prisma.articleRelated.createMany).toHaveBeenCalledWith({ data: [
        { articleId: 'article-1', relatedArticleId: ids[0], position: 1 },
        { articleId: 'article-1', relatedArticleId: ids[1], position: 2 },
      ] });
      expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'RELATED_STORIES_UPDATED', actorId: 'editor-1' }));
    });
  });

  describe('create', () => {
    it('should create an article', async () => {
      prisma.article.findUnique.mockResolvedValue(null);
      prisma.article.create.mockResolvedValue(mockArticle);

      const result = await service.create({ title: 'Test Article' }, 'user-1');

      expect(result.title).toBe('Test Article');
      expect(result.authorId).toBe('user-1');
    });

    it('should throw BadRequestException for duplicate slug', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);

      await expect(
        service.create(
          { title: 'Test Article', slug: 'test-article' },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return an article', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);

      const result = await service.findOne('article-1');
      expect(result.id).toBe('article-1');
    });

    it('should throw NotFoundException for missing article', async () => {
      prisma.article.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findBySlug', () => {
    it('should return an article by slug', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);

      const result = await service.findBySlug('test-article');
      expect(result.id).toBe('article-1');
    });

    it('should throw NotFoundException for missing slug', async () => {
      prisma.article.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update own article', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      prisma.article.update.mockResolvedValue({
        ...mockArticle,
        title: 'Updated',
      });
      prisma.articleTag.deleteMany.mockResolvedValue({});

      const result = await service.update(
        'article-1',
        { title: 'Updated' },
        'user-1',
        [],
      );
      expect(result.title).toBe('Updated');
    });

    it('should throw ForbiddenException when editing others article without permission', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);

      await expect(
        service.update('article-1', { title: 'Updated' }, 'other-user', []),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow editing others article with article.edit permission', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      prisma.article.update.mockResolvedValue({
        ...mockArticle,
        title: 'Updated',
      });
      prisma.articleTag.deleteMany.mockResolvedValue({});

      const result = await service.update(
        'article-1',
        { title: 'Updated' },
        'other-user',
        ['article.edit'],
      );
      expect(result.title).toBe('Updated');
    });

    it('should throw NotFoundException for nonexistent article', async () => {
      prisma.article.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { title: 'Updated' }, 'user-1', []),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow resubmitting the article\'s own unchanged slug', async () => {
      prisma.article.findUnique.mockResolvedValueOnce(mockArticle); // existing lookup
      prisma.article.update.mockResolvedValue({ ...mockArticle, title: 'Updated' });
      prisma.articleTag.deleteMany.mockResolvedValue({});

      const result = await service.update(
        'article-1',
        { title: 'Updated', slug: mockArticle.slug },
        'user-1',
        [],
      );
      expect(result.title).toBe('Updated');
      // Only the "existing" lookup should have run; no slug-collision lookup for an unchanged slug.
      expect(prisma.article.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when changing to a slug owned by another article', async () => {
      prisma.article.findUnique
        .mockResolvedValueOnce(mockArticle) // existing lookup
        .mockResolvedValueOnce({ ...mockArticle, id: 'article-2', slug: 'taken-slug' }); // slug owner

      await expect(
        service.update('article-1', { slug: 'taken-slug' }, 'user-1', []),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow changing to a genuinely free slug', async () => {
      prisma.article.findUnique
        .mockResolvedValueOnce(mockArticle) // existing lookup
        .mockResolvedValueOnce(null); // slug free
      prisma.article.update.mockResolvedValue({ ...mockArticle, slug: 'new-slug' });
      prisma.articleTag.deleteMany.mockResolvedValue({});

      const result = await service.update('article-1', { slug: 'new-slug' }, 'user-1', []);
      expect(result.slug).toBe('new-slug');
    });
  });

  describe('update — optimistic concurrency', () => {
    it('accepts the update when expectedUpdatedAt matches the persisted row', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      prisma.article.update.mockResolvedValue({ ...mockArticle, title: 'Updated' });
      prisma.articleTag.deleteMany.mockResolvedValue({});

      const result = await service.update(
        'article-1',
        { title: 'Updated', expectedUpdatedAt: mockArticle.updatedAt.toISOString() },
        'user-1',
        [],
      );
      expect(result.title).toBe('Updated');
    });

    it('rejects with 409 ARTICLE_VERSION_CONFLICT when expectedUpdatedAt is stale', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);

      const staleTimestamp = new Date(mockArticle.updatedAt.getTime() - 60_000).toISOString();
      await expect(
        service.update('article-1', { title: 'Updated', expectedUpdatedAt: staleTimestamp }, 'user-1', []),
      ).rejects.toThrow(ConflictException);
      expect(prisma.article.update).not.toHaveBeenCalled();
    });

    it('skips the version check entirely when expectedUpdatedAt is not sent', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      prisma.article.update.mockResolvedValue({ ...mockArticle, title: 'Updated' });
      prisma.articleTag.deleteMany.mockResolvedValue({});

      await expect(service.update('article-1', { title: 'Updated' }, 'user-1', [])).resolves.toBeDefined();
    });
  });

  describe('remove', () => {
    it('should delete own article', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      prisma.articleTag.deleteMany.mockResolvedValue({});
      prisma.article.delete.mockResolvedValue({});

      const result = await service.remove('article-1', 'user-1', []);
      expect(result.message).toBe('Article deleted successfully');
    });

    it('should throw ForbiddenException when deleting others article without permission', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);

      await expect(
        service.remove('article-1', 'other-user', []),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow deleting others article with article.delete permission', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      prisma.articleTag.deleteMany.mockResolvedValue({});
      prisma.article.delete.mockResolvedValue({});

      const result = await service.remove('article-1', 'other-user', [
        'article.delete',
      ]);
      expect(result.message).toBe('Article deleted successfully');
    });

    it('should refuse to hard-delete a published article even with article.delete (preserve editorial history)', async () => {
      prisma.article.findUnique.mockResolvedValue({ ...mockArticle, status: 'PUBLISHED' });

      await expect(
        service.remove('article-1', 'other-user', ['article.delete']),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.article.delete).not.toHaveBeenCalled();
    });

    it('allows permanently deleting an ARCHIVED article with article.delete', async () => {
      prisma.article.findUnique.mockResolvedValue({ ...mockArticle, status: 'ARCHIVED' });
      prisma.articleTag.deleteMany.mockResolvedValue({});
      prisma.article.delete.mockResolvedValue({});

      const result = await service.remove('article-1', 'other-user', ['article.delete']);
      expect(result.message).toBe('Article deleted successfully');
    });

    it('refuses to delete an ARCHIVED article without article.delete, even for its own author — more consequential than deleting an untouched draft', async () => {
      prisma.article.findUnique.mockResolvedValue({ ...mockArticle, status: 'ARCHIVED' });

      await expect(
        service.remove('article-1', 'user-1', []),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.article.delete).not.toHaveBeenCalled();
    });
  });

  describe('submitReview', () => {
    it('should submit draft for review', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      prisma.article.update.mockResolvedValue({
        ...mockArticle,
        status: 'IN_REVIEW',
      });

      const result = await service.submitReview('article-1', 'user-1');
      expect(result.status).toBe('IN_REVIEW');
    });

    it('should throw ForbiddenException for non-author', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);

      await expect(
        service.submitReview('article-1', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a non-author with article.publish to submit — otherwise a restored article authored by someone else has no one who can move it forward', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      prisma.article.update.mockResolvedValue({ ...mockArticle, status: 'IN_REVIEW' });

      const result = await service.submitReview('article-1', 'other-user', ['article.publish']);
      expect(result.status).toBe('IN_REVIEW');
    });

    it('blocks submitting a draft with no body content', async () => {
      prisma.article.findUnique.mockResolvedValue({ ...mockArticle, content: null });

      await expect(service.submitReview('article-1', 'user-1')).rejects.toThrow(BadRequestException);
      expect(prisma.article.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for non-draft article', async () => {
      prisma.article.findUnique.mockResolvedValue({
        ...mockArticle,
        status: 'PUBLISHED',
      });

      await expect(
        service.submitReview('article-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('should approve an in-review article', async () => {
      prisma.article.findUnique
        .mockResolvedValueOnce({ ...mockArticle, status: 'IN_REVIEW' })
        .mockResolvedValueOnce({ ...mockArticle, status: 'APPROVED' });
      prisma.article.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.approve('article-1', 'reviewer-1');
      expect(result.status).toBe('APPROVED');
      expect(prisma.article.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'article-1', status: 'IN_REVIEW' } }),
      );
    });

    it('should throw BadRequestException for non-review article', async () => {
      prisma.article.findUnique.mockResolvedValue({
        ...mockArticle,
        status: 'DRAFT',
      });

      await expect(
        service.approve('article-1', 'reviewer-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject self-approval by the author without article.publish (separation of duties)', async () => {
      prisma.article.findUnique.mockResolvedValue({
        ...mockArticle, // authorId: 'user-1'
        status: 'IN_REVIEW',
      });

      await expect(service.approve('article-1', 'user-1', ['article.review'])).rejects.toThrow(ForbiddenException);
    });

    it('should allow self-approval when the author also holds article.publish (Editor-in-Chief/Admin)', async () => {
      prisma.article.findUnique
        .mockResolvedValueOnce({ ...mockArticle, status: 'IN_REVIEW' })
        .mockResolvedValueOnce({ ...mockArticle, status: 'APPROVED' });
      prisma.article.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.approve('article-1', 'user-1', ['article.review', 'article.publish']);
      expect(result.status).toBe('APPROVED');
    });

    it('rejects with a conflict when another reviewer already acted on it first (concurrent approve)', async () => {
      prisma.article.findUnique.mockResolvedValueOnce({ ...mockArticle, status: 'IN_REVIEW' });
      prisma.article.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.approve('article-1', 'reviewer-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('publish', () => {
    it('should publish approved article', async () => {
      prisma.article.findUnique
        .mockResolvedValueOnce({ ...mockArticle, status: 'APPROVED' })
        .mockResolvedValueOnce({ ...mockArticle, status: 'PUBLISHED' });
      prisma.article.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.publish('article-1', 'user-1');
      expect(result.status).toBe('PUBLISHED');
    });

    it('should throw BadRequestException for non-approved article', async () => {
      prisma.article.findUnique.mockResolvedValue({
        ...mockArticle,
        status: 'DRAFT',
      });

      await expect(service.publish('article-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('blocks publishing an approved article that somehow has no body content', async () => {
      prisma.article.findUnique.mockResolvedValue({ ...mockArticle, status: 'APPROVED', content: { type: 'doc', content: [] } });

      await expect(service.publish('article-1', 'user-1')).rejects.toThrow(BadRequestException);
      expect(prisma.article.updateMany).not.toHaveBeenCalled();
    });

    it('rejects with a conflict when the article was already published or moved by another request (concurrent publish)', async () => {
      prisma.article.findUnique.mockResolvedValueOnce({ ...mockArticle, status: 'APPROVED' });
      prisma.article.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.publish('article-1', 'user-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('archive', () => {
    it('should archive a published article', async () => {
      prisma.article.findUnique
        .mockResolvedValueOnce({ ...mockArticle, status: 'PUBLISHED' })
        .mockResolvedValueOnce({ ...mockArticle, status: 'ARCHIVED' });
      prisma.article.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.archive('article-1');
      expect(result.status).toBe('ARCHIVED');
    });

    it('should throw BadRequestException for non-published article', async () => {
      prisma.article.findUnique.mockResolvedValue({
        ...mockArticle,
        status: 'DRAFT',
      });

      await expect(service.archive('article-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects with a conflict when the article was already unpublished/archived by another request (publish + archive race)', async () => {
      prisma.article.findUnique.mockResolvedValueOnce({ ...mockArticle, status: 'PUBLISHED' });
      prisma.article.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.archive('article-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('unpublish', () => {
    it('pulls a published article back to draft and clears publishedAt', async () => {
      prisma.article.findUnique
        .mockResolvedValueOnce({ ...mockArticle, status: 'PUBLISHED', publishedAt: new Date() })
        .mockResolvedValueOnce({ ...mockArticle, status: 'DRAFT', publishedAt: null });
      prisma.article.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.unpublish('article-1', 'user-1');
      expect(result.status).toBe('DRAFT');
      expect(prisma.article.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'article-1', status: 'PUBLISHED' },
          data: expect.objectContaining({ status: 'DRAFT', publishedAt: null }),
        }),
      );
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ articleId: 'article-1', action: 'UNPUBLISHED', fromStatus: 'PUBLISHED', toStatus: 'DRAFT' }),
      );
    });

    it('throws BadRequestException for a non-published article', async () => {
      prisma.article.findUnique.mockResolvedValue({ ...mockArticle, status: 'DRAFT' });
      await expect(service.unpublish('article-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for a missing article', async () => {
      prisma.article.findUnique.mockResolvedValue(null);
      await expect(service.unpublish('article-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('rejects with a conflict when the article was already changed by another request', async () => {
      prisma.article.findUnique.mockResolvedValueOnce({ ...mockArticle, status: 'PUBLISHED' });
      prisma.article.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.unpublish('article-1', 'user-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('restore', () => {
    it('brings an archived article back to draft and clears archivedAt and publishedAt', async () => {
      prisma.article.findUnique
        .mockResolvedValueOnce({ ...mockArticle, status: 'ARCHIVED', archivedAt: new Date(), publishedAt: new Date() })
        .mockResolvedValueOnce({ ...mockArticle, status: 'DRAFT', archivedAt: null, publishedAt: null });
      prisma.article.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.restore('article-1', 'user-1');
      expect(result.status).toBe('DRAFT');
      expect(prisma.article.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'article-1', status: 'ARCHIVED' },
          // publishedAt must be cleared too, not just archivedAt — otherwise a restored article sits in
          // DRAFT while still carrying a stale publish timestamp from its previous life (the exact bug
          // report this test guards against: "restored article can't be drafted/published again").
          data: expect.objectContaining({ status: 'DRAFT', archivedAt: null, publishedAt: null }),
        }),
      );
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ articleId: 'article-1', action: 'RESTORED', fromStatus: 'ARCHIVED', toStatus: 'DRAFT' }),
      );
    });

    it('throws BadRequestException for a non-archived article', async () => {
      prisma.article.findUnique.mockResolvedValue({ ...mockArticle, status: 'DRAFT' });
      await expect(service.restore('article-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for a missing article', async () => {
      prisma.article.findUnique.mockResolvedValue(null);
      await expect(service.restore('article-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('rejects with a conflict when the article was already changed by another request', async () => {
      prisma.article.findUnique.mockResolvedValueOnce({ ...mockArticle, status: 'ARCHIVED' });
      prisma.article.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.restore('article-1', 'user-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('returnToDraft', () => {
    it('should return in-review article to draft', async () => {
      prisma.article.findUnique.mockResolvedValue({
        ...mockArticle,
        status: 'IN_REVIEW',
      });
      prisma.article.update.mockResolvedValue({
        ...mockArticle,
        status: 'DRAFT',
      });

      const result = await service.returnToDraft('article-1', 'user-1');
      expect(result.status).toBe('DRAFT');
    });

    it('should return approved article to draft', async () => {
      prisma.article.findUnique.mockResolvedValue({
        ...mockArticle,
        status: 'APPROVED',
      });
      prisma.article.update.mockResolvedValue({
        ...mockArticle,
        status: 'DRAFT',
      });

      const result = await service.returnToDraft('article-1', 'user-1');
      expect(result.status).toBe('DRAFT');
    });

    it('should throw BadRequestException for draft article', async () => {
      prisma.article.findUnique.mockResolvedValue({
        ...mockArticle,
        status: 'DRAFT',
      });

      await expect(
        service.returnToDraft('article-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('assign', () => {
    it('assigns an article to an active user and records assignedAt', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', status: 'ACTIVE' });
      prisma.article.update.mockResolvedValue({
        ...mockArticle,
        assigneeId: 'user-2',
        assignee: { id: 'user-2', name: 'Reporter Two', email: 'r2@example.com' },
      });

      const result = await service.assign('article-1', 'user-2', 'Please cover the press conference', 'editor-1');
      expect(result.assigneeId).toBe('user-2');
      expect(prisma.article.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ assigneeId: 'user-2', assignmentNote: 'Please cover the press conference' }) }),
      );
      expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ASSIGNED' }));
    });

    it('logs REASSIGNED (not ASSIGNED) when the article already had a different assignee', async () => {
      prisma.article.findUnique.mockResolvedValue({ ...mockArticle, assigneeId: 'user-3' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', status: 'ACTIVE' });
      prisma.article.update.mockResolvedValue({ ...mockArticle, assigneeId: 'user-2' });

      await service.assign('article-1', 'user-2', undefined, 'editor-1');
      expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'REASSIGNED' }));
    });

    it('clears the assignment when assigneeId is null and logs UNASSIGNED', async () => {
      prisma.article.findUnique.mockResolvedValue({ ...mockArticle, assigneeId: 'user-2' });
      prisma.article.update.mockResolvedValue({ ...mockArticle, assigneeId: null, assignedAt: null, assignmentNote: null });

      const result = await service.assign('article-1', null, undefined, 'editor-1');
      expect(result.assigneeId).toBeNull();
      expect(prisma.article.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ assigneeId: null, assignedAt: null, assignmentNote: null }) }),
      );
      expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'UNASSIGNED' }));
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects assigning to a user that does not exist', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.assign('article-1', 'ghost-user', undefined, 'editor-1')).rejects.toThrow(BadRequestException);
      expect(prisma.article.update).not.toHaveBeenCalled();
    });

    it('rejects assigning to a suspended/inactive user', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', status: 'SUSPENDED' });

      await expect(service.assign('article-1', 'user-2', undefined, 'editor-1')).rejects.toThrow(BadRequestException);
      expect(prisma.article.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a missing article', async () => {
      prisma.article.findUnique.mockResolvedValue(null);
      await expect(service.assign('article-1', 'user-2', undefined, 'editor-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated articles', async () => {
      prisma.article.findMany.mockResolvedValue([mockArticle]);
      prisma.article.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('includes the featured image so catalogue consumers (homepage article picker) can show a thumbnail', async () => {
      prisma.article.findMany.mockResolvedValue([mockArticle]);
      prisma.article.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, status: 'PUBLISHED' });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PUBLISHED' }),
          include: expect.objectContaining({ media: { select: { id: true, publicUrl: true, altText: true } } }),
        }),
      );
    });

    it('should apply search filter', async () => {
      prisma.article.findMany.mockResolvedValue([]);
      prisma.article.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20, search: 'test' });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'test', mode: 'insensitive' } },
              { excerpt: { contains: 'test', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });
  });

  describe('scheduling and revisions authorization', () => {
    it('rejects another user from scheduling without article.edit', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      await expect(service.scheduleArticle('article-1', new Date(Date.now() + 3600000).toISOString(), 'other-user', [])).rejects.toThrow(ForbiddenException);
    });

    it('rejects scheduling a draft — the auto-publish sweep only promotes APPROVED articles', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle); // status: DRAFT
      await expect(service.scheduleArticle('article-1', new Date(Date.now() + 3600000).toISOString(), 'user-1', [])).rejects.toThrow(BadRequestException);
    });

    it('allows the article owner to schedule an approved article', async () => {
      prisma.article.findUnique.mockResolvedValue({ ...mockArticle, status: 'APPROVED' });
      prisma.article.update.mockResolvedValue({ ...mockArticle, status: 'APPROVED', scheduledAt: new Date() });
      await expect(service.scheduleArticle('article-1', new Date(Date.now() + 3600000).toISOString(), 'user-1', [])).resolves.toBeDefined();
    });

    it('rejects a scheduled time in the past', async () => {
      prisma.article.findUnique.mockResolvedValue({ ...mockArticle, status: 'APPROVED' });
      await expect(service.scheduleArticle('article-1', new Date(Date.now() - 3600000).toISOString(), 'user-1', [])).rejects.toThrow(BadRequestException);
    });

    it('rejects another user from creating a revision without article.edit', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      await expect(service.saveRevision('article-1', 'other-user', undefined, [])).rejects.toThrow(ForbiddenException);
    });

    it('rejects another user from restoring a revision without article.edit', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      await expect(service.restoreRevision('article-1', 'revision-1', 'other-user', [])).rejects.toThrow(ForbiddenException);
    });

    it('snapshots the current state as a revision before restoring an old one (no silent data loss)', async () => {
      const publishedArticle = { ...mockArticle, status: 'PUBLISHED' };
      prisma.article.findUnique.mockResolvedValue(publishedArticle);
      prisma.articleRevision.findFirst.mockResolvedValue(null);
      prisma.articleRevision.findUnique.mockResolvedValue({
        id: 'revision-1',
        articleId: 'article-1',
        version: 1,
        title: 'Old title',
        excerpt: null,
        content: null,
        slug: 'old-slug',
        categoryId: null,
        locationId: null,
        featuredImageId: null,
      });
      prisma.article.update.mockResolvedValue({ ...publishedArticle, title: 'Old title' });

      await service.restoreRevision('article-1', 'revision-1', 'user-1', []);

      // A pre-restore snapshot must be created before the destructive overwrite.
      expect(prisma.articleRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ changeReason: expect.stringContaining('restoring to version 1') }) }),
      );
    });
  });

  describe('published-article edit safety', () => {
    it('snapshots a revision and logs a distinct audit action when editing a PUBLISHED article', async () => {
      const published = { ...mockArticle, status: 'PUBLISHED' };
      prisma.article.findUnique.mockResolvedValue(published);
      prisma.articleRevision.findFirst.mockResolvedValue(null);
      prisma.article.update.mockResolvedValue({ ...published, title: 'Breaking update' });
      prisma.articleTag.deleteMany.mockResolvedValue({});

      await service.update('article-1', { title: 'Breaking update' }, 'user-1', []);

      expect(prisma.articleRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ changeReason: expect.stringContaining('Auto-snapshot before editing published article') }) }),
      );
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ articleId: 'article-1', action: 'LIVE_CONTENT_EDITED' }),
      );
    });

    it('does not snapshot a revision when editing a plain DRAFT', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle); // status: DRAFT
      prisma.article.update.mockResolvedValue({ ...mockArticle, title: 'Draft update' });
      prisma.articleTag.deleteMany.mockResolvedValue({});

      await service.update('article-1', { title: 'Draft update' }, 'user-1', []);

      expect(prisma.articleRevision.create).not.toHaveBeenCalled();
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ articleId: 'article-1', action: 'UPDATED' }),
      );
    });
  });

  describe('getReadiness', () => {
    it('reports no blocking issues for a complete draft', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      seoService.analyzeArticle.mockResolvedValue({ checks: [] });

      const result = await service.getReadiness('article-1');
      expect(result.blocking).toEqual([]);
    });

    it('reports MISSING_CONTENT as blocking when the body is empty', async () => {
      prisma.article.findUnique.mockResolvedValue({ ...mockArticle, content: null });
      seoService.analyzeArticle.mockResolvedValue({ checks: [] });

      const result = await service.getReadiness('article-1');
      expect(result.blocking.map((i: any) => i.code)).toContain('MISSING_CONTENT');
    });

    it('surfaces relevant SEO analyzer checks (e.g. missing featured image) as warnings', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      seoService.analyzeArticle.mockResolvedValue({
        checks: [{ id: 'featured-image', status: 'WARNING', message: 'No featured image.' }],
      });

      const result = await service.getReadiness('article-1');
      expect(result.warnings.map((w: any) => w.code)).toContain('FEATURED_IMAGE');
    });

    it('throws NotFoundException for an unknown article', async () => {
      prisma.article.findUnique.mockResolvedValue(null);
      await expect(service.getReadiness('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
