import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecordAdEventDto } from '../dto/get-eligible-ad.dto';

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

@Injectable()
export class AdEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Validates the (campaign, creative, placement) triple is real, linked, and actually currently
   * ACTIVE/enabled before writing anything — the same "don't trust the client" guard the legacy
   * AdsService.recordImpression/recordClick used, generalized to the new schema. A request naming a
   * creative that belongs to a different campaign, or a campaign that isn't live, is rejected rather
   * than silently recorded (prevents a stray/forged event id from polluting analytics). */
  private async loadLiveContext(creativeId: string, placementKey: string) {
    const creative = await this.prisma.adCreative.findUnique({
      where: { id: creativeId },
      include: { campaign: true },
    });
    if (!creative || !creative.active) throw new NotFoundException('Active creative not found');
    if (creative.campaign.status !== 'ACTIVE') throw new NotFoundException('Active campaign not found');

    const placement = await this.prisma.adPlacement.findUnique({ where: { key: placementKey as any } });
    if (!placement || !placement.enabled) throw new NotFoundException('Enabled placement not found');

    const assignment = await this.prisma.adCampaignPlacement.findUnique({
      where: { campaignId_placementId: { campaignId: creative.campaignId, placementId: placement.id } },
    });
    if (!assignment || !assignment.enabled) throw new NotFoundException('Campaign is not assigned to this placement');

    return { creative, placement };
  }

  async recordImpression(dto: RecordAdEventDto) {
    const { creative, placement } = await this.loadLiveContext(dto.creativeId, dto.placement);

    // Frequency-cap foundation: if the campaign sets a daily cap and we have a session id, stop counting
    // (and stop billing/reporting) once that session has hit it today — same rolling-dedupe spirit as the
    // legacy model's 30-minute same-session dedupe, generalized to a configurable per-day count.
    if (dto.sessionId && creative.campaign.frequencyCapPerDay) {
      const seenToday = await this.prisma.adEvent.count({
        where: {
          campaignId: creative.campaignId,
          sessionId: dto.sessionId,
          type: 'IMPRESSION',
          createdAt: { gte: startOfDay(new Date()) },
        },
      });
      if (seenToday >= creative.campaign.frequencyCapPerDay) {
        return { capped: true };
      }
    }

    return this.prisma.adEvent.create({
      data: {
        type: 'IMPRESSION',
        campaignId: creative.campaignId,
        creativeId: creative.id,
        placementId: placement.id,
        sessionId: dto.sessionId,
        context: dto.context,
        device: dto.device,
      },
    });
  }

  async recordClick(dto: RecordAdEventDto) {
    const { creative, placement } = await this.loadLiveContext(dto.creativeId, dto.placement);
    return this.prisma.adEvent.create({
      data: {
        type: 'CLICK',
        campaignId: creative.campaignId,
        creativeId: creative.id,
        placementId: placement.id,
        sessionId: dto.sessionId,
        context: dto.context,
        device: dto.device,
      },
    });
  }

  async getCampaignStats(campaignId: string, days = 30) {
    const campaign = await this.prisma.adCampaign.findUnique({ where: { id: campaignId }, select: { id: true } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const today = startOfDay(new Date());

    const [totalImpressions, impressionsToday, totalClicks, clicksToday] = await Promise.all([
      this.prisma.adEvent.count({ where: { campaignId, type: 'IMPRESSION', createdAt: { gte: since } } }),
      this.prisma.adEvent.count({ where: { campaignId, type: 'IMPRESSION', createdAt: { gte: today } } }),
      this.prisma.adEvent.count({ where: { campaignId, type: 'CLICK', createdAt: { gte: since } } }),
      this.prisma.adEvent.count({ where: { campaignId, type: 'CLICK', createdAt: { gte: today } } }),
    ]);

    return {
      totalImpressions,
      impressionsToday,
      totalClicks,
      clicksToday,
      ctr: totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
    };
  }
}
