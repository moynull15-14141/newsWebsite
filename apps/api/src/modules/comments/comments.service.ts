import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentStatus } from '@prisma/client';

@Injectable()
export class CommentsService {
  private readonly recentSubmissions = new Map<string, number>();
  private readonly recentReports = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  async create(articleSlug: string, dto: CreateCommentDto, userId?: string, guestName?: string) {
    const article = await this.prisma.article.findUnique({ where: { slug: articleSlug } });
    if (!article || article.status !== 'PUBLISHED') throw new NotFoundException('Article not found');
    if (article.status !== 'PUBLISHED') throw new BadRequestException('Cannot comment on unpublished articles');

    if (!userId && !guestName) {
      throw new BadRequestException('Guest name is required for unauthenticated comments');
    }

    const content = dto.content.replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
    if (!content) throw new BadRequestException('Comment content is required');
    if (/(https?:\/\/|www\.)/i.test(content) && content.length < 20) {
      throw new BadRequestException('Comment contains blocked content');
    }

    const submissionKey = `${article.id}:${userId || guestName!.toLowerCase()}:${content.toLowerCase()}`;
    const lastSubmission = this.recentSubmissions.get(submissionKey);
    if (lastSubmission && Date.now() - lastSubmission < 60_000) {
      throw new BadRequestException('Duplicate comment submitted recently');
    }
    this.recentSubmissions.set(submissionKey, Date.now());

    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.articleId !== article.id) {
        throw new BadRequestException('Invalid parent comment');
      }
      if (parent.parentId) {
        throw new BadRequestException('Only one level of nesting is supported');
      }
    }

    return this.prisma.comment.create({
      data: {
        articleId: article.id,
        userId,
        guestName: userId ? undefined : guestName,
        content,
        parentId: dto.parentId,
        status: 'PENDING',
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
  }

  async findByArticle(articleSlug: string, page = 1, limit = 50) {
    const article = await this.prisma.article.findUnique({ where: { slug: articleSlug } });
    if (!article || article.status !== 'PUBLISHED') throw new NotFoundException('Article not found');

    const skip = (page - 1) * limit;
    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { articleId: article.id, status: 'APPROVED', parentId: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true } },
          replies: {
            where: { status: 'APPROVED' },
            orderBy: { createdAt: 'asc' },
            include: { user: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.comment.count({ where: { articleId: article.id, status: 'APPROVED' } }),
    ]);

    return { data: comments, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async countByArticle(articleId: string) {
    return this.prisma.comment.count({ where: { articleId, status: 'APPROVED' } });
  }

  async findAll(page = 1, limit = 20, status?: CommentStatus, articleId?: string, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (articleId) where.articleId = articleId;
    if (search) {
      where.OR = [
        { content: { contains: search, mode: 'insensitive' } },
        { guestName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true } },
          article: { select: { id: true, title: true, slug: true } },
        },
      }),
      this.prisma.comment.count({ where }),
    ]);

    return { data: comments, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async moderate(id: string, status: CommentStatus, moderatedById: string, reason?: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');

    return this.prisma.comment.update({
      where: { id },
      data: { status, moderatedAt: new Date(), moderatedById },
    });
  }

  async remove(id: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    await this.prisma.comment.update({ where: { id }, data: { status: 'DELETED', moderatedAt: new Date() } });
    return { message: 'Comment deleted' };
  }

  async report(id: string, reason: string, reportedBy?: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');

    const reportKey = `${id}:${reportedBy || 'guest'}:${reason.trim().toLowerCase()}`;
    const lastReport = this.recentReports.get(reportKey);
    if (lastReport && Date.now() - lastReport < 60_000) {
      throw new BadRequestException('Comment already reported recently');
    }
    this.recentReports.set(reportKey, Date.now());

    return this.prisma.commentReport.create({
      data: { commentId: id, reason, reportedBy },
    });
  }

  async getReports(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;

    const [reports, total] = await Promise.all([
      this.prisma.commentReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          comment: { include: { article: { select: { id: true, title: true, slug: true } } } },
        },
      }),
      this.prisma.commentReport.count({ where }),
    ]);

    return { data: reports, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
