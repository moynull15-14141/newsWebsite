import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ArticleViewService {
  constructor(private readonly prisma: PrismaService) {}

  async recordView(articleId: string, sessionId?: string, fingerprint?: string) {
    // Basic deduplication: check if same session viewed this article in last 30 minutes
    if (fingerprint) {
      const recent = await this.prisma.articleView.findFirst({
        where: {
          articleId,
          fingerprint,
          viewedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
        },
      });
      if (recent) return { counted: false };
    }

    await this.prisma.articleView.create({
      data: { articleId, sessionId, fingerprint },
    });

    await this.prisma.article.update({
      where: { id: articleId },
      data: { viewCount: { increment: 1 } },
    });

    return { counted: true };
  }

  async getArticleViews(articleId: string, days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalViews, viewsToday, viewsLast7Days] = await Promise.all([
      this.prisma.articleView.count({ where: { articleId } }),
      this.prisma.articleView.count({ where: { articleId, viewedAt: { gte: today } } }),
      this.prisma.articleView.count({ where: { articleId, viewedAt: { gte: since } } }),
    ]);

    return { totalViews, viewsToday, viewsLast7Days };
  }
}
