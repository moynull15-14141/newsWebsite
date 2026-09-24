import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAdvertiserDto } from '../dto/create-advertiser.dto';
import { UpdateAdvertiserDto } from '../dto/update-advertiser.dto';

@Injectable()
export class AdvertisersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAdvertiserDto, userId: string) {
    return this.prisma.advertiser.create({
      data: {
        name: dto.name,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        notes: dto.notes,
        active: dto.active ?? true,
        createdById: userId,
      },
    });
  }

  async findAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.advertiser.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { campaigns: true } } },
      }),
      this.prisma.advertiser.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const advertiser = await this.prisma.advertiser.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        campaigns: { select: { id: true, name: true, status: true, startAt: true, endAt: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!advertiser) throw new NotFoundException('Advertiser not found');
    return advertiser;
  }

  async update(id: string, dto: UpdateAdvertiserDto) {
    const existing = await this.prisma.advertiser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Advertiser not found');
    return this.prisma.advertiser.update({
      where: { id },
      data: {
        name: dto.name,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        notes: dto.notes,
        active: dto.active,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.advertiser.findUnique({ where: { id }, include: { _count: { select: { campaigns: true } } } });
    if (!existing) throw new NotFoundException('Advertiser not found');
    if (existing._count.campaigns > 0) {
      throw new BadRequestException('Cannot delete an advertiser that has campaigns. Deactivate it instead.');
    }
    await this.prisma.advertiser.delete({ where: { id } });
    return { message: 'Advertiser deleted' };
  }
}
