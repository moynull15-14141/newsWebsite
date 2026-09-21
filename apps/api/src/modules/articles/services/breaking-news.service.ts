import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BreakingNewsService {
  constructor(private readonly prisma: PrismaService) {}

  async markBreaking(articleId: string, priority?: number, endsAt?: Date) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article not found');
    if (article.status !== 'PUBLISHED') {
      throw new BadRequestException('Only published articles can be marked as breaking');
    }

    return this.prisma.article.update({
      where: { id: articleId },
      data: {
        isBreaking: true,
        breakingStartedAt: new Date(),
        breakingPriority: priority ?? 0,
        breakingEndsAt: endsAt,
      },
    });
  }

  async removeBreaking(articleId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article not found');

    return this.prisma.article.update({
      where: { id: articleId },
      data: {
        isBreaking: false,
        breakingStartedAt: null,
        breakingPriority: null,
        breakingEndsAt: null,
      },
    });
  }

  async getActiveBreakingNews(limit = 5) {
    const now = new Date();
    return this.prisma.article.findMany({
      where: {
        isBreaking: true,
        status: 'PUBLISHED',
        OR: [
          { breakingEndsAt: null },
          { breakingEndsAt: { gt: now } },
        ],
      },
      orderBy: [
        { breakingPriority: 'desc' },
        { breakingStartedAt: 'desc' },
      ],
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        breakingStartedAt: true,
        breakingPriority: true,
        author: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async clearExpiredBreaking() {
    const now = new Date();
    const expired = await this.prisma.article.findMany({
      where: {
        isBreaking: true,
        breakingEndsAt: { lte: now },
      },
    });

    if (expired.length === 0) return [];

    await this.prisma.article.updateMany({
      where: {
        isBreaking: true,
        breakingEndsAt: { lte: now },
      },
      data: {
        isBreaking: false,
        breakingStartedAt: null,
        breakingPriority: null,
        breakingEndsAt: null,
      },
    });

    return expired;
  }
}
