import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdCampaignsService } from './ad-campaigns.service';

function buildService() {
  const prisma: any = {
    adCampaign: {
      create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), findOne: jest.fn(),
      update: jest.fn(), updateMany: jest.fn(), delete: jest.fn(), count: jest.fn(),
    },
    advertiser: { findUnique: jest.fn() },
    category: { findUnique: jest.fn() },
    location: { findUnique: jest.fn(), findMany: jest.fn() },
    language: { findUnique: jest.fn() },
    adCreative: { count: jest.fn() },
    adPlacement: { findUnique: jest.fn(), count: jest.fn() },
    adCampaignPlacement: { findMany: jest.fn() },
  };
  const auditLog: any = { record: jest.fn().mockResolvedValue({}) };
  const service = new AdCampaignsService(prisma, auditLog);
  return { service, prisma, auditLog };
}

const PLACEMENT = { id: 'placement-1', key: 'HOME_HERO', enabled: true };

function makeAssignment(campaignOverrides: any = {}) {
  return {
    id: 'assign-1',
    priority: null as number | null,
    campaign: {
      id: 'campaign-1',
      status: 'ACTIVE',
      startAt: null,
      endAt: null,
      priority: 0,
      targetUrl: 'https://advertiser.example',
      deviceTarget: 'ALL',
      pageTarget: 'ALL',
      languageId: null,
      categoryId: null,
      locationId: null,
      creatives: [{ id: 'creative-1', type: 'IMAGE', active: true, rotationWeight: 1, targetUrl: null, ctaText: null, altText: null, nativeHeadline: null, nativeBody: null, nativeSponsorLabel: 'Sponsored', desktopMedia: null, mobileMedia: null }],
      ...campaignOverrides,
    },
  };
}

describe('AdCampaignsService — display rules (public serving)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when the placement is disabled', async () => {
    const { service, prisma } = buildService();
    prisma.adPlacement.findUnique.mockResolvedValue({ ...PLACEMENT, enabled: false });

    const result = await service.getEligibleForPlacement({ placement: 'HOME_HERO' } as any);

    expect(result).toBeNull();
    expect(prisma.adCampaignPlacement.findMany).not.toHaveBeenCalled();
  });

  it('does not serve a DRAFT campaign (query itself excludes anything but ACTIVE)', async () => {
    const { service, prisma } = buildService();
    prisma.adPlacement.findUnique.mockResolvedValue(PLACEMENT);
    prisma.adCampaignPlacement.findMany.mockResolvedValue([]); // DB-level `status: 'ACTIVE'` filter means a DRAFT campaign never comes back here

    const result = await service.getEligibleForPlacement({ placement: 'HOME_HERO' } as any);

    expect(result).toBeNull();
    expect(prisma.adCampaignPlacement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ campaign: expect.objectContaining({ status: 'ACTIVE' }) }),
    }));
  });

  it('a scheduled-in-the-future campaign is not public (excluded by the startAt filter)', async () => {
    const { service, prisma } = buildService();
    prisma.adPlacement.findUnique.mockResolvedValue(PLACEMENT);
    // The Prisma `where` already excludes startAt-in-the-future rows — simulate that by returning none.
    prisma.adCampaignPlacement.findMany.mockResolvedValue([]);

    const result = await service.getEligibleForPlacement({ placement: 'HOME_HERO' } as any);
    expect(result).toBeNull();
  });

  it('serves an approved, active, in-schedule campaign with an active creative', async () => {
    const { service, prisma } = buildService();
    prisma.adPlacement.findUnique.mockResolvedValue(PLACEMENT);
    prisma.adCampaignPlacement.findMany.mockResolvedValue([makeAssignment()]);

    const result = await service.getEligibleForPlacement({ placement: 'HOME_HERO' } as any);

    expect(result).not.toBeNull();
    expect(result!.campaignId).toBe('campaign-1');
    expect(result!.creativeId).toBe('creative-1');
  });

  it('excludes a campaign with zero active creatives (inactive creative is not public)', async () => {
    const { service, prisma } = buildService();
    prisma.adPlacement.findUnique.mockResolvedValue(PLACEMENT);
    prisma.adCampaignPlacement.findMany.mockResolvedValue([makeAssignment({ creatives: [] })]);

    const result = await service.getEligibleForPlacement({ placement: 'HOME_HERO' } as any);
    expect(result).toBeNull();
  });

  it('language targeting: a campaign locked to English is not served when the reader is on Bangla', async () => {
    const { service, prisma } = buildService();
    prisma.adPlacement.findUnique.mockResolvedValue(PLACEMENT);
    prisma.language.findUnique.mockResolvedValue({ id: 'lang-bn', code: 'bn' });
    prisma.adCampaignPlacement.findMany.mockResolvedValue([makeAssignment({ languageId: 'lang-en' })]);

    const result = await service.getEligibleForPlacement({ placement: 'HOME_HERO', lang: 'bn' } as any);
    expect(result).toBeNull();
  });

  it('language targeting: the same campaign IS served once the reader is on English', async () => {
    const { service, prisma } = buildService();
    prisma.adPlacement.findUnique.mockResolvedValue(PLACEMENT);
    prisma.language.findUnique.mockResolvedValue({ id: 'lang-en', code: 'en' });
    prisma.adCampaignPlacement.findMany.mockResolvedValue([makeAssignment({ languageId: 'lang-en' })]);

    const result = await service.getEligibleForPlacement({ placement: 'HOME_HERO', lang: 'en' } as any);
    expect(result).not.toBeNull();
  });

  it('device targeting: a mobile-only campaign is not served to a desktop reader', async () => {
    const { service, prisma } = buildService();
    prisma.adPlacement.findUnique.mockResolvedValue(PLACEMENT);
    prisma.adCampaignPlacement.findMany.mockResolvedValue([makeAssignment({ deviceTarget: 'MOBILE' })]);

    const result = await service.getEligibleForPlacement({ placement: 'HOME_HERO', device: 'DESKTOP' } as any);
    expect(result).toBeNull();
  });

  it('device targeting: the same mobile-only campaign IS served to a mobile reader', async () => {
    const { service, prisma } = buildService();
    prisma.adPlacement.findUnique.mockResolvedValue(PLACEMENT);
    prisma.adCampaignPlacement.findMany.mockResolvedValue([makeAssignment({ deviceTarget: 'MOBILE' })]);

    const result = await service.getEligibleForPlacement({ placement: 'HOME_HERO', device: 'MOBILE' } as any);
    expect(result).not.toBeNull();
  });

  it('a disabled campaign-placement assignment is invisible even though the campaign itself is active (DB-level `enabled: true` filter)', async () => {
    const { service, prisma } = buildService();
    prisma.adPlacement.findUnique.mockResolvedValue(PLACEMENT);
    prisma.adCampaignPlacement.findMany.mockResolvedValue([]); // enabled:false rows are excluded by the where clause itself

    const result = await service.getEligibleForPlacement({ placement: 'HOME_HERO' } as any);
    expect(result).toBeNull();
    expect(prisma.adCampaignPlacement.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ enabled: true }) }));
  });

  it('excludes campaigns already shown elsewhere on the same pageview (excludeCampaignIds)', async () => {
    const { service, prisma } = buildService();
    prisma.adPlacement.findUnique.mockResolvedValue(PLACEMENT);
    prisma.adCampaignPlacement.findMany.mockResolvedValue([makeAssignment()]);

    const result = await service.getEligibleForPlacement({ placement: 'HOME_HERO', excludeCampaignIds: 'campaign-1,campaign-2' } as any);
    expect(result).toBeNull();
  });

  it('picks the higher-priority assignment over a lower-priority one', async () => {
    const { service, prisma } = buildService();
    prisma.adPlacement.findUnique.mockResolvedValue(PLACEMENT);
    const low = makeAssignment({ id: 'low', creatives: [{ id: 'low-creative', type: 'IMAGE', active: true, rotationWeight: 1, nativeSponsorLabel: 'Sponsored' }] });
    low.priority = 1;
    const high = makeAssignment({ id: 'high', creatives: [{ id: 'high-creative', type: 'IMAGE', active: true, rotationWeight: 1, nativeSponsorLabel: 'Sponsored' }] });
    high.priority = 10;
    prisma.adCampaignPlacement.findMany.mockResolvedValue([low, high]);

    const result = await service.getEligibleForPlacement({ placement: 'HOME_HERO' } as any);
    expect(result!.campaignId).toBe('high');
  });
});

describe('AdCampaignsService — workflow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an invalid date range on create (end before start)', async () => {
    const { service, prisma } = buildService();
    prisma.advertiser.findUnique.mockResolvedValue({ id: 'adv-1' });

    await expect(service.create({
      name: 'Bad range', advertiserId: 'adv-1',
      startAt: '2026-06-10T00:00:00.000Z', endAt: '2026-06-01T00:00:00.000Z',
    } as any, 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a campaign with zero active creatives cannot be submitted for review', async () => {
    const { service, prisma } = buildService();
    prisma.adCampaign.findUnique.mockResolvedValue({ id: 'c1', status: 'DRAFT', createdById: 'user-1' });
    prisma.adCreative.count.mockResolvedValue(0);

    await expect(service.submitForReview('c1', 'user-1', [])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('the creator cannot approve their own campaign without ads.publish', async () => {
    const { service, prisma } = buildService();
    prisma.adCampaign.findUnique.mockResolvedValue({ id: 'c1', status: 'PENDING_REVIEW', createdById: 'user-1' });

    await expect(service.approve('c1', 'user-1', [])).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('the creator CAN approve their own campaign when they hold ads.publish', async () => {
    const { service, prisma } = buildService();
    prisma.adCampaign.findUnique.mockResolvedValue({ id: 'c1', status: 'PENDING_REVIEW', createdById: 'user-1' });
    prisma.adCampaign.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.approve('c1', 'user-1', ['ads.publish'])).resolves.toBeDefined();
  });

  it('reject() sends a PENDING_REVIEW campaign back to DRAFT (not a distinct REJECTED status)', async () => {
    const { service, prisma } = buildService();
    prisma.adCampaign.findUnique.mockResolvedValue({ id: 'c1', status: 'PENDING_REVIEW' });
    prisma.adCampaign.updateMany.mockResolvedValue({ count: 1 });

    await service.reject('c1', 'reviewer-1', 'not on-brand');

    expect(prisma.adCampaign.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'DRAFT' } }));
  });

  it('activate() rejects a campaign whose end date has already passed', async () => {
    const { service, prisma } = buildService();
    prisma.adCampaign.findUnique.mockResolvedValue({ id: 'c1', status: 'APPROVED', startAt: null, endAt: new Date(Date.now() - 1000) });

    await expect(service.activate('c1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('schedule() rejects when startAt is not in the future', async () => {
    const { service, prisma } = buildService();
    prisma.adCampaign.findUnique.mockResolvedValue({ id: 'c1', status: 'APPROVED', startAt: new Date(Date.now() - 1000) });

    await expect(service.schedule('c1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('remove() refuses to delete an ACTIVE campaign', async () => {
    const { service, prisma } = buildService();
    prisma.adCampaign.findUnique.mockResolvedValue({ id: 'c1', status: 'ACTIVE' });

    await expect(service.remove('c1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a concurrent double-approve is rejected with a conflict, not applied twice', async () => {
    const { service, prisma } = buildService();
    prisma.adCampaign.findUnique.mockResolvedValue({ id: 'c1', status: 'PENDING_REVIEW', createdById: 'someone-else' });
    prisma.adCampaign.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.approve('c1', 'reviewer-1', [])).rejects.toThrow();
  });

  it('findOne() 404s for a non-existent campaign', async () => {
    const { service, prisma } = buildService();
    prisma.adCampaign.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
