import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdAuditLogService } from './ad-audit-log.service';
import { UpdateCampaignPlacementDto } from '../dto/assign-placement.dto';

const now = () => new Date();

/** A placement's own "active campaign" is whichever assignment currently wins eligibility — same rule
 * AdCampaignsService.getEligibleForPlacement uses for public serving, so the admin preview and the real
 * public slot always agree. */
function isCampaignLive(status: string, startAt: Date | null, endAt: Date | null) {
  if (status !== 'ACTIVE') return false;
  const t = now();
  if (startAt && startAt > t) return false;
  if (endAt && endAt <= t) return false;
  return true;
}

@Injectable()
export class AdPlacementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AdAuditLogService,
  ) {}

  /** The full registry (seeded — see prisma/seed.ts), each with a lightweight rollup of how many
   * campaigns are assigned/live, for the Admin > Ads > Placements list. */
  async findAll() {
    const placements = await this.prisma.adPlacement.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
      include: {
        campaignPlacements: {
          where: { enabled: true },
          include: { campaign: { select: { id: true, name: true, status: true, startAt: true, endAt: true, priority: true } } },
        },
      },
    });

    return placements.map((p) => {
      const live = p.campaignPlacements.filter((cp) => isCampaignLive(cp.campaign.status, cp.campaign.startAt, cp.campaign.endAt));
      const scheduled = p.campaignPlacements.filter((cp) => cp.campaign.status === 'SCHEDULED' || (cp.campaign.status === 'ACTIVE' && cp.campaign.startAt && cp.campaign.startAt > now()));
      return {
        id: p.id,
        key: p.key,
        label: p.label,
        group: p.group,
        description: p.description,
        recommendedWidth: p.recommendedWidth,
        recommendedHeight: p.recommendedHeight,
        enabled: p.enabled,
        assignedCampaignCount: p.campaignPlacements.length,
        liveCampaignCount: live.length,
        scheduledCampaignCount: scheduled.length,
      };
    });
  }

  async findOne(id: string) {
    const placement = await this.prisma.adPlacement.findUnique({
      where: { id },
      include: {
        campaignPlacements: {
          include: { campaign: { select: { id: true, name: true, status: true, startAt: true, endAt: true, priority: true, advertiser: { select: { id: true, name: true } } } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!placement) throw new NotFoundException('Placement not found');
    return placement;
  }

  async setEnabled(id: string, enabled: boolean, userId: string) {
    const existing = await this.prisma.adPlacement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Placement not found');
    const updated = await this.prisma.adPlacement.update({ where: { id }, data: { enabled } });
    await this.auditLog.record({
      actorId: userId,
      action: enabled ? 'PLACEMENT_ENABLED' : 'PLACEMENT_DISABLED',
      note: `Placement: ${existing.label} (${existing.key})`,
    });
    return updated;
  }

  async assign(campaignId: string, placementId: string, priority: number | undefined, enabled: boolean | undefined, userId: string) {
    const [campaign, placement] = await Promise.all([
      this.prisma.adCampaign.findUnique({ where: { id: campaignId } }),
      this.prisma.adPlacement.findUnique({ where: { id: placementId } }),
    ]);
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (!placement) throw new NotFoundException('Placement not found');

    const assignment = await this.prisma.adCampaignPlacement.upsert({
      where: { campaignId_placementId: { campaignId, placementId } },
      update: { priority, enabled: enabled ?? true },
      create: { campaignId, placementId, priority, enabled: enabled ?? true },
    });
    await this.auditLog.record({
      campaignId,
      actorId: userId,
      action: 'PLACEMENT_ASSIGNED',
      note: `Assigned to ${placement.label} (${placement.key})`,
    });
    return assignment;
  }

  async updateAssignment(id: string, dto: UpdateCampaignPlacementDto, userId: string) {
    const existing = await this.prisma.adCampaignPlacement.findUnique({ where: { id }, include: { placement: true } });
    if (!existing) throw new NotFoundException('Campaign-placement assignment not found');
    const updated = await this.prisma.adCampaignPlacement.update({
      where: { id },
      data: { priority: dto.priority, enabled: dto.enabled },
    });
    await this.auditLog.record({
      campaignId: existing.campaignId,
      actorId: userId,
      action: 'PLACEMENT_ASSIGNMENT_UPDATED',
      note: `${existing.placement.label}: ${JSON.stringify(dto)}`,
    });
    return updated;
  }

  async removeAssignment(id: string, userId: string) {
    const existing = await this.prisma.adCampaignPlacement.findUnique({ where: { id }, include: { placement: true } });
    if (!existing) throw new NotFoundException('Campaign-placement assignment not found');
    await this.prisma.adCampaignPlacement.delete({ where: { id } });
    await this.auditLog.record({
      campaignId: existing.campaignId,
      actorId: userId,
      action: 'PLACEMENT_UNASSIGNED',
      note: `Removed from ${existing.placement.label} (${existing.placement.key})`,
    });
    return { message: 'Assignment removed' };
  }
}
