import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EmployerPortalService } from './employer-portal.service';

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
  return { service, prisma, platformSettings, employerAuditLog, jobAuditLog, jobsService };
}

const ACTIVE_OWNER_MEMBERSHIP = {
  id: 'membership-1', employerId: 'employer-1', userId: 'user-1', role: 'OWNER', status: 'ACTIVE',
  employer: { id: 'employer-1', status: 'ACTIVE', verificationStatus: 'PENDING' },
};

describe('EmployerPortalService', () => {
  describe('register', () => {
    it('rejects registration when the employer platform is disabled', async () => {
      const { service, platformSettings } = buildService();
      platformSettings.get.mockResolvedValueOnce(false); // employer_platform_enabled
      await expect(service.register('user-1', { name: 'Acme' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects registration when self-registration is closed even if the platform is enabled', async () => {
      const { service, platformSettings } = buildService();
      platformSettings.get
        .mockResolvedValueOnce(true) // employer_platform_enabled
        .mockResolvedValueOnce(false); // employer_registration_enabled
      await expect(service.register('user-1', { name: 'Acme' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a user who already has an active/invited membership', async () => {
      const { service, prisma } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(service.register('user-1', { name: 'Acme' } as any)).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates the employer and an OWNER membership together, and writes an audit log', async () => {
      const { service, prisma, employerAuditLog } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue(null);
      prisma.employer.findUnique.mockResolvedValue(null);
      prisma.employer.create.mockResolvedValue({ id: 'employer-1', name: 'Acme' });
      prisma.employerMembership.create.mockResolvedValue({ id: 'membership-1', role: 'OWNER' });

      const result = await service.register('user-1', { name: 'Acme' } as any);

      expect(prisma.employer.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ isSelfService: true, verificationStatus: 'PENDING', status: 'ACTIVE', createdById: 'user-1' }),
      }));
      expect(prisma.employerMembership.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ employerId: 'employer-1', userId: 'user-1', role: 'OWNER', status: 'ACTIVE' }),
      }));
      expect(employerAuditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'employer.registered' }));
      expect(result.employer.id).toBe('employer-1');
    });
  });

  describe('ownership resolution', () => {
    it('throws when the caller has no active membership at all', async () => {
      const { service, prisma } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue(null);
      await expect(service.getDashboard('stranger')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('never trusts a client-supplied employerId — getJob always re-derives it from membership', async () => {
      const { service, prisma } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue(ACTIVE_OWNER_MEMBERSHIP);
      prisma.job.findFirst.mockResolvedValue(null); // job belongs to someone else
      await expect(service.getJob('user-1', 'someone-elses-job')).rejects.toBeInstanceOf(NotFoundException);
      // The lookup must have been scoped by the caller's OWN employerId, not any employerId from the caller.
      expect(prisma.job.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'someone-elses-job', employerId: 'employer-1' },
      }));
    });

    it('blocks mutating actions while the employer account is suspended', async () => {
      const { service, prisma } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue({
        ...ACTIVE_OWNER_MEMBERSHIP, employer: { ...ACTIVE_OWNER_MEMBERSHIP.employer, status: 'SUSPENDED' },
      });
      await expect(service.updateCompany('user-1', { name: 'New name' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('still allows read-only access while the employer account is suspended', async () => {
      const { service, prisma } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue({
        ...ACTIVE_OWNER_MEMBERSHIP, employer: { ...ACTIVE_OWNER_MEMBERSHIP.employer, status: 'SUSPENDED' },
      });
      prisma.job.groupBy.mockResolvedValue([]);
      prisma.jobApplication.count.mockResolvedValue(0);
      prisma.employer.findUnique.mockResolvedValue({ verificationStatus: 'PENDING', status: 'SUSPENDED' });
      await expect(service.getDashboard('user-1')).resolves.toBeDefined();
    });
  });

  describe('job state machine', () => {
    it('rejects job creation when third_party_job_posting_enabled is off', async () => {
      const { service, prisma, platformSettings } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue(ACTIVE_OWNER_MEMBERSHIP);
      platformSettings.get.mockResolvedValueOnce(false); // third_party_job_posting_enabled
      await expect(service.createJob('user-1', { title: 'X', categoryId: 'c1', employmentType: 'FULL_TIME' } as any))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates a DRAFT job locked to the caller\'s own employerId, never a client-supplied one', async () => {
      const { service, prisma, jobAuditLog } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue(ACTIVE_OWNER_MEMBERSHIP);
      prisma.jobCategory.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.job.findUnique.mockResolvedValue(null);
      prisma.job.create.mockResolvedValue({ id: 'job-1', employerId: 'employer-1', status: 'DRAFT' });

      await service.createJob('user-1', { title: 'X', categoryId: 'c1', employmentType: 'FULL_TIME' } as any);

      expect(prisma.job.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ employerId: 'employer-1', createdById: 'user-1' }),
      }));
      expect(jobAuditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATED' }));
    });

    it('rejects editing a job that is no longer DRAFT', async () => {
      const { service, prisma } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue(ACTIVE_OWNER_MEMBERSHIP);
      prisma.job.findFirst.mockResolvedValue({ id: 'job-1', employerId: 'employer-1', status: 'IN_REVIEW' });
      await expect(service.updateJob('user-1', 'job-1', { title: 'New' } as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('submitJob only allows DRAFT -> IN_REVIEW and delegates to JobsService while also logging an employer audit entry', async () => {
      const { service, prisma, jobsService, employerAuditLog } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue(ACTIVE_OWNER_MEMBERSHIP);
      prisma.job.findFirst.mockResolvedValue({ id: 'job-1', employerId: 'employer-1', status: 'DRAFT' });
      jobsService.submitReview.mockResolvedValue({ id: 'job-1', status: 'IN_REVIEW' });

      await service.submitJob('user-1', 'job-1');

      expect(jobsService.submitReview).toHaveBeenCalledWith('job-1', 'user-1', []);
      expect(employerAuditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'employer.job_submitted' }));
    });

    it('rejects withdrawing a job that is not IN_REVIEW', async () => {
      const { service, prisma } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue(ACTIVE_OWNER_MEMBERSHIP);
      prisma.job.findFirst.mockResolvedValue({ id: 'job-1', employerId: 'employer-1', status: 'APPROVED' });
      await expect(service.withdrawJob('user-1', 'job-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('withdrawJob moves IN_REVIEW -> DRAFT scoped to the caller\'s employerId', async () => {
      const { service, prisma, jobAuditLog } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue(ACTIVE_OWNER_MEMBERSHIP);
      prisma.job.findFirst
        .mockResolvedValueOnce({ id: 'job-1', employerId: 'employer-1', status: 'IN_REVIEW' })
        .mockResolvedValueOnce({ id: 'job-1', employerId: 'employer-1', status: 'DRAFT' });
      prisma.job.updateMany.mockResolvedValue({ count: 1 });

      await service.withdrawJob('user-1', 'job-1');

      expect(prisma.job.updateMany).toHaveBeenCalledWith({
        where: { id: 'job-1', employerId: 'employer-1', status: 'IN_REVIEW' },
        data: { status: 'DRAFT' },
      });
      expect(jobAuditLog.record).toHaveBeenCalledWith(expect.objectContaining({ toStatus: 'DRAFT' }));
    });

    it('rejects archiving a job that is not PUBLISHED/EXPIRED', async () => {
      const { service, prisma } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue(ACTIVE_OWNER_MEMBERSHIP);
      prisma.job.findFirst.mockResolvedValue({ id: 'job-1', employerId: 'employer-1', status: 'DRAFT' });
      await expect(service.archiveJob('user-1', 'job-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('never exposes publish/approve/schedule — EmployerPortalService has no such methods', () => {
      const { service } = buildService();
      expect((service as any).publish).toBeUndefined();
      expect((service as any).approve).toBeUndefined();
      expect((service as any).schedule).toBeUndefined();
    });
  });

  describe('applications scoping', () => {
    it('lists only applications for jobs owned by the caller\'s own employer', async () => {
      const { service, prisma } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue(ACTIVE_OWNER_MEMBERSHIP);
      prisma.jobApplication.findMany.mockResolvedValue([]);
      prisma.jobApplication.count.mockResolvedValue(0);

      await service.listApplications('user-1', {});

      expect(prisma.jobApplication.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ job: { employerId: 'employer-1' } }),
      }));
    });

    it('getApplication 404s when the application belongs to a different employer', async () => {
      const { service, prisma } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue(ACTIVE_OWNER_MEMBERSHIP);
      prisma.jobApplication.findFirst.mockResolvedValue(null);
      await expect(service.getApplication('user-1', 'app-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('member management privilege escalation guards', () => {
    it('a RECRUITER cannot invite anyone (not owner/admin)', async () => {
      const { service, prisma } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue({ ...ACTIVE_OWNER_MEMBERSHIP, role: 'RECRUITER' });
      await expect(service.inviteMember('user-1', { email: 'a@b.com', role: 'RECRUITER' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('an ADMIN cannot grant the OWNER role', async () => {
      const { service, prisma } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue({ ...ACTIVE_OWNER_MEMBERSHIP, role: 'ADMIN' });
      await expect(service.inviteMember('user-1', { email: 'a@b.com', role: 'OWNER' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('an ADMIN cannot change an existing OWNER\'s role', async () => {
      const { service, prisma } = buildService();
      // First call: resolve the caller's own membership (ADMIN). Second call: the target membership (OWNER).
      prisma.employerMembership.findFirst
        .mockResolvedValueOnce({ ...ACTIVE_OWNER_MEMBERSHIP, role: 'ADMIN' })
        .mockResolvedValueOnce({ id: 'm-2', employerId: 'employer-1', role: 'OWNER', status: 'ACTIVE' });
      await expect(service.updateMemberRole('user-1', 'm-2', { role: 'ADMIN' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cannot demote the last remaining OWNER', async () => {
      const { service, prisma } = buildService();
      prisma.employerMembership.findFirst
        .mockResolvedValueOnce(ACTIVE_OWNER_MEMBERSHIP) // caller (OWNER)
        .mockResolvedValueOnce({ id: 'm-1', employerId: 'employer-1', role: 'OWNER', status: 'ACTIVE' }); // target is self, also OWNER
      prisma.employerMembership.count.mockResolvedValue(1); // only one active owner
      await expect(service.updateMemberRole('user-1', 'm-1', { role: 'ADMIN' } as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cannot remove the last remaining OWNER', async () => {
      const { service, prisma } = buildService();
      prisma.employerMembership.findFirst
        .mockResolvedValueOnce(ACTIVE_OWNER_MEMBERSHIP)
        .mockResolvedValueOnce({ id: 'm-1', employerId: 'employer-1', role: 'OWNER', status: 'ACTIVE' });
      prisma.employerMembership.count.mockResolvedValue(1);
      await expect(service.removeMember('user-1', 'm-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows demoting an OWNER when another active OWNER still exists', async () => {
      const { service, prisma, employerAuditLog } = buildService();
      prisma.employerMembership.findFirst
        .mockResolvedValueOnce(ACTIVE_OWNER_MEMBERSHIP)
        .mockResolvedValueOnce({ id: 'm-2', employerId: 'employer-1', role: 'OWNER', status: 'ACTIVE' });
      prisma.employerMembership.count.mockResolvedValue(2);
      prisma.employerMembership.update.mockResolvedValue({ id: 'm-2', role: 'ADMIN' });

      await service.updateMemberRole('user-1', 'm-2', { role: 'ADMIN' } as any);

      expect(prisma.employerMembership.update).toHaveBeenCalledWith({ where: { id: 'm-2' }, data: { role: 'ADMIN' } });
      expect(employerAuditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'employer.member_role_changed' }));
    });
  });

  describe('plans and orders', () => {
    it('flags PAID plans as unavailable (but still returned) when paid_job_posting_enabled is off', async () => {
      const { service, prisma, platformSettings } = buildService();
      prisma.jobPostingPlan.findMany.mockResolvedValue([
        { id: 'p1', key: 'standard_free', type: 'FREE', isActive: true },
        { id: 'p2', key: 'featured_paid', type: 'PAID', isActive: true },
      ]);
      platformSettings.get.mockImplementation((key: string) => Promise.resolve(key === 'free_job_posting_enabled'));

      const plans = await service.listPlans();

      expect(plans).toHaveLength(2);
      expect(plans.find((p) => p.key === 'featured_paid')?.available).toBe(false);
      expect(plans.find((p) => p.key === 'standard_free')?.available).toBe(true);
    });

    it('blocks creating an order for a PAID plan when paid posting is not activated', async () => {
      const { service, prisma, platformSettings } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue(ACTIVE_OWNER_MEMBERSHIP);
      prisma.job.findFirst.mockResolvedValue({ id: 'job-1', employerId: 'employer-1' });
      prisma.jobPostingPlan.findUnique.mockResolvedValue({ id: 'plan-1', type: 'PAID', isActive: true, priceAmount: 500 });
      platformSettings.get.mockResolvedValueOnce(false); // paid_job_posting_enabled

      await expect(service.createOrder('user-1', 'job-1', 'plan-1')).rejects.toMatchObject({
        response: expect.objectContaining({ error: 'PAID_POSTING_NOT_ACTIVATED' }),
      });
      expect(prisma.jobPostingOrder.create).not.toHaveBeenCalled();
    });

    it('orders are always created as PENDING, never SUCCEEDED', async () => {
      const { service, prisma } = buildService();
      prisma.employerMembership.findFirst.mockResolvedValue(ACTIVE_OWNER_MEMBERSHIP);
      prisma.job.findFirst.mockResolvedValue({ id: 'job-1', employerId: 'employer-1' });
      prisma.jobPostingPlan.findUnique.mockResolvedValue({ id: 'plan-1', key: 'standard_free', type: 'FREE', isActive: true, priceAmount: null, priceCurrency: 'BDT' });
      prisma.jobPostingOrder.create.mockResolvedValue({ id: 'order-1', status: 'PENDING' });

      await service.createOrder('user-1', 'job-1', 'plan-1');

      expect(prisma.jobPostingOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING' }),
      }));
    });
  });
});
