import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { EmployerAuditLogService } from '../jobs/services/employer-audit-log.service';
import { JobAuditLogService } from '../jobs/services/job-audit-log.service';
import { JobsService } from '../jobs/jobs.service';
import { RegisterEmployerDto } from './dto/register-employer.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateEmployerJobDto, UpdateEmployerJobDto } from './dto/employer-job.dto';
import { InviteMemberDto, UpdateMemberRoleDto } from './dto/member.dto';

type MembershipWithEmployer = {
  id: string;
  employerId: string;
  userId: string;
  role: string;
  status: string;
  employer: { id: string; status: string; verificationStatus: string };
};

/**
 * Every method here resolves "which company is this?" from the caller's own EmployerMembership row —
 * NEVER from a client-supplied employerId (see EmployerMembership's doc comment in schema.prisma; this
 * is the IDOR-prevention rule the whole module is built around). A user is assumed to belong to at most
 * one company at a time (see `register` — it refuses a second ACTIVE/INVITED membership), so
 * `getActiveMembership` resolving the caller's single ACTIVE row is what every other method scopes
 * through, exactly like ReaderService scopes every query through the caller's own userId.
 */
@Injectable()
export class EmployerPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly employerAuditLog: EmployerAuditLogService,
    private readonly jobAuditLog: JobAuditLogService,
    private readonly jobsService: JobsService,
  ) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      + '-' + Date.now().toString(36);
  }

  private async assertEnabled(key: string, message: string) {
    const value = await this.platformSettings.get(key);
    if (value !== true) throw new ForbiddenException(message);
  }

  /** The one place every employer-scoped handler starts from. `requireActive` (default true) additionally
   * blocks any action while the employer account itself is SUSPENDED/INACTIVE — read-only handlers pass
   * `requireActive: false` so a suspended company's members can still see their own data. */
  private async getMembership(userId: string, opts: { requireActive?: boolean } = {}): Promise<MembershipWithEmployer> {
    const requireActive = opts.requireActive !== false;
    const membership = await this.prisma.employerMembership.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { employer: { select: { id: true, status: true, verificationStatus: true } } },
    });
    if (!membership) throw new ForbiddenException('You are not an active member of any employer account');
    if (requireActive && membership.employer.status !== 'ACTIVE') {
      throw new ForbiddenException('This employer account is suspended and cannot perform this action');
    }
    return membership as unknown as MembershipWithEmployer;
  }

  private requireOwnerOrAdmin(membership: MembershipWithEmployer) {
    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new ForbiddenException('Only company owners/admins can perform this action');
    }
  }

  // ==================== REGISTRATION ====================

  async register(userId: string, dto: RegisterEmployerDto) {
    await this.assertEnabled('employer_platform_enabled', 'The employer platform is not currently enabled');
    await this.assertEnabled('employer_registration_enabled', 'Employer self-registration is not currently open');

    const existing = await this.prisma.employerMembership.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'INVITED'] } },
    });
    if (existing) {
      throw new ConflictException('You already belong to an employer account. Each user may belong to only one company.');
    }

    const slug = dto.slug || this.slugify(dto.name);
    const slugTaken = await this.prisma.employer.findUnique({ where: { slug } });
    if (slugTaken) throw new BadRequestException('An employer with this slug already exists');

    const result = await this.prisma.$transaction(async (tx) => {
      const employer = await tx.employer.create({
        data: {
          name: dto.name,
          slug,
          website: dto.website,
          description: dto.description,
          industry: dto.industry,
          companySize: dto.companySize,
          foundedYear: dto.foundedYear,
          locationId: dto.locationId,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
          isSelfService: true,
          verificationStatus: 'PENDING',
          status: 'ACTIVE',
          createdById: userId,
        },
      });
      const membership = await tx.employerMembership.create({
        data: { employerId: employer.id, userId, role: 'OWNER', status: 'ACTIVE' },
      });
      return { employer, membership };
    });

    await this.employerAuditLog.record({ employerId: result.employer.id, actorId: userId, action: 'employer.registered' });
    return result;
  }

  // ==================== ME / COMPANY ====================

  async getMyMemberships(userId: string) {
    return this.prisma.employerMembership.findMany({
      where: { userId, status: { not: 'REMOVED' } },
      include: {
        employer: {
          select: { id: true, name: true, slug: true, status: true, verificationStatus: true, isSelfService: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCompany(userId: string) {
    const membership = await this.getMembership(userId, { requireActive: false });
    await this.assertEnabled('company_profiles_enabled', 'Company profiles are not currently enabled');
    const employer = await this.prisma.employer.findUnique({
      where: { id: membership.employerId },
      include: { logo: true, cover: true, location: true },
    });
    if (!employer) throw new NotFoundException('Company not found');
    return employer;
  }

  async updateCompany(userId: string, dto: UpdateCompanyDto) {
    const membership = await this.getMembership(userId);
    this.requireOwnerOrAdmin(membership);
    await this.assertEnabled('company_profiles_enabled', 'Company profiles are not currently enabled');

    if (dto.logoMediaId) {
      const media = await this.prisma.media.findUnique({ where: { id: dto.logoMediaId } });
      if (!media) throw new BadRequestException('Logo media not found');
    }
    if (dto.coverMediaId) {
      const media = await this.prisma.media.findUnique({ where: { id: dto.coverMediaId } });
      if (!media) throw new BadRequestException('Cover media not found');
    }

    // Never accept verificationStatus/status/isSelfService/createdById from the client — those fields
    // simply aren't on UpdateCompanyDto, so there's nothing here to strip; this comment documents why.
    const updated = await this.prisma.employer.update({
      where: { id: membership.employerId },
      data: {
        name: dto.name,
        logoMediaId: dto.logoMediaId,
        coverMediaId: dto.coverMediaId,
        website: dto.website,
        description: dto.description,
        industry: dto.industry,
        companySize: dto.companySize,
        foundedYear: dto.foundedYear,
        locationId: dto.locationId,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
      },
    });
    await this.employerAuditLog.record({ employerId: membership.employerId, actorId: userId, action: 'employer.company_updated' });
    return updated;
  }

  async submitVerification(userId: string) {
    const membership = await this.getMembership(userId);
    this.requireOwnerOrAdmin(membership);
    const employer = await this.prisma.employer.findUnique({ where: { id: membership.employerId } });
    if (!employer) throw new NotFoundException('Company not found');
    if (employer.verificationStatus === 'VERIFIED') {
      throw new BadRequestException('This company is already verified');
    }
    await this.employerAuditLog.record({ employerId: membership.employerId, actorId: userId, action: 'employer.verification_submitted' });
    return { message: 'Verification request submitted', verificationStatus: employer.verificationStatus };
  }

  // ==================== DASHBOARD ====================

  async getDashboard(userId: string) {
    const membership = await this.getMembership(userId, { requireActive: false });
    const employerId = membership.employerId;

    const [statusGroups, totalApplications, employer] = await Promise.all([
      this.prisma.job.groupBy({ by: ['status'], where: { employerId }, _count: { _all: true } }),
      this.prisma.jobApplication.count({ where: { job: { employerId } } }),
      this.prisma.employer.findUnique({ where: { id: employerId }, select: { verificationStatus: true, status: true } }),
    ]);

    const jobsByStatus: Record<string, number> = {};
    for (const group of statusGroups) jobsByStatus[group.status] = group._count._all;

    return {
      employerStatus: employer?.status ?? null,
      verificationStatus: employer?.verificationStatus ?? null,
      jobsByStatus,
      totalJobs: Object.values(jobsByStatus).reduce((sum, n) => sum + n, 0),
      totalApplications,
    };
  }

  // ==================== JOBS ====================

  async listJobs(userId: string, page = 1, limit = 20, status?: string) {
    const membership = await this.getMembership(userId, { requireActive: false });
    const where: any = { employerId: membership.employerId };
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        select: {
          id: true, title: true, slug: true, status: true, employmentType: true, workplaceType: true,
          deadline: true, publishedAt: true, createdAt: true, updatedAt: true,
          category: { select: { id: true, name: true } },
          _count: { select: { applications: true } },
        },
      }),
      this.prisma.job.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getJob(userId: string, jobId: string) {
    const membership = await this.getMembership(userId, { requireActive: false });
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, employerId: membership.employerId },
      include: { category: true, location: true, _count: { select: { applications: true } } },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async createJob(userId: string, dto: CreateEmployerJobDto) {
    const membership = await this.getMembership(userId);
    this.requireOwnerOrAdmin(membership);
    await this.assertEnabled('third_party_job_posting_enabled', 'Third-party job posting is not currently enabled');
    await this.assertEnabled('free_job_posting_enabled', 'Free job posting is not currently enabled');

    const category = await this.prisma.jobCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new BadRequestException('Job category not found');
    if (dto.applicationMethod === 'EXTERNAL_URL' && !dto.externalApplyUrl) {
      throw new BadRequestException('External application URL is required for the EXTERNAL_URL application method');
    }
    if (dto.applicationMethod === 'EMAIL' && !dto.applicationEmail) {
      throw new BadRequestException('Application email is required for the EMAIL application method');
    }
    if (dto.salaryMin != null && dto.salaryMax != null && dto.salaryMin > dto.salaryMax) {
      throw new BadRequestException('Minimum salary cannot be greater than maximum salary');
    }

    const slug = dto.slug || this.slugify(dto.title);
    const slugTaken = await this.prisma.job.findUnique({ where: { slug } });
    if (slugTaken) throw new BadRequestException('A job with this slug already exists');

    const job = await this.prisma.job.create({
      data: {
        title: dto.title,
        slug,
        summary: dto.summary,
        description: dto.description,
        responsibilities: dto.responsibilities,
        requirements: dto.requirements,
        qualifications: dto.qualifications,
        experience: dto.experience,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        salaryCurrency: dto.salaryCurrency ?? 'BDT',
        salaryNegotiable: dto.salaryNegotiable ?? false,
        employmentType: dto.employmentType,
        workplaceType: dto.workplaceType ?? 'ON_SITE',
        vacancies: dto.vacancies ?? 1,
        categoryId: dto.categoryId,
        employerId: membership.employerId,
        locationId: dto.locationId,
        applicationMethod: dto.applicationMethod ?? 'INTERNAL',
        externalApplyUrl: dto.externalApplyUrl,
        applicationEmail: dto.applicationEmail,
        applicationInstructions: dto.applicationInstructions,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        createdById: userId,
      },
    });
    await this.jobAuditLog.record({ jobId: job.id, actorId: userId, action: 'CREATED', toStatus: 'DRAFT' });
    await this.employerAuditLog.record({ employerId: membership.employerId, actorId: userId, action: 'employer.job_created', note: job.id });
    return job;
  }

  /** PATCH is only ever allowed while the job is still DRAFT. Once submitted (IN_REVIEW) an employer
   * must withdraw it back to DRAFT first — letting them silently edit content that's already in the
   * admin review queue (or worse, already APPROVED/PUBLISHED) would defeat the review step entirely. */
  async updateJob(userId: string, jobId: string, dto: UpdateEmployerJobDto) {
    const membership = await this.getMembership(userId);
    this.requireOwnerOrAdmin(membership);
    const existing = await this.prisma.job.findFirst({ where: { id: jobId, employerId: membership.employerId } });
    if (!existing) throw new NotFoundException('Job not found');
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only draft jobs can be edited. Withdraw this job to draft first.');
    }
    if (dto.categoryId) {
      const category = await this.prisma.jobCategory.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new BadRequestException('Job category not found');
    }
    const salaryMin = dto.salaryMin ?? existing.salaryMin ?? undefined;
    const salaryMax = dto.salaryMax ?? existing.salaryMax ?? undefined;
    if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
      throw new BadRequestException('Minimum salary cannot be greater than maximum salary');
    }

    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        title: dto.title, slug: dto.slug, summary: dto.summary, description: dto.description,
        responsibilities: dto.responsibilities, requirements: dto.requirements, qualifications: dto.qualifications,
        experience: dto.experience, salaryMin: dto.salaryMin, salaryMax: dto.salaryMax,
        salaryCurrency: dto.salaryCurrency, salaryNegotiable: dto.salaryNegotiable,
        employmentType: dto.employmentType, workplaceType: dto.workplaceType, vacancies: dto.vacancies,
        categoryId: dto.categoryId, locationId: dto.locationId,
        applicationMethod: dto.applicationMethod, externalApplyUrl: dto.externalApplyUrl,
        applicationEmail: dto.applicationEmail, applicationInstructions: dto.applicationInstructions,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        updatedById: userId,
      },
    });
    await this.jobAuditLog.record({ jobId, actorId: userId, action: 'EDITED' });
    return updated;
  }

  async submitJob(userId: string, jobId: string) {
    const membership = await this.getMembership(userId);
    this.requireOwnerOrAdmin(membership);
    const existing = await this.prisma.job.findFirst({ where: { id: jobId, employerId: membership.employerId } });
    if (!existing) throw new NotFoundException('Job not found');
    if (existing.status !== 'DRAFT') throw new BadRequestException('Only draft jobs can be submitted for review');

    const result = await this.jobsService.submitReview(jobId, userId, []);
    await this.employerAuditLog.record({ employerId: membership.employerId, actorId: userId, action: 'employer.job_submitted', note: jobId });
    return result;
  }

  /** Deliberately NOT a call into JobsService.returnToDraft — that method also allows APPROVED->DRAFT
   * (an admin overriding their own approval), which an employer must never be able to trigger once staff
   * has approved a posting. This only ever moves IN_REVIEW -> DRAFT, and only before any admin action. */
  async withdrawJob(userId: string, jobId: string) {
    const membership = await this.getMembership(userId);
    this.requireOwnerOrAdmin(membership);
    const existing = await this.prisma.job.findFirst({ where: { id: jobId, employerId: membership.employerId } });
    if (!existing) throw new NotFoundException('Job not found');
    if (existing.status !== 'IN_REVIEW') {
      throw new BadRequestException('Only jobs currently in review can be withdrawn back to draft');
    }
    const { count } = await this.prisma.job.updateMany({
      where: { id: jobId, employerId: membership.employerId, status: 'IN_REVIEW' },
      data: { status: 'DRAFT' },
    });
    if (count === 0) throw new ConflictException({ message: 'This job was already acted on by someone else.', code: 'JOB_STATUS_CONFLICT' });
    await this.jobAuditLog.record({ jobId, actorId: userId, action: 'RETURNED_TO_DRAFT', fromStatus: 'IN_REVIEW', toStatus: 'DRAFT', note: 'Withdrawn by employer' });
    await this.employerAuditLog.record({ employerId: membership.employerId, actorId: userId, action: 'employer.job_withdrawn', note: jobId });
    return this.getJob(userId, jobId);
  }

  async archiveJob(userId: string, jobId: string) {
    const membership = await this.getMembership(userId);
    this.requireOwnerOrAdmin(membership);
    const existing = await this.prisma.job.findFirst({ where: { id: jobId, employerId: membership.employerId } });
    if (!existing) throw new NotFoundException('Job not found');
    if (!['PUBLISHED', 'EXPIRED'].includes(existing.status)) {
      throw new BadRequestException('Only published or expired jobs can be archived');
    }
    const result = await this.jobsService.archive(jobId, userId);
    await this.employerAuditLog.record({ employerId: membership.employerId, actorId: userId, action: 'employer.job_archived', note: jobId });
    return result;
  }

  // ==================== APPLICATIONS ====================

  async listApplications(userId: string, params: { page?: number; limit?: number; jobId?: string; status?: string }) {
    const membership = await this.getMembership(userId, { requireActive: false });
    await this.assertEnabled('employer_application_access_enabled', 'Application access is not currently enabled');
    const { page = 1, limit = 20, jobId, status } = params;
    const where: any = { job: { employerId: membership.employerId } };
    if (jobId) where.jobId = jobId;
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      this.prisma.jobApplication.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        select: {
          id: true, status: true, method: true, notes: true, createdAt: true, updatedAt: true,
          applicant: { select: { id: true, name: true, email: true } },
          job: { select: { id: true, title: true, slug: true } },
          resume: { select: { id: true, fileName: true, publicUrl: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.jobApplication.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getApplication(userId: string, applicationId: string) {
    const membership = await this.getMembership(userId, { requireActive: false });
    await this.assertEnabled('employer_application_access_enabled', 'Application access is not currently enabled');
    // `notes` is included here — unlike ReaderService.getMyApplication's applicant-facing select, the
    // employer IS the reviewer for their own jobs, so the admin-only internal note is legitimately theirs
    // to read (it is never shown to the applicant, only to staff and now the employer who owns the job).
    const application = await this.prisma.jobApplication.findFirst({
      where: { id: applicationId, job: { employerId: membership.employerId } },
      select: {
        id: true, status: true, method: true, coverLetter: true, notes: true, createdAt: true, updatedAt: true,
        applicant: { select: { id: true, name: true, email: true } },
        job: { select: { id: true, title: true, slug: true, status: true } },
        resume: { select: { id: true, fileName: true, publicUrl: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  async updateApplicationStatus(userId: string, applicationId: string, status: string, note: string | undefined) {
    const membership = await this.getMembership(userId);
    this.requireOwnerOrAdmin(membership);
    await this.assertEnabled('employer_application_access_enabled', 'Application access is not currently enabled');
    const existing = await this.prisma.jobApplication.findFirst({
      where: { id: applicationId, job: { employerId: membership.employerId } },
    });
    if (!existing) throw new NotFoundException('Application not found');
    if (existing.status === 'WITHDRAWN') {
      throw new BadRequestException('This application was withdrawn by the applicant and cannot be updated');
    }
    const updated = await this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: status as any, reviewedById: userId, notes: note !== undefined ? note : undefined },
      include: { applicant: { select: { id: true, name: true } }, job: { select: { id: true, title: true } } },
    });
    await this.jobAuditLog.record({
      jobId: existing.jobId, actorId: userId, action: 'APPLICATION_STATUS_CHANGED',
      fromStatus: existing.status, toStatus: status,
      note: `Application ${applicationId} for ${updated.applicant.name} (reviewed by employer)`,
    });
    return updated;
  }

  // ==================== MEMBERS ====================

  async listMembers(userId: string) {
    const membership = await this.getMembership(userId, { requireActive: false });
    return this.prisma.employerMembership.findMany({
      where: { employerId: membership.employerId, status: { not: 'REMOVED' } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        invitedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async inviteMember(userId: string, dto: InviteMemberDto) {
    const membership = await this.getMembership(userId);
    this.requireOwnerOrAdmin(membership);
    if (dto.role === 'OWNER' && membership.role !== 'OWNER') {
      throw new ForbiddenException('Only an existing owner can grant the OWNER role');
    }
    const invitedUser = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!invitedUser) throw new NotFoundException('No user with this email exists yet');

    const existing = await this.prisma.employerMembership.findUnique({
      where: { employerId_userId: { employerId: membership.employerId, userId: invitedUser.id } },
    });
    if (existing && existing.status !== 'REMOVED') {
      throw new ConflictException('This user is already a member (or has a pending invite) of this company');
    }

    const result = existing
      ? await this.prisma.employerMembership.update({
          where: { id: existing.id },
          data: { role: dto.role, status: 'INVITED', invitedById: userId, invitedAt: new Date() },
        })
      : await this.prisma.employerMembership.create({
          data: {
            employerId: membership.employerId, userId: invitedUser.id, role: dto.role,
            status: 'INVITED', invitedById: userId, invitedAt: new Date(),
          },
        });
    await this.employerAuditLog.record({
      employerId: membership.employerId, actorId: userId, action: 'employer.member_invited',
      note: `${dto.email} as ${dto.role}`,
    });
    return result;
  }

  async acceptInvite(userId: string, membershipId: string) {
    const membership = await this.prisma.employerMembership.findUnique({ where: { id: membershipId } });
    if (!membership || membership.userId !== userId) throw new NotFoundException('Invitation not found');
    if (membership.status !== 'INVITED') throw new BadRequestException('This invitation is no longer pending');
    const updated = await this.prisma.employerMembership.update({ where: { id: membershipId }, data: { status: 'ACTIVE' } });
    await this.employerAuditLog.record({ employerId: membership.employerId, actorId: userId, action: 'employer.member_invite_accepted' });
    return updated;
  }

  private async countActiveOwners(employerId: string): Promise<number> {
    return this.prisma.employerMembership.count({ where: { employerId, role: 'OWNER', status: 'ACTIVE' } });
  }

  async updateMemberRole(userId: string, membershipId: string, dto: UpdateMemberRoleDto) {
    const membership = await this.getMembership(userId);
    this.requireOwnerOrAdmin(membership);
    const target = await this.prisma.employerMembership.findFirst({
      where: { id: membershipId, employerId: membership.employerId, status: { not: 'REMOVED' } },
    });
    if (!target) throw new NotFoundException('Member not found');

    // Privilege-escalation guards: only an OWNER may grant OWNER, and only an OWNER may change another
    // OWNER's role at all (an ADMIN demoting an OWNER is itself a privilege-escalation vector).
    if ((dto.role === 'OWNER' || target.role === 'OWNER') && membership.role !== 'OWNER') {
      throw new ForbiddenException('Only an existing owner can grant or change the OWNER role');
    }
    if (target.role === 'OWNER' && dto.role !== 'OWNER') {
      const activeOwners = await this.countActiveOwners(membership.employerId);
      if (activeOwners <= 1) {
        throw new BadRequestException('Cannot demote the last remaining owner. Promote another member to OWNER first.');
      }
    }

    const updated = await this.prisma.employerMembership.update({ where: { id: membershipId }, data: { role: dto.role } });
    await this.employerAuditLog.record({
      employerId: membership.employerId, actorId: userId, action: 'employer.member_role_changed',
      note: `${membershipId} -> ${dto.role}`,
    });
    return updated;
  }

  async removeMember(userId: string, membershipId: string) {
    const membership = await this.getMembership(userId);
    this.requireOwnerOrAdmin(membership);
    const target = await this.prisma.employerMembership.findFirst({
      where: { id: membershipId, employerId: membership.employerId, status: { not: 'REMOVED' } },
    });
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'ADMIN' && membership.role !== 'OWNER') {
      throw new ForbiddenException('Only an owner can remove an admin member');
    }
    if (target.role === 'OWNER') {
      const activeOwners = await this.countActiveOwners(membership.employerId);
      if (activeOwners <= 1) {
        throw new BadRequestException('Cannot remove the last remaining owner. Promote another member to OWNER first.');
      }
    }

    const updated = await this.prisma.employerMembership.update({ where: { id: membershipId }, data: { status: 'REMOVED' } });
    await this.employerAuditLog.record({ employerId: membership.employerId, actorId: userId, action: 'employer.member_removed', note: membershipId });
    return updated;
  }

  // ==================== PLANS & ORDERS ====================

  async listPlans() {
    const [plans, paidEnabled, freeEnabled] = await Promise.all([
      this.prisma.jobPostingPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      this.platformSettings.get('paid_job_posting_enabled'),
      this.platformSettings.get('free_job_posting_enabled'),
    ]);
    return plans.map((plan) => ({
      ...plan,
      available: plan.type === 'PAID' ? paidEnabled === true : freeEnabled === true,
    }));
  }

  async createOrder(userId: string, jobId: string, planId: string) {
    const membership = await this.getMembership(userId);
    this.requireOwnerOrAdmin(membership);
    const job = await this.prisma.job.findFirst({ where: { id: jobId, employerId: membership.employerId } });
    if (!job) throw new NotFoundException('Job not found');
    const plan = await this.prisma.jobPostingPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Plan not found');

    if (plan.type === 'PAID') {
      const paidEnabled = await this.platformSettings.get('paid_job_posting_enabled');
      if (paidEnabled !== true) {
        throw new ConflictException({ error: 'PAID_POSTING_NOT_ACTIVATED', message: 'Paid job posting is configured but not yet activated on this platform' });
      }
    }

    // Never created as anything but PENDING — see JobPostingOrder's doc comment in schema.prisma. No
    // payment gateway exists in this phase, so SUCCEEDED is unreachable from application code.
    const order = await this.prisma.jobPostingOrder.create({
      data: {
        jobId, employerId: membership.employerId, planId,
        amount: plan.priceAmount ?? 0, currency: plan.priceCurrency ?? 'BDT',
        status: 'PENDING', createdById: userId,
      },
    });
    await this.employerAuditLog.record({ employerId: membership.employerId, actorId: userId, action: 'employer.order_created', note: `job ${jobId}, plan ${plan.key}` });
    return order;
  }
}
