import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { CreateJobCategoryDto, UpdateJobCategoryDto } from './dto/job-category.dto';
import { CreateEmployerDto, UpdateEmployerDto } from './dto/employer.dto';
import { JobAuditLogService } from './services/job-audit-log.service';
import { EmployerAuditLogService } from './services/employer-audit-log.service';

const JOB_LIST_SELECT = {
  id: true, title: true, slug: true, summary: true, status: true, featured: true,
  employmentType: true, workplaceType: true, vacancies: true, deadline: true,
  publishedAt: true, scheduledAt: true, createdAt: true, updatedAt: true, viewCount: true,
  category: { select: { id: true, name: true, slug: true } },
  employer: { select: { id: true, name: true, slug: true, logo: { select: { publicUrl: true } } } },
  location: { select: { id: true, name: true, slug: true } },
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
  _count: { select: { applications: true } },
} as const;

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: JobAuditLogService,
    private readonly employerAuditLog: EmployerAuditLogService,
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

  // ==================== JOB CRUD ====================

  async create(dto: CreateJobDto, userId: string) {
    const employer = await this.prisma.employer.findUnique({ where: { id: dto.employerId } });
    if (!employer) throw new BadRequestException('Employer not found');
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
    const existing = await this.prisma.job.findUnique({ where: { slug } });
    if (existing) throw new BadRequestException('A job with this slug already exists');

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
        employerId: dto.employerId,
        locationId: dto.locationId,
        applicationMethod: dto.applicationMethod ?? 'INTERNAL',
        externalApplyUrl: dto.externalApplyUrl,
        applicationEmail: dto.applicationEmail,
        applicationInstructions: dto.applicationInstructions,
        featured: dto.featured ?? false,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        createdById: userId,
      },
      select: JOB_LIST_SELECT,
    });
    await this.auditLog.record({ jobId: job.id, actorId: userId, action: 'CREATED', toStatus: 'DRAFT' });
    return job;
  }

  async findAll(query: QueryJobsDto) {
    const { page = 1, limit = 20, search, status, categoryId, employerId, locationId, employmentType, workplaceType, featured, deadlineBefore, sort = 'createdAt', order = 'desc' } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { employer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (employerId) where.employerId = employerId;
    if (locationId) where.locationId = locationId;
    if (employmentType) where.employmentType = employmentType;
    if (workplaceType) where.workplaceType = workplaceType;
    if (featured !== undefined) where.featured = featured;
    if (deadlineBefore) where.deadline = { lte: new Date(deadlineBefore) };

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({ where, skip, take: limit, orderBy: { [sort]: order }, select: JOB_LIST_SELECT }),
      this.prisma.job.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        category: true, employer: { include: { logo: true, location: true } }, location: true,
        createdBy: { select: { id: true, name: true } }, updatedBy: { select: { id: true, name: true } },
        _count: { select: { applications: true, savedBy: true } },
      },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async findBySlug(slug: string) {
    const job = await this.prisma.job.findUnique({ where: { slug }, include: { category: true, employer: true, location: true } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async update(id: string, dto: UpdateJobDto, userId: string) {
    const existing = await this.prisma.job.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job not found');

    if (dto.expectedUpdatedAt && new Date(dto.expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
      throw new ConflictException({ message: 'This job was changed by someone else since you loaded it. Reload and try again.', code: 'JOB_STATUS_CONFLICT' });
    }
    if (dto.employerId) {
      const employer = await this.prisma.employer.findUnique({ where: { id: dto.employerId } });
      if (!employer) throw new BadRequestException('Employer not found');
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

    const employerChanged = dto.employerId && dto.employerId !== existing.employerId;
    const deadlineChanged = dto.deadline && new Date(dto.deadline).getTime() !== existing.deadline?.getTime();

    const updated = await this.prisma.job.update({
      where: { id },
      data: {
        title: dto.title, slug: dto.slug, summary: dto.summary, description: dto.description,
        responsibilities: dto.responsibilities, requirements: dto.requirements, qualifications: dto.qualifications,
        experience: dto.experience, salaryMin: dto.salaryMin, salaryMax: dto.salaryMax,
        salaryCurrency: dto.salaryCurrency, salaryNegotiable: dto.salaryNegotiable,
        employmentType: dto.employmentType, workplaceType: dto.workplaceType, vacancies: dto.vacancies,
        categoryId: dto.categoryId, employerId: dto.employerId, locationId: dto.locationId,
        applicationMethod: dto.applicationMethod, externalApplyUrl: dto.externalApplyUrl,
        applicationEmail: dto.applicationEmail, applicationInstructions: dto.applicationInstructions,
        featured: dto.featured, deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        updatedById: userId,
      },
      select: JOB_LIST_SELECT,
    });
    await this.auditLog.record({ jobId: id, actorId: userId, action: 'EDITED', note: dto.title ? `Title: ${dto.title}` : undefined });
    if (employerChanged) await this.auditLog.record({ jobId: id, actorId: userId, action: 'EMPLOYER_CHANGED' });
    if (deadlineChanged) await this.auditLog.record({ jobId: id, actorId: userId, action: 'DEADLINE_CHANGED' });
    return updated;
  }

  async remove(id: string) {
    const existing = await this.prisma.job.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job not found');
    if (!['DRAFT', 'ARCHIVED'].includes(existing.status)) {
      throw new BadRequestException('Only draft or archived jobs can be deleted. Archive a published job first.');
    }
    await this.prisma.job.delete({ where: { id } });
    return { message: 'Job deleted successfully' };
  }

  // ==================== WORKFLOW ====================

  async submitReview(id: string, userId: string, userPermissions: string[] = []) {
    const existing = await this.prisma.job.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job not found');
    if (existing.createdById !== userId && !userPermissions.includes('job.publish')) {
      throw new ForbiddenException('Only the creator can submit this job for review');
    }
    if (existing.status !== 'DRAFT') throw new BadRequestException('Only draft jobs can be submitted for review');

    const { count } = await this.prisma.job.updateMany({ where: { id, status: 'DRAFT' }, data: { status: 'IN_REVIEW' } });
    if (count === 0) throw new ConflictException({ message: 'This job is no longer a draft — someone else already acted on it.', code: 'JOB_STATUS_CONFLICT' });
    await this.auditLog.record({ jobId: id, actorId: userId, action: 'SUBMITTED_FOR_REVIEW', fromStatus: 'DRAFT', toStatus: 'IN_REVIEW' });
    return this.findOne(id);
  }

  async approve(id: string, userId: string, userPermissions: string[] = []) {
    const existing = await this.prisma.job.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job not found');
    if (existing.status !== 'IN_REVIEW') throw new BadRequestException('Only jobs in review can be approved');

    // Separation of duties, same rule as articles: the creator approving their own job posting defeats
    // the point of review. Someone who can also publish may knowingly override this.
    if (existing.createdById === userId && !userPermissions.includes('job.publish')) {
      throw new ForbiddenException('You cannot approve a job you created yourself. Ask another reviewer to approve it.');
    }

    const { count } = await this.prisma.job.updateMany({ where: { id, status: 'IN_REVIEW' }, data: { status: 'APPROVED' } });
    if (count === 0) throw new ConflictException({ message: 'This job is no longer awaiting review — someone else already acted on it.', code: 'JOB_STATUS_CONFLICT' });
    await this.auditLog.record({ jobId: id, actorId: userId, action: 'APPROVED', fromStatus: 'IN_REVIEW', toStatus: 'APPROVED' });
    return this.findOne(id);
  }

  async returnToDraft(id: string, userId: string, reason?: string) {
    const existing = await this.prisma.job.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job not found');
    if (!['IN_REVIEW', 'APPROVED'].includes(existing.status)) {
      throw new BadRequestException('Only jobs in review or approved can be returned to draft');
    }
    const { count } = await this.prisma.job.updateMany({ where: { id, status: existing.status }, data: { status: 'DRAFT' } });
    if (count === 0) throw new ConflictException({ message: 'This job was already acted on by someone else.', code: 'JOB_STATUS_CONFLICT' });
    await this.auditLog.record({ jobId: id, actorId: userId, action: 'RETURNED_TO_DRAFT', fromStatus: existing.status, toStatus: 'DRAFT', note: reason });
    return this.findOne(id);
  }

  async publish(id: string, userId: string) {
    const existing = await this.prisma.job.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job not found');
    if (existing.status !== 'APPROVED') throw new BadRequestException('Only approved jobs can be published');
    if (existing.deadline && existing.deadline.getTime() <= Date.now()) {
      throw new BadRequestException('Cannot publish a job whose application deadline has already passed');
    }

    const { count } = await this.prisma.job.updateMany({ where: { id, status: 'APPROVED' }, data: { status: 'PUBLISHED', publishedAt: new Date(), scheduledAt: null } });
    if (count === 0) throw new ConflictException({ message: 'This job is no longer approved — someone else already acted on it.', code: 'JOB_STATUS_CONFLICT' });
    await this.auditLog.record({ jobId: id, actorId: userId, action: 'PUBLISHED', fromStatus: 'APPROVED', toStatus: 'PUBLISHED' });
    return this.findOne(id);
  }

  async schedule(id: string, scheduledAt: string, userId: string) {
    const existing = await this.prisma.job.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job not found');
    if (existing.status !== 'APPROVED') throw new BadRequestException('Only approved jobs can be scheduled');
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      throw new BadRequestException('Scheduled time must be a valid date in the future');
    }

    const { count } = await this.prisma.job.updateMany({ where: { id, status: 'APPROVED' }, data: { status: 'SCHEDULED', scheduledAt: when } });
    if (count === 0) throw new ConflictException({ message: 'This job is no longer approved — someone else already acted on it.', code: 'JOB_STATUS_CONFLICT' });
    await this.auditLog.record({ jobId: id, actorId: userId, action: 'SCHEDULED', fromStatus: 'APPROVED', toStatus: 'SCHEDULED', note: `Scheduled for ${when.toISOString()}` });
    return this.findOne(id);
  }

  async cancelSchedule(id: string, userId: string) {
    const existing = await this.prisma.job.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job not found');
    if (existing.status !== 'SCHEDULED') throw new BadRequestException('Only scheduled jobs can have their schedule cancelled');
    const { count } = await this.prisma.job.updateMany({ where: { id, status: 'SCHEDULED' }, data: { status: 'APPROVED', scheduledAt: null } });
    if (count === 0) throw new ConflictException({ message: 'This job is no longer scheduled — someone else already acted on it.', code: 'JOB_STATUS_CONFLICT' });
    await this.auditLog.record({ jobId: id, actorId: userId, action: 'SCHEDULE_CANCELLED', fromStatus: 'SCHEDULED', toStatus: 'APPROVED' });
    return this.findOne(id);
  }

  /** Cron entry point — mirrors PublishingService.executeScheduledPublications() for articles. */
  async executeScheduledPublications(now: Date = new Date()) {
    const due = await this.prisma.job.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: now } }, select: { id: true } });
    const published: string[] = [];
    for (const job of due) {
      const { count } = await this.prisma.job.updateMany({ where: { id: job.id, status: 'SCHEDULED' }, data: { status: 'PUBLISHED', publishedAt: now, scheduledAt: null } });
      if (count > 0) {
        await this.auditLog.record({ jobId: job.id, actorId: null, action: 'PUBLISHED', fromStatus: 'SCHEDULED', toStatus: 'PUBLISHED', note: 'Automatic scheduled publish' });
        published.push(job.id);
      }
    }
    return published;
  }

  /** Cron entry point — PUBLISHED jobs whose deadline has passed move to EXPIRED so they stop being
   * publicly eligible/acceptable for new applications. Does not touch DRAFT/IN_REVIEW/APPROVED/
   * SCHEDULED/ARCHIVED jobs even if they happen to carry a past deadline — only a live PUBLISHED job
   * can "expire". */
  async expireDueJobs(now: Date = new Date()) {
    const due = await this.prisma.job.findMany({ where: { status: 'PUBLISHED', deadline: { lte: now } }, select: { id: true } });
    const expired: string[] = [];
    for (const job of due) {
      const { count } = await this.prisma.job.updateMany({ where: { id: job.id, status: 'PUBLISHED' }, data: { status: 'EXPIRED' } });
      if (count > 0) {
        await this.auditLog.record({ jobId: job.id, actorId: null, action: 'EXPIRED', fromStatus: 'PUBLISHED', toStatus: 'EXPIRED', note: 'Automatic deadline expiration' });
        expired.push(job.id);
      }
    }
    return expired;
  }

  async archive(id: string, userId: string) {
    const existing = await this.prisma.job.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job not found');
    if (!['PUBLISHED', 'EXPIRED'].includes(existing.status)) {
      throw new BadRequestException('Only published or expired jobs can be archived');
    }
    const { count } = await this.prisma.job.updateMany({ where: { id, status: existing.status }, data: { status: 'ARCHIVED', featured: false } });
    if (count === 0) throw new ConflictException({ message: 'This job was already acted on by someone else.', code: 'JOB_STATUS_CONFLICT' });
    await this.auditLog.record({ jobId: id, actorId: userId, action: 'ARCHIVED', fromStatus: existing.status, toStatus: 'ARCHIVED' });
    return this.findOne(id);
  }

  async setFeatured(id: string, featured: boolean, userId: string) {
    const existing = await this.prisma.job.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job not found');
    if (featured && existing.status !== 'PUBLISHED') {
      throw new BadRequestException('Only published jobs can be featured');
    }
    const updated = await this.prisma.job.update({ where: { id }, data: { featured }, select: JOB_LIST_SELECT });
    await this.auditLog.record({ jobId: id, actorId: userId, action: featured ? 'FEATURED' : 'UNFEATURED' });
    return updated;
  }

  async getAuditLog(id: string, page = 1, limit = 50) {
    const existing = await this.prisma.job.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Job not found');
    return this.auditLog.listForJob(id, page, limit);
  }

  // ==================== DASHBOARD ====================

  async getDashboardStats() {
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [draft, inReview, approved, scheduled, published, expired, archived, expiringSoon, totalApplications, pendingApplications] = await Promise.all([
      this.prisma.job.count({ where: { status: 'DRAFT' } }),
      this.prisma.job.count({ where: { status: 'IN_REVIEW' } }),
      this.prisma.job.count({ where: { status: 'APPROVED' } }),
      this.prisma.job.count({ where: { status: 'SCHEDULED' } }),
      this.prisma.job.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.job.count({ where: { status: 'EXPIRED' } }),
      this.prisma.job.count({ where: { status: 'ARCHIVED' } }),
      this.prisma.job.count({ where: { status: 'PUBLISHED', deadline: { gt: now, lte: soon } } }),
      this.prisma.jobApplication.count(),
      this.prisma.jobApplication.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    ]);
    return { draft, inReview, approved, scheduled, published, expired, archived, expiringSoon, totalApplications, pendingApplications };
  }

  // ==================== JOB CATEGORIES ====================

  async listCategories(includeInactive = false) {
    return this.prisma.jobCategory.findMany({
      where: includeInactive ? {} : { status: 'ACTIVE' },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { jobs: true } } },
    });
  }

  async createCategory(dto: CreateJobCategoryDto) {
    const slug = dto.slug || this.slugify(dto.name);
    const existing = await this.prisma.jobCategory.findUnique({ where: { slug } });
    if (existing) throw new BadRequestException('A job category with this slug already exists');
    return this.prisma.jobCategory.create({ data: { name: dto.name, slug, description: dto.description, sortOrder: dto.sortOrder ?? 0 } });
  }

  async updateCategory(id: string, dto: UpdateJobCategoryDto) {
    const existing = await this.prisma.jobCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job category not found');
    return this.prisma.jobCategory.update({ where: { id }, data: dto });
  }

  /** Soft-deactivate only — a category with existing jobs referencing it (RESTRICT FK) can never be
   * hard-deleted anyway; deactivating just hides it from the public filter/admin "create job" picker. */
  async deactivateCategory(id: string) {
    const existing = await this.prisma.jobCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job category not found');
    return this.prisma.jobCategory.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  // ==================== EMPLOYERS ====================

  async listEmployers(page = 1, limit = 20, search?: string, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      this.prisma.employer.findMany({ where, skip, take: limit, orderBy: { name: 'asc' }, include: { logo: { select: { publicUrl: true } }, location: { select: { name: true } }, _count: { select: { jobs: true } } } }),
      this.prisma.employer.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getEmployer(id: string) {
    const employer = await this.prisma.employer.findUnique({ where: { id }, include: { logo: true, location: true, _count: { select: { jobs: true } } } });
    if (!employer) throw new NotFoundException('Employer not found');
    return employer;
  }

  async createEmployer(dto: CreateEmployerDto, userId: string) {
    if (dto.logoMediaId) {
      const media = await this.prisma.media.findUnique({ where: { id: dto.logoMediaId } });
      if (!media) throw new BadRequestException('Logo media not found');
    }
    const slug = dto.slug || this.slugify(dto.name);
    const existing = await this.prisma.employer.findUnique({ where: { slug } });
    if (existing) throw new BadRequestException('An employer with this slug already exists');
    return this.prisma.employer.create({
      data: {
        name: dto.name, slug, logoMediaId: dto.logoMediaId, website: dto.website, description: dto.description,
        industry: dto.industry, locationId: dto.locationId, contactEmail: dto.contactEmail, contactPhone: dto.contactPhone,
        createdById: userId,
      },
    });
  }

  async updateEmployer(id: string, dto: UpdateEmployerDto) {
    const existing = await this.prisma.employer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employer not found');
    if (dto.logoMediaId) {
      const media = await this.prisma.media.findUnique({ where: { id: dto.logoMediaId } });
      if (!media) throw new BadRequestException('Logo media not found');
    }
    return this.prisma.employer.update({ where: { id }, data: dto });
  }

  // ==================== EMPLOYER VERIFICATION / SUSPENSION (Phase 2P, admin side) ====================

  /** Valid from PENDING (first review) or REJECTED (re-review after the employer addressed feedback) —
   * never from VERIFIED, so an already-verified company can't be silently re-decided through this
   * endpoint (an admin would have to suspend/reactivate instead, a deliberately separate action). */
  async verifyEmployer(id: string, decision: 'VERIFIED' | 'REJECTED', note: string | undefined, userId: string) {
    const existing = await this.prisma.employer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employer not found');
    if (existing.verificationStatus === 'VERIFIED') {
      throw new BadRequestException('This employer is already verified');
    }
    const updated = await this.prisma.employer.update({
      where: { id },
      data: { verificationStatus: decision, verifiedAt: new Date(), verifiedById: userId, verificationNote: note ?? null },
    });
    await this.employerAuditLog.record({
      employerId: id, actorId: userId, action: decision === 'VERIFIED' ? 'employer.verified' : 'employer.verification_rejected', note,
    });
    return updated;
  }

  async suspendEmployer(id: string, userId: string) {
    const existing = await this.prisma.employer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employer not found');
    if (existing.status === 'SUSPENDED') throw new BadRequestException('Employer is already suspended');
    const updated = await this.prisma.employer.update({ where: { id }, data: { status: 'SUSPENDED' } });
    await this.employerAuditLog.record({ employerId: id, actorId: userId, action: 'employer.suspended' });
    return updated;
  }

  async reactivateEmployer(id: string, userId: string) {
    const existing = await this.prisma.employer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employer not found');
    if (existing.status === 'ACTIVE') throw new BadRequestException('Employer is already active');
    const updated = await this.prisma.employer.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.employerAuditLog.record({ employerId: id, actorId: userId, action: 'employer.reactivated' });
    return updated;
  }

  async getEmployerAuditLog(id: string, page = 1, limit = 50) {
    const existing = await this.prisma.employer.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Employer not found');
    return this.employerAuditLog.listForEmployer(id, page, limit);
  }

  async getEmployerMembers(id: string) {
    const existing = await this.prisma.employer.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Employer not found');
    return this.prisma.employerMembership.findMany({
      where: { employerId: id, status: { not: 'REMOVED' } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ==================== APPLICATION MANAGEMENT (admin/staff side) ====================

  async listApplications(params: { page?: number; limit?: number; jobId?: string; status?: string; search?: string }) {
    const { page = 1, limit = 20, jobId, status, search } = params;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (jobId) where.jobId = jobId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { applicant: { name: { contains: search, mode: 'insensitive' } } },
        { applicant: { email: { contains: search, mode: 'insensitive' } } },
        { job: { title: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.jobApplication.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        select: {
          id: true, status: true, method: true, createdAt: true, updatedAt: true,
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

  async getApplication(id: string) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id },
      include: {
        applicant: { select: { id: true, name: true, email: true } },
        job: { select: { id: true, title: true, slug: true, status: true } },
        resume: true,
        reviewedBy: { select: { id: true, name: true } },
      },
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  /** Users can never self-assign SHORTLISTED/ACCEPTED/etc — every status change on this path is
   * staff-only (see JobApplicationsController's job_application.manage guard) and gets a JobAuditLog
   * entry against the job, satisfying "important application status changes" (Part 18). */
  async updateApplicationStatus(id: string, status: string, note: string | undefined, userId: string) {
    const existing = await this.prisma.jobApplication.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Application not found');
    if (existing.status === 'WITHDRAWN') {
      throw new BadRequestException('This application was withdrawn by the applicant and cannot be updated');
    }
    const updated = await this.prisma.jobApplication.update({
      where: { id },
      data: { status: status as any, reviewedById: userId, notes: note !== undefined ? note : undefined },
      include: { applicant: { select: { id: true, name: true } }, job: { select: { id: true, title: true } } },
    });
    await this.auditLog.record({
      jobId: existing.jobId, actorId: userId, action: 'APPLICATION_STATUS_CHANGED',
      fromStatus: existing.status, toStatus: status,
      note: `Application ${id} for ${updated.applicant.name}`,
    });
    return updated;
  }
}
