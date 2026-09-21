import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { QueryArticlesDto } from './dto/query-articles.dto';
import { ArticleStatus } from '@prisma/client';

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateArticleDto, authorId: string) {
    const slug = dto.slug || this.slugify(dto.title);
    
    const existing = await this.prisma.article.findUnique({ where: { slug } });
    if (existing) {
      throw new BadRequestException('Article with this slug already exists');
    }

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
        articleTags: { include: { tag: true } },
      },
    });

    return article;
  }

  async findAll(query: QueryArticlesDto, userId?: string, userPermissions?: string[]) {
    const { page = 1, limit = 20, search, status, categoryId, locationId, authorId, tagId, sort = 'createdAt', order = 'desc' } = query;
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

    if (dto.tagIds !== undefined) {
      await this.prisma.articleTag.deleteMany({ where: { articleId: id } });
      if (dto.tagIds.length > 0) {
        await this.prisma.articleTag.createMany({
          data: dto.tagIds.map((tagId) => ({ articleId: id, tagId })),
        });
      }
    }

    return this.prisma.article.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, email: true } },
        category: true,
        location: true,
        articleTags: { include: { tag: true } },
      },
    });
  }

  async remove(id: string, userId: string, userPermissions: string[]) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    if (existing.authorId !== userId && !userPermissions.includes('article.delete')) {
      throw new ForbiddenException('You can only delete your own articles');
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

    return this.prisma.article.update({
      where: { id },
      data: { status: 'IN_REVIEW' },
    });
  }

  async approve(id: string, userId: string) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    if (existing.status !== 'IN_REVIEW') {
      throw new BadRequestException('Only articles in review can be approved');
    }

    return this.prisma.article.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedById: userId,
      },
    });
  }

  async publish(id: string, userId: string) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    if (existing.status !== 'APPROVED') {
      throw new BadRequestException('Only approved articles can be published');
    }

    return this.prisma.article.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
  }

  async archive(id: string) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    if (existing.status !== 'PUBLISHED') {
      throw new BadRequestException('Only published articles can be archived');
    }

    return this.prisma.article.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
      },
    });
  }

  async returnToDraft(id: string, userId: string) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    if (!['IN_REVIEW', 'APPROVED'].includes(existing.status)) {
      throw new BadRequestException('Only articles in review or approved can be returned to draft');
    }

    return this.prisma.article.update({
      where: { id },
      data: { status: 'DRAFT' },
    });
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

    if (!['APPROVED', 'DRAFT'].includes(existing.status)) {
      throw new BadRequestException('Only approved or draft articles can be scheduled');
    }

    return this.prisma.article.update({
      where: { id },
      data: {
        scheduledAt: new Date(scheduledAt),
        status: existing.status,
      },
    });
  }

  async cancelSchedule(id: string, userId = '', userPermissions: string[] = []) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }
    if (existing.authorId !== userId && !userPermissions.includes('article.edit')) {
      throw new ForbiddenException('You can only cancel schedules for your own articles');
    }

    return this.prisma.article.update({
      where: { id },
      data: { scheduledAt: null },
    });
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
