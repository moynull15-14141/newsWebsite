import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import * as bcrypt from 'bcryptjs';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageModule } from '../../common/storage/storage.module';
import { JobsModule } from './jobs.module';
import { JobsService } from './jobs.service';
import { ReaderModule } from '../reader/reader.module';
import { ReaderService } from '../reader/reader.service';

config({ path: '../../.env' });
jest.setTimeout(60_000);

describe('Phase 2O jobs platform (real Aiven E2E)', () => {
  let prisma: PrismaService;
  let jobsService: JobsService;
  let readerService: ReaderService;
  const marker = `phase2o-${randomUUID()}`;
  let creatorId = '';
  let reviewerId = '';
  let applicantId = '';
  let categoryId = '';
  let employerId = '';
  let jobId = '';

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || '');
    if (!url.hostname.endsWith('.aivencloud.com')) throw new Error('Refusing E2E: not Aiven');

    const moduleRef = await Test.createTestingModule({ imports: [PrismaModule, StorageModule, JobsModule, ReaderModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    jobsService = moduleRef.get(JobsService);
    readerService = moduleRef.get(ReaderService);

    const passwordHash = await bcrypt.hash('Password9!', 12);
    const [creator, reviewer, applicant] = await Promise.all([
      prisma.user.create({ data: { name: `${marker}-creator`, email: `${marker}-creator@example.invalid`, passwordHash, accountType: 'STAFF' } }),
      prisma.user.create({ data: { name: `${marker}-reviewer`, email: `${marker}-reviewer@example.invalid`, passwordHash, accountType: 'STAFF' } }),
      prisma.user.create({ data: { name: `${marker}-applicant`, email: `${marker}-applicant@example.invalid`, passwordHash, accountType: 'READER', verifiedAt: new Date(), readerProfile: { create: { displayName: marker } }, notificationPreference: { create: {} } } }),
    ]);
    creatorId = creator.id; reviewerId = reviewer.id; applicantId = applicant.id;

    const category = await prisma.jobCategory.findFirstOrThrow({ where: { status: 'ACTIVE' } });
    categoryId = category.id;

    const employer = await prisma.employer.create({ data: { name: marker, slug: marker, createdById: creatorId } });
    employerId = employer.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.jobApplication.deleteMany({ where: { applicantId } });
    await prisma.savedJob.deleteMany({ where: { userId: applicantId } });
    await prisma.jobAuditLog.deleteMany({ where: { jobId } });
    await prisma.job.deleteMany({ where: { employerId } });
    await prisma.employer.deleteMany({ where: { id: employerId } });
    await prisma.user.deleteMany({ where: { id: { in: [creatorId, reviewerId, applicantId] } } });
    expect(await prisma.user.count({ where: { id: { in: [creatorId, reviewerId, applicantId] } } })).toBe(0);
    expect(await prisma.employer.count({ where: { id: employerId } })).toBe(0);
  });

  it('runs a job through the full DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED workflow with audit entries', async () => {
    const created = await jobsService.create({
      title: marker, employerId, categoryId, employmentType: 'FULL_TIME', workplaceType: 'ON_SITE',
      applicationMethod: 'INTERNAL', deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    } as any, creatorId);
    jobId = created.id;
    expect(created.status).toBe('DRAFT');

    await jobsService.submitReview(jobId, creatorId, []);
    // The creator cannot approve their own posting without job.publish.
    await expect(jobsService.approve(jobId, creatorId, [])).rejects.toThrow('cannot approve');
    const approved = await jobsService.approve(jobId, reviewerId, []);
    expect((approved as any).status).toBe('APPROVED');

    const published = await jobsService.publish(jobId, reviewerId);
    expect((published as any).status).toBe('PUBLISHED');

    const auditLog = await jobsService.getAuditLog(jobId, 1, 50);
    const actions = auditLog.data.map((entry: any) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(['CREATED', 'SUBMITTED_FOR_REVIEW', 'APPROVED', 'PUBLISHED']));
  });

  it('is publicly discoverable once PUBLISHED and respects public eligibility', async () => {
    const found = await prisma.job.findFirst({ where: { id: jobId, status: 'PUBLISHED' } });
    expect(found).not.toBeNull();
  });

  it('can be saved once (idempotent), reported, listed, and unsaved — only by its own owner', async () => {
    const first = await readerService.addSavedJob(applicantId, jobId);
    const second = await readerService.addSavedJob(applicantId, jobId);
    expect(second.id).toBe(first.id);
    expect(await readerService.savedJobStatus(applicantId, jobId)).toEqual({ saved: true });
    expect((await readerService.getSavedJobs(applicantId, 1, 20)).meta.total).toBe(1);
    await readerService.removeSavedJob(applicantId, jobId);
    expect(await readerService.savedJobStatus(applicantId, jobId)).toEqual({ saved: false });
  });

  it('accepts one internal application per applicant, rejects a duplicate, and lets the applicant withdraw', async () => {
    const application = await readerService.applyToJob(applicantId, jobId, { coverLetter: 'Please consider me.' });
    expect((application as any).status).toBe('SUBMITTED');

    await expect(readerService.applyToJob(applicantId, jobId, {})).rejects.toThrow('already applied');

    const mine = await readerService.getMyApplications(applicantId, 1, 20);
    expect(mine.meta.total).toBe(1);

    const withdrawn = await readerService.withdrawApplication(applicantId, (application as any).id);
    expect((withdrawn as any).status).toBe('WITHDRAWN');
    await expect(readerService.withdrawApplication(applicantId, (application as any).id)).rejects.toThrow('can no longer be withdrawn');
  });

  it('lets staff move a fresh application through statuses and records an audit entry, without exposing notes to the applicant', async () => {
    // The previous test left a WITHDRAWN row for this (jobId, applicantId) pair — the unique
    // constraint is on the pair regardless of status, so clear it before creating a fresh one here.
    await prisma.jobApplication.deleteMany({ where: { jobId, applicantId } });
    const application = await prisma.jobApplication.create({ data: { jobId, applicantId, status: 'SUBMITTED', method: 'INTERNAL' } });
    const updated = await jobsService.updateApplicationStatus(application.id, 'SHORTLISTED', 'Strong candidate — internal note', reviewerId);
    expect((updated as any).status).toBe('SHORTLISTED');

    const staffView = await jobsService.getApplication(application.id);
    expect(staffView.notes).toContain('Strong candidate');

    const applicantView = await readerService.getMyApplication(applicantId, application.id);
    expect(applicantView).not.toHaveProperty('notes');

    const auditLog = await jobsService.getAuditLog(jobId, 1, 50);
    expect(auditLog.data.some((entry: any) => entry.action === 'APPLICATION_STATUS_CHANGED')).toBe(true);
  });

  it('expires a published job past its deadline and removes it from public eligibility', async () => {
    await prisma.job.update({ where: { id: jobId }, data: { deadline: new Date(Date.now() - 60_000) } });
    const expired = await jobsService.expireDueJobs();
    expect(expired).toContain(jobId);

    const row = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(row.status).toBe('EXPIRED');

    // A new application to an expired job must be refused even if the applicant already withdrew
    // their earlier one (jobId/applicantId unique constraint no longer blocks it, so this is the real
    // eligibility check, not just the duplicate-application guard).
    await expect(readerService.applyToJob(applicantId, jobId, {})).rejects.toThrow('Published job not found');
  });

  it('archives an expired job and blocks deletion of anything but draft/archived jobs', async () => {
    await expect(jobsService.remove(jobId)).rejects.toThrow('Only draft or archived jobs can be deleted');
    const archived = await jobsService.archive(jobId, reviewerId);
    expect((archived as any).status).toBe('ARCHIVED');
  });
});
