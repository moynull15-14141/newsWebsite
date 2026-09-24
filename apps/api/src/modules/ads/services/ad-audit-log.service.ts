import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface RecordAdAuditEntryInput {
  campaignId?: string | null;
  actorId?: string | null;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
}

/** Same append-only "who did what, when" pattern as EmployerAuditLogService/JobAuditLogService — see
 * those for the full rationale. A null campaignId records a placement-registry-level action. */
@Injectable()
export class AdAuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAdAuditEntryInput) {
    return this.prisma.adAuditLog.create({
      data: {
        campaignId: input.campaignId ?? null,
        actorId: input.actorId ?? null,
        action: input.action,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        note: input.note ? input.note.slice(0, 2000) : null,
      },
    });
  }

  async listForCampaign(campaignId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.adAuditLog.findMany({
        where: { campaignId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { actor: { select: { id: true, name: true } } },
      }),
      this.prisma.adAuditLog.count({ where: { campaignId } }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /** Platform-wide feed for the Ads > Audit Log admin page — every campaign's history plus
   * placement-registry-level entries (campaignId null), newest first. */
  async listAll(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.adAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          actor: { select: { id: true, name: true } },
          campaign: { select: { id: true, name: true } },
        },
      }),
      this.prisma.adAuditLog.count(),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
