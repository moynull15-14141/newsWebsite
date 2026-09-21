import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ArticleRevisionService {
  constructor(private readonly prisma: PrismaService) {}

  async createRevision(articleId: string, changedById: string, changeReason?: string) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        categoryId: true,
        locationId: true,
        featuredImageId: true,
        authorId: true,
        status: true,
      },
    });
    if (!article) throw new NotFoundException('Article not found');

    // Get next version number
    const lastRevision = await this.prisma.articleRevision.findFirst({
      where: { articleId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (lastRevision?.version || 0) + 1;

    return this.prisma.articleRevision.create({
      data: {
        articleId,
        version: nextVersion,
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        content: article.content as any,
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

  async getRevisions(articleId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article not found');

    return this.prisma.articleRevision.findMany({
      where: { articleId },
      orderBy: { version: 'desc' },
      include: {
        changedBy: { select: { id: true, name: true } },
      },
    });
  }

  async getRevision(articleId: string, version: number) {
    const revision = await this.prisma.articleRevision.findUnique({
      where: { articleId_version: { articleId, version } },
      include: {
        changedBy: { select: { id: true, name: true } },
        article: { select: { id: true, title: true, slug: true, status: true } },
      },
    });
    if (!revision) throw new NotFoundException('Revision not found');
    return revision;
  }

  async restoreRevision(articleId: string, version: number, changedById: string) {
    const revision = await this.prisma.articleRevision.findUnique({
      where: { articleId_version: { articleId, version } },
    });
    if (!revision) throw new NotFoundException('Revision not found');

    // Create a new revision of current state before restoring
    await this.createRevision(articleId, changedById, `Before restoring to version ${version}`);

    // Get next version number
    const lastRevision = await this.prisma.articleRevision.findFirst({
      where: { articleId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (lastRevision?.version || 0) + 1;

    // Create a new revision of the restored state
    await this.prisma.articleRevision.create({
      data: {
        articleId,
        version: nextVersion,
        title: revision.title,
        slug: revision.slug,
        excerpt: revision.excerpt,
        content: revision.content as any,
        categoryId: revision.categoryId,
        locationId: revision.locationId,
        featuredImageId: revision.featuredImageId,
        authorId: revision.authorId,
        status: revision.status,
        changedById,
        changeReason: `Restored from version ${version}`,
      },
    });

    // Restore the article
    return this.prisma.article.update({
      where: { id: articleId },
      data: {
        title: revision.title,
        slug: revision.slug,
        excerpt: revision.excerpt,
        content: revision.content as any,
        categoryId: revision.categoryId,
        locationId: revision.locationId,
        featuredImageId: revision.featuredImageId,
        authorId: revision.authorId,
        status: revision.status as any,
      },
    });
  }
}
