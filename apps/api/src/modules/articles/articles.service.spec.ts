import { Test, TestingModule } from '@nestjs/testing';
import { ArticlesService } from './articles.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LanguagesService } from '../languages/languages.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let prisma: any;
  let languagesService: any;

  const mockArticle = {
    id: 'article-1',
    title: 'Test Article',
    slug: 'test-article',
    excerpt: 'Test excerpt',
    content: null,
    status: 'DRAFT',
    authorId: 'user-1',
    categoryId: null,
    locationId: null,
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
        delete: jest.fn(),
      },
      articleTag: {
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
      $transaction: jest.fn((fn: (tx: any) => unknown) => fn(prisma)),
    };
    languagesService = { getDefault: jest.fn().mockResolvedValue({ id: 'lang-bn', code: 'bn', isDefault: true }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: PrismaService, useValue: prisma },
        { provide: LanguagesService, useValue: languagesService },
      ],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
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
      prisma.article.findUnique.mockResolvedValue({
        ...mockArticle,
        status: 'IN_REVIEW',
      });
      prisma.article.update.mockResolvedValue({
        ...mockArticle,
        status: 'APPROVED',
      });

      const result = await service.approve('article-1', 'reviewer-1');
      expect(result.status).toBe('APPROVED');
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
  });

  describe('publish', () => {
    it('should publish approved article', async () => {
      prisma.article.findUnique.mockResolvedValue({
        ...mockArticle,
        status: 'APPROVED',
      });
      prisma.article.update.mockResolvedValue({
        ...mockArticle,
        status: 'PUBLISHED',
      });

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
  });

  describe('archive', () => {
    it('should archive a published article', async () => {
      prisma.article.findUnique.mockResolvedValue({
        ...mockArticle,
        status: 'PUBLISHED',
      });
      prisma.article.update.mockResolvedValue({
        ...mockArticle,
        status: 'ARCHIVED',
      });

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

    it('allows the article owner to schedule a draft', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      prisma.article.update.mockResolvedValue({ ...mockArticle, scheduledAt: new Date() });
      await expect(service.scheduleArticle('article-1', new Date(Date.now() + 3600000).toISOString(), 'user-1', [])).resolves.toBeDefined();
    });

    it('rejects another user from creating a revision without article.edit', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      await expect(service.saveRevision('article-1', 'other-user', undefined, [])).rejects.toThrow(ForbiddenException);
    });

    it('rejects another user from restoring a revision without article.edit', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      await expect(service.restoreRevision('article-1', 'revision-1', 'other-user', [])).rejects.toThrow(ForbiddenException);
    });
  });
});
