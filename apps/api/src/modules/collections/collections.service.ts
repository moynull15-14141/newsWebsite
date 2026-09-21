import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: string) {
    return this.prisma.editorialCollection.findMany({ where: status ? { status: status as any } : {}, orderBy: { updatedAt: 'desc' }, include: { _count: { select: { articles: true } } } });
  }

  async create(data: { name: string; slug: string; description?: string; coverImageId?: string; status?: string; articleIds?: string[] }, userId: string) {
    return this.prisma.editorialCollection.create({ data: { name: data.name, slug: data.slug, description: data.description, coverImageId: data.coverImageId, status: (data.status || 'DRAFT') as any, createdById: userId, articles: data.articleIds?.length ? { create: data.articleIds.map((articleId, index) => ({ articleId, sortOrder: index })) } : undefined }, include: { articles: true } });
  }

  async update(id: string, data: { name?: string; slug?: string; description?: string; coverImageId?: string; status?: string; articleIds?: string[] }) {
    const existing = await this.prisma.editorialCollection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Collection not found');
    return this.prisma.$transaction(async (tx) => {
      if (data.articleIds) {
        await tx.articleCollection.deleteMany({ where: { collectionId: id } });
        if (data.articleIds.length) await tx.articleCollection.createMany({ data: data.articleIds.map((articleId, index) => ({ collectionId: id, articleId, sortOrder: index })) });
      }
      return tx.editorialCollection.update({ where: { id }, data: { name: data.name, slug: data.slug, description: data.description, coverImageId: data.coverImageId, status: data.status as any }, include: { articles: true } });
    });
  }

  async remove(id: string) {
    await this.prisma.editorialCollection.delete({ where: { id } });
    return { message: 'Collection deleted' };
  }

  async publicList() {
    return this.prisma.editorialCollection.findMany({ where: { status: 'PUBLISHED' }, orderBy: { updatedAt: 'desc' }, select: { id: true, name: true, slug: true, description: true, coverImage: { select: { publicUrl: true, altText: true } }, _count: { select: { articles: true } } } });
  }

  async publicOne(slug: string) {
    const collection = await this.prisma.editorialCollection.findFirst({ where: { slug, status: 'PUBLISHED' }, select: { id: true, name: true, slug: true, description: true, coverImage: { select: { publicUrl: true, altText: true } }, articles: { where: { article: { status: 'PUBLISHED', OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] } }, orderBy: { sortOrder: 'asc' }, include: { article: { select: { id: true, title: true, slug: true, excerpt: true, publishedAt: true, viewCount: true, category: { select: { name: true, slug: true } } } } } } } });
    if (!collection) throw new NotFoundException('Collection not found');
    return { ...collection, articles: collection.articles.map((item) => item.article) };
  }
}
