import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { ArticlesService } from './articles.service';
import { ArticlesModule } from './articles.module';
import { EditorialService } from '../editorial/editorial.service';
import { isPubliclyEligible } from './public-eligibility';

config({ path: '../../.env' });
jest.setTimeout(30_000);

/**
 * Real-database Phase 2H verification: the editorial governance layer (workflow transitions,
 * separation of duties, audit trail, published-article edit safety, corrections, scheduled
 * publishing eligibility) exercised against the live Aiven database, not mocks.
 *
 * This deliberately does not end in `.spec.ts` so the normal unit suite never touches Aiven.
 * Run explicitly with `npm run test:e2e:aiven -w api`.
 */
describe('Phase 2H editorial governance (real Aiven E2E)', () => {
  let prisma: PrismaService;
  let articlesService: ArticlesService;
  let editorialService: EditorialService;

  const marker = `phase2h-e2e-${randomUUID()}`;
  const ids: { users: string[]; articles: string[] } = { users: [], articles: [] };

  let reporterId: string;
  let editorId: string;
  let categoryId: string;

  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL || '');
    if (!databaseUrl.hostname.endsWith('.aivencloud.com')) {
      throw new Error('Refusing Phase 2H E2E: DATABASE_URL is not an Aiven host');
    }

    const moduleRef = await Test.createTestingModule({ imports: [PrismaModule, ArticlesModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    articlesService = moduleRef.get(ArticlesService);
    editorialService = new EditorialService(prisma);

    const [reporter, editor] = await Promise.all([
      prisma.user.create({ data: { name: `${marker} Reporter`, email: `${marker}-reporter@example.invalid`, passwordHash: `${marker}-secret` } }),
      prisma.user.create({ data: { name: `${marker} Editor`, email: `${marker}-editor@example.invalid`, passwordHash: `${marker}-secret` } }),
    ]);
    reporterId = reporter.id;
    editorId = editor.id;
    ids.users.push(reporter.id, editor.id);

    const category = await prisma.category.findFirstOrThrow({ select: { id: true } });
    categoryId = category.id;
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.articleAuditLog.deleteMany({ where: { articleId: { in: ids.articles } } });
      await prisma.articleNote.deleteMany({ where: { articleId: { in: ids.articles } } });
      await prisma.articleCorrection.deleteMany({ where: { articleId: { in: ids.articles } } });
      await prisma.articleRevision.deleteMany({ where: { articleId: { in: ids.articles } } });
      await prisma.article.deleteMany({ where: { id: { in: ids.articles } } });
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });

      const [articles, users] = await Promise.all([
        prisma.article.count({ where: { id: { in: ids.articles } } }),
        prisma.user.count({ where: { id: { in: ids.users } } }),
      ]);
      expect({ articles, users }).toEqual({ articles: 0, users: 0 });
    }
  }, 60_000);

  it('Test 1 — draft lifecycle: DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED, ineligible until published', async () => {
    const article = await articlesService.create(
      { title: `${marker} lifecycle`, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Real news body text for the Phase 2H governance E2E suite.' }] }] } as any, categoryId },
      reporterId,
    );
    ids.articles.push(article.id);
    expect(article.status).toBe('DRAFT');
    expect(isPubliclyEligible(article)).toBe(false);

    const inReview = await articlesService.submitReview(article.id, reporterId);
    expect(inReview.status).toBe('IN_REVIEW');
    expect(isPubliclyEligible(inReview)).toBe(false);

    const approved = await articlesService.approve(article.id, editorId, ['article.review']);
    expect(approved.status).toBe('APPROVED');
    expect(isPubliclyEligible(approved)).toBe(false);

    const published = await articlesService.publish(article.id, editorId);
    expect(published.status).toBe('PUBLISHED');
    expect(isPubliclyEligible(published)).toBe(true);

    const auditActions = (await articlesService.getAuditLog(article.id, editorId, ['audit.read'])).data.map((e) => e.action);
    expect(auditActions).toEqual(expect.arrayContaining(['CREATED', 'SUBMITTED_FOR_REVIEW', 'APPROVED', 'PUBLISHED']));
  });

  it('Test 2 — unauthorized transitions are rejected: self-approval and cross-user submit', async () => {
    const article = await articlesService.create(
      { title: `${marker} unauthorized`, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Real news body text for the Phase 2H governance E2E suite.' }] }] } as any, categoryId },
      reporterId,
    );
    ids.articles.push(article.id);

    // Only the author may submit their own draft for review.
    await expect(articlesService.submitReview(article.id, editorId)).rejects.toThrow(ForbiddenException);

    await articlesService.submitReview(article.id, reporterId);

    // The reporter (author) cannot approve their own article even if handed reviewer permission,
    // unless they also hold article.publish (separation of duties).
    await expect(articlesService.approve(article.id, reporterId, ['article.review'])).rejects.toThrow(ForbiddenException);

    // A different reviewer can.
    const approved = await articlesService.approve(article.id, editorId, ['article.review']);
    expect(approved.status).toBe('APPROVED');
  });

  it('Test 3 — review / request changes: reason is captured on the audit trail', async () => {
    const article = await articlesService.create(
      { title: `${marker} request-changes`, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Real news body text for the Phase 2H governance E2E suite.' }] }] } as any, categoryId },
      reporterId,
    );
    ids.articles.push(article.id);
    await articlesService.submitReview(article.id, reporterId);

    const reason = 'Needs a second source for paragraph 2';
    const returned = await articlesService.returnToDraft(article.id, editorId, reason);
    expect(returned.status).toBe('DRAFT');

    const log = await articlesService.getAuditLog(article.id, editorId, ['audit.read']);
    const entry = log.data.find((e) => e.action === 'RETURNED_TO_DRAFT');
    expect(entry?.note).toBe(reason);
    expect(entry?.actorId).toBe(editorId);
  });

  it('Test 4 — revision history: each edit is attributable and versioned', async () => {
    const article = await articlesService.create(
      { title: `${marker} revisions v1`, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Real news body text for the Phase 2H governance E2E suite.' }] }] } as any, categoryId },
      reporterId,
    );
    ids.articles.push(article.id);

    await articlesService.saveRevision(article.id, reporterId, 'first pass');
    await articlesService.update(article.id, { title: `${marker} revisions v2` }, reporterId, []);
    await articlesService.saveRevision(article.id, reporterId, 'second pass');

    const revisions = await articlesService.getRevisions(article.id, reporterId, []);
    expect(revisions.length).toBeGreaterThanOrEqual(2);
    expect(revisions.every((r) => r.changedById === reporterId)).toBe(true);
  });

  it('Test 5 — published-edit safety: editing live content snapshots a revision and logs a distinct action', async () => {
    const article = await articlesService.create(
      { title: `${marker} publish-safety`, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Real news body text for the Phase 2H governance E2E suite.' }] }] } as any, categoryId },
      reporterId,
    );
    ids.articles.push(article.id);
    await articlesService.submitReview(article.id, reporterId);
    await articlesService.approve(article.id, editorId, ['article.review']);
    await articlesService.publish(article.id, editorId);

    const beforeRevisions = await articlesService.getRevisions(article.id, editorId, ['article.read']);
    await articlesService.update(article.id, { title: `${marker} publish-safety edited` }, editorId, ['article.edit']);
    const afterRevisions = await articlesService.getRevisions(article.id, editorId, ['article.read']);

    // The pre-edit state was preserved as a new revision — nothing was silently overwritten.
    expect(afterRevisions.length).toBe(beforeRevisions.length + 1);
    const auditActions = (await articlesService.getAuditLog(article.id, editorId, ['audit.read'])).data.map((e) => e.action);
    expect(auditActions).toContain('LIVE_CONTENT_EDITED');
  });

  it('Test 6 — scheduled publication: not publicly eligible before its scheduled time', async () => {
    const article = await articlesService.create(
      { title: `${marker} scheduled`, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Real news body text for the Phase 2H governance E2E suite.' }] }] } as any, categoryId },
      reporterId,
    );
    ids.articles.push(article.id);
    await articlesService.submitReview(article.id, reporterId);
    const approved = await articlesService.approve(article.id, editorId, ['article.review']);
    expect(isPubliclyEligible(approved)).toBe(false);

    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const scheduled = await articlesService.scheduleArticle(article.id, future, reporterId, []);
    // Scheduling does not itself publish — the article is still APPROVED, not public, until the
    // cron sweep (PublishingService.executeScheduledPublications) promotes it after the time passes.
    expect(scheduled.status).toBe('APPROVED');
    expect(isPubliclyEligible(scheduled)).toBe(false);
  });

  it('Test 7 — correction: recorded, attributable, and publicly visible only for published articles', async () => {
    const article = await articlesService.create(
      { title: `${marker} correction`, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Real news body text for the Phase 2H governance E2E suite.' }] }] } as any, categoryId },
      reporterId,
    );
    ids.articles.push(article.id);

    await expect(editorialService.addCorrection(article.id, editorId, 'Too early — not published yet')).rejects.toThrow();

    await articlesService.submitReview(article.id, reporterId);
    await articlesService.approve(article.id, editorId, ['article.review']);
    await articlesService.publish(article.id, editorId);

    await editorialService.addCorrection(article.id, editorId, 'Corrected the casualty figure in paragraph 3');
    const publicCorrections = await editorialService.getPublicCorrections(article.id);
    expect(publicCorrections).toHaveLength(1);
    expect(publicCorrections[0].description).toContain('casualty figure');

    const auditActions = (await articlesService.getAuditLog(article.id, editorId, ['audit.read'])).data.map((e) => e.action);
    expect(auditActions).toContain('CORRECTED');
  });

  it('Test 8 — audit trail: accumulates one entry per meaningful action, newest first', async () => {
    const article = await articlesService.create(
      { title: `${marker} audit-trail`, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Real news body text for the Phase 2H governance E2E suite.' }] }] } as any, categoryId },
      reporterId,
    );
    ids.articles.push(article.id);
    await articlesService.submitReview(article.id, reporterId);
    await articlesService.returnToDraft(article.id, editorId, 'typo in the title');

    const log = await articlesService.getAuditLog(article.id, editorId, ['audit.read']);
    expect(log.data.map((e) => e.action)).toEqual(['RETURNED_TO_DRAFT', 'SUBMITTED_FOR_REVIEW', 'CREATED']);
    expect(new Date(log.data[0].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(log.data[1].createdAt).getTime());
  });

  it('Test 9 — public isolation: draft, in-review and approved-not-published articles are never publicly eligible', async () => {
    const draft = await articlesService.create({ title: `${marker} iso-draft`, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Real news body text for the Phase 2H governance E2E suite.' }] }] } as any, categoryId }, reporterId);
    ids.articles.push(draft.id);
    const inReview = await articlesService.submitReview(draft.id, reporterId);
    expect(isPubliclyEligible(inReview)).toBe(false);

    const approved = await articlesService.approve(draft.id, editorId, ['article.review']);
    expect(isPubliclyEligible(approved)).toBe(false);

    const archived = await articlesService.publish(draft.id, editorId).then((p) => articlesService.archive(p.id, editorId));
    expect(isPubliclyEligible(archived)).toBe(false);
  });

  it('Test 10 — hard-delete is refused once an article has real editorial history (preserves auditability)', async () => {
    const article = await articlesService.create({ title: `${marker} delete-guard`, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Real news body text for the Phase 2H governance E2E suite.' }] }] } as any, categoryId }, reporterId);
    ids.articles.push(article.id);
    await articlesService.submitReview(article.id, reporterId);

    await expect(articlesService.remove(article.id, reporterId, ['article.delete'])).rejects.toThrow();
    // Still present — will be cleaned up by afterAll via direct Prisma delete, not the API.
    const stillThere = await prisma.article.findUnique({ where: { id: article.id } });
    expect(stillThere).not.toBeNull();
  });

  it('Test 11 — stale write is rejected with 409-equivalent ARTICLE_VERSION_CONFLICT; no data corruption', async () => {
    const article = await articlesService.create(
      { title: `${marker} concurrency`, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original body.' }] }] } as any, categoryId },
      reporterId,
    );
    ids.articles.push(article.id);
    const versionA = article.updatedAt.toISOString();

    const firstUpdate = await articlesService.update(article.id, { excerpt: 'First save', expectedUpdatedAt: versionA }, reporterId, []);
    expect(firstUpdate.excerpt).toBe('First save');

    // A second editor still holding the OLD version tries to save — must be rejected, not merged/overwritten.
    await expect(
      articlesService.update(article.id, { excerpt: 'Stale save should be rejected', expectedUpdatedAt: versionA }, reporterId, []),
    ).rejects.toThrow(ConflictException);

    const final = await prisma.article.findUniqueOrThrow({ where: { id: article.id } });
    expect(final.excerpt).toBe('First save'); // the stale write never took effect
  });

  it('Test 12 — blocking validation: an empty-body article cannot be submitted for review or published', async () => {
    const article = await articlesService.create({ title: `${marker} empty-body`, categoryId }, reporterId);
    ids.articles.push(article.id);

    await expect(articlesService.submitReview(article.id, reporterId)).rejects.toThrow(BadRequestException);

    const readiness = await articlesService.getReadiness(article.id);
    expect(readiness.blocking.map((i) => i.code)).toContain('MISSING_CONTENT');

    // Once real content is added, the same transition succeeds.
    await articlesService.update(article.id, { content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Now it has a body.' }] }] } }, reporterId, []);
    const inReview = await articlesService.submitReview(article.id, reporterId);
    expect(inReview.status).toBe('IN_REVIEW');
  });

  it('Test 13 — readiness warnings surface missing metadata via the SEO analyzer without duplicating it', async () => {
    const article = await articlesService.create(
      { title: `${marker} readiness-warnings`, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A published-quality body of real text for this check.' }] }] } as any, categoryId },
      reporterId,
    );
    ids.articles.push(article.id);

    const readiness = await articlesService.getReadiness(article.id);
    expect(readiness.blocking).toEqual([]);
    // No featured image / SEO description were set — the analyzer should flag both as warnings.
    expect(readiness.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(['FEATURED_IMAGE', 'META_DESCRIPTION']));
  });
});
