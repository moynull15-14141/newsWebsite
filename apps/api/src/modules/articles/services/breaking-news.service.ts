import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { articleLanguageWhere, LanguageFilter } from '../../../common/i18n/article-language';

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

  /**
   * `language` is optional so existing callers (and tests) keep working across every configured
   * language. It is combined via `AND` rather than spread — the language filter can itself be an `OR`
   * (default language also matches legacy null rows), which would silently overwrite the breaking-news
   * expiry `OR` clause if merged by object spread instead.
   */
  async getActiveBreakingNews(limit = 5, language?: LanguageFilter) {
    const now = new Date();
    return this.prisma.article.findMany({
      where: {
        isBreaking: true,
        status: 'PUBLISHED',
        OR: [
          { breakingEndsAt: null },
          { breakingEndsAt: { gt: now } },
        ],
        ...(language ? { AND: [articleLanguageWhere(language)] } : {}),
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
