import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagTranslationDto } from './dto/tag-translation.dto';

const TRANSLATIONS_INCLUDE = { translations: { include: { language: { select: { id: true, code: true } } } } } satisfies Prisma.TagInclude;

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params?: { page?: number; limit?: number; search?: string; all?: boolean }) {
    if (params?.page) {
      const page = Math.max(1, params.page);
      const limit = Math.max(1, params.limit || 20);
      const where: any = {};
      if (!params.all) where.status = 'ACTIVE';
      if (params.search) {
        where.OR = [
          { name: { contains: params.search, mode: 'insensitive' } },
          { slug: { contains: params.search, mode: 'insensitive' } },
        ];
      }
      const [total, data] = await Promise.all([
        this.prisma.tag.count({ where }),
        this.prisma.tag.findMany({
          where,
          include: {
            _count: {
              select: { articleTags: true },
            },
            ...TRANSLATIONS_INCLUDE,
          },
          orderBy: { name: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);
      return {
        data,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    }

    return this.prisma.tag.findMany({
      where: params?.all ? undefined : { status: 'ACTIVE' },
      include: {
        _count: {
          select: { articleTags: true },
        },
        ...TRANSLATIONS_INCLUDE,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: {
        _count: {
          select: { articleTags: true },
        },
        ...TRANSLATIONS_INCLUDE,
      },
    });
    if (!tag) {
      throw new NotFoundException(`Tag with ID "${id}" not found`);
    }
    return tag;
  }

  async findBySlug(slug: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { articleTags: true },
        },
        ...TRANSLATIONS_INCLUDE,
      },
    });
    if (!tag) {
      throw new NotFoundException(`Tag with slug "${slug}" not found`);
    }
    return tag;
  }

  async create(dto: CreateTagDto) {
    const existing = await this.prisma.tag.findUnique({
      where: { slug: dto.slug.trim().toLowerCase() },
    });
    if (existing) {
      throw new ConflictException(`Tag slug "${dto.slug}" already exists`);
    }

    if (dto.translations?.length) await this.assertTranslationsValid(dto.translations);

    try {
      return await this.prisma.tag.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug.trim().toLowerCase(),
          status: dto.status ?? 'ACTIVE',
          translations: dto.translations?.length
            ? { create: dto.translations.map((t) => this.translationData(t, dto.slug)) }
            : undefined,
        },
        include: {
          _count: {
            select: { articleTags: true },
          },
          ...TRANSLATIONS_INCLUDE,
        },
      });
    } catch (error) {
      throw this.translateConflict(error);
    }
  }

  async update(id: string, dto: UpdateTagDto) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw new NotFoundException(`Tag with ID "${id}" not found`);
    }

    if (dto.slug && dto.slug.trim().toLowerCase() !== tag.slug) {
      const existing = await this.prisma.tag.findUnique({
        where: { slug: dto.slug.trim().toLowerCase() },
      });
      if (existing) {
        throw new ConflictException(`Tag slug "${dto.slug}" already exists`);
      }
    }

    if (dto.translations) await this.assertTranslationsValid(dto.translations);

    const updateData = {
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        slug: dto.slug !== undefined ? dto.slug.trim().toLowerCase() : undefined,
        status: dto.status !== undefined ? dto.status : undefined,
      },
      include: {
        _count: {
          select: { articleTags: true },
        },
        ...TRANSLATIONS_INCLUDE,
      },
    } as const;

    try {
      // Only the translation-replacing path needs a transaction; the common case (no translations
      // touched) is a single update, same as before Phase 2C.
      if (!dto.translations) return await this.prisma.tag.update(updateData);

      return await this.prisma.$transaction(async (tx) => {
        await tx.tagTranslation.deleteMany({ where: { tagId: id } });
        if (dto.translations!.length) {
          await tx.tagTranslation.createMany({
            data: dto.translations!.map((t) => ({ tagId: id, ...this.translationData(t, dto.slug ?? tag.slug) })),
          });
        }
        return tx.tag.update(updateData);
      });
    } catch (error) {
      throw this.translateConflict(error);
    }
  }

  async remove(id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw new NotFoundException(`Tag with ID "${id}" not found`);
    }

    await this.prisma.tag.delete({ where: { id } });
    return { message: `Tag "${tag.name}" deleted successfully` };
  }

  private async assertTranslationsValid(translations: TagTranslationDto[]) {
    const seen = new Set<string>();
    for (const t of translations) {
      if (seen.has(t.languageId)) throw new BadRequestException('Each language can only have one translation per tag.');
      seen.add(t.languageId);
    }
    const languages = await this.prisma.language.findMany({ where: { id: { in: [...seen] } }, select: { id: true } });
    if (languages.length !== seen.size) throw new BadRequestException('One or more translation languages do not exist.');
  }

  private translationData(t: TagTranslationDto, fallbackSlug: string) {
    return {
      languageId: t.languageId,
      name: t.name.trim(),
      slug: (t.slug ?? fallbackSlug).trim().toLowerCase(),
    };
  }

  private translateConflict(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('A translation with that language/slug combination already exists for another tag.');
    }
    return error;
  }
}
