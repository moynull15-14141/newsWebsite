import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: {
    category: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      category: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create category if slug is unique', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({
        id: 'cat-1',
        name: 'Politics',
        slug: 'politics',
        status: 'ACTIVE',
      });

      const result = await service.create({
        name: 'Politics',
        slug: 'politics',
      });

      expect(result.id).toBe('cat-1');
      expect(prisma.category.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if slug already exists', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-old', slug: 'politics' });

      await expect(
        service.create({ name: 'Politics', slug: 'politics' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update category', async () => {
      prisma.category.findUnique.mockResolvedValueOnce({
        id: 'cat-1',
        name: 'Politics',
        slug: 'politics',
      });
      prisma.category.update.mockResolvedValue({
        id: 'cat-1',
        name: 'Politics & Governance',
        slug: 'politics',
      });

      const result = await service.update('cat-1', {
        name: 'Politics & Governance',
      });

      expect(result.name).toBe('Politics & Governance');
    });

    it('should throw NotFoundException if category not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.update('cat-nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should throw BadRequestException if category has articles', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        name: 'Politics',
        _count: { articles: 5, children: 0 },
      });

      await expect(service.remove('cat-1')).rejects.toThrow(BadRequestException);
    });

    it('should delete category if empty', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        name: 'Politics',
        _count: { articles: 0, children: 0 },
      });
      prisma.category.delete.mockResolvedValue({ id: 'cat-1' });

      const result = await service.remove('cat-1');
      expect(result.message).toContain('deleted');
    });
  });
});

