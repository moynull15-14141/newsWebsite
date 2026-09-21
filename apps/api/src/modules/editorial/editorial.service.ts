import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EditorialService {
  constructor(private readonly prisma: PrismaService) {}

  async addNote(articleId: string, authorId: string, content: string) {
    await this.prisma.article.findUniqueOrThrow({ where: { id: articleId } });
    return this.prisma.articleNote.create({ data: { articleId, authorId, content: content.trim() }, include: { author: { select: { id: true, name: true } } } });
  }

  async getNotes(articleId: string) {
    return this.prisma.articleNote.findMany({ where: { articleId }, orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, name: true } } } });
  }

  async addCorrection(articleId: string, correctedById: string, description: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId, status: 'PUBLISHED' } });
    if (!article) throw new NotFoundException('Published article not found');
    return this.prisma.articleCorrection.create({ data: { articleId, correctedById, description: description.trim() } });
  }

  async getPublicCorrections(articleId: string) {
    return this.prisma.articleCorrection.findMany({ where: { articleId }, orderBy: { correctedAt: 'desc' }, select: { id: true, description: true, correctedAt: true } });
  }

  async getSettings() {
    const rows = await this.prisma.platformSetting.findMany();
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async updateSettings(values: Record<string, unknown>, updatedById: string) {
    const allowed = ['siteName', 'siteDescription', 'defaultSeoTitle', 'defaultSeoDescription', 'contactEmail', 'defaultLanguage', 'socialLinks'];
    await this.prisma.$transaction(allowed.filter((key) => values[key] !== undefined).map((key) => this.prisma.platformSetting.upsert({ where: { key }, update: { value: values[key] as any, updatedById }, create: { key, value: values[key] as any, updatedById } })));
    return this.getSettings();
  }
}
