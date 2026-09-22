import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { articleLanguageWhere, LanguageFilter } from '../../../common/i18n/article-language';

@Injectable()
export class MostReadService {
  constructor(private readonly prisma: PrismaService) {}

  async getMostRead(options: { limit?: number; window?: 'today' | '24h' | '7d'; language?: LanguageFilter } = {}) {
    const { limit = 10, window: timeWindow = '24h', language } = options;
    const now = new Date();
    let since: Date;

    switch (timeWindow) {
      case 'today':
        since = new Date(now);
        since.setHours(0, 0, 0, 0);
        break;
      case '7d':
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '24h':
      default:
        since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
    }

    // Get articles with view counts in the time window
    const articles = await this.prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        ...(language ? articleLanguageWhere(language) : {}),
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        viewCount: true,
        author: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, slug: true } },
        location: { select: { id: true, name: true, slug: true, type: true } },
        views: {
          where: { viewedAt: { gte: since } },
          select: { id: true },
        },
      },
      orderBy: { viewCount: 'desc' },
      take: limit * 3, // Get more to sort by window views
    });

    // Sort by views in the time window, then by total views as tiebreaker
    const sorted = articles
      .map((article) => ({
        ...article,
        windowViews: article.views.length,
      }))
      .sort((a, b) => b.windowViews - a.windowViews || b.viewCount - a.viewCount)
      .slice(0, limit);

    return sorted.map(({ views, windowViews, ...article }) => ({
      ...article,
      recentViews: windowViews,
    }));
  }
}
