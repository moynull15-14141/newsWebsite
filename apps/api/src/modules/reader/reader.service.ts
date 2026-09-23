import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { publicJobWhere } from '../jobs/job-eligibility';
import { StorageProvider } from '../../common/storage/storage.provider';

const RESUME_MIME_TYPES: Record<string, (buf: Buffer) => boolean> = {
  'application/pdf': (buf) => buf.length >= 4 && buf.toString('ascii', 0, 4) === '%PDF',
  'application/msword': (buf) => buf.length >= 4 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (buf) =>
    buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07),
};
const MAX_RESUME_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class ReaderService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('StorageProvider') private readonly storage: StorageProvider,
  ) {}

  private async reader(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId, accountType: 'READER' } });
    if (!user) throw new ForbiddenException('Reader account required');
    return user;
  }

  async getProfile(userId: string) {
    await this.reader(userId);
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, verifiedAt: true,
        createdAt: true,
        readerProfile: { include: { avatar: { select: { id: true, publicUrl: true, altText: true } } } },
        notificationPreference: true,
        preferenceCategories: { include: { category: true } },
        preferenceLocations: { include: { location: true } },
      },
    });
  }

  async updateProfile(userId: string, data: { displayName?: string; preferredLanguage?: string; phone?: string; bio?: string; location?: string; theme?: string; profilePublic?: boolean }) {
    await this.reader(userId);
    const profile = await this.prisma.readerProfile.upsert({
      where: { userId },
      update: { displayName: data.displayName?.trim(), preferredLanguage: data.preferredLanguage, phone: data.phone?.trim() || null, bio: data.bio?.trim() || null, location: data.location?.trim() || null, theme: data.theme, profilePublic: data.profilePublic },
      create: { userId, displayName: data.displayName?.trim() || 'Reader', preferredLanguage: data.preferredLanguage || 'en', phone: data.phone?.trim() || null, bio: data.bio?.trim() || null, location: data.location?.trim() || null, theme: data.theme || 'SYSTEM', profilePublic: data.profilePublic ?? false },
    });
    if (data.displayName?.trim()) await this.prisma.user.update({ where: { id: userId }, data: { name: data.displayName.trim() } });
    return profile;
  }

  async setAvatar(userId: string, avatarMediaId: string) {
    await this.reader(userId);
    const media = await this.prisma.media.findFirst({ where: { id: avatarMediaId, uploadedById: userId, mimeType: { in: ['image/jpeg', 'image/png', 'image/webp'] } } });
    if (!media) throw new BadRequestException('Valid uploaded avatar image required');
    await this.prisma.readerProfile.upsert({ where: { userId }, update: { avatarMediaId }, create: { userId, displayName: 'Reader', avatarMediaId } });
    return { id: media.id, publicUrl: media.publicUrl, altText: media.altText };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.reader(userId);
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new ForbiddenException('Current password is incorrect');
    if (await bcrypt.compare(newPassword, user.passwordHash)) throw new BadRequestException('New password must be different');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } }),
      this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { message: 'Password changed. Please sign in again.' };
  }

  async updatePreferences(userId: string, data: { categoryIds?: string[]; locationIds?: string[]; breakingNews?: boolean; categoryNews?: boolean; locationNews?: boolean; jobAlerts?: boolean; accountSecurity?: boolean }) {
    await this.reader(userId);
    await this.prisma.$transaction([
      ...(data.categoryIds ? [this.prisma.readerPreferenceCategory.deleteMany({ where: { userId } }), this.prisma.readerPreferenceCategory.createMany({ data: [...new Set(data.categoryIds)].map((categoryId) => ({ userId, categoryId })) })] : []),
      ...(data.locationIds ? [this.prisma.readerPreferenceLocation.deleteMany({ where: { userId } }), this.prisma.readerPreferenceLocation.createMany({ data: [...new Set(data.locationIds)].map((locationId) => ({ userId, locationId })) })] : []),
      this.prisma.notificationPreference.upsert({ where: { userId }, update: { breakingNews: data.breakingNews, categoryNews: data.categoryNews, locationNews: data.locationNews, jobAlerts: data.jobAlerts, accountSecurity: data.accountSecurity }, create: { userId, breakingNews: data.breakingNews ?? true, categoryNews: data.categoryNews ?? true, locationNews: data.locationNews ?? true, jobAlerts: data.jobAlerts ?? false, accountSecurity: data.accountSecurity ?? true } }),
    ]);
    return this.getProfile(userId);
  }

  async bookmarkStatus(userId: string, articleId: string) {
    await this.reader(userId);
    return { saved: !!(await this.prisma.bookmark.findUnique({ where: { userId_articleId: { userId, articleId } }, select: { id: true } })) };
  }

  async addBookmark(userId: string, articleId: string) {
    await this.reader(userId);
    const article = await this.prisma.article.findFirst({ where: { id: articleId, status: 'PUBLISHED', OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] } });
    if (!article) throw new NotFoundException('Published article not found');
    return this.prisma.bookmark.upsert({ where: { userId_articleId: { userId, articleId } }, update: {}, create: { userId, articleId }, include: { article: { select: { id: true, title: true, slug: true, excerpt: true, publishedAt: true, viewCount: true } } } });
  }

  async removeBookmark(userId: string, articleId: string) {
    await this.reader(userId);
    await this.prisma.bookmark.deleteMany({ where: { userId, articleId } });
    return { message: 'Bookmark removed' };
  }

  async getBookmarks(userId: string, page = 1, limit = 20) {
    await this.reader(userId);
    const where = { userId, article: { status: 'PUBLISHED' as const, OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] } };
    const [data, total] = await Promise.all([
      this.prisma.bookmark.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { article: { select: { id: true, title: true, slug: true, excerpt: true, publishedAt: true, viewCount: true, category: { select: { name: true, slug: true } } } } } }),
      this.prisma.bookmark.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getFeed(userId: string, limit = 20) {
    await this.reader(userId);
    const preferences = await this.prisma.user.findUnique({ where: { id: userId }, select: { preferenceCategories: { select: { categoryId: true } }, preferenceLocations: { select: { locationId: true } } } });
    const categoryIds = preferences?.preferenceCategories.map((item) => item.categoryId) || [];
    const locationIds = preferences?.preferenceLocations.map((item) => item.locationId) || [];
    return this.prisma.article.findMany({
      where: { status: 'PUBLISHED', OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }], AND: [{ OR: [{ categoryId: { in: categoryIds.length ? categoryIds : ['__none__'] } }, { locationId: { in: locationIds.length ? locationIds : ['__none__'] } }, { publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }] }] },
      take: limit,
      orderBy: [{ publishedAt: 'desc' }, { viewCount: 'desc' }],
      select: { id: true, title: true, slug: true, excerpt: true, publishedAt: true, viewCount: true, category: { select: { name: true, slug: true } }, location: { select: { name: true, slug: true } } },
    });
  }

  async getNotifications(userId: string, page = 1, limit = 20) {
    await this.reader(userId);
    const where = { userId };
    const [data, total, unread] = await Promise.all([
      this.prisma.notification.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { article: { select: { title: true, slug: true } } } }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { data, unread, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async markNotificationRead(userId: string, id: string) {
    await this.reader(userId);
    await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    return { message: 'Notification marked as read' };
  }

  async markAllNotificationsRead(userId: string) {
    await this.reader(userId);
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { message: 'Notifications marked as read' };
  }

  // ==================== SAVED JOBS (Phase 2O) — same shape as bookmarks above ====================

  async savedJobStatus(userId: string, jobId: string) {
    await this.reader(userId);
    return { saved: !!(await this.prisma.savedJob.findUnique({ where: { userId_jobId: { userId, jobId } }, select: { id: true } })) };
  }

  async addSavedJob(userId: string, jobId: string) {
    await this.reader(userId);
    const job = await this.prisma.job.findFirst({ where: { id: jobId, ...publicJobWhere() } });
    if (!job) throw new NotFoundException('Published job not found');
    return this.prisma.savedJob.upsert({
      where: { userId_jobId: { userId, jobId } },
      update: {},
      create: { userId, jobId },
      include: { job: { select: { id: true, title: true, slug: true, deadline: true, employer: { select: { name: true } } } } },
    });
  }

  async removeSavedJob(userId: string, jobId: string) {
    await this.reader(userId);
    await this.prisma.savedJob.deleteMany({ where: { userId, jobId } });
    return { message: 'Saved job removed' };
  }

  async getSavedJobs(userId: string, page = 1, limit = 20) {
    await this.reader(userId);
    const where = { userId };
    const [data, total] = await Promise.all([
      this.prisma.savedJob.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: { job: { select: { id: true, title: true, slug: true, status: true, deadline: true, employmentType: true, employer: { select: { name: true, slug: true } }, location: { select: { name: true } } } } },
      }),
      this.prisma.savedJob.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ==================== RESUME FOUNDATION (Phase 2O) ====================

  async uploadResume(userId: string, file: Express.Multer.File) {
    await this.reader(userId);
    if (!file) throw new BadRequestException('A resume file is required');
    const signatureCheck = RESUME_MIME_TYPES[file.mimetype];
    if (!signatureCheck) throw new BadRequestException('Invalid file type. Allowed: PDF, DOC, DOCX');
    if (file.size > MAX_RESUME_SIZE) throw new BadRequestException(`File too large. Maximum size: ${MAX_RESUME_SIZE / 1024 / 1024}MB`);
    if (!file.buffer || !signatureCheck(file.buffer)) throw new BadRequestException('File content does not match a supported resume format.');

    const extByMime: Record<string, string> = { 'application/pdf': '.pdf', 'application/msword': '.doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx' };
    const key = `resumes/${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}${extByMime[file.mimetype]}`;
    const result = await this.storage.upload(file, key);

    const existingCount = await this.prisma.resume.count({ where: { userId } });
    return this.prisma.resume.create({
      data: {
        userId,
        fileName: file.originalname.slice(0, 200),
        storageKey: result.key,
        publicUrl: result.url,
        mimeType: file.mimetype,
        size: file.size,
        isDefault: existingCount === 0,
      },
    });
  }

  async listResumes(userId: string) {
    await this.reader(userId);
    return this.prisma.resume.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  }

  async setDefaultResume(userId: string, resumeId: string) {
    await this.reader(userId);
    const resume = await this.prisma.resume.findFirst({ where: { id: resumeId, userId } });
    if (!resume) throw new NotFoundException('Resume not found');
    await this.prisma.$transaction([
      this.prisma.resume.updateMany({ where: { userId }, data: { isDefault: false } }),
      this.prisma.resume.update({ where: { id: resumeId }, data: { isDefault: true } }),
    ]);
    return { message: 'Default resume updated' };
  }

  async deleteResume(userId: string, resumeId: string) {
    await this.reader(userId);
    const resume = await this.prisma.resume.findFirst({ where: { id: resumeId, userId } });
    if (!resume) throw new NotFoundException('Resume not found');
    await this.storage.delete(resume.storageKey).catch(() => undefined);
    await this.prisma.resume.delete({ where: { id: resumeId } });
    if (resume.isDefault) {
      const next = await this.prisma.resume.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      if (next) await this.prisma.resume.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { message: 'Resume deleted' };
  }

  // ==================== JOB APPLICATIONS (Phase 2O, applicant side) ====================

  /** Only ever called for INTERNAL jobs — EXTERNAL_URL/EMAIL jobs never reach this: the public job
   * detail page renders "Apply on Employer Website"/a mailto: link instead of the internal form for
   * those, and this method independently re-verifies the method server-side rather than trusting the
   * client's own branching. */
  async applyToJob(userId: string, jobId: string, data: { resumeId?: string; coverLetter?: string }) {
    await this.reader(userId);
    const job = await this.prisma.job.findFirst({ where: { id: jobId, ...publicJobWhere() } });
    if (!job) throw new NotFoundException('Published job not found');
    if (job.applicationMethod !== 'INTERNAL') {
      throw new BadRequestException('This job does not accept applications on this platform');
    }
    if (data.resumeId) {
      const resume = await this.prisma.resume.findFirst({ where: { id: data.resumeId, userId } });
      if (!resume) throw new BadRequestException('Resume not found');
    }

    try {
      return await this.prisma.jobApplication.create({
        data: { jobId, applicantId: userId, resumeId: data.resumeId, coverLetter: data.coverLetter?.slice(0, 5000), method: 'INTERNAL' },
        include: { job: { select: { id: true, title: true, slug: true } } },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new BadRequestException('You have already applied to this job');
      throw error;
    }
  }

  async getMyApplications(userId: string, page = 1, limit = 20) {
    await this.reader(userId);
    const where = { applicantId: userId };
    const [data, total] = await Promise.all([
      this.prisma.jobApplication.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        select: {
          id: true, status: true, method: true, createdAt: true, updatedAt: true,
          job: { select: { id: true, title: true, slug: true, status: true, deadline: true, employer: { select: { name: true, slug: true } } } },
        },
      }),
      this.prisma.jobApplication.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getMyApplication(userId: string, applicationId: string) {
    await this.reader(userId);
    // Internal notes (staff-only) are deliberately excluded from this select — an applicant must never
    // see them, regardless of what the admin-side query returns.
    const application = await this.prisma.jobApplication.findFirst({
      where: { id: applicationId, applicantId: userId },
      select: {
        id: true, status: true, method: true, coverLetter: true, createdAt: true, updatedAt: true,
        job: { select: { id: true, title: true, slug: true, status: true, deadline: true, employer: { select: { name: true, slug: true } } } },
        resume: { select: { id: true, fileName: true, publicUrl: true } },
      },
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  async withdrawApplication(userId: string, applicationId: string) {
    await this.reader(userId);
    const application = await this.prisma.jobApplication.findFirst({ where: { id: applicationId, applicantId: userId } });
    if (!application) throw new NotFoundException('Application not found');
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(application.status)) {
      throw new BadRequestException('This application can no longer be withdrawn');
    }
    return this.prisma.jobApplication.update({ where: { id: applicationId }, data: { status: 'WITHDRAWN' } });
  }
}

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async createBreakingNotification(articleId: string, title: string) {
    try {
      const readers = await this.prisma.user.findMany({ where: { accountType: 'READER', status: 'ACTIVE', verifiedAt: { not: null }, notificationPreference: { breakingNews: true } }, select: { id: true } });
      if (!readers.length) return { count: 0 };
      const result = await this.prisma.notification.createMany({ data: readers.map(({ id }) => ({ userId: id, articleId, type: 'BREAKING_NEWS' as const, title: 'Breaking News', body: title })) });
      return { count: result.count };
    } catch (error) {
      console.error('Notification creation failed', error);
      return { count: 0 };
    }
  }
}

@Injectable()
export class NewsletterService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(email: string) {
    const normalized = email.trim().toLowerCase();
    const existing = await this.prisma.newsletterSubscriber.findUnique({ where: { email: normalized } });
    if (existing) {
      if (existing.status !== 'ACTIVE') return this.prisma.newsletterSubscriber.update({ where: { email: normalized }, data: { status: 'ACTIVE', unsubscribedAt: null, subscribedAt: new Date() } });
      return existing;
    }
    return this.prisma.newsletterSubscriber.create({ data: { email: normalized, status: 'ACTIVE', verifiedAt: new Date() } });
  }

  async unsubscribe(email: string) {
    await this.prisma.newsletterSubscriber.updateMany({ where: { email: email.trim().toLowerCase() }, data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() } });
    return { message: 'If the subscription exists, it has been unsubscribed.' };
  }
}
