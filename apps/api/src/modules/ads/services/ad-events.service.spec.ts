import { NotFoundException } from '@nestjs/common';
import { AdEventsService } from './ad-events.service';

function buildService() {
  const prisma: any = {
    adCreative: { findUnique: jest.fn() },
    adPlacement: { findUnique: jest.fn() },
    adCampaignPlacement: { findUnique: jest.fn() },
    adEvent: { create: jest.fn().mockResolvedValue({ id: 'event-1' }), count: jest.fn() },
  };
  const service = new AdEventsService(prisma);
  return { service, prisma };
}

const LIVE_CREATIVE = {
  id: 'creative-1',
  campaignId: 'campaign-1',
  active: true,
  campaign: { id: 'campaign-1', status: 'ACTIVE', frequencyCapPerDay: null },
};
const PLACEMENT = { id: 'placement-1', key: 'HOME_HERO', enabled: true };
const ASSIGNMENT = { campaignId: 'campaign-1', placementId: 'placement-1', enabled: true };

describe('AdEventsService — IDOR / forged-event protection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an impression for a creative that does not exist', async () => {
    const { service, prisma } = buildService();
    prisma.adCreative.findUnique.mockResolvedValue(null);

    await expect(service.recordImpression({ placement: 'HOME_HERO', creativeId: 'ghost' } as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.adEvent.create).not.toHaveBeenCalled();
  });

  it('rejects an impression for an inactive creative', async () => {
    const { service, prisma } = buildService();
    prisma.adCreative.findUnique.mockResolvedValue({ ...LIVE_CREATIVE, active: false });

    await expect(service.recordImpression({ placement: 'HOME_HERO', creativeId: 'creative-1' } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an impression for a creative whose campaign is not ACTIVE (e.g. paused/draft)', async () => {
    const { service, prisma } = buildService();
    prisma.adCreative.findUnique.mockResolvedValue({ ...LIVE_CREATIVE, campaign: { ...LIVE_CREATIVE.campaign, status: 'PAUSED' } });

    await expect(service.recordImpression({ placement: 'HOME_HERO', creativeId: 'creative-1' } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an impression naming a real creative but a placement it is not assigned to (forged/stale slot)', async () => {
    const { service, prisma } = buildService();
    prisma.adCreative.findUnique.mockResolvedValue(LIVE_CREATIVE);
    prisma.adPlacement.findUnique.mockResolvedValue(PLACEMENT);
    prisma.adCampaignPlacement.findUnique.mockResolvedValue(null); // no assignment row for this campaign+placement pair

    await expect(service.recordImpression({ placement: 'HOME_HERO', creativeId: 'creative-1' } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('records a legitimate impression for a live, assigned creative', async () => {
    const { service, prisma } = buildService();
    prisma.adCreative.findUnique.mockResolvedValue(LIVE_CREATIVE);
    prisma.adPlacement.findUnique.mockResolvedValue(PLACEMENT);
    prisma.adCampaignPlacement.findUnique.mockResolvedValue(ASSIGNMENT);

    const result = await service.recordImpression({ placement: 'HOME_HERO', creativeId: 'creative-1', sessionId: 's1' } as any);
    expect(result).toEqual({ id: 'event-1' });
    expect(prisma.adEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'IMPRESSION', campaignId: 'campaign-1' }) }));
  });
});

describe('AdEventsService — frequency-cap foundation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stops counting impressions once a session has hit the campaign\'s daily cap', async () => {
    const { service, prisma } = buildService();
    const cappedCreative = { ...LIVE_CREATIVE, campaign: { ...LIVE_CREATIVE.campaign, frequencyCapPerDay: 3 } };
    prisma.adCreative.findUnique.mockResolvedValue(cappedCreative);
    prisma.adPlacement.findUnique.mockResolvedValue(PLACEMENT);
    prisma.adCampaignPlacement.findUnique.mockResolvedValue(ASSIGNMENT);
    prisma.adEvent.count.mockResolvedValue(3); // already at the cap for today

    const result = await service.recordImpression({ placement: 'HOME_HERO', creativeId: 'creative-1', sessionId: 's1' } as any);

    expect(result).toEqual({ capped: true });
    expect(prisma.adEvent.create).not.toHaveBeenCalled();
  });

  it('still records the impression when under the cap', async () => {
    const { service, prisma } = buildService();
    const cappedCreative = { ...LIVE_CREATIVE, campaign: { ...LIVE_CREATIVE.campaign, frequencyCapPerDay: 3 } };
    prisma.adCreative.findUnique.mockResolvedValue(cappedCreative);
    prisma.adPlacement.findUnique.mockResolvedValue(PLACEMENT);
    prisma.adCampaignPlacement.findUnique.mockResolvedValue(ASSIGNMENT);
    prisma.adEvent.count.mockResolvedValue(1);

    const result = await service.recordImpression({ placement: 'HOME_HERO', creativeId: 'creative-1', sessionId: 's1' } as any);

    expect(result).toEqual({ id: 'event-1' });
    expect(prisma.adEvent.create).toHaveBeenCalled();
  });

  it('an uncapped campaign (frequencyCapPerDay null) never checks the count', async () => {
    const { service, prisma } = buildService();
    prisma.adCreative.findUnique.mockResolvedValue(LIVE_CREATIVE);
    prisma.adPlacement.findUnique.mockResolvedValue(PLACEMENT);
    prisma.adCampaignPlacement.findUnique.mockResolvedValue(ASSIGNMENT);

    await service.recordImpression({ placement: 'HOME_HERO', creativeId: 'creative-1', sessionId: 's1' } as any);

    expect(prisma.adEvent.count).not.toHaveBeenCalled();
  });
});
