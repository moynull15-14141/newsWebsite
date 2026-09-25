import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBreakingNewsDto } from './dto/create-breaking-news.dto';
import { UpdateBreakingNewsDto } from './dto/update-breaking-news.dto';
import { isPubliclyEligible } from '../articles/public-eligibility';

const ARTICLE_LINK_SELECT = { id: true, slug: true, title: true, status: true, publishedAt: true } as const;

@Injectable()
export class BreakingNewsService {
  constructor(private readonly prisma: PrismaService) {}

  private async recordAudit(breakingNewsId: string, actorId: string | null | undefined, action: string, note?: string) {
    await this.prisma.breakingNewsAuditLog.create({
      data: { breakingNewsId, actorId: actorId ?? null, action, note: note ? note.slice(0, 2000) : null },
    });
  }

  private async assertArticleExists(articleId: string | null | undefined) {
    if (!articleId) return;
    const article = await this.prisma.article.findUnique({ where: { id: articleId }, select: { id: true } });
    if (!article) throw new BadRequestException('Linked article not found.');
  }

  private assertScheduleWindow(startAt?: string | null, endAt?: string | null) {
    if (startAt && endAt && new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      throw new BadRequestException('End time must be after start time.');
    }
  }

  // ==================== ADMIN ====================

  /** Ordered exactly as the public ticker cycles them, so the admin table row order matches reality. */
  async findAll() {
    return this.prisma.breakingNews.findMany({
      where: { archivedAt: null },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include: { article: { select: ARTICLE_LINK_SELECT } },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.breakingNews.findUnique({
      where: { id },
      include: { article: { select: ARTICLE_LINK_SELECT } },
    });
    if (!item) throw new NotFoundException('Breaking news item not found');
    return item;
  }

  async create(dto: CreateBreakingNewsDto, actorId: string) {
    await this.assertArticleExists(dto.articleId);
    this.assertScheduleWindow(dto.startAt, dto.endAt);

    // Default a new item to the back of the queue rather than 0 — an admin adding a fourth headline
    // almost never means "make this the most important one by default."
    let priority = dto.priority;
    if (priority === undefined) {
      const last = await this.prisma.breakingNews.findFirst({ orderBy: { priority: 'desc' }, select: { priority: true } });
      priority = (last?.priority ?? 0) + 1;
    }

    const created = await this.prisma.breakingNews.create({
      data: {
        headline: dto.headline,
        articleId: dto.articleId ?? null,
        isActive: dto.isActive ?? false,
        priority,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        backgroundMode: dto.backgroundMode ?? 'SOLID',
        backgroundColor: dto.backgroundColor ?? '#D32F2F',
        gradientStart: dto.gradientStart ?? null,
        gradientEnd: dto.gradientEnd ?? null,
        gradientDirection: dto.gradientDirection ?? null,
        textColor: dto.textColor ?? '#FFFFFF',
        badgeBackgroundColor: dto.badgeBackgroundColor ?? '#FFFFFF',
        badgeTextColor: dto.badgeTextColor ?? '#D32F2F',
        animationSpeedMs: dto.animationSpeedMs ?? 18000,
        createdById: actorId,
        updatedById: actorId,
      },
      include: { article: { select: ARTICLE_LINK_SELECT } },
    });

    await this.recordAudit(created.id, actorId, 'CREATED', `Headline: ${created.headline}`);
    return created;
  }

  async update(id: string, dto: UpdateBreakingNewsDto, actorId: string) {
    const existing = await this.prisma.breakingNews.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Breaking news item not found');
    if (dto.articleId !== undefined) await this.assertArticleExists(dto.articleId);
    this.assertScheduleWindow(
      dto.startAt === undefined ? existing.startAt?.toISOString() : dto.startAt,
      dto.endAt === undefined ? existing.endAt?.toISOString() : dto.endAt,
    );

    const data: Record<string, unknown> = {};
    if (dto.headline !== undefined) data.headline = dto.headline;
    if (dto.articleId !== undefined) data.articleId = dto.articleId;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.startAt !== undefined) data.startAt = dto.startAt ? new Date(dto.startAt) : null;
    if (dto.endAt !== undefined) data.endAt = dto.endAt ? new Date(dto.endAt) : null;
    if (dto.backgroundMode !== undefined) data.backgroundMode = dto.backgroundMode;
    if (dto.backgroundColor !== undefined) data.backgroundColor = dto.backgroundColor;
    if (dto.gradientStart !== undefined) data.gradientStart = dto.gradientStart;
    if (dto.gradientEnd !== undefined) data.gradientEnd = dto.gradientEnd;
    if (dto.gradientDirection !== undefined) data.gradientDirection = dto.gradientDirection;
    if (dto.textColor !== undefined) data.textColor = dto.textColor;
    if (dto.badgeBackgroundColor !== undefined) data.badgeBackgroundColor = dto.badgeBackgroundColor;
    if (dto.badgeTextColor !== undefined) data.badgeTextColor = dto.badgeTextColor;
    if (dto.animationSpeedMs !== undefined) data.animationSpeedMs = dto.animationSpeedMs;
    data.updatedById = actorId;

    const updated = await this.prisma.breakingNews.update({
      where: { id },
      data,
      include: { article: { select: ARTICLE_LINK_SELECT } },
    });

    await this.recordAudit(id, actorId, 'UPDATED', `Changed: ${Object.keys(data).filter((k) => k !== 'updatedById').join(', ') || 'none'}`);
    return updated;
  }

  /** A real, permanent delete — unlike an article, a breaking-news item has no separate editorial
   * history worth preserving once removed; "Deactivate" already covers "take it off the ticker but keep
   * it around." Its own audit trail is cascade-deleted with it (BreakingNewsAuditLog.onDelete: Cascade),
   * same as a DRAFT article's revisions/audit log when hard-deleted. */
  async remove(id: string, actorId: string) {
    const existing = await this.prisma.breakingNews.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Breaking news item not found');
    await this.prisma.breakingNews.update({
      where: { id },
      data: { isActive: false, archivedAt: new Date(), updatedById: actorId },
    });
    await this.recordAudit(id, actorId, 'ARCHIVED');
    return { message: 'Breaking news item archived' };
  }

  async setActive(id: string, isActive: boolean, actorId: string) {
    const existing = await this.prisma.breakingNews.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Breaking news item not found');
    const updated = await this.prisma.breakingNews.update({ where: { id }, data: { isActive, updatedById: actorId } });
    await this.recordAudit(id, actorId, isActive ? 'ACTIVATED' : 'DEACTIVATED');
    return updated;
  }

  /** "Publish/start immediately" — turns it on right now regardless of any future startAt. */
  async publishNow(id: string, actorId: string) {
    const existing = await this.prisma.breakingNews.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Breaking news item not found');
    const updated = await this.prisma.breakingNews.update({
      where: { id },
      data: { isActive: true, startAt: new Date(), updatedById: actorId },
    });
    await this.recordAudit(id, actorId, 'PUBLISHED');
    return updated;
  }

  /** "Stop immediately" — distinct from a plain deactivate: it also closes out the schedule window
   * (endAt = now) so a later reactivation doesn't silently resume an old, already-ended run. */
  async stop(id: string, actorId: string) {
    const existing = await this.prisma.breakingNews.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Breaking news item not found');
    const updated = await this.prisma.breakingNews.update({
      where: { id },
      data: { isActive: false, endAt: new Date(), updatedById: actorId },
    });
    await this.recordAudit(id, actorId, 'STOPPED');
    return updated;
  }

  /** Schedule start/end only — `isActive` stays the admin's own on/off switch (an inactive item never
   * shows regardless of its schedule window; an active one is further gated by it). */
  async schedule(id: string, startAt: string | null, endAt: string | null, actorId: string) {
    const existing = await this.prisma.breakingNews.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Breaking news item not found');
    this.assertScheduleWindow(startAt, endAt);
    const updated = await this.prisma.breakingNews.update({
      where: { id },
      data: { startAt: startAt ? new Date(startAt) : null, endAt: endAt ? new Date(endAt) : null, updatedById: actorId },
    });
    await this.recordAudit(id, actorId, 'SCHEDULED', `startAt=${startAt ?? 'none'} endAt=${endAt ?? 'none'}`);
    return updated;
  }

  async reorder(orderedIds: string[], actorId: string) {
    const existing = await this.prisma.breakingNews.findMany({ where: { id: { in: orderedIds } }, select: { id: true } });
    if (existing.length !== orderedIds.length) {
      throw new BadRequestException('One or more breaking news ids do not exist.');
    }
    await this.prisma.$transaction(
      orderedIds.map((id, index) => this.prisma.breakingNews.update({ where: { id }, data: { priority: index + 1, updatedById: actorId } })),
    );
    for (const id of orderedIds) {
      await this.recordAudit(id, actorId, 'REORDERED');
    }
    return this.findAll();
  }

  // ==================== PUBLIC ====================

  /** The live ticker's own query: active, within its schedule window (or unscheduled), in display
   * order. A linked article that is no longer publicly eligible (draft/in-review/scheduled-not-yet/
   * archived/hard-deleted) has its link stripped rather than the whole item hidden — the headline is
   * the newsroom's own text, independent of the article's current workflow state, but the article's
   * page itself must never be reachable from here before it is genuinely public (Phase 2I). */
  async getActiveTicker() {
    const now = new Date();
    const items = await this.prisma.breakingNews.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include: { article: { select: ARTICLE_LINK_SELECT } },
    });

    return items.map((item) => {
      const eligible = item.article ? isPubliclyEligible(item.article, now) : false;
      return {
        id: item.id,
        headline: item.headline,
        articleSlug: eligible ? item.article!.slug : null,
        backgroundMode: item.backgroundMode,
        backgroundColor: item.backgroundColor,
        gradientStart: item.gradientStart,
        gradientEnd: item.gradientEnd,
        gradientDirection: item.gradientDirection,
        textColor: item.textColor,
        badgeBackgroundColor: item.badgeBackgroundColor,
        badgeTextColor: item.badgeTextColor,
        animationSpeedMs: item.animationSpeedMs,
      };
    });
  }

  // ------------------------------------------------------------------ ticker style (presentation)
  //
  // How the whole banner renders (chips / marquee / rotator) is a single global choice, stored as a
  // plain PlatformSetting row (the same generic key/value store EditorialService and
  // PlatformSettingsService each already use for their own, differently-scoped allowlists) rather than
  // a new table, gated by this module's own `breaking_news.manage` permission (not the site-wide
  // `settings.manage`, which the Admin role here doesn't hold).
  //
  // Chips keeps each BreakingNews row's own colors (that is what they're for). Marquee and Rotator each
  // have exactly ONE bar/badge on screen at a time with no natural "whose color wins" answer when
  // several items are active with different colors — so each gets its own dedicated color set, stored
  // here rather than derived from any one item. Headlines/links for those two styles still come from
  // whichever items are currently active; only the coloring is decoupled from the individual items.

  async getTickerSettings(): Promise<TickerSettings> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: TICKER_SETTINGS_KEY } });
    const stored = (row?.value ?? {}) as Partial<TickerSettings>;
    const style = typeof stored.style === 'string' && (TICKER_STYLES as readonly string[]).includes(stored.style) ? (stored.style as TickerStyle) : 'CHIPS';
    return {
      style,
      marquee: { ...DEFAULT_TICKER_COLORS, direction: DEFAULT_MARQUEE_DIRECTION, speedMs: DEFAULT_MARQUEE_SPEED_MS, ...stored.marquee },
      rotator: { ...DEFAULT_TICKER_COLORS, holdMs: DEFAULT_ROTATOR_HOLD_MS, ...stored.rotator },
    };
  }

  async updateTickerSettings(patch: Partial<TickerSettings>, updatedById: string): Promise<TickerSettings> {
    const current = await this.getTickerSettings();
    const next: TickerSettings = {
      style: patch.style ?? current.style,
      marquee: patch.marquee ? { ...current.marquee, ...patch.marquee } : current.marquee,
      rotator: patch.rotator ? { ...current.rotator, ...patch.rotator } : current.rotator,
    };
    await this.prisma.platformSetting.upsert({
      where: { key: TICKER_SETTINGS_KEY },
      update: { value: next as any, updatedById },
      create: { key: TICKER_SETTINGS_KEY, value: next as any, updatedById },
    });
    return next;
  }
}

const TICKER_SETTINGS_KEY = 'breakingNewsTickerSettings';
export const TICKER_STYLES = ['CHIPS', 'MARQUEE', 'ROTATOR'] as const;
export type TickerStyle = (typeof TICKER_STYLES)[number];

export interface TickerColors {
  backgroundMode: 'SOLID' | 'GRADIENT';
  backgroundColor: string;
  gradientStart: string | null;
  gradientEnd: string | null;
  gradientDirection: 'LEFT_RIGHT' | 'RIGHT_LEFT' | 'TOP_BOTTOM' | 'BOTTOM_TOP' | 'DIAGONAL' | null;
  textColor: string;
  badgeBackgroundColor: string;
  badgeTextColor: string;
}

/** Marquee-only: which way the headline text crawls. RTL (right edge in, left edge out) is the standard
 * news-ticker convention and the default; LTR is offered because some admins specifically want the
 * reversed motion (e.g. to match a brand's existing marquee elsewhere on the site). */
export const TICKER_DIRECTIONS = ['LTR', 'RTL'] as const;
export type TickerDirection = (typeof TICKER_DIRECTIONS)[number];

/** Marquee-only: how long one full pass of the crawling text takes. Its own setting, not derived from
 * any item's animationSpeedMs — that field was designed for the Chips style (each chip's own pace), and
 * summing several different items' speeds together made the marquee's pace an accident of how many
 * items happened to be active rather than a deliberate choice (same reasoning as Rotator's holdMs). */
export interface MarqueeSettings extends TickerColors {
  direction: TickerDirection;
  speedMs: number;
}

/** Rotator-only: how long each headline holds before fading to the next. Not on the shared TickerColors
 * shape — Marquee has nothing to "hold", it scrolls continuously — and deliberately not derived from any
 * item's own animationSpeedMs (that field means "how fast to scroll", which items were configured with
 * Chips/Marquee in mind, not "how long to display standing still"; same reasoning as colors above). */
export interface RotatorSettings extends TickerColors {
  holdMs: number;
}

export interface TickerSettings {
  style: TickerStyle;
  marquee: MarqueeSettings;
  rotator: RotatorSettings;
}

const DEFAULT_TICKER_COLORS: TickerColors = {
  backgroundMode: 'SOLID',
  backgroundColor: '#D32F2F',
  gradientStart: null,
  gradientEnd: null,
  gradientDirection: null,
  textColor: '#FFFFFF',
  badgeBackgroundColor: '#FFFFFF',
  badgeTextColor: '#D32F2F',
};

const DEFAULT_ROTATOR_HOLD_MS = 4000;
const DEFAULT_MARQUEE_DIRECTION: TickerDirection = 'RTL';
const DEFAULT_MARQUEE_SPEED_MS = 18000;
