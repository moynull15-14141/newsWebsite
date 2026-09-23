import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface RecordEmployerAuditEntryInput {
  employerId?: string | null;
  actorId?: string | null;
  action: string;
  note?: string | null;
}

/** Same append-only "who did what, when" pattern as JobAuditLogService — see that file for the full
 * rationale. Kept as its own service/table (EmployerAuditLog) because it covers company/verification/
 * platform-wide events that are not scoped to a single job (a null employerId records a platform-wide
 * event, e.g. a feature-flag toggle). */
@Injectable()
export class EmployerAuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordEmployerAuditEntryInput) {
    return this.prisma.employerAuditLog.create({
      data: {
        employerId: input.employerId ?? null,
        actorId: input.actorId ?? null,
        action: input.action,
        note: input.note ? input.note.slice(0, 2000) : null,
      },
    });
  }

  async listForEmployer(employerId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.employerAuditLog.findMany({
        where: { employerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { actor: { select: { id: true, name: true } } },
      }),
      this.prisma.employerAuditLog.count({ where: { employerId } }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
