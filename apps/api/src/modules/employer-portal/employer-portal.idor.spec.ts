import { NotFoundException } from '@nestjs/common';
import { EmployerPortalService } from './employer-portal.service';

/**
 * Dedicated IDOR regression suite. Employer A's caller is a fully valid, ACTIVE OWNER of Employer A —
 * every one of these calls targets an id that actually belongs to Employer B. The whole point of
 * EmployerPortalService's design (see its class doc comment) is that "which company is this?" always
 * comes from the caller's own EmployerMembership row, never from the :id in the URL/body — so every one
 * of these must 404 (not 403, and never succeed) exactly as if the resource didn't exist at all.
 */
function buildService() {
  const prisma: any = {
    employerMembership: {
      findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(),
      create: jest.fn(), update: jest.fn(), count: jest.fn(),
    },
    employer: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    job: {
      findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(),
      create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), count: jest.fn(), groupBy: jest.fn(),
    },
    jobApplication: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
    jobCategory: { findUnique: jest.fn() },
    jobPostingPlan: { findMany: jest.fn(), findUnique: jest.fn() },
    jobPostingOrder: { create: jest.fn() },
    media: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const platformSettings: any = { get: jest.fn().mockResolvedValue(true) };
  const employerAuditLog: any = { record: jest.fn().mockResolvedValue({}) };
  const jobAuditLog: any = { record: jest.fn().mockResolvedValue({}) };
  const jobsService: any = { submitReview: jest.fn(), archive: jest.fn() };
  const service = new EmployerPortalService(prisma, platformSettings, employerAuditLog, jobAuditLog, jobsService);
  return { service, prisma, jobsService };
}

// Employer A's caller — a real, valid, ACTIVE OWNER, but only of employer-A.
const OWNER_OF_EMPLOYER_A = {
  id: 'membership-a', employerId: 'employer-A', userId: 'user-a', role: 'OWNER', status: 'ACTIVE',
  employer: { id: 'employer-A', status: 'ACTIVE', verificationStatus: 'VERIFIED' },
};

describe('EmployerPortalService — IDOR protection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cannot read Employer B\'s job by guessing its id', async () => {
    const { service, prisma } = buildService();
    prisma.employerMembership.findFirst.mockResolvedValue(OWNER_OF_EMPLOYER_A);
    // The job exists, but belongs to employer-B — the scoped query must not find it.
    prisma.job.findFirst.mockResolvedValue(null);

    await expect(service.getJob('user-a', 'employer-b-job-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.job.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'employer-b-job-id', employerId: 'employer-A' },
    }));
  });

  it('cannot edit Employer B\'s job', async () => {
    const { service, prisma } = buildService();
    prisma.employerMembership.findFirst.mockResolvedValue(OWNER_OF_EMPLOYER_A);
    prisma.job.findFirst.mockResolvedValue(null);
    await expect(service.updateJob('user-a', 'employer-b-job-id', { title: 'Hijacked' } as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('cannot submit, withdraw, or archive Employer B\'s job', async () => {
    const { service, prisma, jobsService } = buildService();
    prisma.employerMembership.findFirst.mockResolvedValue(OWNER_OF_EMPLOYER_A);
    prisma.job.findFirst.mockResolvedValue(null);

    await expect(service.submitJob('user-a', 'employer-b-job-id')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.withdrawJob('user-a', 'employer-b-job-id')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.archiveJob('user-a', 'employer-b-job-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(jobsService.submitReview).not.toHaveBeenCalled();
    expect(jobsService.archive).not.toHaveBeenCalled();
  });

  it('cannot read or update Employer B\'s company profile — company is always the caller\'s own employerId', async () => {
    const { service, prisma } = buildService();
    prisma.employerMembership.findFirst.mockResolvedValue(OWNER_OF_EMPLOYER_A);
    prisma.employer.findUnique.mockResolvedValue({ id: 'employer-A', name: 'Employer A' });

    await service.getCompany('user-a');
    // There is no employerId parameter at all on getCompany/updateCompany — it is architecturally
    // impossible to pass Employer B's id in; the lookup always uses the caller's own membership.employerId.
    expect(prisma.employer.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'employer-A' } }));
  });

  it('cannot read Employer B\'s applications by guessing an application id', async () => {
    const { service, prisma } = buildService();
    prisma.employerMembership.findFirst.mockResolvedValue(OWNER_OF_EMPLOYER_A);
    prisma.jobApplication.findFirst.mockResolvedValue(null);

    await expect(service.getApplication('user-a', 'employer-b-application-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.jobApplication.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'employer-b-application-id', job: { employerId: 'employer-A' } },
    }));
  });

  it('cannot change the status of Employer B\'s application', async () => {
    const { service, prisma } = buildService();
    prisma.employerMembership.findFirst.mockResolvedValue(OWNER_OF_EMPLOYER_A);
    prisma.jobApplication.findFirst.mockResolvedValue(null);
    await expect(service.updateApplicationStatus('user-a', 'employer-b-application-id', 'SHORTLISTED', undefined))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.jobApplication.update).not.toHaveBeenCalled();
  });

  it('cannot view or modify Employer B\'s members list', async () => {
    const { service, prisma } = buildService();
    prisma.employerMembership.findFirst.mockResolvedValue(OWNER_OF_EMPLOYER_A);
    prisma.employerMembership.findMany.mockResolvedValue([]);

    await service.listMembers('user-a');
    expect(prisma.employerMembership.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { employerId: 'employer-A', status: { not: 'REMOVED' } },
    }));

    // A membership id that actually belongs to Employer B must not be reachable through Employer A's OWNER.
    prisma.employerMembership.findFirst
      .mockResolvedValueOnce(OWNER_OF_EMPLOYER_A) // caller lookup
      .mockResolvedValueOnce(null); // target lookup, scoped to employerId: 'employer-A', finds nothing
    await expect(service.updateMemberRole('user-a', 'employer-b-membership-id', { role: 'ADMIN' } as any))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.employerMembership.update).not.toHaveBeenCalled();
  });

  it('cannot create an order against Employer B\'s job', async () => {
    const { service, prisma } = buildService();
    prisma.employerMembership.findFirst.mockResolvedValue(OWNER_OF_EMPLOYER_A);
    prisma.job.findFirst.mockResolvedValue(null); // job belongs to employer-B
    await expect(service.createOrder('user-a', 'employer-b-job-id', 'plan-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.jobPostingOrder.create).not.toHaveBeenCalled();
  });

  it('dashboard/job-list numbers are always computed from the caller\'s own employerId, never an input', async () => {
    const { service, prisma } = buildService();
    prisma.employerMembership.findFirst.mockResolvedValue(OWNER_OF_EMPLOYER_A);
    prisma.job.groupBy.mockResolvedValue([]);
    prisma.jobApplication.count.mockResolvedValue(0);
    prisma.employer.findUnique.mockResolvedValue({ verificationStatus: 'VERIFIED', status: 'ACTIVE' });

    await service.getDashboard('user-a');

    expect(prisma.job.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { employerId: 'employer-A' } }));
    expect(prisma.jobApplication.count).toHaveBeenCalledWith({ where: { job: { employerId: 'employer-A' } } });
  });
});
