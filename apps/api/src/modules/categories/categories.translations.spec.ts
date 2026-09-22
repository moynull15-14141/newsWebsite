import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../../prisma/prisma.service';

const uniqueConstraintError = () => new Prisma.PrismaClientKnownRequestError('unique constraint', { code: 'P2002', clientVersion: 'test' });

describe('CategoriesService localized names', () => {
  let service: CategoriesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      category: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      language: { findMany: jest.fn() },
      categoryTranslation: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn((fn: (tx: any) => unknown) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  describe('create with translations', () => {
    it('creates the category with its localized names in one call', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      prisma.language.findMany.mockResolvedValue([{ id: 'lang-bn' }]);
      prisma.category.create.mockResolvedValue({ id: 'cat-1', name: 'Politics', slug: 'politics' });

      await service.create({ name: 'Politics', slug: 'politics', translations: [{ languageId: 'lang-bn', name: 'রাজনীতি' }] });

      expect(prisma.category.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          translations: { create: [expect.objectContaining({ languageId: 'lang-bn', name: 'রাজনীতি', slug: 'politics' })] },
        }),
      }));
    });

    it('defaults a translation\'s slug to the category\'s own slug', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      prisma.language.findMany.mockResolvedValue([{ id: 'lang-bn' }]);
      prisma.category.create.mockResolvedValue({});

      await service.create({ name: 'Politics', slug: 'politics', translations: [{ languageId: 'lang-bn', name: 'রাজনীতি' }] });

      const translations = prisma.category.create.mock.calls[0][0].data.translations.create;
      expect(translations[0].slug).toBe('politics');
    });

    it('rejects two translations for the same language in one request', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(
        service.create({
          name: 'Politics',
          slug: 'politics',
          translations: [{ languageId: 'lang-bn', name: 'A' }, { languageId: 'lang-bn', name: 'B' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a translation referencing a language that does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      prisma.language.findMany.mockResolvedValue([]); // none of the referenced ids exist
      await expect(
        service.create({ name: 'Politics', slug: 'politics', translations: [{ languageId: 'lang-missing', name: 'X' }] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('surfaces a duplicate translation slug as a conflict', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      prisma.language.findMany.mockResolvedValue([{ id: 'lang-bn' }]);
      prisma.category.create.mockRejectedValue(uniqueConstraintError());
      await expect(
        service.create({ name: 'Politics', slug: 'politics', translations: [{ languageId: 'lang-bn', name: 'রাজনীতি' }] }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update with translations', () => {
    it('replaces the translation set inside a transaction', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', slug: 'politics', parentId: null });
      prisma.language.findMany.mockResolvedValue([{ id: 'lang-bn' }]);
      prisma.category.update.mockResolvedValue({ id: 'cat-1' });

      await service.update('cat-1', { translations: [{ languageId: 'lang-bn', name: 'রাজনীতি' }] });

      expect(prisma.categoryTranslation.deleteMany).toHaveBeenCalledWith({ where: { categoryId: 'cat-1' } });
      expect(prisma.categoryTranslation.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ categoryId: 'cat-1', languageId: 'lang-bn', name: 'রাজনীতি' })],
      });
    });

    it('does not open a transaction when translations are not touched', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', slug: 'politics', parentId: null });
      prisma.category.update.mockResolvedValue({ id: 'cat-1', name: 'Renamed' });

      await service.update('cat-1', { name: 'Renamed' });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.category.update).toHaveBeenCalled();
    });

    it('clears all translations when an empty array is sent', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', slug: 'politics', parentId: null });
      prisma.language.findMany.mockResolvedValue([]);
      prisma.category.update.mockResolvedValue({ id: 'cat-1' });

      await service.update('cat-1', { translations: [] });

      expect(prisma.categoryTranslation.deleteMany).toHaveBeenCalledWith({ where: { categoryId: 'cat-1' } });
      expect(prisma.categoryTranslation.createMany).not.toHaveBeenCalled();
    });
  });
});
