import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmployerAuditLogService } from '../jobs/services/employer-audit-log.service';
import { PLATFORM_SETTING_KEYS } from './platform-settings.constants';

interface CacheEntry {
  value: any;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;

/** Thin key/value config store backing the employer/third-party job-posting platform's feature flags
 * (see PLATFORM_SETTING_KEYS). Every gated code path (employer-portal registration, job posting, paid
 * plans, ...) reads through `get`/`getMany` rather than querying PlatformSetting directly, so the 30s
 * in-memory cache below benefits every caller uniformly. A missing row is treated as "off"/disabled by
 * every boolean gate that calls this service — `get` returns `null` rather than throwing, so a fresh
 * environment that hasn't been seeded yet fails closed instead of 500ing. */
@Injectable()
export class PlatformSettingsService {
  private cache = new Map<string, CacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: EmployerAuditLogService,
  ) {}

  private readCache(key: string): { hit: boolean; value?: any } {
    const entry = this.cache.get(key);
    if (!entry || entry.expiresAt < Date.now()) return { hit: false };
    return { hit: true, value: entry.value };
  }

  private writeCache(key: string, value: any) {
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  private invalidate(key: string) {
    this.cache.delete(key);
  }

  async get(key: string): Promise<any> {
    const cached = this.readCache(key);
    if (cached.hit) return cached.value;
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    const value = row ? row.value : null;
    this.writeCache(key, value);
    return value;
  }

  async getMany(keys: string[]): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    await Promise.all(keys.map(async (key) => {
      result[key] = await this.get(key);
    }));
    return result;
  }

  /** Every known key (see PLATFORM_SETTING_KEYS), including ones with no row yet (returned as null). */
  async getAll(): Promise<Record<string, any>> {
    return this.getMany([...PLATFORM_SETTING_KEYS]);
  }

  async set(key: string, value: any, actorId: string | null) {
    const row = await this.prisma.platformSetting.upsert({
      where: { key },
      update: { value, updatedById: actorId ?? undefined },
      create: { key, value, updatedById: actorId ?? undefined },
    });
    this.invalidate(key);
    await this.auditLog.record({
      employerId: null,
      actorId,
      action: 'platform_setting.updated',
      note: `${key} -> ${JSON.stringify(value)}`,
    });
    return row;
  }
}
