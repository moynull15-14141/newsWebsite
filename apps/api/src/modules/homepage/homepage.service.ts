import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { isPubliclyEligible } from '../articles/public-eligibility';
import { PublicService } from '../public/public.service';
import {
  CreateHomepageSectionDto,
  ReorderHomepageSectionsDto,
  SetHomepagePlacementsDto,
  UpdateHomepageSectionDto,
} from './dto/homepage.dto';
import {
  DEFAULT_LAYOUT_PRESET,
  DEFAULT_SECTION_ITEMS,
  HERO_MAX_PLACEMENTS,
  HOMEPAGE_LAYOUT_PRESETS,
  isRepeatableType,
  MAX_SECTIONS_PER_CONFIGURATION,
  singletonKey,
} from './homepage.constants';
import { loadConfiguredSections } from './homepage.serializer';
import {
  configurationSignature,
  HomepageIssue,
  PLACEMENT_ISSUE_CODES,
  validateHomepageSections,
} from './homepage.validation';

type Tx = Prisma.TransactionClient;

/**
 * Article fields the admin builder shows for a placement (and that eligibility needs: status, publishedAt).
 * Thumbnail, category and author let editors recognise stories without opening them.
 */
const ARTICLE_SUMMARY_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
  publishedAt: true,
  media: { select: { id: true, publicUrl: true, altText: true } },
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, name: true } },
} as const;
const SECTION_ORDER = [{ sortOrder: 'asc' as const }, { id: 'asc' as const }];
const SECTION_VIEW_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  placements: { orderBy: { sortOrder: 'asc' as const }, include: { article: { select: ARTICLE_SUMMARY_SELECT } } },
} satisfies Prisma.HomepageSectionInclude;

type SectionWithPlacements = Prisma.HomepageSectionGetPayload<{ include: typeof SECTION_VIEW_INCLUDE }>;

const TX_OPTIONS = { timeout: 15_000, maxWait: 5_000 };

/**
 * Homepage curation with a hard draft/active boundary.
 *
 *   ACTIVE configuration  – the only thing GET /public/homepage reads.
 *   DRAFT configuration   – the single persistent working copy; every editor mutation targets it.
 *
 * Invariants (see prisma/schema.prisma HomepageConfiguration):
 *   - at most one ACTIVE and one DRAFT row (unique index on status);
 *   - every draft mutation is a compare-and-swap on DRAFT.version inside one transaction, so a stale
 *     editor gets HTTP 409 and a failed mutation leaves no partial state;
 *   - publish() validates the whole draft and then replaces the ACTIVE sections in ONE transaction;
 *     if anything fails the previous ACTIVE configuration is untouched.
 * After a publish the draft stays as-is (it now equals ACTIVE) and remains the editable working copy.
 */
@Injectable()
export class HomepageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicService: PublicService,
  ) {}

  // ------------------------------------------------------------------ reads

  /** Read-only view of what is currently live. */
  async getActive() {
    const active = await this.prisma.homepageConfiguration.findUnique({ where: { status: 'ACTIVE' } });
    if (!active) return { id: null, status: 'ACTIVE' as const, version: 0, publishedAt: null, updatedAt: null, sections: [] };
    const sections = await this.loadSections(this.prisma, active.id);
    return {
      id: active.id,
      status: 'ACTIVE' as const,
      version: active.version,
      publishedAt: active.publishedAt,
      updatedAt: active.updatedAt,
      sections: sections.map((section) => this.toSectionView(section)),
    };
  }

  /** The editable draft, with publish readiness (`issues`) and whether it differs from the live homepage. */
  async getDraft() {
    return this.prisma.$transaction(async (tx) => {
      const draft = await this.ensureDraft(tx);
      return this.buildDraftView(tx, draft.id);
    }, TX_OPTIONS);
  }

  /**
   * Renders the DRAFT with the same composition as the public homepage (same serializer, same fallback,
   * trending/most-read/breaking stay algorithmic). Only reachable through the protected controller.
   */
  async previewDraft() {
    await this.prisma.$transaction((tx) => this.ensureDraft(tx), TX_OPTIONS);
    const { configuration, sections } = await loadConfiguredSections(this.prisma, 'DRAFT');
    const content = await this.publicService.buildHomepage(sections);
    return {
      ...content,
      preview: {
        status: 'DRAFT' as const,
        configurationId: configuration?.id ?? null,
        version: configuration?.version ?? null,
        updatedAt: configuration?.updatedAt ?? null,
        source: sections.length ? ('CONFIGURED' as const) : ('FALLBACK' as const),
      },
    };
  }

  // ------------------------------------------------------- draft mutations

  async createSection(dto: CreateHomepageSectionDto) {
    return this.mutateDraft(dto.expectedVersion, async (tx, draft) => {
      const existing = await tx.homepageSection.findMany({ where: { configurationId: draft.id }, select: { type: true } });
      if (existing.length >= MAX_SECTIONS_PER_CONFIGURATION) {
        throw this.badRequest('HOMEPAGE_SECTION_LIMIT', `A homepage can have at most ${MAX_SECTIONS_PER_CONFIGURATION} sections.`);
      }
      if (!isRepeatableType(dto.type) && existing.some((section) => section.type === dto.type)) {
        throw this.badRequest(
          dto.type === 'HERO' ? 'HERO_MULTIPLE' : 'DUPLICATE_SECTION_TYPE',
          dto.type === 'HERO' ? 'The draft already has a HERO section.' : `The draft already has a ${dto.type} section.`,
        );
      }
      await this.assertLinksExist(tx, dto.categoryId, dto.locationId);

      await tx.homepageSection.create({
        data: {
          configurationId: draft.id,
          type: dto.type,
          key: isRepeatableType(dto.type) ? `${dto.type.toLowerCase()}-${randomUUID().slice(0, 8)}` : singletonKey(dto.type),
          title: dto.title,
          enabled: dto.enabled ?? true,
          sortOrder: existing.length,
          categoryId: dto.categoryId ?? null,
          locationId: dto.locationId ?? null,
          maxItems: dto.type === 'HERO' ? HERO_MAX_PLACEMENTS : (dto.maxItems ?? DEFAULT_SECTION_ITEMS),
          layoutType: dto.layoutType ?? DEFAULT_LAYOUT_PRESET,
        },
      });
      return this.buildDraftView(tx, draft.id);
    });
  }

  async updateSection(id: string, dto: UpdateHomepageSectionDto) {
    return this.mutateDraft(dto.expectedVersion, async (tx, draft) => {
      const section = await this.findDraftSection(tx, draft.id, id);
      const data: Prisma.HomepageSectionUpdateInput = {};

      if (dto.title !== undefined) data.title = dto.title;
      if (dto.enabled !== undefined) data.enabled = dto.enabled;
      if (dto.layoutType !== undefined) data.layoutType = dto.layoutType;
      if (dto.maxItems !== undefined) {
        if (section.type === 'HERO' && dto.maxItems !== HERO_MAX_PLACEMENTS) {
          throw this.badRequest('HERO_PLACEMENT_LIMIT', `The HERO section always shows exactly ${HERO_MAX_PLACEMENTS} article.`);
        }
        const placed = await tx.homepagePlacement.count({ where: { sectionId: id } });
        if (dto.maxItems < placed) {
          throw this.badRequest('PLACEMENT_LIMIT_EXCEEDED', `${placed} articles are placed in this section; remove some before lowering maxItems to ${dto.maxItems}.`);
        }
        data.maxItems = dto.maxItems;
      }
      if (dto.categoryId !== undefined || dto.locationId !== undefined) {
        await this.assertLinksExist(tx, dto.categoryId, dto.locationId);
        if (dto.categoryId !== undefined) data.category = dto.categoryId ? { connect: { id: dto.categoryId } } : { disconnect: true };
        if (dto.locationId !== undefined) data.location = dto.locationId ? { connect: { id: dto.locationId } } : { disconnect: true };
      }

      await tx.homepageSection.update({ where: { id }, data });
      return this.buildDraftView(tx, draft.id);
    });
  }

  async deleteSection(id: string, expectedVersion: number) {
    return this.mutateDraft(expectedVersion, async (tx, draft) => {
      await this.findDraftSection(tx, draft.id, id);
      await tx.homepageSection.delete({ where: { id } }); // placements cascade
      const remaining = await tx.homepageSection.findMany({ where: { configurationId: draft.id }, orderBy: SECTION_ORDER, select: { id: true, sortOrder: true } });
      for (const [index, section] of remaining.entries()) {
        if (section.sortOrder !== index) await tx.homepageSection.update({ where: { id: section.id }, data: { sortOrder: index } });
      }
      return this.buildDraftView(tx, draft.id);
    });
  }

  /** Batch reorder: `sectionIds` is the complete desired order; sortOrder is re-derived as 0..n-1. */
  async reorderSections(dto: ReorderHomepageSectionsDto) {
    return this.mutateDraft(dto.expectedVersion, async (tx, draft) => {
      const current = await tx.homepageSection.findMany({ where: { configurationId: draft.id }, select: { id: true } });
      const currentIds = new Set(current.map((section) => section.id));
      const requested = dto.sectionIds;
      const requestedSet = new Set(requested);

      const duplicates = [...new Set(requested.filter((id, index) => requested.indexOf(id) !== index))];
      const foreign = requested.filter((id) => !currentIds.has(id));
      const missing = [...currentIds].filter((id) => !requestedSet.has(id));
      if (duplicates.length || foreign.length || missing.length) {
        throw this.badRequest('HOMEPAGE_REORDER_INVALID', 'sectionIds must list every section of the current draft exactly once.', { duplicates, foreign, missing });
      }

      for (const [index, id] of requested.entries()) {
        await tx.homepageSection.update({ where: { id }, data: { sortOrder: index } });
      }
      return this.buildDraftView(tx, draft.id);
    });
  }

  /** Transactional replacement of one section's ordered placements. Only eligible, public articles are accepted. */
  async setPlacements(sectionId: string, dto: SetHomepagePlacementsDto) {
    return this.mutateDraft(dto.expectedVersion, async (tx, draft) => {
      const section = await this.findDraftSection(tx, draft.id, sectionId);
      const articleIds = dto.articleIds;
      const articles = articleIds.length
        ? await tx.article.findMany({ where: { id: { in: articleIds } }, select: ARTICLE_SUMMARY_SELECT })
        : [];
      const byId = new Map(articles.map((article) => [article.id, article]));

      const issues = validateHomepageSections([
        {
          key: section.key,
          type: section.type,
          title: section.title,
          layoutType: section.layoutType,
          maxItems: section.maxItems,
          placements: articleIds.map((articleId) => ({ articleId, article: byId.get(articleId) ?? null })),
        },
      ]).filter((issue) => PLACEMENT_ISSUE_CODES.has(issue.code));
      if (issues.length) {
        throw this.badRequest('HOMEPAGE_PLACEMENT_INVALID', 'Some articles cannot be placed in this section.', { issues });
      }

      await tx.homepagePlacement.deleteMany({ where: { sectionId } });
      if (articleIds.length) {
        await tx.homepagePlacement.createMany({ data: articleIds.map((articleId, index) => ({ sectionId, articleId, sortOrder: index })) });
      }
      return this.buildDraftView(tx, draft.id);
    });
  }

  // ---------------------------------------------------------------- publish

  /**
   * Atomically activates the complete draft. Everything happens in one transaction:
   *   1. compare-and-swap the draft version (409 if stale; also serializes against concurrent edits);
   *   2. validate the entire draft (articles still eligible, hero cardinality, layouts, limits, ...);
   *   3. replace the ACTIVE sections/placements with a copy of the draft and bump the ACTIVE version.
   * A failure at any step rolls back all of it, so the live homepage never sees a partial state.
   */
  async publish(expectedVersion: number) {
    const now = new Date();
    return this.mutateDraft(expectedVersion, async (tx, draft) => {
      const sections = await this.loadSections(tx, draft.id);
      const issues = validateHomepageSections(sections, now);
      if (issues.length) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          code: 'HOMEPAGE_PUBLISH_VALIDATION_FAILED',
          message: 'The draft cannot be published until the listed problems are fixed. The live homepage was not changed.',
          issues,
        });
      }

      const active = (await tx.homepageConfiguration.findUnique({ where: { status: 'ACTIVE' } })) ?? (await tx.homepageConfiguration.create({ data: { status: 'ACTIVE' } }));
      await tx.homepageSection.deleteMany({ where: { configurationId: active.id } }); // placements cascade
      await this.copySections(tx, sections, active.id);
      const published = await tx.homepageConfiguration.update({
        where: { id: active.id },
        data: { version: { increment: 1 }, publishedAt: now },
      });

      return {
        published: true as const,
        publishedAt: published.publishedAt,
        activeVersion: published.version,
        draftVersion: draft.version,
        sectionCount: sections.length,
        placementCount: sections.reduce((total, section) => total + section.placements.length, 0),
      };
    });
  }

  // ---------------------------------------------------------------- helpers

  /**
   * Runs `work` in a transaction that first compare-and-swaps DRAFT.version (expected -> expected+1).
   * The updateMany takes the row lock, so concurrent editors/publishers are serialized and the loser
   * observes count 0 and gets a 409. Any exception rolls back the version bump together with the work.
   */
  private async mutateDraft<T>(expectedVersion: number, work: (tx: Tx, draft: { id: string; version: number }) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const draft = await this.ensureDraft(tx);
      const swapped = await tx.homepageConfiguration.updateMany({
        where: { id: draft.id, version: expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (swapped.count !== 1) {
        const current = await tx.homepageConfiguration.findUnique({ where: { id: draft.id }, select: { version: true } });
        throw new ConflictException({
          statusCode: 409,
          code: 'HOMEPAGE_DRAFT_CONFLICT',
          message: 'The homepage draft was changed since you loaded it. Reload the draft and re-apply your change.',
          expectedVersion,
          currentVersion: current?.version ?? draft.version,
        });
      }
      return work(tx, { id: draft.id, version: expectedVersion + 1 });
    }, TX_OPTIONS);
  }

  /** The single DRAFT row; created (as a clone of ACTIVE) if it does not exist yet. */
  private async ensureDraft(tx: Tx) {
    const existing = await tx.homepageConfiguration.findUnique({ where: { status: 'DRAFT' } });
    if (existing) return existing;
    const draft = await tx.homepageConfiguration.create({ data: { status: 'DRAFT' } });
    const active = await tx.homepageConfiguration.findUnique({ where: { status: 'ACTIVE' }, select: { id: true } });
    if (active) await this.copySections(tx, await this.loadSections(tx, active.id), draft.id);
    return draft;
  }

  private loadSections(client: Pick<Tx, 'homepageSection'>, configurationId: string) {
    return client.homepageSection.findMany({ where: { configurationId }, orderBy: SECTION_ORDER, include: SECTION_VIEW_INCLUDE });
  }

  /** Copies sections (new ids) and their placements into `targetId`, normalizing order to 0..n-1. */
  private async copySections(tx: Tx, sections: SectionWithPlacements[], targetId: string) {
    for (const [index, section] of sections.entries()) {
      await tx.homepageSection.create({
        data: {
          configurationId: targetId,
          type: section.type,
          key: section.key,
          title: section.title,
          enabled: section.enabled,
          sortOrder: index,
          categoryId: section.categoryId,
          locationId: section.locationId,
          maxItems: section.maxItems,
          layoutType: section.layoutType,
          placements: { create: section.placements.map((placement, position) => ({ articleId: placement.articleId, sortOrder: position })) },
        },
      });
    }
  }

  private async findDraftSection(tx: Tx, draftId: string, id: string) {
    const section = await tx.homepageSection.findFirst({ where: { id, configurationId: draftId } });
    if (!section) throw new NotFoundException('Homepage section not found in the current draft');
    return section;
  }

  private async assertLinksExist(tx: Tx, categoryId?: string | null, locationId?: string | null) {
    if (categoryId && !(await tx.category.findUnique({ where: { id: categoryId }, select: { id: true } }))) {
      throw this.badRequest('CATEGORY_NOT_FOUND', 'The selected category does not exist.');
    }
    if (locationId && !(await tx.location.findUnique({ where: { id: locationId }, select: { id: true } }))) {
      throw this.badRequest('LOCATION_NOT_FOUND', 'The selected location does not exist.');
    }
  }

  private async buildDraftView(client: Tx, draftId: string) {
    const draft = await client.homepageConfiguration.findUniqueOrThrow({ where: { id: draftId } });
    const sections = await this.loadSections(client, draftId);
    const active = await client.homepageConfiguration.findUnique({ where: { status: 'ACTIVE' }, select: { id: true } });
    const activeSections = active ? await this.loadSections(client, active.id) : [];
    const issues: HomepageIssue[] = validateHomepageSections(sections);
    return {
      id: draft.id,
      status: 'DRAFT' as const,
      version: draft.version,
      updatedAt: draft.updatedAt,
      layoutPresets: [...HOMEPAGE_LAYOUT_PRESETS],
      hasUnpublishedChanges: configurationSignature(sections) !== configurationSignature(activeSections),
      publishable: issues.length === 0,
      issues,
      sections: sections.map((section) => this.toSectionView(section)),
    };
  }

  private toSectionView(section: SectionWithPlacements) {
    const now = new Date();
    return {
      id: section.id,
      key: section.key,
      type: section.type,
      title: section.title,
      enabled: section.enabled,
      sortOrder: section.sortOrder,
      maxItems: section.maxItems,
      layoutType: section.layoutType,
      categoryId: section.categoryId,
      category: section.category,
      locationId: section.locationId,
      updatedAt: section.updatedAt,
      placements: section.placements.map((placement) => ({
        articleId: placement.articleId,
        sortOrder: placement.sortOrder,
        eligible: isPubliclyEligible(placement.article, now),
        article: placement.article,
      })),
    };
  }

  private badRequest(code: string, message: string, extra: Record<string, unknown> = {}) {
    return new BadRequestException({ statusCode: 400, code, message, ...extra });
  }
}
