import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { AdStatus } from '@prisma/client';

@Injectable()
export class AdsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAdDto, userId: string) {
    return this.prisma.ad.create({
      data: {
        name: dto.name,
        type: dto.type as any,
        mediaId: dto.mediaId,
        targetUrl: dto.targetUrl,
        htmlContent: dto.htmlContent,
        slot: dto.slot as any,
        priority: dto.priority ?? 0,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        deviceTarget: dto.deviceTarget ?? 'all',
        pageTarget: dto.pageTarget,
        categoryId: dto.categoryId,
        locationId: dto.locationId,
        createdById: userId,
      },
      include: {
        media: { select: { id: true, publicUrl: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(page = 1, limit = 20, status?: AdStatus, slot?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (slot) where.slot = slot;

    const [ads, total] = await Promise.all([
      this.prisma.ad.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: {
          media: { select: { id: true, publicUrl: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.ad.count({ where }),
    ]);

    return { data: ads, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const ad = await this.prisma.ad.findUnique({
      where: { id },
      include: {
        media: { select: { id: true, publicUrl: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!ad) throw new NotFoundException('Ad not found');
    return ad;
  }

  async update(id: string, dto: Partial<CreateAdDto>) {
    const ad = await this.prisma.ad.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException('Ad not found');

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.mediaId !== undefined) updateData.mediaId = dto.mediaId;
    if (dto.targetUrl !== undefined) updateData.targetUrl = dto.targetUrl;
    if (dto.htmlContent !== undefined) updateData.htmlContent = dto.htmlContent;
    if (dto.slot !== undefined) updateData.slot = dto.slot;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.startAt !== undefined) updateData.startAt = dto.startAt ? new Date(dto.startAt) : null;
    if (dto.endAt !== undefined) updateData.endAt = dto.endAt ? new Date(dto.endAt) : null;
    if (dto.deviceTarget !== undefined) updateData.deviceTarget = dto.deviceTarget;
    if (dto.pageTarget !== undefined) updateData.pageTarget = dto.pageTarget;
    if (dto.categoryId !== undefined) updateData.categoryId = dto.categoryId;
    if (dto.locationId !== undefined) updateData.locationId = dto.locationId;

    return this.prisma.ad.update({ where: { id }, data: updateData });
  }

  async activate(id: string) {
    const ad = await this.prisma.ad.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException('Ad not found');
    return this.prisma.ad.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  async pause(id: string) {
    const ad = await this.prisma.ad.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException('Ad not found');
    return this.prisma.ad.update({ where: { id }, data: { status: 'PAUSED' } });
  }

  async remove(id: string) {
    const ad = await this.prisma.ad.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException('Ad not found');
    await this.prisma.ad.delete({ where: { id } });
    return { message: 'Ad deleted' };
  }

  async getActiveForSlot(slot: string, pageType?: string, categoryId?: string, locationId?: string, device?: string) {
    const now = new Date();
    const where: any = {
      status: 'ACTIVE',
      slot: slot as any,
      AND: [
        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
        { OR: [{ endAt: null }, { endAt: { gt: now } }] },
      ],
    };

    if (device && device !== 'all') {
      where.AND.push({ OR: [{ deviceTarget: 'all' }, { deviceTarget: device }] });
    }

    if (pageType) {
      where.AND.push({ OR: [{ pageTarget: null }, { pageTarget: pageType }] });
    }

    if (categoryId) {
      where.AND.push({ OR: [{ categoryId: null }, { categoryId }] });
    }

    if (locationId) {
      where.AND.push({ OR: [{ locationId: null }, { locationId }] });
    }

    const ads = await this.prisma.ad.findMany({
      where,
      orderBy: { priority: 'desc' },
      take: 1,
      include: {
        media: { select: { id: true, publicUrl: true, altText: true } },
      },
    });

    return ads[0] || null;
  }

  async recordImpression(adId: string, slot: string, sessionId?: string) {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad || ad.status !== 'ACTIVE' || ad.slot !== slot) throw new NotFoundException('Active ad not found');
    if (sessionId) {
      const recent = await this.prisma.adImpression.findFirst({
        where: { adId, sessionId, createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
      });
      if (recent) return recent;
    }
    return this.prisma.adImpression.create({
      data: { adId, slot, sessionId },
    });
  }

  async recordClick(adId: string, slot: string, sessionId?: string) {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad || ad.status !== 'ACTIVE' || ad.slot !== slot) throw new NotFoundException('Active ad not found');
    return this.prisma.adClick.create({
      data: { adId, slot, sessionId },
    });
  }

  async getAdStats(adId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalImpressions, impressionsToday, totalClicks, clicksToday] = await Promise.all([
      this.prisma.adImpression.count({ where: { adId, createdAt: { gte: since } } }),
      this.prisma.adImpression.count({ where: { adId, createdAt: { gte: today } } }),
      this.prisma.adClick.count({ where: { adId, createdAt: { gte: since } } }),
      this.prisma.adClick.count({ where: { adId, createdAt: { gte: today } } }),
    ]);

    return { totalImpressions, impressionsToday, totalClicks, clicksToday, ctr: totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : '0' };
  }
}
