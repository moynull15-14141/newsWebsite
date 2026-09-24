import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCreativeDto } from '../dto/create-creative.dto';
import { UpdateCreativeDto } from '../dto/update-creative.dto';
import { AdAuditLogService } from './ad-audit-log.service';

const CREATIVE_INCLUDE = {
  desktopMedia: { select: { id: true, publicUrl: true, altText: true } },
  mobileMedia: { select: { id: true, publicUrl: true, altText: true } },
} as const;

@Injectable()
export class AdCreativesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AdAuditLogService,
  ) {}

  async create(dto: CreateCreativeDto, userId: string) {
    const campaign = await this.prisma.adCampaign.findUnique({ where: { id: dto.campaignId } });
    if (!campaign) throw new BadRequestException('Campaign not found');
    if ((dto.type === 'IMAGE' || dto.type === 'RESPONSIVE_IMAGE') && !dto.desktopMediaId) {
      throw new BadRequestException('An image creative needs at least a desktop image');
    }
    if (dto.type === 'NATIVE_SPONSORED' && !dto.nativeHeadline) {
      throw new BadRequestException('A native sponsored creative needs a headline');
    }
    if (dto.desktopMediaId && !(await this.prisma.media.findUnique({ where: { id: dto.desktopMediaId } }))) {
      throw new BadRequestException('Desktop media not found');
    }
    if (dto.mobileMediaId && !(await this.prisma.media.findUnique({ where: { id: dto.mobileMediaId } }))) {
      throw new BadRequestException('Mobile media not found');
    }

    const creative = await this.prisma.adCreative.create({
      data: {
        campaignId: dto.campaignId,
        type: dto.type,
        desktopMediaId: dto.desktopMediaId,
        mobileMediaId: dto.mobileMediaId,
        targetUrl: dto.targetUrl,
        ctaText: dto.ctaText,
        altText: dto.altText,
        nativeHeadline: dto.nativeHeadline,
        nativeBody: dto.nativeBody,
        nativeSponsorLabel: dto.nativeSponsorLabel ?? 'Sponsored',
        active: dto.active ?? true,
        rotationWeight: dto.rotationWeight ?? 1,
      },
      include: CREATIVE_INCLUDE,
    });
    await this.auditLog.record({ campaignId: dto.campaignId, actorId: userId, action: 'CREATIVE_ADDED', note: `${dto.type}` });
    return creative;
  }

  async findAllForCampaign(campaignId: string) {
    return this.prisma.adCreative.findMany({ where: { campaignId }, include: CREATIVE_INCLUDE, orderBy: { createdAt: 'asc' } });
  }

  async findAll(page = 1, limit = 20, campaignId?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (campaignId) where.campaignId = campaignId;
    const [data, total] = await Promise.all([
      this.prisma.adCreative.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { ...CREATIVE_INCLUDE, campaign: { select: { id: true, name: true, status: true, advertiser: { select: { id: true, name: true } } } } },
      }),
      this.prisma.adCreative.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const creative = await this.prisma.adCreative.findUnique({ where: { id }, include: CREATIVE_INCLUDE });
    if (!creative) throw new NotFoundException('Creative not found');
    return creative;
  }

  async update(id: string, dto: UpdateCreativeDto, userId: string) {
    const existing = await this.prisma.adCreative.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Creative not found');
    if (dto.desktopMediaId && !(await this.prisma.media.findUnique({ where: { id: dto.desktopMediaId } }))) {
      throw new BadRequestException('Desktop media not found');
    }
    if (dto.mobileMediaId && !(await this.prisma.media.findUnique({ where: { id: dto.mobileMediaId } }))) {
      throw new BadRequestException('Mobile media not found');
    }
    const updated = await this.prisma.adCreative.update({
      where: { id },
      data: {
        type: dto.type,
        desktopMediaId: dto.desktopMediaId,
        mobileMediaId: dto.mobileMediaId,
        targetUrl: dto.targetUrl,
        ctaText: dto.ctaText,
        altText: dto.altText,
        nativeHeadline: dto.nativeHeadline,
        nativeBody: dto.nativeBody,
        nativeSponsorLabel: dto.nativeSponsorLabel,
        active: dto.active,
        rotationWeight: dto.rotationWeight,
      },
      include: CREATIVE_INCLUDE,
    });
    await this.auditLog.record({ campaignId: existing.campaignId, actorId: userId, action: 'CREATIVE_UPDATED' });
    return updated;
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.adCreative.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Creative not found');
    await this.prisma.adCreative.delete({ where: { id } });
    await this.auditLog.record({ campaignId: existing.campaignId, actorId: userId, action: 'CREATIVE_REMOVED' });
    return { message: 'Creative deleted' };
  }
}
