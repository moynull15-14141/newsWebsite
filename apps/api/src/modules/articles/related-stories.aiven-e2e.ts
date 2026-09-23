import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { ArticlesModule } from './articles.module';
import { ArticlesService } from './articles.service';
import { PublicModule } from '../public/public.module';
import { PublicService } from '../public/public.service';

config({ path: '../../.env' });
jest.setTimeout(60_000);

describe('Phase 2L manual related stories (real Aiven E2E)', () => {
  let prisma: PrismaService;
  let articles: ArticlesService;
  let publicService: PublicService;
  const marker = `phase2l-related-${randomUUID()}`;
  const articleIds: string[] = [];
  let userId = '';

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || '');
    if (!url.hostname.endsWith('.aivencloud.com')) throw new Error('Refusing E2E: DATABASE_URL is not Aiven');
    const moduleRef = await Test.createTestingModule({ imports: [PrismaModule, ArticlesModule, PublicModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    articles = moduleRef.get(ArticlesService);
    publicService = moduleRef.get(PublicService);
    const user = await prisma.user.create({ data: { name: marker, email: `${marker}@example.invalid`, passwordHash: marker } });
    userId = user.id;
    const category = await prisma.category.findFirstOrThrow({ select: { id: true } });
    const language = await prisma.language.findFirstOrThrow({ where: { isDefault: true }, select: { id: true } });
    const base = { authorId: userId, categoryId: category.id, languageId: language.id, content: { type: 'doc', content: [] } };
    const created = await Promise.all([
      prisma.article.create({ data: { ...base, title: `${marker} source`, slug: `${marker}-source`, status: 'PUBLISHED', publishedAt: new Date() } }),
      prisma.article.create({ data: { ...base, title: `${marker} manual`, slug: `${marker}-manual`, status: 'PUBLISHED', publishedAt: new Date() } }),
      prisma.article.create({ data: { ...base, title: `${marker} draft`, slug: `${marker}-draft`, status: 'DRAFT' } }),
      prisma.article.create({ data: { ...base, title: `${marker} future`, slug: `${marker}-future`, status: 'PUBLISHED', publishedAt: new Date('2099-01-01') } }),
    ]);
    articleIds.push(...created.map((row) => row.id));
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.articleRelated.deleteMany({ where: { OR: [{ articleId: { in: articleIds } }, { relatedArticleId: { in: articleIds } }] } });
      await prisma.articleAuditLog.deleteMany({ where: { articleId: { in: articleIds } } });
      await prisma.article.deleteMany({ where: { id: { in: articleIds } } });
      if (userId) await prisma.user.delete({ where: { id: userId } });
      expect(await prisma.article.count({ where: { id: { in: articleIds } } })).toBe(0);
    }
  });

  it('persists manual order, audits it, and publicly excludes draft/future targets', async () => {
    const [sourceId, eligibleId, draftId, futureId] = articleIds;
    const managed = await articles.updateManualRelated(sourceId, [eligibleId, draftId, futureId], userId);
    expect(managed.manual.map((row) => row.id)).toEqual([eligibleId, draftId, futureId]);
    const audit = await prisma.articleAuditLog.findFirst({ where: { articleId: sourceId, action: 'RELATED_STORIES_UPDATED' } });
    expect(audit?.actorId).toBe(userId);
    const source = await prisma.article.findUniqueOrThrow({ where: { id: sourceId }, include: { articleTags: true } });
    const visible = await publicService.getRelatedArticles(sourceId, source.categoryId ?? undefined, [], undefined, source.languageId);
    expect(visible[0]?.id).toBe(eligibleId);
    expect(visible.some((row) => row.id === draftId || row.id === futureId)).toBe(false);
  });
});
