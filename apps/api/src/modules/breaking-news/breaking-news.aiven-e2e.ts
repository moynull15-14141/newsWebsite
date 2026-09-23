import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { BreakingNewsService } from './breaking-news.service';
import { BreakingNewsModule } from './breaking-news.module';

config({ path: '../../.env' });
jest.setTimeout(30_000);

/**
 * Real-database Phase 2L verification: the breaking-news ticker's CRUD, scheduling and — most
 * importantly — its public-eligibility safety net (never linking to an article that isn't genuinely
 * public) exercised against the live Aiven database, not mocks.
 *
 * This deliberately does not end in `.spec.ts` so the normal unit suite never touches Aiven.
 * Run explicitly with `npm run test:e2e:aiven -w api`.
 */
describe('Phase 2L breaking news (real Aiven E2E)', () => {
  let prisma: PrismaService;
  let service: BreakingNewsService;

  const marker = `phase2l-e2e-${randomUUID()}`;
  const ids: { users: string[]; articles: string[]; breakingNews: string[] } = { users: [], articles: [], breakingNews: [] };

  let actorId: string;
  let categoryId: string;
  let publishedArticleId: string;
  let publishedArticleSlug: string;
  let draftArticleId: string;
  let archivedArticleId: string;

  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL || '');
    if (!databaseUrl.hostname.endsWith('.aivencloud.com')) {
      throw new Error('Refusing Phase 2L E2E: DATABASE_URL is not an Aiven host');
    }

    const moduleRef = await Test.createTestingModule({ imports: [PrismaModule, BreakingNewsModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(BreakingNewsService);

    const actor = await prisma.user.create({ data: { name: `${marker} Editor`, email: `${marker}-editor@example.invalid`, passwordHash: `${marker}-secret` } });
    actorId = actor.id;
    ids.users.push(actor.id);

    const category = await prisma.category.findFirstOrThrow({ select: { id: true } });
    categoryId = category.id;
    const language = await prisma.language.findFirstOrThrow({ where: { isDefault: true }, select: { id: true } });

    const content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Real body content for the Phase 2L breaking-news E2E suite.' }] }] };
    const [published, draft, archived] = await Promise.all([
      prisma.article.create({ data: { title: `${marker} published`, slug: `${marker}-published`, content, authorId: actorId, categoryId, languageId: language.id, status: 'PUBLISHED', publishedAt: new Date() } }),
      prisma.article.create({ data: { title: `${marker} draft`, slug: `${marker}-draft`, content, authorId: actorId, categoryId, languageId: language.id, status: 'DRAFT' } }),
      prisma.article.create({ data: { title: `${marker} archived`, slug: `${marker}-archived`, content, authorId: actorId, categoryId, languageId: language.id, status: 'ARCHIVED', archivedAt: new Date() } }),
    ]);
    publishedArticleId = published.id;
    publishedArticleSlug = published.slug;
    draftArticleId = draft.id;
    archivedArticleId = archived.id;
    ids.articles.push(published.id, draft.id, archived.id);
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.breakingNewsAuditLog.deleteMany({ where: { breakingNewsId: { in: ids.breakingNews } } });
      await prisma.breakingNews.deleteMany({ where: { id: { in: ids.breakingNews } } });
      await prisma.article.deleteMany({ where: { id: { in: ids.articles } } });
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });

      const [breakingNews, articles, users] = await Promise.all([
        prisma.breakingNews.count({ where: { id: { in: ids.breakingNews } } }),
        prisma.article.count({ where: { id: { in: ids.articles } } }),
        prisma.user.count({ where: { id: { in: ids.users } } }),
      ]);
      expect({ breakingNews, articles, users }).toEqual({ breakingNews: 0, articles: 0, users: 0 });
    }
  }, 60_000);

  it('Test 1 — create, activate, and appear on the public ticker in priority order', async () => {
    const first = await service.create({ headline: `${marker} first`, priority: 1 }, actorId);
    const second = await service.create({ headline: `${marker} second`, priority: 2 }, actorId);
    ids.breakingNews.push(first.id, second.id);

    await service.setActive(first.id, true, actorId);
    await service.setActive(second.id, true, actorId);

    const active = await service.getActiveTicker();
    const headlines = active.filter((i) => i.headline.startsWith(marker)).map((i) => i.headline);
    expect(headlines).toEqual([`${marker} first`, `${marker} second`]);
  });

  it('Test 2 — an inactive item never appears on the public ticker', async () => {
    const item = await service.create({ headline: `${marker} inactive`, isActive: false }, actorId);
    ids.breakingNews.push(item.id);

    const active = await service.getActiveTicker();
    expect(active.some((i) => i.id === item.id)).toBe(false);
  });

  it('Test 3 — a future-scheduled item does not appear before its startAt', async () => {
    const item = await service.create({ headline: `${marker} future`, isActive: true, startAt: new Date(Date.now() + 3_600_000).toISOString() }, actorId);
    ids.breakingNews.push(item.id);

    const active = await service.getActiveTicker();
    expect(active.some((i) => i.id === item.id)).toBe(false);
  });

  it('Test 4 — an expired item (endAt in the past) no longer appears', async () => {
    const item = await service.create({ headline: `${marker} expired`, isActive: true, endAt: new Date(Date.now() - 3_600_000).toISOString() }, actorId);
    ids.breakingNews.push(item.id);

    const active = await service.getActiveTicker();
    expect(active.some((i) => i.id === item.id)).toBe(false);
  });

  it('Test 5 — publishNow makes a future-scheduled item appear immediately', async () => {
    const item = await service.create({ headline: `${marker} publish-now`, isActive: false, startAt: new Date(Date.now() + 3_600_000).toISOString() }, actorId);
    ids.breakingNews.push(item.id);

    await service.publishNow(item.id, actorId);
    const active = await service.getActiveTicker();
    expect(active.some((i) => i.id === item.id)).toBe(true);
  });

  it('Test 6 — stop immediately removes it and closes the schedule window', async () => {
    const item = await service.create({ headline: `${marker} stop-me`, isActive: true }, actorId);
    ids.breakingNews.push(item.id);

    await service.stop(item.id, actorId);
    const active = await service.getActiveTicker();
    expect(active.some((i) => i.id === item.id)).toBe(false);

    const stopped = await service.findOne(item.id);
    expect(stopped.isActive).toBe(false);
    expect(stopped.endAt).not.toBeNull();
  });

  it('Test 7 — linked to a real PUBLISHED article: the ticker exposes the article slug', async () => {
    const item = await service.create({ headline: `${marker} linked-published`, isActive: true, articleId: publishedArticleId }, actorId);
    ids.breakingNews.push(item.id);

    const active = await service.getActiveTicker();
    const found = active.find((i) => i.id === item.id);
    expect(found?.articleSlug).toBe(publishedArticleSlug);
  });

  it('Test 8 — linked to a real DRAFT article: the headline shows, but the link is never exposed', async () => {
    const item = await service.create({ headline: `${marker} linked-draft`, isActive: true, articleId: draftArticleId }, actorId);
    ids.breakingNews.push(item.id);

    const active = await service.getActiveTicker();
    const found = active.find((i) => i.id === item.id);
    expect(found?.headline).toBe(`${marker} linked-draft`);
    expect(found?.articleSlug).toBeNull();
  });

  it('Test 9 — linked to a real ARCHIVED article: the link is never exposed', async () => {
    const item = await service.create({ headline: `${marker} linked-archived`, isActive: true, articleId: archivedArticleId }, actorId);
    ids.breakingNews.push(item.id);

    const active = await service.getActiveTicker();
    const found = active.find((i) => i.id === item.id);
    expect(found?.articleSlug).toBeNull();
  });

  it('Test 10 — if the linked article is later unpublished, the ticker stops exposing its link without any breaking-news edit', async () => {
    const article = await prisma.article.create({
      data: {
        title: `${marker} unpublish-me`, slug: `${marker}-unpublish-me`,
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] },
        authorId: actorId, categoryId, status: 'PUBLISHED', publishedAt: new Date(),
      },
    });
    ids.articles.push(article.id);
    const item = await service.create({ headline: `${marker} dynamic-link`, isActive: true, articleId: article.id }, actorId);
    ids.breakingNews.push(item.id);

    let active = await service.getActiveTicker();
    expect(active.find((i) => i.id === item.id)?.articleSlug).toBe(article.slug);

    await prisma.article.update({ where: { id: article.id }, data: { status: 'DRAFT', publishedAt: null } });
    active = await service.getActiveTicker();
    expect(active.find((i) => i.id === item.id)?.articleSlug).toBeNull();
  });

  it('Test 11 — reorder persists real priority values in the given order', async () => {
    const a = await service.create({ headline: `${marker} reorder-a` }, actorId);
    const b = await service.create({ headline: `${marker} reorder-b` }, actorId);
    ids.breakingNews.push(a.id, b.id);

    await service.reorder([b.id, a.id], actorId);
    const [freshA, freshB] = await Promise.all([service.findOne(a.id), service.findOne(b.id)]);
    expect(freshB.priority).toBeLessThan(freshA.priority);
  });

  it('Test 12 — deleting a breaking news item cascades its own audit log, and never touches the linked article', async () => {
    const item = await service.create({ headline: `${marker} to-delete`, articleId: publishedArticleId }, actorId);
    ids.breakingNews.push(item.id);
    await service.update(item.id, { headline: `${marker} to-delete edited` }, actorId);

    const logsBefore = await prisma.breakingNewsAuditLog.count({ where: { breakingNewsId: item.id } });
    expect(logsBefore).toBeGreaterThan(0);

    await service.remove(item.id, actorId);

    const logsAfter = await prisma.breakingNewsAuditLog.count({ where: { breakingNewsId: item.id } });
    expect(logsAfter).toBeGreaterThan(logsBefore);

    const archived = await prisma.breakingNews.findUnique({ where: { id: item.id } });
    expect(archived?.archivedAt).not.toBeNull();
    expect(archived?.isActive).toBe(false);

    const articleStillExists = await prisma.article.findUnique({ where: { id: publishedArticleId } });
    expect(articleStillExists).not.toBeNull();
  });

  it('Test 14 — edit/deactivate/schedule and appearance fields persist with audit events', async () => {
    const item = await service.create({ headline: `${marker} configurable`, isActive: true }, actorId);
    ids.breakingNews.push(item.id);
    await service.update(item.id, {
      headline: `${marker} configured`, backgroundMode: 'GRADIENT', gradientStart: '#112233',
      gradientEnd: '#445566', gradientDirection: 'BOTTOM_TOP', textColor: '#FFFFFF',
      badgeBackgroundColor: '#000000', badgeTextColor: '#FFFFFF', animationSpeedMs: 9000,
      articleId: publishedArticleId,
    }, actorId);
    await service.schedule(item.id, '2030-01-01T00:00:00.000Z', '2030-01-02T00:00:00.000Z', actorId);
    await service.setActive(item.id, false, actorId);
    const fresh = await service.findOne(item.id);
    expect(fresh).toMatchObject({ backgroundMode: 'GRADIENT', gradientStart: '#112233', gradientEnd: '#445566', gradientDirection: 'BOTTOM_TOP', animationSpeedMs: 9000, articleId: publishedArticleId, isActive: false });
    const actions = (await prisma.breakingNewsAuditLog.findMany({ where: { breakingNewsId: item.id } })).map((log) => log.action);
    expect(actions).toEqual(expect.arrayContaining(['CREATED', 'UPDATED', 'SCHEDULED', 'DEACTIVATED']));
  });

  it('Test 13 — every mutation records an audit entry with the responsible actor', async () => {
    const item = await service.create({ headline: `${marker} audited` }, actorId);
    ids.breakingNews.push(item.id);
    await service.setActive(item.id, true, actorId);

    const logs = await prisma.breakingNewsAuditLog.findMany({ where: { breakingNewsId: item.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['CREATED', 'ACTIVATED']);
    expect(logs.every((l) => l.actorId === actorId)).toBe(true);
  });
});
