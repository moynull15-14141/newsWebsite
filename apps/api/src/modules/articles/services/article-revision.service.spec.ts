import { Test, TestingModule } from '@nestjs/testing';
import { ArticleRevisionService } from './article-revision.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ArticleRevisionService', () => {
  let service: ArticleRevisionService;
  let prisma: any;

  const mockArticle = {
    id: 'article-1',
    title: 'Test Article',
    slug: 'test-article',
    excerpt: 'Test excerpt',
    content: { blocks: [] },
    categoryId: 'cat-1',
    locationId: 'loc-1',
    featuredImageId: 'img-1',
    authorId: 'user-1',
    status: 'PUBLISHED',
  };

  const mockRevision = {
    id: 'rev-1',
    articleId: 'article-1',
    version: 1,
    title: 'Test Article',
    slug: 'test-article',
    excerpt: 'Test excerpt',
    content: { blocks: [] },
    categoryId: 'cat-1',
    locationId: 'loc-1',
    featuredImageId: 'img-1',
    authorId: 'user-1',
    status: 'PUBLISHED',
    changedById: 'user-1',
    changeReason: 'Initial revision',
    createdAt: new Date(),
    changedBy: { id: 'user-1', name: 'Test User' },
  };

  beforeEach(async () => {
    prisma = {
      article: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      articleRevision: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleRevisionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ArticleRevisionService>(ArticleRevisionService);
  });

  describe('createRevision', () => {
    it('should create revision with next version number', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      prisma.articleRevision.findFirst.mockResolvedValue(null); // no existing revisions
      prisma.articleRevision.create.mockResolvedValue(mockRevision);

      const result = await service.createRevision('article-1', 'user-1');

      expect(prisma.articleRevision.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          articleId: 'article-1',
          version: 1,
          changedById: 'user-1',
        }),
      });
      expect(result.version).toBe(1);
    });

    it('should store article content', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      prisma.articleRevision.findFirst.mockResolvedValue(null);
      prisma.articleRevision.create.mockResolvedValue(mockRevision);

      await service.createRevision('article-1', 'user-1');

      expect(prisma.articleRevision.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: mockArticle.title,
          slug: mockArticle.slug,
          excerpt: mockArticle.excerpt,
          content: mockArticle.content,
          categoryId: mockArticle.categoryId,
          locationId: mockArticle.locationId,
          featuredImageId: mockArticle.featuredImageId,
          authorId: mockArticle.authorId,
          status: mockArticle.status,
        }),
      });
    });

    it('should throw NotFoundException for non-existent article', async () => {
      prisma.article.findUnique.mockResolvedValue(null);

      await expect(
        service.createRevision('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should increment version number from last revision', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      prisma.articleRevision.findFirst.mockResolvedValue({ version: 3 });
      prisma.articleRevision.create.mockResolvedValue({
        ...mockRevision,
        version: 4,
      });

      await service.createRevision('article-1', 'user-1');

      expect(prisma.articleRevision.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ version: 4 }),
      });
    });
  });

  describe('getRevisions', () => {
    it('should return revisions for article', async () => {
      prisma.article.findUnique.mockResolvedValue(mockArticle);
      prisma.articleRevision.findMany.mockResolvedValue([mockRevision]);

      const result = await service.getRevisions('article-1');

      expect(prisma.articleRevision.findMany).toHaveBeenCalledWith({
        where: { articleId: 'article-1' },
        orderBy: { version: 'desc' },
        include: { changedBy: { select: { id: true, name: true } } },
      });
      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException for non-existent article', async () => {
      prisma.article.findUnique.mockResolvedValue(null);

      await expect(service.getRevisions('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getRevision', () => {
    it('should return specific version', async () => {
      prisma.articleRevision.findUnique.mockResolvedValue(mockRevision);

      const result = await service.getRevision('article-1', 1);

      expect(prisma.articleRevision.findUnique).toHaveBeenCalledWith({
        where: { articleId_version: { articleId: 'article-1', version: 1 } },
        include: {
          changedBy: { select: { id: true, name: true } },
          article: { select: { id: true, title: true, slug: true, status: true } },
        },
      });
      expect(result.version).toBe(1);
    });

    it('should throw NotFoundException for non-existent revision', async () => {
      prisma.articleRevision.findUnique.mockResolvedValue(null);

      await expect(
        service.getRevision('article-1', 999),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('restoreRevision', () => {
    it('should create new revision before restoring', async () => {
      const existingRevisions = [
        { ...mockRevision, version: 1 },
        { ...mockRevision, id: 'rev-2', version: 2 },
      ];
      prisma.articleRevision.findUnique
        .mockResolvedValueOnce(mockRevision) // find the revision to restore
        .mockResolvedValueOnce(null); // for createRevision's article findUnique
      prisma.article.findUnique
        .mockResolvedValueOnce(mockRevision) // find article for createRevision
        .mockResolvedValueOnce(mockArticle); // find article for second createRevision
      prisma.articleRevision.findFirst
        .mockResolvedValueOnce(null) // for createRevision version
        .mockResolvedValueOnce({ version: 2 }) // for after first createRevision
        .mockResolvedValueOnce({ version: 3 }); // for final createRevision
      prisma.articleRevision.create
        .mockResolvedValueOnce({ ...mockRevision, version: 3 }) // before-restoring revision
        .mockResolvedValueOnce({ ...mockRevision, version: 4 }); // restored revision
      prisma.article.update.mockResolvedValue(mockArticle);

      const result = await service.restoreRevision('article-1', 1, 'user-1');

      // Should create two revisions (before restoring + restored state)
      expect(prisma.articleRevision.create).toHaveBeenCalledTimes(2);
      expect(prisma.article.update).toHaveBeenCalled();
    });

    it('should update article to revision state', async () => {
      prisma.articleRevision.findUnique.mockResolvedValueOnce(mockRevision);
      prisma.article.findUnique
        .mockResolvedValueOnce(mockArticle)
        .mockResolvedValueOnce(mockArticle);
      prisma.articleRevision.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ version: 1 })
        .mockResolvedValueOnce({ version: 2 });
      prisma.articleRevision.create
        .mockResolvedValueOnce({ ...mockRevision, version: 2 })
        .mockResolvedValueOnce({ ...mockRevision, version: 3 });
      prisma.article.update.mockResolvedValue(mockArticle);

      await service.restoreRevision('article-1', 1, 'user-1');

      expect(prisma.article.update).toHaveBeenCalledWith({
        where: { id: 'article-1' },
        data: expect.objectContaining({
          title: mockRevision.title,
          slug: mockRevision.slug,
          excerpt: mockRevision.excerpt,
          content: mockRevision.content,
          categoryId: mockRevision.categoryId,
          locationId: mockRevision.locationId,
          featuredImageId: mockRevision.featuredImageId,
          authorId: mockRevision.authorId,
          status: mockRevision.status,
        }),
      });
    });

    it('should throw NotFoundException for non-existent revision', async () => {
      prisma.articleRevision.findUnique.mockResolvedValue(null);

      await expect(
        service.restoreRevision('article-1', 999, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
