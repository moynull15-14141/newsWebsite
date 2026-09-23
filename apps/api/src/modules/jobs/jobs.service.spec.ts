import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobAuditLogService } from './services/job-audit-log.service';

describe('JobsService', () => {
  let service: JobsService;
  let prisma: any;
  let auditLog: any;

  const mockJob = {
    id: 'job-1',
    title: 'Software Engineer',
    slug: 'software-engineer-abc123',
    status: 'DRAFT',
    createdById: 'creator-1',
    employerId: 'employer-1',
    categoryId: 'category-1',
    deadline: null,
    salaryMin: null,
    salaryMax: null,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      job: {
        create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(),
        update: jest.fn(), updateMany: jest.fn(), delete: jest.fn(), count: jest.fn(),
      },
      jobCategory: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      employer: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      media: { findUnique: jest.fn() },
      jobApplication: {
        findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), update: jest.fn(),
      },
    };
    auditLog = { record: jest.fn().mockResolvedValue({}), listForJob: jest.fn() };
    service = new JobsService(prisma, auditLog as unknown as JobAuditLogService);
  });

  describe('create', () => {
    it('rejects an unknown employer', async () => {
      prisma.employer.findUnique.mockResolvedValue(null);
      await expect(service.create({ title: 'X', employerId: 'nope', categoryId: 'c1', employmentType: 'FULL_TIME' } as any, 'u1'))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects EXTERNAL_URL method with no URL', async () => {
      prisma.employer.findUnique.mockResolvedValue({ id: 'employer-1' });
      prisma.jobCategory.findUnique.mockResolvedValue({ id: 'category-1' });
      await expect(service.create({
        title: 'X', employerId: 'employer-1', categoryId: 'category-1', employmentType: 'FULL_TIME', applicationMethod: 'EXTERNAL_URL',
      } as any, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects salaryMin greater than salaryMax', async () => {
      prisma.employer.findUnique.mockResolvedValue({ id: 'employer-1' });
      prisma.jobCategory.findUnique.mockResolvedValue({ id: 'category-1' });
      await expect(service.create({
        title: 'X', employerId: 'employer-1', categoryId: 'category-1', employmentType: 'FULL_TIME', salaryMin: 5000, salaryMax: 1000,
      } as any, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a DRAFT job and records an audit entry', async () => {
      prisma.employer.findUnique.mockResolvedValue({ id: 'employer-1' });
      prisma.jobCategory.findUnique.mockResolvedValue({ id: 'category-1' });
      prisma.job.findUnique.mockResolvedValue(null);
      prisma.job.create.mockResolvedValue(mockJob);

      const result = await service.create({ title: 'Software Engineer', employerId: 'employer-1', categoryId: 'category-1', employmentType: 'FULL_TIME' } as any, 'creator-1');

      expect(result).toEqual(mockJob);
      expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ jobId: mockJob.id, action: 'CREATED', toStatus: 'DRAFT' }));
    });
  });

  describe('submitReview', () => {
    it('rejects a non-creator without job.publish', async () => {
      prisma.job.findUnique.mockResolvedValue({ ...mockJob, createdById: 'someone-else' });
      await expect(service.submitReview('job-1', 'u1', [])).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows a privileged non-creator', async () => {
      prisma.job.findUnique.mockResolvedValue({ ...mockJob, createdById: 'someone-else' });
      prisma.job.updateMany.mockResolvedValue({ count: 1 });
      prisma.job.findMany.mockResolvedValue([]);
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockJob, status: 'IN_REVIEW' } as any);
      await expect(service.submitReview('job-1', 'u1', ['job.publish'])).resolves.toBeDefined();
    });

    it('rejects submitting a non-draft job', async () => {
      prisma.job.findUnique.mockResolvedValue({ ...mockJob, status: 'PUBLISHED' });
      await expect(service.submitReview('job-1', 'creator-1', [])).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('approve', () => {
    it('prevents the creator from approving their own job', async () => {
      prisma.job.findUnique.mockResolvedValue({ ...mockJob, status: 'IN_REVIEW' });
      await expect(service.approve('job-1', 'creator-1', [])).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows the creator to approve when they also hold job.publish', async () => {
      prisma.job.findUnique.mockResolvedValue({ ...mockJob, status: 'IN_REVIEW' });
      prisma.job.updateMany.mockResolvedValue({ count: 1 });
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockJob, status: 'APPROVED' } as any);
      await expect(service.approve('job-1', 'creator-1', ['job.publish'])).resolves.toBeDefined();
    });

    it('throws a conflict when the row already moved (race)', async () => {
      prisma.job.findUnique.mockResolvedValue({ ...mockJob, status: 'IN_REVIEW', createdById: 'other' });
      prisma.job.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.approve('job-1', 'reviewer-1', [])).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('publish', () => {
    it('rejects publishing a non-approved job', async () => {
      prisma.job.findUnique.mockResolvedValue({ ...mockJob, status: 'DRAFT' });
      await expect(service.publish('job-1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects publishing a job whose deadline already passed', async () => {
      prisma.job.findUnique.mockResolvedValue({ ...mockJob, status: 'APPROVED', deadline: new Date('2020-01-01') });
      await expect(service.publish('job-1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('publishes an approved job', async () => {
      prisma.job.findUnique.mockResolvedValue({ ...mockJob, status: 'APPROVED' });
      prisma.job.updateMany.mockResolvedValue({ count: 1 });
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockJob, status: 'PUBLISHED' } as any);
      const result = await service.publish('job-1', 'u1');
      expect((result as any).status).toBe('PUBLISHED');
      expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'PUBLISHED', toStatus: 'PUBLISHED' }));
    });
  });

  describe('remove', () => {
    it('refuses to delete a published job', async () => {
      prisma.job.findUnique.mockResolvedValue({ ...mockJob, status: 'PUBLISHED' });
      await expect(service.remove('job-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows deleting a draft job', async () => {
      prisma.job.findUnique.mockResolvedValue({ ...mockJob, status: 'DRAFT' });
      prisma.job.delete.mockResolvedValue(mockJob);
      await expect(service.remove('job-1')).resolves.toEqual({ message: 'Job deleted successfully' });
    });

    it('404s for a missing job', async () => {
      prisma.job.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('setFeatured', () => {
    it('refuses to feature a job that is not published', async () => {
      prisma.job.findUnique.mockResolvedValue({ ...mockJob, status: 'DRAFT' });
      await expect(service.setFeatured('job-1', true, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('features a published job', async () => {
      prisma.job.findUnique.mockResolvedValue({ ...mockJob, status: 'PUBLISHED' });
      prisma.job.update.mockResolvedValue({ ...mockJob, status: 'PUBLISHED', featured: true });
      const result = await service.setFeatured('job-1', true, 'u1');
      expect((result as any).featured).toBe(true);
      expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'FEATURED' }));
    });
  });

  describe('expireDueJobs', () => {
    it('moves PUBLISHED jobs past their deadline to EXPIRED and audits each one', async () => {
      prisma.job.findMany.mockResolvedValue([{ id: 'job-1' }, { id: 'job-2' }]);
      prisma.job.updateMany.mockResolvedValue({ count: 1 });
      const expired = await service.expireDueJobs();
      expect(expired).toEqual(['job-1', 'job-2']);
      expect(auditLog.record).toHaveBeenCalledTimes(2);
      expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'EXPIRED', toStatus: 'EXPIRED' }));
    });

    it('does not audit a job whose row already changed under it (race)', async () => {
      prisma.job.findMany.mockResolvedValue([{ id: 'job-1' }]);
      prisma.job.updateMany.mockResolvedValue({ count: 0 });
      const expired = await service.expireDueJobs();
      expect(expired).toEqual([]);
      expect(auditLog.record).not.toHaveBeenCalled();
    });
  });

  describe('deactivateCategory', () => {
    it('404s for an unknown category', async () => {
      prisma.jobCategory.findUnique.mockResolvedValue(null);
      await expect(service.deactivateCategory('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sets status to INACTIVE rather than deleting the row', async () => {
      prisma.jobCategory.findUnique.mockResolvedValue({ id: 'cat-1', status: 'ACTIVE' });
      prisma.jobCategory.update.mockResolvedValue({ id: 'cat-1', status: 'INACTIVE' });
      await service.deactivateCategory('cat-1');
      expect(prisma.jobCategory.update).toHaveBeenCalledWith({ where: { id: 'cat-1' }, data: { status: 'INACTIVE' } });
    });
  });

  describe('updateApplicationStatus', () => {
    it('refuses to change a withdrawn application', async () => {
      prisma.jobApplication.findUnique = jest.fn().mockResolvedValue({ id: 'app-1', jobId: 'job-1', status: 'WITHDRAWN' });
      await expect(service.updateApplicationStatus('app-1', 'SHORTLISTED', undefined, 'staff-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates status and records a job audit entry', async () => {
      prisma.jobApplication.findUnique = jest.fn().mockResolvedValue({ id: 'app-1', jobId: 'job-1', status: 'SUBMITTED' });
      prisma.jobApplication.update.mockResolvedValue({ id: 'app-1', status: 'SHORTLISTED', applicant: { id: 'a1', name: 'Applicant' }, job: { id: 'job-1', title: 'Job' } });
      const result = await service.updateApplicationStatus('app-1', 'SHORTLISTED', 'Looks strong', 'staff-1');
      expect((result as any).status).toBe('SHORTLISTED');
      expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-1', action: 'APPLICATION_STATUS_CHANGED', fromStatus: 'SUBMITTED', toStatus: 'SHORTLISTED' }));
    });
  });
});
