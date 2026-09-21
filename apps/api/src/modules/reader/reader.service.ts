import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReaderService {
  constructor(private readonly prisma: PrismaService) {}

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
        readerProfile: true,
        notificationPreference: true,
        preferenceCategories: { include: { category: true } },
        preferenceLocations: { include: { location: true } },
      },
    });
  }

  async updateProfile(userId: string, data: { displayName?: string; preferredLanguage?: string }) {
    await this.reader(userId);
    const profile = await this.prisma.readerProfile.upsert({
      where: { userId },
      update: { displayName: data.displayName?.trim(), preferredLanguage: data.preferredLanguage },
      create: { userId, displayName: data.displayName?.trim() || 'Reader', preferredLanguage: data.preferredLanguage || 'en' },
    });
    if (data.displayName?.trim()) await this.prisma.user.update({ where: { id: userId }, data: { name: data.displayName.trim() } });
    return profile;
  }

  async updatePreferences(userId: string, data: { categoryIds?: string[]; locationIds?: string[]; breakingNews?: boolean; categoryNews?: boolean; locationNews?: boolean }) {
    await this.reader(userId);
    await this.prisma.$transaction([
      ...(data.categoryIds ? [this.prisma.readerPreferenceCategory.deleteMany({ where: { userId } }), this.prisma.readerPreferenceCategory.createMany({ data: [...new Set(data.categoryIds)].map((categoryId) => ({ userId, categoryId })) })] : []),
      ...(data.locationIds ? [this.prisma.readerPreferenceLocation.deleteMany({ where: { userId } }), this.prisma.readerPreferenceLocation.createMany({ data: [...new Set(data.locationIds)].map((locationId) => ({ userId, locationId })) })] : []),
      this.prisma.notificationPreference.upsert({ where: { userId }, update: { breakingNews: data.breakingNews, categoryNews: data.categoryNews, locationNews: data.locationNews }, create: { userId, breakingNews: data.breakingNews ?? true, categoryNews: data.categoryNews ?? true, locationNews: data.locationNews ?? true } }),
    ]);
    return this.getProfile(userId);
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
