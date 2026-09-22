import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LanguagesService } from '../languages/languages.service';
import { AuditLogService } from './services/audit-log.service';
import { SeoService } from '../seo/seo.service';

/**
 * Phase 2C: a story's Bangla and English versions are two real Article rows, explicitly linked by
 * translationGroupId — never guessed from a matching title or slug. Each keeps its own publication
 * state, so publishing one never publishes the other.
 */
describe('ArticlesService content translations', () => {
  let service: ArticlesService;
  let prisma: any;

  const bn = { id: 'lang-bn', code: 'bn', name: 'Bengali', nativeName: 'বাংলা' };
  const en = { id: 'lang-en', code: 'en', name: 'English', nativeName: 'English' };

  const bnArticle = {
    id: 'article-bn',
    title: 'বাংলাদেশে বন্যা',
    slug: 'flood-bn',
    status: 'PUBLISHED',
    authorId: 'user-1',
    languageId: 'lang-bn',
    translationGroupId: null,
    categoryId: 'cat-1',
    locationId: 'loc-1',
    featuredImageId: 'media-1',
    articleTags: [{ tagId: 'tag-1' }],
  };

  beforeEach(async () => {
    prisma = {
      article: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      language: { findUnique: jest.fn() },
      $transaction: jest.fn((fn: (tx: any) => unknown) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: PrismaService, useValue: prisma },
        { provide: LanguagesService, useValue: { getDefault: jest.fn().mockResolvedValue(bn) } },
        { provide: AuditLogService, useValue: { record: jest.fn().mockResolvedValue({}) } },
        { provide: SeoService, useValue: { analyzeArticle: jest.fn().mockResolvedValue({ checks: [] }) } },
      ],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
  });

  describe('createTranslation', () => {
    it('creates a new-group DRAFT sibling when the source has no group yet', async () => {
      prisma.article.findUnique.mockResolvedValue(bnArticle);
      prisma.language.findUnique.mockResolvedValue(en);
      prisma.article.update.mockResolvedValue({ translationGroupId: 'group-1' });
      prisma.article.findFirst.mockResolvedValue(null); // no existing English sibling
      prisma.article.create.mockResolvedValue({ id: 'article-en', status: 'DRAFT', languageId: 'lang-en', translationGroupId: 'group-1' });

      const result = await service.createTranslation('article-bn', 'lang-en', 'user-2');

      expect(prisma.article.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'article-bn' },
        data: { translationGroup: { create: {} } },
      }));
      expect(prisma.article.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          languageId: 'lang-en',
          translationGroupId: 'group-1',
          status: 'DRAFT',
          categoryId: 'cat-1',
          locationId: 'loc-1',
          featuredImageId: 'media-1',
        }),
      }));
      expect(result.status).toBe('DRAFT');
    });

    it('never copies title, slug, content, excerpt or SEO fields from the source', async () => {
      prisma.article.findUnique.mockResolvedValue({ ...bnArticle, excerpt: 'সারাংশ', seoTitle: 'SEO' });
      prisma.language.findUnique.mockResolvedValue(en);
      prisma.article.update.mockResolvedValue({ translationGroupId: 'group-1' });
      prisma.article.findFirst.mockResolvedValue(null);
      prisma.article.create.mockResolvedValue({});

      await service.createTranslation('article-bn', 'lang-en', 'user-2');

      const created = prisma.article.create.mock.calls[0][0].data;
      expect(created).not.toHaveProperty('excerpt');
      expect(created).not.toHaveProperty('content');
      expect(created).not.toHaveProperty('seoTitle');
      expect(created.slug).not.toBe(bnArticle.slug);
      expect(created.title).not.toBe(bnArticle.title);
    });

    it('reuses the existing group when the source already has one', async () => {
      prisma.article.findUnique.mockResolvedValue({ ...bnArticle, translationGroupId: 'group-existing' });
      prisma.language.findUnique.mockResolvedValue(en);
      prisma.article.findFirst.mockResolvedValue(null);
      prisma.article.create.mockResolvedValue({});

      await service.createTranslation('article-bn', 'lang-en', 'user-2');

      expect(prisma.article.update).not.toHaveBeenCalled(); // no new group created
      expect(prisma.article.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ translationGroupId: 'group-existing' }),
      }));
    });

    it('rejects creating a translation in the article\'s own language', async () => {
      prisma.article.findUnique.mockResolvedValue(bnArticle);
      prisma.language.findUnique.mockResolvedValue(bn);
      await expect(service.createTranslation('article-bn', 'lang-bn', 'user-2')).rejects.toThrow(BadRequestException);
    });

    it('rejects a second translation into a language that already has one', async () => {
      prisma.article.findUnique.mockResolvedValue({ ...bnArticle, translationGroupId: 'group-1' });
      prisma.language.findUnique.mockResolvedValue(en);
      prisma.article.findFirst.mockResolvedValue({ id: 'already-exists' });
      await expect(service.createTranslation('article-bn', 'lang-en', 'user-2')).rejects.toThrow(BadRequestException);
      expect(prisma.article.create).not.toHaveBeenCalled();
    });

    it('throws for a source article that does not exist', async () => {
      prisma.article.findUnique.mockResolvedValue(null);
      await expect(service.createTranslation('missing', 'lang-en', 'user-2')).rejects.toThrow(NotFoundException);
    });

    it('throws for a target language that does not exist', async () => {
      prisma.article.findUnique.mockResolvedValue(bnArticle);
      prisma.language.findUnique.mockResolvedValue(null);
      await expect(service.createTranslation('article-bn', 'missing-lang', 'user-2')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTranslations', () => {
    it('returns every language version of the group, including the article itself', async () => {
      prisma.article.findUnique.mockResolvedValue({ translationGroupId: 'group-1', languageId: 'lang-bn' });
      prisma.article.findMany.mockResolvedValue([
        { id: 'article-bn', title: 'বাংলা', slug: 'flood-bn', status: 'PUBLISHED', publishedAt: new Date(), language: bn },
        { id: 'article-en', title: 'Flood', slug: 'flood-en', status: 'DRAFT', publishedAt: null, language: en },
      ]);

      const result = await service.getTranslations('article-bn');

      expect(result).toHaveLength(2);
      expect(result.find((r: any) => r.language.code === 'bn')?.status).toBe('PUBLISHED');
      expect(result.find((r: any) => r.language.code === 'en')?.status).toBe('DRAFT');
    });

    it('returns an empty list for a standalone article with no translations, instead of throwing', async () => {
      prisma.article.findUnique.mockResolvedValue({ translationGroupId: null, languageId: 'lang-bn' });
      const result = await service.getTranslations('article-bn');
      expect(result).toEqual([]);
      expect(prisma.article.findMany).not.toHaveBeenCalled();
    });

    it('throws for an unknown article', async () => {
      prisma.article.findUnique.mockResolvedValue(null);
      await expect(service.getTranslations('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
