import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

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
      },
      orderBy: { name: 'asc' },
    });
  }

  async findTree() {
    const all = await this.prisma.location.findMany({
      include: {
        _count: {
          select: { articles: true, children: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const country = all.find((l) => l.type === 'COUNTRY');
    const divisions = all.filter((l) => l.type === 'DIVISION');
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
      },
    });
    if (!location) {
      throw new NotFoundException(`Location with ID "${id}" not found`);
    }
    return location;
  }

  async findBySlug(slug: string, type?: string) {
    const location = await this.prisma.location.findFirst({
      where: { slug, ...(type ? { type: type as any } : {}) },
      include: {
        parent: true,
        children: true,
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

    if (parentId) {
      const parent = await this.prisma.location.findUnique({ where: { id: parentId } });
      if (!parent) {
        throw new NotFoundException(`Parent location not found`);
      }
    }

    return this.prisma.location.create({
      data: {
        name: dto.name.trim(),
        slug,
        type: dto.type,
        parentId,
        identityKey,
        status: dto.status ?? 'ACTIVE',
      },
      include: {
        parent: {
          select: { id: true, name: true, type: true, slug: true },
        },
        _count: {
          select: { articles: true, children: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateLocationDto) {
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location) {
      throw new NotFoundException(`Location with ID "${id}" not found`);
    }

    const newSlug = dto.slug ? dto.slug.trim().toLowerCase() : location.slug;
    const newParentId = dto.parentId !== undefined ? (dto.parentId || null) : location.parentId;

    if (newSlug !== location.slug || newParentId !== location.parentId) {
      const identityKey = `${location.type}:${newParentId || ''}:${newSlug}`;
      const existing = await this.prisma.location.findUnique({ where: { identityKey } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Location with identity "${identityKey}" already exists`);
      }
    }

    return this.prisma.location.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        slug: dto.slug !== undefined ? newSlug : undefined,
        parentId: dto.parentId !== undefined ? newParentId : undefined,
        identityKey: `${location.type}:${newParentId || ''}:${newSlug}`,
        status: dto.status !== undefined ? dto.status : undefined,
      },
      include: {
        parent: {
          select: { id: true, name: true, type: true, slug: true },
        },
        _count: {
          select: { articles: true, children: true },
        },
      },
    });
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
        `Cannot delete location "${location.name}" because it has ${location._count.children} child location(s).`,
      );
    }

    await this.prisma.location.delete({ where: { id } });
    return { message: `Location "${location.name}" deleted successfully` };
  }
}
