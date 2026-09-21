import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(all = false) {
    return this.prisma.category.findMany({
      where: all ? undefined : { status: 'ACTIVE' },
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { articles: true, children: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        _count: {
          select: { articles: true },
        },
      },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }
    return category;
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        parent: true,
        children: true,
        _count: {
          select: { articles: true },
        },
      },
    });
    if (!category) {
      throw new NotFoundException(`Category with slug "${slug}" not found`);
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Category slug "${dto.slug}" already exists`);
    }

    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent category not found`);
      }
    }

    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug: dto.slug.trim().toLowerCase(),
        description: dto.description?.trim(),
        parentId: dto.parentId || null,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? 'ACTIVE',
      },
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { articles: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    if (dto.slug && dto.slug !== category.slug) {
      const existing = await this.prisma.category.findUnique({
        where: { slug: dto.slug },
      });
      if (existing) {
        throw new ConflictException(`Category slug "${dto.slug}" already exists`);
      }
    }

    if (dto.parentId && dto.parentId !== category.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent category not found`);
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        slug: dto.slug !== undefined ? dto.slug.trim().toLowerCase() : undefined,
        description: dto.description !== undefined ? dto.description.trim() : undefined,
        parentId: dto.parentId !== undefined ? dto.parentId : undefined,
        sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : undefined,
        status: dto.status !== undefined ? dto.status : undefined,
      },
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { articles: true },
        },
      },
    });
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { articles: true, children: true },
        },
      },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    if (category._count.articles > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}" because it has ${category._count.articles} associated article(s). Reassign them first.`,
      );
    }

    if (category._count.children > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}" because it has ${category._count.children} subcategory/subcategories.`,
      );
    }

    await this.prisma.category.delete({ where: { id } });
    return { message: `Category "${category.name}" deleted successfully` };
  }
}
