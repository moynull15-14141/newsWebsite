import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicModule } from './public.module';
import { SeoModule } from '../seo/seo.module';
import { SeoService } from '../seo/seo.service';

config({ path: '../../.env' });
jest.setTimeout(30_000);

/**
 * Real-database Phase 2F verification. This file deliberately does not end in `.spec.ts`, so the
 * normal unit suite never touches Aiven. Run explicitly with `npm run test:e2e:aiven -w api`.
 */
describe('Phase 2F public discovery (real Aiven E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  let seoService: SeoService;

  const marker = `phase2f-e2e-${randomUUID()}`;
  const ids: { users: string[]; tags: string[]; articles: string[]; locations: string[] } = {
    users: [], tags: [], articles: [], locations: [],
  };

  let authorId: string;
  let emptyAuthorId: string;
  let activeTagSlug: string;
  let inactiveTagSlug: string;
  let inactiveLocationSlug: string;
  let bangladesh: { id: string; slug: string };
  let division: { id: string; slug: string };
  let district: { id: string; slug: string };

  const get = async (path: string) => {
    const response = await fetch(`${baseUrl}/api/v1${path}`);
    const body = await response.json();
    return { status: response.status, body };
  };

  const expectNoPrivateFields = (value: unknown) => {
    const forbidden = new Set([
      'passwordHash', 'password', 'role', 'roles', 'permissions', 'storageKey',
      'credentials', 'userRoles', 'sessions', 'countryCode', 'latitude', 'longitude',
      'timezone', 'identityKey',
    ]);
    const visit = (item: unknown) => {
      if (!item || typeof item !== 'object') return;
      for (const [key, child] of Object.entries(item as Record<string, unknown>)) {
        expect(forbidden.has(key)).toBe(false);
        if (typeof child === 'string') {
          expect(child).not.toMatch(/(?:[A-Za-z]:\\|\/home\/|\/Users\/|postgres(?:ql)?:\/\/)/i);
        }
        visit(child);
      }
    };
    visit(value);
  };

  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL || '');
    if (!databaseUrl.hostname.endsWith('.aivencloud.com')) {
      throw new Error('Refusing Phase 2F E2E: DATABASE_URL is not an Aiven host');
    }

    const moduleRef = await Test.createTestingModule({ imports: [PrismaModule, PublicModule, SeoModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    prisma = app.get(PrismaService);
    seoService = app.get(SeoService);

    const [bn, en] = await Promise.all([
      prisma.language.findFirstOrThrow({ where: { code: 'bn', isActive: true } }),
      prisma.language.findFirstOrThrow({ where: { code: 'en', isActive: true } }),
    ]);

    bangladesh = await prisma.location.findFirstOrThrow({
      where: { slug: 'bangladesh', type: 'COUNTRY', status: 'ACTIVE' }, select: { id: true, slug: true },
    });
    division = await prisma.location.findFirstOrThrow({
      where: { type: 'DIVISION', status: 'ACTIVE', parentId: bangladesh.id }, select: { id: true, slug: true },
    });
    district = await prisma.location.findFirstOrThrow({
      where: { type: 'DISTRICT', status: 'ACTIVE', parentId: division.id }, select: { id: true, slug: true },
    });

    const [author, emptyAuthor] = await Promise.all([
      prisma.user.create({ data: { name: `${marker} Author`, email: `${marker}-author@example.invalid`, passwordHash: `${marker}-secret` } }),
      prisma.user.create({ data: { name: `${marker} Empty Author`, email: `${marker}-empty@example.invalid`, passwordHash: `${marker}-secret` } }),
    ]);
    authorId = author.id;
    emptyAuthorId = emptyAuthor.id;
    ids.users.push(author.id, emptyAuthor.id);

    activeTagSlug = `${marker}-active`;
    inactiveTagSlug = `${marker}-inactive`;
    const [activeTag, inactiveTag] = await Promise.all([
      prisma.tag.create({
        data: {
          name: `${marker} base`, slug: activeTagSlug, status: 'ACTIVE',
          translations: { create: [
            { languageId: bn.id, name: `${marker} বাংলা`, slug: `${marker}-bn` },
            { languageId: en.id, name: `${marker} English`, slug: `${marker}-en` },
          ] },
        },
      }),
      prisma.tag.create({ data: { name: `${marker} inactive`, slug: inactiveTagSlug, status: 'INACTIVE' } }),
    ]);
    ids.tags.push(activeTag.id, inactiveTag.id);

    inactiveLocationSlug = `${marker}-inactive-location`;
    const inactiveLocation = await prisma.location.create({
      data: {
        name: `${marker} inactive location`, slug: inactiveLocationSlug, type: 'OTHER',
        identityKey: `OTHER::${inactiveLocationSlug}`, status: 'INACTIVE',
      },
    });
    ids.locations.push(inactiveLocation.id);

    const articleData = [
      { title: `${marker} বাংলা one`, slug: `${marker}-bn-1`, status: 'PUBLISHED' as const, languageId: bn.id, publishedAt: new Date('2090-01-04T00:00:00Z') },
      { title: `${marker} বাংলা two`, slug: `${marker}-bn-2`, status: 'PUBLISHED' as const, languageId: bn.id, publishedAt: new Date('2090-01-03T00:00:00Z') },
      { title: `${marker} English`, slug: `${marker}-en-1`, status: 'PUBLISHED' as const, languageId: en.id, publishedAt: new Date('2090-01-02T00:00:00Z') },
      { title: `${marker} fallback`, slug: `${marker}-fallback`, status: 'PUBLISHED' as const, languageId: null, publishedAt: new Date('2090-01-01T00:00:00Z') },
      { title: `${marker} draft`, slug: `${marker}-draft`, status: 'DRAFT' as const, languageId: bn.id, publishedAt: null },
    ];
    for (const data of articleData) {
      const article = await prisma.article.create({
        data: {
          ...data, excerpt: `${marker} excerpt`, content: { type: 'doc', content: [] },
          authorId, locationId: district.id,
          articleTags: { create: { tagId: activeTag.id } },
        },
      });
      ids.articles.push(article.id);
    }
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      // Only records whose exact IDs were created by this run are touched.
      await prisma.article.deleteMany({ where: { id: { in: ids.articles } } });
      await prisma.tag.deleteMany({ where: { id: { in: ids.tags } } });
      await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });

      const [articles, tags, locations, users] = await Promise.all([
        prisma.article.count({ where: { id: { in: ids.articles } } }),
        prisma.tag.count({ where: { id: { in: ids.tags } } }),
        prisma.location.count({ where: { id: { in: ids.locations } } }),
        prisma.user.count({ where: { id: { in: ids.users } } }),
      ]);
      expect({ articles, tags, locations, users }).toEqual({ articles: 0, tags: 0, locations: 0, users: 0 });
    }
    if (app) await app.close();
  }, 60_000);

  it('verifies tags, localization, pagination, active-only and published-only behavior', async () => {
    const metadata = await get(`/public/tags/${activeTagSlug}`);
    expect(metadata.status).toBe(200);
    expect(metadata.body.name).toBe(`${marker} base`);
    expect(metadata.body.translations).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: `${marker} বাংলা`, language: expect.objectContaining({ code: 'bn' }) }),
      expect.objectContaining({ name: `${marker} English`, language: expect.objectContaining({ code: 'en' }) }),
    ]));

    const page1 = await get(`/public/tags/${activeTagSlug}/articles?lang=bn&page=1&limit=1`);
    const page2 = await get(`/public/tags/${activeTagSlug}/articles?lang=bn&page=2&limit=1`);
    expect(page1.status).toBe(200);
    expect(page1.body.meta).toMatchObject({ page: 1, limit: 1, total: 3, totalPages: 3 });
    expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id);
    expect(JSON.stringify([page1.body, page2.body])).not.toContain(`${marker} draft`);

    const english = await get(`/public/tags/${activeTagSlug}/articles?lang=en&page=1&limit=10`);
    expect(english.body.data.map((article: any) => article.title)).toEqual([`${marker} English`]);
    const bangla = await get(`/public/tags/${activeTagSlug}/articles?lang=bn&page=1&limit=10`);
    expect(bangla.body.data.map((article: any) => article.title)).toEqual(expect.arrayContaining([
      `${marker} বাংলা one`, `${marker} বাংলা two`, `${marker} fallback`,
    ]));

    expect((await get(`/public/tags/${inactiveTagSlug}`)).status).toBe(404);
    expect((await get('/public/tags/phase2f-unknown-tag')).status).toBe(404);
    expectNoPrivateFields(metadata.body);
    expectNoPrivateFields(bangla.body);
  });

  it('verifies author safety, empty profiles, pagination and unpublished exclusion', async () => {
    const profile = await get(`/public/authors/${authorId}`);
    expect(profile.status).toBe(200);
    expect(Object.keys(profile.body).sort()).toEqual(['id', 'name']);
    expectNoPrivateFields(profile.body);

    const empty = await get(`/public/authors/${emptyAuthorId}`);
    expect(empty.status).toBe(200);
    expect(empty.body.name).toBe(`${marker} Empty Author`);
    const emptyFeed = await get(`/public/authors/${emptyAuthorId}/articles?lang=bn`);
    expect(emptyFeed.body.meta.total).toBe(0);

    const page1 = await get(`/public/authors/${authorId}/articles?lang=bn&page=1&limit=1`);
    const page2 = await get(`/public/authors/${authorId}/articles?lang=bn&page=2&limit=1`);
    expect(page1.body.meta.totalPages).toBe(3);
    expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id);
    expect(JSON.stringify([page1.body, page2.body])).not.toContain(`${marker} draft`);
    expect((await get('/public/authors/phase2f-unknown-author')).status).toBe(404);
    expectNoPrivateFields(page1.body);
  });

  it('verifies Bangladesh, division, district and generic location hierarchy', async () => {
    const countryMeta = await get('/public/locations/bangladesh?locationType=COUNTRY');
    const divisionMeta = await get(`/public/locations/${division.slug}?locationType=DIVISION`);
    const districtMeta = await get(`/public/locations/${district.slug}?locationType=DISTRICT`);
    expect(countryMeta.status).toBe(200);
    expect(countryMeta.body.type).toBe('COUNTRY');
    expect(divisionMeta.body.parent.slug).toBe('bangladesh');
    expect(districtMeta.body.parent.slug).toBe(division.slug);
    expect(districtMeta.body.parent.parent.slug).toBe('bangladesh');

    for (const [slug, type] of [['bangladesh', 'COUNTRY'], [division.slug, 'DIVISION'], [district.slug, 'DISTRICT']] as const) {
      const feed = await get(`/public/locations/${slug}/articles?locationType=${type}&lang=bn&page=1&limit=20`);
      expect(feed.status).toBe(200);
      const titles = feed.body.data.map((article: any) => article.title);
      expect(titles).toContain(`${marker} বাংলা one`);
      expect(titles).not.toContain(`${marker} draft`);
      expectNoPrivateFields(feed.body);
    }

    const generic = await get(`/public/locations/${district.slug}`);
    expect(generic.status).toBe(200);
    expect(generic.body.type).toBe('DISTRICT');
    expect(generic.body.parent.parent.slug).toBe('bangladesh');
    const listing = await get('/public/locations');
    expect(listing.status).toBe(200);
    expect(listing.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: district.id, type: 'DISTRICT' })]));
    expectNoPrivateFields(listing.body);
    expect((await get('/public/locations/phase2f-unknown-location')).status).toBe(404);
    expect((await get(`/public/locations/${inactiveLocationSlug}`)).status).toBe(404);
    expect((await get('/public/locations/phase2f-unknown-division?locationType=DIVISION')).status).toBe(404);
    expect((await get('/public/locations/phase2f-unknown-district?locationType=DISTRICT')).status).toBe(404);
    expectNoPrivateFields(countryMeta.body);
    expectNoPrivateFields(divisionMeta.body);
    expectNoPrivateFields(districtMeta.body);
  });

  it('verifies Phase 2G SEO against real Aiven records without exposing private data', async () => {
    const published = await prisma.article.findUniqueOrThrow({ where: { id: ids.articles[0] }, select: { id: true, slug: true } });
    const draft = await prisma.article.findUniqueOrThrow({ where: { id: ids.articles[ids.articles.length - 1] }, select: { slug: true } });

    const robots = seoService.getRobots();
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Disallow: /search');
    expect(robots).toContain('/seo/sitemap.xml');

    const index = seoService.getSitemapIndex();
    expect(index).toContain('article-sitemap.xml');
    expect(index).toContain('tag-sitemap.xml');
    expect(index).toContain('author-sitemap.xml');
    expect(index).toContain('location-sitemap.xml');

    const [articles, tags, authors, locations] = await Promise.all([
      seoService.getArticleSitemap(), seoService.getTagSitemap(), seoService.getAuthorSitemap(), seoService.getLocationSitemap(),
    ]);
    expect(articles).toContain(`/article/${published.slug}`);
    expect(articles).not.toContain(`/article/${draft.slug}`);
    expect(tags).toContain(`/tag/${activeTagSlug}`);
    expect(tags).not.toContain(`/tag/${inactiveTagSlug}`);
    expect(authors).toContain(`/author/${authorId}`);
    expect(locations).toContain(district.slug);

    const analysis = await seoService.analyzeArticle(published.id);
    expect(analysis.score).toBeGreaterThanOrEqual(0);
    expect(analysis.score).toBeLessThanOrEqual(100);
    expect(analysis.checks.find((item) => item.id === 'duplicate-description')?.status).toBe('WARNING');

    const health = await seoService.getSiteHealth();
    expect(health.analyzedArticles).toBeGreaterThanOrEqual(ids.articles.length);
    expect(Object.values(health.distribution).reduce((sum, count) => sum + count, 0)).toBe(health.analyzedArticles);

    const response = await get(`/public/articles/${published.slug}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ slug: published.slug, canonicalUrl: null, noIndex: false }));
    expectNoPrivateFields(response.body);

    // Not every translationGroupId has more than one PUBLISHED member — some groups are a single
    // language with no sibling yet, which legitimately renders an empty `translations` array. Picking
    // an arbitrary group member (as this used to) made the assertion below flaky: it passed or failed
    // depending on which group `findFirst` happened to return, not on any real behavior. Group by
    // translationGroupId first and only exercise a group with an actual sibling to check.
    const groups = await prisma.article.groupBy({
      by: ['translationGroupId'],
      where: { status: 'PUBLISHED', translationGroupId: { not: null } },
      _count: { _all: true },
      having: { translationGroupId: { _count: { gt: 1 } } },
    });
    const translated = groups.length
      ? await prisma.article.findFirst({ where: { status: 'PUBLISHED', translationGroupId: groups[0].translationGroupId }, select: { slug: true } })
      : null;
    if (translated) {
      const translatedResponse = await get(`/public/articles/${translated.slug}`);
      expect(translatedResponse.body.translations.length).toBeGreaterThan(0);
      expectNoPrivateFields(translatedResponse.body.translations);
    }
  }, 60_000);
});
