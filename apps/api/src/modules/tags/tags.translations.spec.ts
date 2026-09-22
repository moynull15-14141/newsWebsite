import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TagsService } from './tags.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TagsService localized names', () => {
  let service: TagsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      tag: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      language: { findMany: jest.fn() },
      tagTranslation: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn((fn: (tx: any) => unknown) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TagsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<TagsService>(TagsService);
  });

  it('creates a tag with one localized name per language, defaulting the slug', async () => {
    prisma.tag.findUnique.mockResolvedValue(null);
    prisma.language.findMany.mockResolvedValue([{ id: 'lang-bn' }]);
    prisma.tag.create.mockResolvedValue({ id: 'tag-1' });

    await service.create({ name: 'Election', slug: 'election', translations: [{ languageId: 'lang-bn', name: 'নির্বাচন' }] });

    const translations = prisma.tag.create.mock.calls[0][0].data.translations.create;
    expect(translations).toEqual([{ languageId: 'lang-bn', name: 'নির্বাচন', slug: 'election' }]);
  });

  it('keeps one underlying tag for both languages rather than creating two tags', async () => {
    prisma.tag.findUnique.mockResolvedValue(null);
    prisma.language.findMany.mockResolvedValue([{ id: 'lang-bn' }, { id: 'lang-en' }]);
    prisma.tag.create.mockResolvedValue({ id: 'tag-1' });

    await service.create({
      name: 'Election',
      slug: 'election',
      translations: [{ languageId: 'lang-bn', name: 'নির্বাচন' }, { languageId: 'lang-en', name: 'Election' }],
    });

    expect(prisma.tag.create).toHaveBeenCalledTimes(1); // one tag, two names
  });

  it('rejects duplicate languages within one request', async () => {
    prisma.tag.findUnique.mockResolvedValue(null);
    await expect(
      service.create({ name: 'Election', slug: 'election', translations: [{ languageId: 'lang-bn', name: 'A' }, { languageId: 'lang-bn', name: 'B' }] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('replaces translations transactionally on update, and skips the transaction otherwise', async () => {
    prisma.tag.findUnique.mockResolvedValue({ id: 'tag-1', slug: 'election' });
    prisma.language.findMany.mockResolvedValue([{ id: 'lang-bn' }]);
    prisma.tag.update.mockResolvedValue({ id: 'tag-1' });

    await service.update('tag-1', { translations: [{ languageId: 'lang-bn', name: 'নির্বাচন' }] });
    expect(prisma.tagTranslation.deleteMany).toHaveBeenCalledWith({ where: { tagId: 'tag-1' } });

    prisma.$transaction.mockClear();
    await service.update('tag-1', { status: 'INACTIVE' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
