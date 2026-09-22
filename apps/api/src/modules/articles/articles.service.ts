import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { QueryArticlesDto } from './dto/query-articles.dto';
import { LanguagesService } from '../languages/languages.service';
import { AuditLogService } from './services/audit-log.service';
import { SeoService } from '../seo/seo.service';
import { evaluateBlockingIssues, evaluateStalenessAndScheduleWarnings, ReadinessIssue } from './editorial-readiness';
import { ArticleStatus } from '@prisma/client';

const LANGUAGE_SELECT = { select: { id: true, code: true, name: true, nativeName: true } } as const;

@Injectable()
export class ArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly languagesService: LanguagesService,
    private readonly auditLog: AuditLogService,
    private readonly seoService: SeoService,
  ) {}

  /** Editorial readiness: deterministic blocking issues plus staleness/schedule/SEO-derived warnings
   * (Phase 2H). Reuses the existing SEO Intelligence analyzer for duplicate/metadata warnings instead
   * of re-implementing them. */
  async getReadiness(id: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const blocking: ReadinessIssue[] = evaluateBlockingIssues(article);
    const warnings: ReadinessIssue[] = evaluateStalenessAndScheduleWarnings(article);

    const seo = await this.seoService.analyzeArticle(id);
    const seoWarningChecks = seo.checks.filter((c) =>
      ['meta-description', 'featured-image', 'duplicate-title', 'duplicate-slug', 'duplicate-description', 'entity-context'].includes(c.id) &&
      (c.status === 'WARNING' || c.status === 'ERROR'),
    );
    for (const c of seoWarningChecks) {
      warnings.push({ code: c.id.toUpperCase().replace(/-/g, '_'), message: c.message });
    }

    return { blocking, warnings };
  }

  /** Snapshots the article's current persisted state into a new revision row before a mutation that
   * could otherwise silently overwrite it with no way back (Phase 2H — editorial auditability). */
  private async snapshotRevision(articleId: string, changedById: string, changeReason: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) return null;

    const latestRevision = await this.prisma.articleRevision.findFirst({
      where: { articleId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latestRevision?.version || 0) + 1;

    return this.prisma.articleRevision.create({
      data: {
        articleId,
        version: nextVersion,
        title: article.title,
        excerpt: article.excerpt,
        content: article.content as any,
        slug: article.slug,
        categoryId: article.categoryId,
        locationId: article.locationId,
        featuredImageId: article.featuredImageId,
        authorId: article.authorId,
        status: article.status,
        changedById,
        changeReason,
      },
    });
  }

  async create(dto: CreateArticleDto, authorId: string) {
    const slug = dto.slug || this.slugify(dto.title);

    const existing = await this.prisma.article.findUnique({ where: { slug } });
    if (existing) {
      throw new BadRequestException('Article with this slug already exists');
    }

    // Every article belongs to a language; the editor rarely needs to choose — the platform default
    // covers the common case, and translations get their own explicit language via createTranslation().
    const languageId = dto.languageId ?? (await this.languagesService.getDefault()).id;

    const article = await this.prisma.article.create({
      data: {
        title: dto.title,
        slug,
        excerpt: dto.excerpt,
        content: dto.content,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        seoKeywords: dto.seoKeywords,
        canonicalUrl: dto.canonicalUrl,
        noIndex: dto.noIndex,
        authorId,
        categoryId: dto.categoryId,
        locationId: dto.locationId,
        featuredImageId: dto.featuredImageId,
        languageId,
        status: 'DRAFT',
        isBreaking: dto.isBreaking,
        breakingPriority: dto.breakingPriority,
        breakingEndsAt: dto.breakingEndsAt ? new Date(dto.breakingEndsAt) : undefined,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        articleTags: dto.tagIds?.length
          ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        category: true,
        location: true,
        language: LANGUAGE_SELECT,
        articleTags: { include: { tag: true } },
      },
    });

    await this.auditLog.record({ articleId: article.id, actorId: authorId, action: 'CREATED', toStatus: 'DRAFT' });

    return article;
  }

  async findAll(query: QueryArticlesDto, userId?: string, userPermissions?: string[]) {
    const { page = 1, limit = 20, search, status, categoryId, locationId, authorId, tagId, languageId, sort = 'createdAt', order = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status === 'SCHEDULED') {
      where.scheduledAt = { not: null };
      where.status = { not: 'PUBLISHED' };
    } else if (status) {
      where.status = status;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (locationId) {
      where.locationId = locationId;
    }

    if (authorId) {
      where.authorId = authorId;
    }

    if (tagId) {
      where.articleTags = { some: { tagId } };
    }

    if (languageId) {
      where.languageId = languageId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = { [sort]: order };

    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          author: { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true, slug: true } },
          location: { select: { id: true, name: true, slug: true, type: true } },
          language: LANGUAGE_SELECT,
          articleTags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
          // Featured image, so catalogue consumers (e.g. the homepage article picker) can show a thumbnail.
          media: { select: { id: true, publicUrl: true, altText: true } },
        },
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      data: articles,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true } },
        category: true,
        location: true,
        media: { select: { id: true, publicUrl: true, originalFilename: true, altText: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        language: LANGUAGE_SELECT,
        articleTags: { include: { tag: true } },
      },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return article;
  }

  async findBySlug(slug: string) {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, name: true, email: true } },
        category: true,
        location: true,
        media: { select: { id: true, publicUrl: true, originalFilename: true, altText: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        language: LANGUAGE_SELECT,
        articleTags: { include: { tag: true } },
      },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return article;
  }

  async update(id: string, dto: UpdateArticleDto, userId: string, userPermissions: string[]) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    if (existing.authorId !== userId && !userPermissions.includes('article.edit')) {
      throw new ForbiddenException('You can only edit your own articles');
    }

    // Optimistic concurrency: if the editor tells us which version it loaded and that no longer
    // matches what's persisted, someone else saved in between — reject rather than silently clobber
    // their change (Phase 2H).
    if (dto.expectedUpdatedAt && new Date(dto.expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
      throw new ConflictException({
        message: 'This article was changed by another user. Reload the latest version before continuing.',
        code: 'ARTICLE_VERSION_CONFLICT',
      });
    }

    // Unlike create(), a saved article keeps resubmitting its own current slug on every save (the
    // editor form always sends the loaded value), so this only rejects an actual collision with a
    // *different* article rather than the article's own unchanged slug.
    if (dto.slug !== undefined && dto.slug !== existing.slug) {
      const slugOwner = await this.prisma.article.findUnique({ where: { slug: dto.slug } });
      if (slugOwner && slugOwner.id !== id) {
        throw new BadRequestException('Article with this slug already exists');
      }
    }

    const updateData: any = {};

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.slug !== undefined) updateData.slug = dto.slug;
    if (dto.excerpt !== undefined) updateData.excerpt = dto.excerpt;
    if (dto.seoTitle !== undefined) updateData.seoTitle = dto.seoTitle;
    if (dto.seoDescription !== undefined) updateData.seoDescription = dto.seoDescription;
    if (dto.seoKeywords !== undefined) updateData.seoKeywords = dto.seoKeywords;
    if (dto.canonicalUrl !== undefined) updateData.canonicalUrl = dto.canonicalUrl;
    if (dto.noIndex !== undefined) updateData.noIndex = dto.noIndex;
    if (dto.content !== undefined) updateData.content = dto.content;
    if (dto.categoryId !== undefined) updateData.categoryId = dto.categoryId;
    if (dto.locationId !== undefined) updateData.locationId = dto.locationId;
    if (dto.featuredImageId !== undefined) updateData.featuredImageId = dto.featuredImageId;
    if (dto.isBreaking !== undefined) updateData.isBreaking = dto.isBreaking;
    if (dto.breakingPriority !== undefined) updateData.breakingPriority = dto.breakingPriority;
    if (dto.breakingEndsAt !== undefined) updateData.breakingEndsAt = dto.breakingEndsAt ? new Date(dto.breakingEndsAt) : null;
    if (dto.scheduledAt !== undefined) updateData.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (dto.languageId !== undefined) updateData.languageId = dto.languageId;

    if (dto.tagIds !== undefined) {
      await this.prisma.articleTag.deleteMany({ where: { articleId: id } });
      if (dto.tagIds.length > 0) {
        await this.prisma.articleTag.createMany({
          data: dto.tagIds.map((tagId) => ({ articleId: id, tagId })),
        });
      }
    }

    // Editing content that is already live (or was live and is now archived) must never be a silent
    // mutation: snapshot the pre-edit state as a revision first, so the previous public version is
    // always recoverable, and leave an audit trail distinct from an ordinary draft edit (Phase 2H).
    const editingLiveContent = existing.status === 'PUBLISHED' || existing.status === 'ARCHIVED';
    if (editingLiveContent && Object.keys(updateData).length > 0) {
      await this.snapshotRevision(id, userId, `Auto-snapshot before editing ${existing.status.toLowerCase()} article`);
    }

    const updated = await this.prisma.article.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, email: true } },
        category: true,
        location: true,
        language: LANGUAGE_SELECT,
        articleTags: { include: { tag: true } },
      },
    });

    if (Object.keys(updateData).length > 0 || dto.tagIds !== undefined) {
      const changedFields = [...Object.keys(updateData), ...(dto.tagIds !== undefined ? ['tags'] : [])];
      await this.auditLog.record({
        articleId: id,
        actorId: userId,
        action: editingLiveContent ? 'LIVE_CONTENT_EDITED' : 'UPDATED',
        note: `Changed: ${changedFields.join(', ')}`,
      });
    }

    return updated;
  }

  async remove(id: string, userId: string, userPermissions: string[]) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    if (existing.authorId !== userId && !userPermissions.includes('article.delete')) {
      throw new ForbiddenException('You can only delete your own articles');
    }

    // Anything that has entered review/approval/publication has real editorial history — permanently
    // erasing the row would erase that history too. Only untouched drafts can be hard-deleted; a
    // published or previously-reviewed article must be archived instead (Phase 2H).
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only draft articles can be permanently deleted. Archive it instead.');
    }

    await this.prisma.articleTag.deleteMany({ where: { articleId: id } });
    await this.prisma.article.delete({ where: { id } });

    return { message: 'Article deleted successfully' };
  }

  async submitReview(id: string, userId: string) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    if (existing.authorId !== userId) {
      throw new ForbiddenException('Only the author can submit for review');
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only draft articles can be submitted for review');
    }

    const blocking = evaluateBlockingIssues(existing);
    if (blocking.length > 0) {
      throw new BadRequestException({ message: blocking[0].message, code: blocking[0].code, blocking });
    }

    const updated = await this.prisma.article.update({
      where: { id },
      data: { status: 'IN_REVIEW' },
    });
    await this.auditLog.record({ articleId: id, actorId: userId, action: 'SUBMITTED_FOR_REVIEW', fromStatus: 'DRAFT', toStatus: 'IN_REVIEW' });
    return updated;
  }

  async approve(id: string, userId: string, userPermissions: string[] = []) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    if (existing.status !== 'IN_REVIEW') {
      throw new BadRequestException('Only articles in review can be approved');
    }

    // Separation of duties: a reviewer approving their own article defeats the purpose of review.
    // Only someone who can also publish (Editor-in-Chief/Admin) may knowingly override this, and that
    // override is itself auditable via the actor/article pair on the resulting log entry.
    if (existing.authorId === userId && !userPermissions.includes('article.publish')) {
      throw new ForbiddenException('You cannot approve your own article. Ask another reviewer to approve it.');
    }

    // Guard the transition at the database level, not just on the value read above: if a second
    // reviewer's request already moved this article out of IN_REVIEW between that read and this write,
    // updateMany matches zero rows instead of silently overwriting whatever they just set — the classic
    // "two reviewers approve simultaneously" race (Phase 2I).
    const { count } = await this.prisma.article.updateMany({
      where: { id, status: 'IN_REVIEW' },
      data: { status: 'APPROVED', reviewedAt: new Date(), reviewedById: userId },
    });
    if (count === 0) {
      throw new ConflictException({ message: 'This article is no longer awaiting review — someone else already acted on it.', code: 'ARTICLE_STATUS_CONFLICT' });
    }

    const updated = await this.prisma.article.findUnique({ where: { id } });
    if (!updated) throw new NotFoundException('Article not found');
    await this.auditLog.record({ articleId: id, actorId: userId, action: 'APPROVED', fromStatus: 'IN_REVIEW', toStatus: 'APPROVED' });
    return updated;
  }

  async publish(id: string, userId: string) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    if (existing.status !== 'APPROVED') {
      throw new BadRequestException('Only approved articles can be published');
    }

    const blocking = evaluateBlockingIssues(existing);
    if (blocking.length > 0) {
      throw new BadRequestException({ message: blocking[0].message, code: blocking[0].code, blocking });
    }

    // Same database-level guard as approve(): prevents two concurrent publish requests (or a manual
    // publish racing the scheduled-publishing sweep) from both succeeding against a stale read.
    const { count } = await this.prisma.article.updateMany({
      where: { id, status: 'APPROVED' },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    if (count === 0) {
      throw new ConflictException({ message: 'This article is no longer approved — someone else already acted on it.', code: 'ARTICLE_STATUS_CONFLICT' });
    }

    const updated = await this.prisma.article.findUnique({ where: { id } });
    if (!updated) throw new NotFoundException('Article not found');
    await this.auditLog.record({ articleId: id, actorId: userId, action: 'PUBLISHED', fromStatus: 'APPROVED', toStatus: 'PUBLISHED' });
    return updated;
  }

  async archive(id: string, userId?: string) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    if (existing.status !== 'PUBLISHED') {
      throw new BadRequestException('Only published articles can be archived');
    }

    // Guards against "publish + archive at the same time": if the article was unpublished/archived by
    // another request in between, this matches zero rows instead of archiving a no-longer-published row.
    const { count } = await this.prisma.article.updateMany({
      where: { id, status: 'PUBLISHED' },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        // An archived article is no longer publicly promotable — clear stale breaking-news state so
        // it can never resurface if the article is later republished (Phase 2H).
        isBreaking: false,
        breakingStartedAt: null,
        breakingEndsAt: null,
        breakingPriority: null,
      },
    });
    if (count === 0) {
      throw new ConflictException({ message: 'This article is no longer published — someone else already acted on it.', code: 'ARTICLE_STATUS_CONFLICT' });
    }

    const updated = await this.prisma.article.findUnique({ where: { id } });
    if (!updated) throw new NotFoundException('Article not found');
    await this.auditLog.record({ articleId: id, actorId: userId, action: 'ARCHIVED', fromStatus: 'PUBLISHED', toStatus: 'ARCHIVED' });
    return updated;
  }

  /** PUBLISHED -> DRAFT: pulls a live article back off the public site without erasing it (Phase 2I).
   * Unlike archive(), this is meant for "we need to fix this before anyone reads it again" rather than
   * end-of-life; the article re-enters the normal DRAFT -> review -> publish workflow from scratch. */
  async unpublish(id: string, userId?: string) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }
    if (existing.status !== 'PUBLISHED') {
      throw new BadRequestException('Only published articles can be unpublished');
    }

    const { count } = await this.prisma.article.updateMany({
      where: { id, status: 'PUBLISHED' },
      data: { status: 'DRAFT', publishedAt: null },
    });
    if (count === 0) {
      throw new ConflictException({ message: 'This article is no longer published — someone else already acted on it.', code: 'ARTICLE_STATUS_CONFLICT' });
    }

    const updated = await this.prisma.article.findUnique({ where: { id } });
    if (!updated) throw new NotFoundException('Article not found');
    await this.auditLog.record({ articleId: id, actorId: userId, action: 'UNPUBLISHED', fromStatus: 'PUBLISHED', toStatus: 'DRAFT' });
    return updated;
  }

  /** ARCHIVED -> DRAFT: brings a retired article back into the editorial workflow (Phase 2I). Does not
   * republish it directly — a restored article must clear review again like any other draft. */
  async restore(id: string, userId?: string) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }
    if (existing.status !== 'ARCHIVED') {
      throw new BadRequestException('Only archived articles can be restored');
    }

    const { count } = await this.prisma.article.updateMany({
      where: { id, status: 'ARCHIVED' },
      data: { status: 'DRAFT', archivedAt: null },
    });
    if (count === 0) {
      throw new ConflictException({ message: 'This article is no longer archived — someone else already acted on it.', code: 'ARTICLE_STATUS_CONFLICT' });
    }

    const updated = await this.prisma.article.findUnique({ where: { id } });
    if (!updated) throw new NotFoundException('Article not found');
    await this.auditLog.record({ articleId: id, actorId: userId, action: 'RESTORED', fromStatus: 'ARCHIVED', toStatus: 'DRAFT' });
    return updated;
  }

  async returnToDraft(id: string, userId: string, reason?: string) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    if (!['IN_REVIEW', 'APPROVED'].includes(existing.status)) {
      throw new BadRequestException('Only articles in review or approved can be returned to draft');
    }

    const updated = await this.prisma.article.update({
      where: { id },
      data: { status: 'DRAFT' },
    });
    await this.auditLog.record({
      articleId: id,
      actorId: userId,
      action: 'RETURNED_TO_DRAFT',
      fromStatus: existing.status,
      toStatus: 'DRAFT',
      note: reason,
    });
    return updated;
  }

  async saveRevision(id: string, userId: string, changeReason?: string, userPermissions: string[] = []) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    if (article.authorId !== userId && !userPermissions.includes('article.edit')) {
      throw new ForbiddenException('You can only revise your own articles');
    }

    const latestRevision = await this.prisma.articleRevision.findFirst({
      where: { articleId: id },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latestRevision?.version || 0) + 1;

    return this.prisma.articleRevision.create({
      data: {
        articleId: id,
        version: nextVersion,
        title: article.title,
        excerpt: article.excerpt,
        content: article.content as any,
        slug: article.slug,
        categoryId: article.categoryId,
        locationId: article.locationId,
        featuredImageId: article.featuredImageId,
        authorId: article.authorId,
        status: article.status,
        changedById: userId,
        changeReason,
      },
    });
  }

  async getAuditLog(articleId: string, userId = '', userPermissions: string[] = []) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    if (article.authorId !== userId && !userPermissions.includes('audit.read')) {
      throw new ForbiddenException('You cannot view the audit trail for this article');
    }

    return this.auditLog.listForArticle(articleId);
  }

  async getRevisions(articleId: string, userId = '', userPermissions: string[] = []) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    if (article.authorId !== userId && !userPermissions.includes('article.read')) {
      throw new ForbiddenException('You cannot view revisions for this article');
    }

    return this.prisma.articleRevision.findMany({
      where: { articleId },
      orderBy: { version: 'desc' },
      include: {
        changedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async restoreRevision(articleId: string, revisionId: string, userId: string, userPermissions: string[] = []) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    if (article.authorId !== userId && !userPermissions.includes('article.edit')) {
      throw new ForbiddenException('You can only restore revisions for your own articles');
    }

    const revision = await this.prisma.articleRevision.findUnique({ where: { id: revisionId } });
    if (!revision || revision.articleId !== articleId) {
      throw new NotFoundException('Revision not found');
    }

    // Restoring an old revision overwrites the article's CURRENT content — snapshot that current
    // state first, so restoring is never a one-way, unrecoverable action (Phase 2H).
    await this.snapshotRevision(articleId, userId, `Auto-snapshot before restoring to version ${revision.version}`);

    const updateData: any = {
      title: revision.title,
      excerpt: revision.excerpt,
      content: revision.content as any,
      slug: revision.slug,
      categoryId: revision.categoryId,
      locationId: revision.locationId,
      featuredImageId: revision.featuredImageId,
    };

    return this.prisma.article.update({
      where: { id: articleId },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, email: true } },
        category: true,
        location: true,
        articleTags: { include: { tag: true } },
      },
    });
  }

  async scheduleArticle(id: string, scheduledAt: string, userId = '', userPermissions: string[] = []) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }
    if (existing.authorId !== userId && !userPermissions.includes('article.edit')) {
      throw new ForbiddenException('You can only schedule your own articles');
    }

    // The scheduled-publishing sweep only ever promotes APPROVED articles (see
    // PublishingService.executeScheduledPublications), so accepting a DRAFT here would silently set a
    // scheduledAt that can never fire — scheduling must require the article has already cleared review.
    if (existing.status !== 'APPROVED') {
      throw new BadRequestException('Only approved articles can be scheduled');
    }

    if (new Date(scheduledAt).getTime() <= Date.now()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    const updated = await this.prisma.article.update({
      where: { id },
      data: {
        scheduledAt: new Date(scheduledAt),
        status: existing.status,
      },
    });
    await this.auditLog.record({ articleId: id, actorId: userId, action: 'SCHEDULED', note: `Scheduled for ${scheduledAt}` });
    return updated;
  }

  async cancelSchedule(id: string, userId = '', userPermissions: string[] = []) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }
    if (existing.authorId !== userId && !userPermissions.includes('article.edit')) {
      throw new ForbiddenException('You can only cancel schedules for your own articles');
    }

    const updated = await this.prisma.article.update({
      where: { id },
      data: { scheduledAt: null },
    });
    await this.auditLog.record({ articleId: id, actorId: userId, action: 'SCHEDULE_CANCELLED' });
    return updated;
  }

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [publishedToday, drafts, inReview, scheduled, breaking, viewsToday, mostRead] = await Promise.all([
      this.prisma.article.count({
        where: {
          status: 'PUBLISHED',
          publishedAt: { gte: today, lt: tomorrow },
        },
      }),
      this.prisma.article.count({ where: { status: 'DRAFT' } }),
      this.prisma.article.count({ where: { status: 'IN_REVIEW' } }),
      this.prisma.article.count({ where: { scheduledAt: { not: null }, status: { not: 'PUBLISHED' } } }),
      this.prisma.article.count({ where: { isBreaking: true, status: 'PUBLISHED' } }),
      this.prisma.articleView.count({
        where: { viewedAt: { gte: today, lt: tomorrow } },
      }),
      this.prisma.article.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { viewCount: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          slug: true,
          viewCount: true,
          publishedAt: true,
        },
      }),
    ]);

    return {
      publishedToday,
      drafts,
      inReview,
      scheduled,
      breaking,
      viewsToday,
      mostRead,
    };
  }

  /**
   * Creates a new-language DRAFT sibling of `articleId`: a real, independent Article row that the
   * editor writes fresh content into, linked by `translationGroupId` so the two are known to be
   * translations of the same story (not guessed from a matching title/slug). Taxonomy (category,
   * location, tags, featured image) carries over as a starting point; title/slug/excerpt/content/SEO do
   * NOT — those are for the target language and start blank so nothing untranslated is ever visible.
   * The new article's own publication status is independent from the source's (Part 13/25).
   */
  async createTranslation(articleId: string, languageId: string, authorId: string) {
    const source = await this.prisma.article.findUnique({
      where: { id: articleId },
      include: { articleTags: true },
    });
    if (!source) throw new NotFoundException('Article not found');

    const language = await this.prisma.language.findUnique({ where: { id: languageId } });
    if (!language) throw new NotFoundException('Language not found');
    if (source.languageId === languageId) {
      throw new BadRequestException('This article is already in that language.');
    }

    return this.prisma.$transaction(async (tx) => {
      const groupId =
        source.translationGroupId ??
        (await tx.article.update({ where: { id: source.id }, data: { translationGroup: { create: {} } }, select: { translationGroupId: true } }))
          .translationGroupId!;

      const existingSibling = await tx.article.findFirst({ where: { translationGroupId: groupId, languageId } });
      if (existingSibling) {
        throw new BadRequestException(`A ${language.name} translation already exists for this story.`);
      }

      const placeholderTitle = `(${language.nativeName} translation of "${source.title}")`;
      return tx.article.create({
        data: {
          title: placeholderTitle,
          slug: this.slugify(placeholderTitle),
          authorId,
          languageId,
          translationGroupId: groupId,
          categoryId: source.categoryId,
          locationId: source.locationId,
          featuredImageId: source.featuredImageId,
          status: 'DRAFT',
          articleTags: source.articleTags.length ? { create: source.articleTags.map((t) => ({ tagId: t.tagId })) } : undefined,
        },
        include: {
          author: { select: { id: true, name: true, email: true } },
          category: true,
          location: true,
          language: LANGUAGE_SELECT,
          articleTags: { include: { tag: true } },
        },
      });
    });
  }

  /** Every language version of the same story (the article itself plus its siblings), for the admin translation panel. */
  async getTranslations(articleId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId }, select: { translationGroupId: true, languageId: true } });
    if (!article) throw new NotFoundException('Article not found');
    if (!article.translationGroupId) return [];

    return this.prisma.article.findMany({
      where: { translationGroupId: article.translationGroupId },
      select: { id: true, title: true, slug: true, status: true, publishedAt: true, language: LANGUAGE_SELECT },
      orderBy: { language: { sortOrder: 'asc' } },
    });
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      + '-' + Date.now().toString(36);
  }
}
