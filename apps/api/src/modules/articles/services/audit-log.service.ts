import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface RecordAuditEntryInput {
  articleId: string;
  actorId?: string | null;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
}

/** Append-only "who did what to which article when" trail for newsroom governance (Phase 2H). */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEntryInput) {
    return this.prisma.articleAuditLog.create({
      data: {
        articleId: input.articleId,
        actorId: input.actorId ?? null,
        action: input.action,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        note: input.note ? input.note.slice(0, 2000) : null,
      },
    });
  }

  async listForArticle(articleId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.articleAuditLog.findMany({
        where: { articleId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { actor: { select: { id: true, name: true } } },
      }),
      this.prisma.articleAuditLog.count({ where: { articleId } }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
