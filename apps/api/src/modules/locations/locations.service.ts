import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationTranslationDto } from './dto/location-translation.dto';
import { LocationTypeValue, PARENT_TYPE_RULES } from './location-types';

const TRANSLATIONS_INCLUDE = { translations: { include: { language: { select: { id: true, code: true } } } } } satisfies Prisma.LocationInclude;

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(type?: string, all = false, parentId?: string) {
    return this.prisma.location.findMany({
      where: {
        ...(type ? { type: type as any } : {}),
        ...(parentId ? { parentId } : {}),
        ...(all ? {} : { status: 'ACTIVE' }),
      },
      include: {
        parent: {
          select: { id: true, name: true, type: true, slug: true },
        },
        _count: {
          select: { articles: true, children: true },
        },
        ...TRANSLATIONS_INCLUDE,
      },
      orderBy: { name: 'asc' },
    });
  }

  /** Bangladesh-shaped tree — unchanged since Phase 1, kept for the existing admin tree view. */
  async findTree() {
    const all = await this.prisma.location.findMany({
      include: {
        _count: {
          select: { articles: true, children: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const country = all.find((l) => l.type === 'COUNTRY' && l.slug === 'bangladesh') ?? all.find((l) => l.type === 'COUNTRY');
    const divisions = all.filter((l) => l.type === 'DIVISION' && l.parentId === country?.id);
    const districts = all.filter((l) => l.type === 'DISTRICT');
    const upazilas = all.filter((l) => l.type === 'UPAZILA');

    const tree = divisions.map((div) => {
      const divDistricts = districts.filter((d) => d.parentId === div.id);
      return {
        ...div,
        districts: divDistricts.map((dist) => ({
          ...dist,
          upazilas: upazilas.filter((u) => u.parentId === dist.id),
        })),
      };
    });

    return {
      country: country || null,
      divisions: tree,
      totalCount: all.length,
    };
  }

  /**
   * Generic recursive tree for every root location (CONTINENT rows, and any COUNTRY without a
   * CONTINENT parent, e.g. Bangladesh). Depth is not assumed — each node just nests its own children.
   * Used by the admin's global-locations browser; `findTree()` above stays Bangladesh-specific so the
   * existing consumer never has to change shape.
   */
  async findGlobalTree() {
    const all = await this.prisma.location.findMany({
      include: { _count: { select: { articles: true, children: true } }, ...TRANSLATIONS_INCLUDE },
      orderBy: { name: 'asc' },
    });
    const byParent = new Map<string | null, typeof all>();
    for (const location of all) {
      const key = location.parentId ?? null;
      const list = byParent.get(key) ?? [];
      list.push(location);
      byParent.set(key, list);
    }
    const build = (parentId: string | null): any[] =>
      (byParent.get(parentId) ?? []).map((location) => ({ ...location, children: build(location.id) }));

    return { roots: build(null), totalCount: all.length };
  }

  async findById(id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          include: {
            _count: { select: { articles: true } },
          },
        },
        _count: {
          select: { articles: true },
        },
        ...TRANSLATIONS_INCLUDE,
      },
    });
    if (!location) {
      throw new NotFoundException(`Location with ID "${id}" not found`);
    }
    return location;
  }

  /**
   * `parent` is nested one extra level (grandparent) so a District response carries its Division AND
   * that Division's own parent (the country) in one call — enough for a real Bangladesh → Division →
   * District breadcrumb without a second round trip or hardcoding the hierarchy in the frontend.
   */
  async findBySlug(slug: string, type?: string) {
    const location = await this.prisma.location.findFirst({
      where: { slug, ...(type ? { type: type as any } : {}) },
      include: {
        // Prisma's generated types don't model a 3-level-deep self-relation include cleanly; the shape
        // itself (parent -> parent, translations at each level) is valid and exercised by the tests.
        parent: { include: { parent: { include: TRANSLATIONS_INCLUDE }, ...TRANSLATIONS_INCLUDE } } as any,
        children: true,
        ...TRANSLATIONS_INCLUDE,
      },
    });
    if (!location) {
      throw new NotFoundException(`Location with slug "${slug}" not found`);
    }
    return location;
  }

  async create(dto: CreateLocationDto) {
    const slug = dto.slug.trim().toLowerCase();
    const parentId = dto.parentId || null;
    const identityKey = `${dto.type}:${parentId || ''}:${slug}`;

    const existing = await this.prisma.location.findUnique({
      where: { identityKey },
    });
    if (existing) {
      throw new ConflictException(`Location with identity "${identityKey}" already exists`);
    }

    const parent = await this.assertParent(dto.type, parentId);
    if (dto.translations?.length) await this.assertTranslationsValid(dto.translations);

    try {
      return await this.prisma.location.create({
        data: {
          name: dto.name.trim(),
          slug,
          type: dto.type,
          parentId,
          identityKey,
          status: dto.status ?? 'ACTIVE',
          countryCode: dto.countryCode?.trim().toUpperCase() || (parent?.countryCode ?? undefined),
          latitude: dto.latitude,
          longitude: dto.longitude,
          timezone: dto.timezone,
          translations: dto.translations?.length
            ? { create: dto.translations.map((t) => ({ languageId: t.languageId, name: t.name.trim() })) }
            : undefined,
        },
        include: {
          parent: {
            select: { id: true, name: true, type: true, slug: true },
          },
          _count: {
            select: { articles: true, children: true },
          },
          ...TRANSLATIONS_INCLUDE,
        },
      });
    } catch (error) {
      throw this.translateConflict(error);
    }
  }

  async update(id: string, dto: UpdateLocationDto) {
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location) {
      throw new NotFoundException(`Location with ID "${id}" not found`);
    }

    const newSlug = dto.slug ? dto.slug.trim().toLowerCase() : location.slug;
    const newParentId = dto.parentId !== undefined ? (dto.parentId || null) : location.parentId;

    if (dto.parentId !== undefined && newParentId !== location.parentId) {
      if (newParentId === id) throw new BadRequestException('A location cannot be its own parent');
      await this.assertParent(location.type as LocationTypeValue, newParentId);
    }

    if (newSlug !== location.slug || newParentId !== location.parentId) {
      const identityKey = `${location.type}:${newParentId || ''}:${newSlug}`;
      const existing = await this.prisma.location.findUnique({ where: { identityKey } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Location with identity "${identityKey}" already exists`);
      }
    }

    if (dto.translations) await this.assertTranslationsValid(dto.translations);

    const updateData = {
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        slug: dto.slug !== undefined ? newSlug : undefined,
        parentId: dto.parentId !== undefined ? newParentId : undefined,
        identityKey: `${location.type}:${newParentId || ''}:${newSlug}`,
        status: dto.status !== undefined ? dto.status : undefined,
        countryCode: dto.countryCode !== undefined ? (dto.countryCode?.trim().toUpperCase() || null) : undefined,
        latitude: dto.latitude !== undefined ? dto.latitude : undefined,
        longitude: dto.longitude !== undefined ? dto.longitude : undefined,
        timezone: dto.timezone !== undefined ? dto.timezone : undefined,
      },
      include: {
        parent: {
          select: { id: true, name: true, type: true, slug: true },
        },
        _count: {
          select: { articles: true, children: true },
        },
        ...TRANSLATIONS_INCLUDE,
      },
    } as const;

    try {
      // Only the translation-replacing path needs a transaction; the common case (no translations
      // touched) is a single update, same as before Phase 2C.
      if (!dto.translations) return await this.prisma.location.update(updateData);

      return await this.prisma.$transaction(async (tx) => {
        await tx.locationTranslation.deleteMany({ where: { locationId: id } });
        if (dto.translations!.length) {
          await tx.locationTranslation.createMany({
            data: dto.translations!.map((t) => ({ locationId: id, languageId: t.languageId, name: t.name.trim() })),
          });
        }
        return tx.location.update(updateData);
      });
    } catch (error) {
      throw this.translateConflict(error);
    }
  }

  async remove(id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: {
        _count: {
          select: { articles: true, children: true },
        },
      },
    });
    if (!location) {
      throw new NotFoundException(`Location with ID "${id}" not found`);
    }

    if (location._count.articles > 0) {
      throw new BadRequestException(
        `Cannot delete location "${location.name}" because it has ${location._count.articles} associated article(s).`,
      );
    }

    if (location._count.children > 0) {
      throw new BadRequestException(
        `Cannot delete location "${location.name}" because it contains ${location._count.children} sub-location(s).`,
      );
    }

    await this.prisma.location.delete({ where: { id } });
    return { message: `Location "${location.name}" deleted successfully` };
  }

  /** Validates parentId against PARENT_TYPE_RULES for `type`; returns the parent row (for countryCode inheritance) when set. */
  private async assertParent(type: LocationTypeValue, parentId: string | null) {
    const rule = PARENT_TYPE_RULES[type];
    if (!parentId) {
      if (rule.required) throw new BadRequestException(`A ${type.toLowerCase()} must have a parent location.`);
      return null;
    }
    const parent = await this.prisma.location.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundException('Parent location not found');
    if (rule.allowed.length && !rule.allowed.includes(parent.type as LocationTypeValue)) {
      throw new BadRequestException(`A ${type.toLowerCase()} cannot be parented under a ${parent.type.toLowerCase()}.`);
    }
    return parent;
  }

  private async assertTranslationsValid(translations: LocationTranslationDto[]) {
    const seen = new Set<string>();
    for (const t of translations) {
      if (seen.has(t.languageId)) throw new BadRequestException('Each language can only have one translation per location.');
      seen.add(t.languageId);
    }
    const languages = await this.prisma.language.findMany({ where: { id: { in: [...seen] } }, select: { id: true } });
    if (languages.length !== seen.size) throw new BadRequestException('One or more translation languages do not exist.');
  }

  private translateConflict(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('A translation for that language already exists for another location.');
    }
    return error;
  }
}
