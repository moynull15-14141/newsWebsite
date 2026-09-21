import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

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

    return this.prisma.tag.create({
      data: {
        name: dto.name.trim(),
        slug: dto.slug.trim().toLowerCase(),
        status: dto.status ?? 'ACTIVE',
      },
      include: {
        _count: {
          select: { articleTags: true },
        },
      },
    });
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

    return this.prisma.tag.update({
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
      },
    });
  }

  async remove(id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw new NotFoundException(`Tag with ID "${id}" not found`);
    }

    await this.prisma.tag.delete({ where: { id } });
    return { message: `Tag "${tag.name}" deleted successfully` };
  }
}
