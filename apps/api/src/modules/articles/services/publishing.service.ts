import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PublishingService {
  constructor(private readonly prisma: PrismaService) {}

  async publish(articleId: string, userId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article not found');
    if (article.status !== 'APPROVED') {
      throw new BadRequestException('Only approved articles can be published');
    }

    return this.prisma.article.update({
      where: { id: articleId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
  }

  async schedule(articleId: string, scheduledAt: Date, userId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article not found');
    if (article.status !== 'APPROVED') {
      throw new BadRequestException('Only approved articles can be scheduled');
    }
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    return this.prisma.article.update({
      where: { id: articleId },
      data: { scheduledAt },
    });
  }

  async cancelSchedule(articleId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article not found');

    return this.prisma.article.update({
      where: { id: articleId },
      data: { scheduledAt: null },
    });
  }

  async archive(articleId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article not found');
    if (article.status !== 'PUBLISHED') {
      throw new BadRequestException('Only published articles can be archived');
    }

    return this.prisma.article.update({
      where: { id: articleId },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        isBreaking: false,
        breakingStartedAt: null,
        breakingEndsAt: null,
        breakingPriority: null,
      },
    });
  }

  async executeScheduledPublications() {
    const now = new Date();
    const scheduledArticles = await this.prisma.article.findMany({
      where: {
        status: 'APPROVED',
        scheduledAt: { lte: now },
      },
    });

    const published = [];
    for (const article of scheduledArticles) {
      try {
        const updated = await this.prisma.article.update({
          where: { id: article.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: now,
            scheduledAt: null,
          },
        });
        published.push(updated);
      } catch (error) {
        console.error(`Failed to publish scheduled article ${article.id}:`, error);
      }
    }

    return published;
  }
}
