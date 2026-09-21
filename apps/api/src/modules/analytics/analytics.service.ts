import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async trackEvent(eventType: string, data: { articleId?: string; categoryId?: string; locationId?: string; adId?: string; sessionId?: string; metadata?: any }) {
    return this.prisma.analyticsEvent.create({
      data: { eventType, ...data },
    });
  }

  async getOverview(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalViews, viewsToday, totalComments, commentsToday,
      totalAds, activeAds, adImpressions, adClicks,
      publishedArticles,
    ] = await Promise.all([
      this.prisma.articleView.count({ where: { viewedAt: { gte: since } } }),
      this.prisma.articleView.count({ where: { viewedAt: { gte: today } } }),
      this.prisma.comment.count({ where: { status: 'APPROVED', createdAt: { gte: since } } }),
      this.prisma.comment.count({ where: { status: 'APPROVED', createdAt: { gte: today } } }),
      this.prisma.ad.count(),
      this.prisma.ad.count({ where: { status: 'ACTIVE' } }),
      this.prisma.adImpression.count({ where: { createdAt: { gte: since } } }),
      this.prisma.adClick.count({ where: { createdAt: { gte: since } } }),
      this.prisma.article.count({ where: { status: 'PUBLISHED' } }),
    ]);

    return {
      totalViews, viewsToday, totalComments, commentsToday,
      totalAds, activeAds, adImpressions, adClicks,
      publishedArticles,
    };
  }

  async getTopContent(days = 30, limit = 10) {
    const articles = await this.prisma.article.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { viewCount: 'desc' },
      take: limit,
      select: {
        id: true, title: true, slug: true, viewCount: true, publishedAt: true,
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { comments: { where: { status: 'APPROVED' } } } },
      },
    });

    return articles.map((a) => ({
      ...a,
      commentCount: a._count.comments,
      _count: undefined,
    }));
  }

  async getTopCategories(limit = 10) {
    const categories = await this.prisma.category.findMany({
      where: { status: 'ACTIVE' },
      include: {
        _count: { select: { articles: { where: { status: 'PUBLISHED' } } } },
      },
      orderBy: { articles: { _count: 'desc' } },
      take: limit,
    });

    const result = [];
    for (const cat of categories) {
      const views = await this.prisma.article.aggregate({
        where: { categoryId: cat.id, status: 'PUBLISHED' },
        _sum: { viewCount: true },
      });
      result.push({
        id: cat.id, name: cat.name, slug: cat.slug,
        articleCount: cat._count.articles,
        totalViews: views._sum.viewCount || 0,
      });
    }
    return result;
  }

  async getTopLocations(limit = 10) {
    const locations = await this.prisma.location.findMany({
      where: { status: 'ACTIVE' },
      include: {
        _count: { select: { articles: { where: { status: 'PUBLISHED' } } } },
      },
      orderBy: { articles: { _count: 'desc' } },
      take: limit,
    });

    const result = [];
    for (const loc of locations) {
      const views = await this.prisma.article.aggregate({
        where: { locationId: loc.id, status: 'PUBLISHED' },
        _sum: { viewCount: true },
      });
      result.push({
        id: loc.id, name: loc.name, slug: loc.slug, type: loc.type,
        articleCount: loc._count.articles,
        totalViews: views._sum.viewCount || 0,
      });
    }
    return result;
  }

  async getSearchAnalytics(limit = 20) {
    const events = await this.prisma.analyticsEvent.groupBy({
      by: ['metadata'],
      where: { eventType: 'SEARCH' },
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });
    return events;
  }
}
