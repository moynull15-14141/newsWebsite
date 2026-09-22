import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryTranslationDto } from './dto/category-translation.dto';

const TRANSLATIONS_INCLUDE = { translations: { include: { language: { select: { id: true, code: true } } } } } satisfies Prisma.CategoryInclude;

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
        ...TRANSLATIONS_INCLUDE,
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
        ...TRANSLATIONS_INCLUDE,
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
        ...TRANSLATIONS_INCLUDE,
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

    if (dto.translations?.length) await this.assertTranslationsValid(dto.translations);

    try {
      return await this.prisma.category.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug.trim().toLowerCase(),
          description: dto.description?.trim(),
          parentId: dto.parentId || null,
          sortOrder: dto.sortOrder ?? 0,
          status: dto.status ?? 'ACTIVE',
          translations: dto.translations?.length
            ? { create: dto.translations.map((t) => this.translationData(t, dto.slug)) }
            : undefined,
        },
        include: {
          parent: {
            select: { id: true, name: true, slug: true },
          },
          _count: {
            select: { articles: true },
          },
          ...TRANSLATIONS_INCLUDE,
        },
      });
    } catch (error) {
      throw this.translateConflict(error);
    }
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

    if (dto.translations) await this.assertTranslationsValid(dto.translations);

    const updateData = {
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
        ...TRANSLATIONS_INCLUDE,
      },
    } as const;

    try {
      // Only the translation-replacing path needs a transaction; the common case (no translations
      // touched) is a single update, same as before Phase 2C.
      if (!dto.translations) return await this.prisma.category.update(updateData);

      return await this.prisma.$transaction(async (tx) => {
        await tx.categoryTranslation.deleteMany({ where: { categoryId: id } });
        if (dto.translations!.length) {
          await tx.categoryTranslation.createMany({
            data: dto.translations!.map((t) => ({ categoryId: id, ...this.translationData(t, dto.slug ?? category.slug) })),
          });
        }
        return tx.category.update(updateData);
      });
    } catch (error) {
      throw this.translateConflict(error);
    }
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

  /** A translation's own languageId can't repeat within the same request. */
  private async assertTranslationsValid(translations: CategoryTranslationDto[]) {
    const seen = new Set<string>();
    for (const t of translations) {
      if (seen.has(t.languageId)) throw new BadRequestException('Each language can only have one translation per category.');
      seen.add(t.languageId);
    }
    const languages = await this.prisma.language.findMany({ where: { id: { in: [...seen] } }, select: { id: true } });
    if (languages.length !== seen.size) throw new BadRequestException('One or more translation languages do not exist.');
  }

  /** A translation's slug defaults to the category's own slug, keeping /category/:slug language-agnostic unless overridden. */
  private translationData(t: CategoryTranslationDto, fallbackSlug: string) {
    return {
      languageId: t.languageId,
      name: t.name.trim(),
      slug: (t.slug ?? fallbackSlug).trim().toLowerCase(),
      description: t.description?.trim(),
    };
  }

  private translateConflict(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('A translation with that language/slug combination already exists for another category.');
    }
    return error;
  }
}
