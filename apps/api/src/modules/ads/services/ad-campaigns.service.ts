import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCampaignDto } from '../dto/create-campaign.dto';
import { UpdateCampaignDto } from '../dto/update-campaign.dto';
import { QueryCampaignsDto } from '../dto/query-campaigns.dto';
import { GetEligibleAdDto } from '../dto/get-eligible-ad.dto';
import { AdAuditLogService } from './ad-audit-log.service';
import { loadLocationDescendants } from '../../../common/location/location-descendants';

const CAMPAIGN_LIST_SELECT = {
  id: true, name: true, status: true, startAt: true, endAt: true, priority: true,
  targetUrl: true, deviceTarget: true, pageTarget: true, frequencyCapPerDay: true,
  createdAt: true, updatedAt: true, approvedAt: true,
  advertiser: { select: { id: true, name: true } },
  language: { select: { id: true, code: true, nativeName: true } },
  category: { select: { id: true, name: true, slug: true } },
  location: { select: { id: true, name: true, slug: true } },
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  _count: { select: { creatives: true, placements: true } },
} as const;

function assertValidDateRange(startAt?: string | null, endAt?: string | null) {
  if (!startAt || !endAt) return;
  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    throw new BadRequestException('Campaign end date must be after the start date');
  }
}

@Injectable()
export class AdCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AdAuditLogService,
  ) {}

  // ==================== CRUD ====================

  async create(dto: CreateCampaignDto, userId: string) {
    const advertiser = await this.prisma.advertiser.findUnique({ where: { id: dto.advertiserId } });
    if (!advertiser) throw new BadRequestException('Advertiser not found');
    if (dto.categoryId && !(await this.prisma.category.findUnique({ where: { id: dto.categoryId } }))) {
      throw new BadRequestException('Category not found');
    }
    if (dto.locationId && !(await this.prisma.location.findUnique({ where: { id: dto.locationId } }))) {
      throw new BadRequestException('Location not found');
    }
    if (dto.languageId && !(await this.prisma.language.findUnique({ where: { id: dto.languageId } }))) {
      throw new BadRequestException('Language not found');
    }
    assertValidDateRange(dto.startAt, dto.endAt);

    const campaign = await this.prisma.adCampaign.create({
      data: {
        name: dto.name,
        advertiserId: dto.advertiserId,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        priority: dto.priority ?? 0,
        targetUrl: dto.targetUrl,
        languageId: dto.languageId,
        deviceTarget: dto.deviceTarget ?? 'ALL',
        pageTarget: dto.pageTarget ?? 'ALL',
        categoryId: dto.categoryId,
        locationId: dto.locationId,
        frequencyCapPerDay: dto.frequencyCapPerDay,
        notes: dto.notes,
        createdById: userId,
      },
      select: CAMPAIGN_LIST_SELECT,
    });
    await this.auditLog.record({ campaignId: campaign.id, actorId: userId, action: 'CREATED', toStatus: 'DRAFT' });
    return campaign;
  }

  async findAll(query: QueryCampaignsDto) {
    const { page = 1, limit = 20, search, status, advertiserId, placementId, dateFrom, dateTo, sort = 'createdAt', order = 'desc' } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { advertiser: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (status) where.status = status;
    if (advertiserId) where.advertiserId = advertiserId;
    if (placementId) where.placements = { some: { placementId } };
    if (dateFrom) where.startAt = { ...(where.startAt ?? {}), gte: new Date(dateFrom) };
    if (dateTo) where.endAt = { ...(where.endAt ?? {}), lte: new Date(dateTo) };

    const [data, total] = await Promise.all([
      this.prisma.adCampaign.findMany({ where, skip, take: limit, orderBy: { [sort]: order }, select: CAMPAIGN_LIST_SELECT }),
      this.prisma.adCampaign.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const campaign = await this.prisma.adCampaign.findUnique({
      where: { id },
      include: {
        advertiser: true,
        language: true,
        category: true,
        location: true,
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        creatives: { include: { desktopMedia: { select: { id: true, publicUrl: true } }, mobileMedia: { select: { id: true, publicUrl: true } } } },
        placements: { include: { placement: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async update(id: string, dto: UpdateCampaignDto, userId: string) {
    const existing = await this.prisma.adCampaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campaign not found');
    if (dto.expectedUpdatedAt && new Date(dto.expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
      throw new ConflictException({ message: 'This campaign was changed by someone else since you loaded it. Reload and try again.', code: 'AD_CAMPAIGN_CONFLICT' });
    }
    if (dto.advertiserId && !(await this.prisma.advertiser.findUnique({ where: { id: dto.advertiserId } }))) {
      throw new BadRequestException('Advertiser not found');
    }
    const startAt = dto.startAt ?? existing.startAt?.toISOString();
    const endAt = dto.endAt ?? existing.endAt?.toISOString();
    assertValidDateRange(startAt, endAt);

    const updated = await this.prisma.adCampaign.update({
      where: { id },
      data: {
        name: dto.name,
        advertiserId: dto.advertiserId,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        priority: dto.priority,
        targetUrl: dto.targetUrl,
        languageId: dto.languageId,
        deviceTarget: dto.deviceTarget,
        pageTarget: dto.pageTarget,
        categoryId: dto.categoryId,
        locationId: dto.locationId,
        frequencyCapPerDay: dto.frequencyCapPerDay,
        notes: dto.notes,
      },
      select: CAMPAIGN_LIST_SELECT,
    });
    await this.auditLog.record({ campaignId: id, actorId: userId, action: 'EDITED' });
    return updated;
  }

  async remove(id: string) {
    const existing = await this.prisma.adCampaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campaign not found');
    if (!['DRAFT', 'ARCHIVED'].includes(existing.status)) {
      throw new BadRequestException('Only draft or archived campaigns can be deleted. Archive an active campaign first.');
    }
    await this.prisma.adCampaign.delete({ where: { id } });
    return { message: 'Campaign deleted' };
  }

  // ==================== WORKFLOW ====================
  // DRAFT -> PENDING_REVIEW -> APPROVED -> (SCHEDULED ->) ACTIVE -> PAUSED/EXPIRED -> ARCHIVED.
  // Mirrors JobsService's workflow methods exactly — see that file for the pattern this copies
  // (updateMany-with-status-guard for atomicity + a ConflictException on the race, then an audit entry).

  async submitForReview(id: string, userId: string, userPermissions: string[] = []) {
    const existing = await this.prisma.adCampaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campaign not found');
    if (existing.createdById !== userId && !userPermissions.includes('ads.publish')) {
      throw new ForbiddenException('Only the creator can submit this campaign for review');
    }
    if (existing.status !== 'DRAFT') throw new BadRequestException('Only draft campaigns can be submitted for review');
    const creativeCount = await this.prisma.adCreative.count({ where: { campaignId: id, active: true } });
    if (creativeCount === 0) throw new BadRequestException('Add at least one active creative before submitting for review');

    const { count } = await this.prisma.adCampaign.updateMany({ where: { id, status: 'DRAFT' }, data: { status: 'PENDING_REVIEW' } });
    if (count === 0) throw new ConflictException({ message: 'This campaign is no longer a draft — someone else already acted on it.', code: 'AD_CAMPAIGN_CONFLICT' });
    await this.auditLog.record({ campaignId: id, actorId: userId, action: 'SUBMITTED_FOR_REVIEW', fromStatus: 'DRAFT', toStatus: 'PENDING_REVIEW' });
    return this.findOne(id);
  }

  /** Separation of duties, same rule as articles/jobs: the creator approving their own campaign defeats
   * the point of review. Someone who can also publish (`ads.publish`) may knowingly override this. */
  async approve(id: string, userId: string, userPermissions: string[] = []) {
    const existing = await this.prisma.adCampaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campaign not found');
    if (existing.status !== 'PENDING_REVIEW') throw new BadRequestException('Only campaigns pending review can be approved');
    if (existing.createdById === userId && !userPermissions.includes('ads.publish')) {
      throw new ForbiddenException('You cannot approve a campaign you created yourself. Ask another reviewer to approve it.');
    }

    const { count } = await this.prisma.adCampaign.updateMany({ where: { id, status: 'PENDING_REVIEW' }, data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date() } });
    if (count === 0) throw new ConflictException({ message: 'This campaign is no longer pending review — someone else already acted on it.', code: 'AD_CAMPAIGN_CONFLICT' });
    await this.auditLog.record({ campaignId: id, actorId: userId, action: 'APPROVED', fromStatus: 'PENDING_REVIEW', toStatus: 'APPROVED' });
    return this.findOne(id);
  }

  /** No REJECTED status exists in the enum (spec's own workflow diagram has none) — rejecting sends the
   * campaign back to DRAFT with the reviewer's reason recorded, which already satisfies "a rejected ad
   * is not public" (DRAFT is never publicly eligible) without a redundant extra status. */
  async reject(id: string, userId: string, reason: string | undefined) {
    const existing = await this.prisma.adCampaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campaign not found');
    if (existing.status !== 'PENDING_REVIEW') throw new BadRequestException('Only campaigns pending review can be rejected');
    const { count } = await this.prisma.adCampaign.updateMany({ where: { id, status: 'PENDING_REVIEW' }, data: { status: 'DRAFT' } });
    if (count === 0) throw new ConflictException({ message: 'This campaign is no longer pending review — someone else already acted on it.', code: 'AD_CAMPAIGN_CONFLICT' });
    await this.auditLog.record({ campaignId: id, actorId: userId, action: 'REJECTED', fromStatus: 'PENDING_REVIEW', toStatus: 'DRAFT', note: reason });
    return this.findOne(id);
  }

  /** Immediate go-live. If `startAt` is unset or already in the past, it's set to now so the eligibility
   * window (used by getEligibleForPlacement) is correct starting this moment. */
  async activate(id: string, userId: string) {
    const existing = await this.prisma.adCampaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campaign not found');
    if (!['APPROVED', 'SCHEDULED', 'PAUSED'].includes(existing.status)) {
      throw new BadRequestException('Only approved, scheduled or paused campaigns can be activated');
    }
    if (existing.endAt && existing.endAt.getTime() <= Date.now()) {
      throw new BadRequestException('Cannot activate a campaign whose end date has already passed');
    }
    const now = new Date();
    const startAt = existing.startAt && existing.startAt.getTime() > now.getTime() ? existing.startAt : now;

    const { count } = await this.prisma.adCampaign.updateMany({ where: { id, status: existing.status }, data: { status: 'ACTIVE', startAt } });
    if (count === 0) throw new ConflictException({ message: 'This campaign was already acted on by someone else.', code: 'AD_CAMPAIGN_CONFLICT' });
    await this.auditLog.record({ campaignId: id, actorId: userId, action: 'ACTIVATED', fromStatus: existing.status, toStatus: 'ACTIVE' });
    return this.findOne(id);
  }

  async schedule(id: string, userId: string) {
    const existing = await this.prisma.adCampaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campaign not found');
    if (existing.status !== 'APPROVED') throw new BadRequestException('Only approved campaigns can be scheduled');
    if (!existing.startAt || existing.startAt.getTime() <= Date.now()) {
      throw new BadRequestException('Set a start date in the future before scheduling');
    }

    const { count } = await this.prisma.adCampaign.updateMany({ where: { id, status: 'APPROVED' }, data: { status: 'SCHEDULED' } });
    if (count === 0) throw new ConflictException({ message: 'This campaign is no longer approved — someone else already acted on it.', code: 'AD_CAMPAIGN_CONFLICT' });
    await this.auditLog.record({ campaignId: id, actorId: userId, action: 'SCHEDULED', fromStatus: 'APPROVED', toStatus: 'SCHEDULED', note: `Scheduled for ${existing.startAt.toISOString()}` });
    return this.findOne(id);
  }

  async cancelSchedule(id: string, userId: string) {
    const existing = await this.prisma.adCampaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campaign not found');
    if (existing.status !== 'SCHEDULED') throw new BadRequestException('Only scheduled campaigns can have their schedule cancelled');
    const { count } = await this.prisma.adCampaign.updateMany({ where: { id, status: 'SCHEDULED' }, data: { status: 'APPROVED' } });
    if (count === 0) throw new ConflictException({ message: 'This campaign is no longer scheduled — someone else already acted on it.', code: 'AD_CAMPAIGN_CONFLICT' });
    await this.auditLog.record({ campaignId: id, actorId: userId, action: 'SCHEDULE_CANCELLED', fromStatus: 'SCHEDULED', toStatus: 'APPROVED' });
    return this.findOne(id);
  }

  async pause(id: string, userId: string) {
    const existing = await this.prisma.adCampaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campaign not found');
    if (existing.status !== 'ACTIVE') throw new BadRequestException('Only active campaigns can be paused');
    const { count } = await this.prisma.adCampaign.updateMany({ where: { id, status: 'ACTIVE' }, data: { status: 'PAUSED' } });
    if (count === 0) throw new ConflictException({ message: 'This campaign is no longer active — someone else already acted on it.', code: 'AD_CAMPAIGN_CONFLICT' });
    await this.auditLog.record({ campaignId: id, actorId: userId, action: 'PAUSED', fromStatus: 'ACTIVE', toStatus: 'PAUSED' });
    return this.findOne(id);
  }

  async resume(id: string, userId: string) {
    return this.activate(id, userId);
  }

  async archive(id: string, userId: string) {
    const existing = await this.prisma.adCampaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campaign not found');
    if (!['ACTIVE', 'PAUSED', 'EXPIRED'].includes(existing.status)) {
      throw new BadRequestException('Only active, paused or expired campaigns can be archived');
    }
    const { count } = await this.prisma.adCampaign.updateMany({ where: { id, status: existing.status }, data: { status: 'ARCHIVED' } });
    if (count === 0) throw new ConflictException({ message: 'This campaign was already acted on by someone else.', code: 'AD_CAMPAIGN_CONFLICT' });
    await this.auditLog.record({ campaignId: id, actorId: userId, action: 'ARCHIVED', fromStatus: existing.status, toStatus: 'ARCHIVED' });
    return this.findOne(id);
  }

  // ==================== SCHEDULER (cron entry points) ====================

  /** SCHEDULED campaigns whose startAt has arrived go live automatically. Mirrors
   * JobsService.executeScheduledPublications. */
  async executeScheduledActivations(now: Date = new Date()) {
    const due = await this.prisma.adCampaign.findMany({ where: { status: 'SCHEDULED', startAt: { lte: now } }, select: { id: true } });
    const activated: string[] = [];
    for (const c of due) {
      const { count } = await this.prisma.adCampaign.updateMany({ where: { id: c.id, status: 'SCHEDULED' }, data: { status: 'ACTIVE' } });
      if (count > 0) {
        await this.auditLog.record({ campaignId: c.id, actorId: null, action: 'ACTIVATED', fromStatus: 'SCHEDULED', toStatus: 'ACTIVE', note: 'Automatic scheduled activation' });
        activated.push(c.id);
      }
    }
    return activated;
  }

  /** ACTIVE campaigns whose endAt has passed expire automatically. Mirrors JobsService.expireDueJobs. */
  async expireDueCampaigns(now: Date = new Date()) {
    const due = await this.prisma.adCampaign.findMany({ where: { status: 'ACTIVE', endAt: { lte: now } }, select: { id: true } });
    const expired: string[] = [];
    for (const c of due) {
      const { count } = await this.prisma.adCampaign.updateMany({ where: { id: c.id, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
      if (count > 0) {
        await this.auditLog.record({ campaignId: c.id, actorId: null, action: 'EXPIRED', fromStatus: 'ACTIVE', toStatus: 'EXPIRED', note: 'Automatic end-date expiration' });
        expired.push(c.id);
      }
    }
    return expired;
  }

  // ==================== PUBLIC SERVING (display rules) ====================

  /**
   * The single reusable ad-selection mechanism every placement (public web) and the admin placement
   * preview both call — deterministic eligibility filtering, then a weighted-random pick among what's
   * left. Order of checks mirrors the spec's "Display rules" exactly:
   *   1. placement enabled            4. targeting matches request   7. frequency-cap foundation
   *   2. campaign active by workflow  5. creative active
   *   3. campaign active by schedule  6. priority/rotation selection
   * Never returns a DRAFT/PENDING_REVIEW/PAUSED/EXPIRED/ARCHIVED campaign, a disabled placement, or an
   * inactive creative — there is no separate "public" query path that could drift from this one.
   */
  async getEligibleForPlacement(dto: GetEligibleAdDto) {
    const placement = await this.prisma.adPlacement.findUnique({ where: { key: dto.placement } });
    if (!placement || !placement.enabled) return null;

    const now = new Date();
    const assignments = await this.prisma.adCampaignPlacement.findMany({
      where: {
        placementId: placement.id,
        enabled: true,
        campaign: {
          status: 'ACTIVE',
          AND: [
            { OR: [{ startAt: null }, { startAt: { lte: now } }] },
            { OR: [{ endAt: null }, { endAt: { gt: now } }] },
          ],
        },
      },
      include: {
        campaign: {
          include: {
            creatives: {
              where: { active: true },
              include: {
                desktopMedia: { select: { publicUrl: true, altText: true } },
                mobileMedia: { select: { publicUrl: true, altText: true } },
              },
            },
          },
        },
      },
    });
    if (!assignments.length) return null;

    const device = dto.device ?? 'DESKTOP';
    const resolvedLanguage = dto.lang ? await this.prisma.language.findUnique({ where: { code: dto.lang } }) : null;

    const excludeIds = new Set((dto.excludeCampaignIds ?? '').split(',').map((s) => s.trim()).filter(Boolean));

    const eligible: typeof assignments = [];
    for (const a of assignments) {
      const c = a.campaign;
      if (excludeIds.has(c.id)) continue;
      if (!c.creatives.length) continue;
      if (c.deviceTarget !== 'ALL' && c.deviceTarget !== device) continue;
      if (c.pageTarget !== 'ALL' && c.pageTarget !== (dto.pageType ?? 'ALL')) continue;
      if (c.languageId && c.languageId !== resolvedLanguage?.id) continue;
      if (c.categoryId && c.categoryId !== dto.categoryId) continue;
      if (c.locationId) {
        if (!dto.locationId) continue;
        const family = await loadLocationDescendants(this.prisma, [c.locationId]);
        if (!family.includes(dto.locationId)) continue;
      }
      eligible.push(a);
    }
    if (!eligible.length) return null;

    const topPriority = Math.max(...eligible.map((a) => a.priority ?? a.campaign.priority));
    const topTier = eligible.filter((a) => (a.priority ?? a.campaign.priority) === topPriority);
    const chosen = topTier[Math.floor(Math.random() * topTier.length)];
    const creative = this.pickWeightedCreative(chosen.campaign.creatives);

    return {
      campaignId: chosen.campaign.id,
      creativeId: creative.id,
      placementKey: placement.key,
      type: creative.type,
      targetUrl: creative.targetUrl ?? chosen.campaign.targetUrl ?? null,
      ctaText: creative.ctaText,
      altText: creative.altText,
      nativeHeadline: creative.nativeHeadline,
      nativeBody: creative.nativeBody,
      nativeSponsorLabel: creative.nativeSponsorLabel,
      // Public serving — no separate authenticated media lookup needed to render this. Only the
      // fields a reader's browser actually needs (never the Media row's id, uploader, etc).
      desktopMedia: creative.desktopMedia ? { publicUrl: creative.desktopMedia.publicUrl, altText: creative.desktopMedia.altText } : null,
      mobileMedia: creative.mobileMedia ? { publicUrl: creative.mobileMedia.publicUrl, altText: creative.mobileMedia.altText } : null,
    };
  }

  private pickWeightedCreative<T extends { rotationWeight: number }>(creatives: T[]): T {
    const totalWeight = creatives.reduce((sum, c) => sum + Math.max(1, c.rotationWeight), 0);
    let roll = Math.random() * totalWeight;
    for (const c of creatives) {
      roll -= Math.max(1, c.rotationWeight);
      if (roll <= 0) return c;
    }
    return creatives[creatives.length - 1];
  }

  // ==================== OVERVIEW ====================

  async getOverview() {
    const [active, scheduled, pendingReview, activePlacements, totalPlacements, recent] = await Promise.all([
      this.prisma.adCampaign.count({ where: { status: 'ACTIVE' } }),
      this.prisma.adCampaign.count({ where: { status: 'SCHEDULED' } }),
      this.prisma.adCampaign.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.adPlacement.count({ where: { enabled: true } }),
      this.prisma.adPlacement.count(),
      this.prisma.adCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: CAMPAIGN_LIST_SELECT }),
    ]);
    return {
      activeCampaigns: active,
      scheduledCampaigns: scheduled,
      pendingApproval: pendingReview,
      activePlacements,
      totalPlacements,
      recentCampaigns: recent,
    };
  }

  async getAuditLog(id: string, page = 1, limit = 50) {
    const existing = await this.prisma.adCampaign.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Campaign not found');
    return this.auditLog.listForCampaign(id, page, limit);
  }
}
