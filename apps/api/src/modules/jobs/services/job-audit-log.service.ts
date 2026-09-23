import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface RecordJobAuditEntryInput {
  jobId: string;
  actorId?: string | null;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
}

/** Same append-only "who did what, when" pattern as articles' AuditLogService — see that file for the
 * full rationale. Kept as its own service/table (JobAuditLog) rather than reusing ArticleAuditLog
 * because that table's articleId column is required and unrelated to jobs. */
@Injectable()
export class JobAuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordJobAuditEntryInput) {
    return this.prisma.jobAuditLog.create({
      data: {
        jobId: input.jobId,
        actorId: input.actorId ?? null,
        action: input.action,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        note: input.note ? input.note.slice(0, 2000) : null,
      },
    });
  }

  async listForJob(jobId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.jobAuditLog.findMany({
        where: { jobId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { actor: { select: { id: true, name: true } } },
      }),
      this.prisma.jobAuditLog.count({ where: { jobId } }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
