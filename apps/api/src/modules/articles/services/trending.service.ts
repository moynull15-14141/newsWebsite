import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { articleLanguageWhere, LanguageFilter } from '../../../common/i18n/article-language';

@Injectable()
export class TrendingService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrending(options: { limit?: number; locationSlug?: string; language?: LanguageFilter } = {}) {
    const { limit = 10, locationSlug, language } = options;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const where: any = {
      status: 'PUBLISHED',
      publishedAt: { gte: sevenDaysAgo },
      ...(language ? articleLanguageWhere(language) : {}),
    };

    if (locationSlug) {
      const location = await this.prisma.location.findFirst({ where: { slug: locationSlug } });
      if (location) {
        const childLocations = await this.prisma.location.findMany({
          where: { parentId: location.id },
          select: { id: true },
        });
        const locationIds = [location.id, ...childLocations.map((l) => l.id)];
        where.locationId = { in: locationIds };
      }
    }

    const articles = await this.prisma.article.findMany({
      where,
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
        media: { select: { id: true, publicUrl: true, altText: true, width: true, height: true } },
      },
    });

    // Calculate trending score: recent views × recency factor
    const now = Date.now();
    const scored = articles.map((article) => {
      const ageHours = article.publishedAt
        ? (now - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60)
        : 999;
      // Recency factor: newer articles get higher multiplier
      const recencyFactor = Math.max(0.1, 1 - ageHours / 168); // 168 hours = 7 days
      // View factor: normalize against max views
      const viewFactor = Math.log10(article.viewCount + 1);
      const score = viewFactor * recencyFactor * 100;
      return { ...article, trendingScore: Math.round(score * 100) / 100 };
    });

    scored.sort((a, b) => b.trendingScore - a.trendingScore);

    return scored.slice(0, limit);
  }
}
