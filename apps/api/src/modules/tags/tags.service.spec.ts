import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TagsService } from './tags.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TagsService', () => {
  let service: TagsService;
  let prisma: {
    tag: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      tag: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TagsService>(TagsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create tag when slug is unique', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);
      prisma.tag.create.mockResolvedValue({
        id: 'tag-1',
        name: 'Dhaka',
        slug: 'dhaka',
        status: 'ACTIVE',
      });

      const result = await service.create({ name: 'Dhaka', slug: 'dhaka' });
      expect(result.id).toBe('tag-1');
      expect(prisma.tag.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if slug exists', async () => {
      prisma.tag.findUnique.mockResolvedValue({ id: 'tag-old', slug: 'dhaka' });

      await expect(
        service.create({ name: 'Dhaka', slug: 'dhaka' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update tag', async () => {
      prisma.tag.findUnique.mockResolvedValueOnce({
        id: 'tag-1',
        name: 'Dhaka',
        slug: 'dhaka',
      });
      prisma.tag.update.mockResolvedValue({
        id: 'tag-1',
        name: 'Dhaka City',
        slug: 'dhaka-city',
      });

      const result = await service.update('tag-1', { name: 'Dhaka City', slug: 'dhaka-city' });
      expect(result.name).toBe('Dhaka City');
    });

    it('should throw NotFoundException if tag does not exist', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);

      await expect(
        service.update('tag-nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete tag', async () => {
      prisma.tag.findUnique.mockResolvedValue({ id: 'tag-1', name: 'Dhaka' });
      prisma.tag.delete.mockResolvedValue({ id: 'tag-1' });

      const result = await service.remove('tag-1');
      expect(result.message).toContain('deleted');
    });
  });
});

