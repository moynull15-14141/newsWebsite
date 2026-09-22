import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';

/** The scheduled-publishing sweep only — interactive publish/schedule/cancel/archive live on
 * ArticlesService (the canonical, permission- and audit-checked workflow entry points used by the
 * controller). This service used to duplicate those transitions with none of that enforcement; the
 * duplicates were dead code (never wired to any controller) and were removed in Phase 2H. */
@Injectable()
export class PublishingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async executeScheduledPublications() {
    const now = new Date();
    const scheduledArticles = await this.prisma.article.findMany({
      where: {
        status: 'APPROVED',
        scheduledAt: { lte: now },
      },
    });

    const published = [];
    for (const article of scheduledArticles) {
      try {
        // updateMany with the status re-asserted in the WHERE clause: if a manual "Publish Now" (or a
        // second overlapping sweep) already moved this article to PUBLISHED between the findMany above
        // and this write, `count` comes back 0 and this article is skipped instead of being published
        // twice or clobbering a fresher state (Phase 2I — "scheduler + manual publish simultaneously").
        const { count } = await this.prisma.article.updateMany({
          where: { id: article.id, status: 'APPROVED' },
          data: {
            status: 'PUBLISHED',
            publishedAt: now,
            scheduledAt: null,
          },
        });
        if (count === 0) continue;

        await this.auditLog.record({
          articleId: article.id,
          actorId: null,
          action: 'PUBLISHED',
          fromStatus: 'APPROVED',
          toStatus: 'PUBLISHED',
          note: 'Scheduled publication',
        });
        published.push({ ...article, status: 'PUBLISHED', publishedAt: now, scheduledAt: null });
      } catch (error) {
        console.error(`Failed to publish scheduled article ${article.id}:`, error);
      }
    }

    return published;
  }
}
